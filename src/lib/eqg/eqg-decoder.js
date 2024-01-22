import zlib from 'pako';
import { Buffer } from 'buffer';
import { Wld, WldType } from '../s3d/wld/wld';
import { TypedArrayReader } from '../util/typed-array-reader';
import { imageProcessor } from '../util/image/image-processor';
import { Accessor, WebIO, Writer } from '@gltf-transform/core';
import { weld } from '@gltf-transform/functions';
import { gameController } from '../../viewer/controllers/GameController';
import { mat4, vec3 } from 'gl-matrix';
import { ShaderType } from '../s3d/materials/material';
import { Zone, ZoneData } from './zone/zone';
import { Geometry, Model, Polygon } from './model/model';
// import { KHRTextureTransform } from '@gltf-transform/extensions';

function chunkArray(array, chunkSize) {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export class EQGDecoder {
  /** @type {import('../model/file-handle').EQFileHandle} */
  #fileHandle = null;

  /**
   * @type {Zone}
   */
  zone = null;

  /**
   * @type {Object.<string, import('./model/model').Model>}
   */
  models = {};

  /**
   * @type {ZoneData}
   */
  zoneData = null;

  #imageProcessingPromises = [];

  constructor(fileHandle) {
    this.#fileHandle = fileHandle;
  }

  /**
   *
   * @param {FileSystemHandle} file
   */
  async processEQG(file) {
    console.log('handle eqg', file.name);
    const arrayBuffer = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    if (buf.length === 0) {
      return;
    }
    const reader = new TypedArrayReader(arrayBuffer);
    const offset = reader.readUint32();
    reader.setCursor(offset);
    const fileList = [];
    const count = reader.readUint32();
    let directory = null;
    for (let i = 0; i < count; i++) {
      reader.setCursor(offset + 4 + i * 12);
      const crc = reader.readUint32();
      const fileOffset = reader.readUint32();
      const size = reader.readUint32();
      const data = Buffer.alloc(size);
      let writeCursor = 0;
      reader.setCursor(fileOffset);
      while (writeCursor < size) {
        const deflen = reader.readUint32();
        const inflen = reader.readUint32();
        const inflated = Buffer.from(
          zlib.inflate(
            buf.slice(reader.getCursor(), reader.getCursor() + deflen)
          )
        );
        if (inflated.length !== inflen) {
          throw new Error('ZLib Decompression failed');
        }
        inflated.copy(data, writeCursor);
        reader.setCursor(reader.getCursor() + deflen);
        writeCursor += inflen;
      }
      if (crc === 0x61580ac9) {
        directory = data;
      } else {
        fileList.push({ fileOffset, data });
      }
    }
    fileList.sort((a, b) => a.fileOffset - b.fileOffset);

    const dirBufferReader = new TypedArrayReader(directory.buffer);
    const _dirlen = dirBufferReader.readUint32();

    this.files = {};
    // Preprocess
    for (const f of fileList) {
      const fileName = dirBufferReader.readString(dirBufferReader.readUint32());
      this.files[fileName] = f.data;

      if (fileName.endsWith('.zon')) {
        this.zone = new Zone(f.data, this.#fileHandle, fileName, this.files);
      }

      if (fileName.endsWith('.mod') || fileName.endsWith('.ter')) {
        const model = new Model(f.data, this.#fileHandle, fileName);
        this.models[model.name] = model;
      }

      if (fileName.endsWith('.bmp') || fileName.endsWith('.dds')) {
        console.log('Img', fileName);
        this.#imageProcessingPromises.push(
          imageProcessor.parseTexture(fileName, f.data.buffer)
        );
        continue;
      }
    }

    // Post process
    for (const [key, data] of Object.entries(this.files)) {
      if (key.endsWith('.dat')) {
        switch (key) {
          case 'water.dat':
            break;
          case 'floraexclusion.dat':
            break;
          case 'invw.dat':
            break;
          default:
            this.zoneData = new ZoneData(
              data,
              this.#fileHandle,
              key,
              this.zone,
              this.models
            );
            break;
        }
      }
    }
    console.log(`Processed :: ${file.name}`);
    await Promise.all(this.#imageProcessingPromises);
    console.log('Done processing images');
    console.log(this);
  }

  async export() {
    const document = this.#fileHandle.zoneGltf;
    const buffer = document.createBuffer();

    const scene = document.createScene(this.zone.name);
    document.createPrimitive().setAttribute();

    const materials = {};
    const matIndices = {};
    for (const [key, mod] of Object.entries(this.models)) {
      for (const mat of mod.geometry.mats) {
        if (materials[mat.name]) {
          continue;
        }

        const gltfMaterial = document
          .createMaterial(mat.name)
          .setDoubleSided(false)
          .setExtension('KHR_materials_unlit')
          .setRoughnessFactor(0)
          .setMetallicFactor(0);

        for (const prop of mat.properties) {
          const [name] = prop.valueS.toLowerCase().split('.');
          const texture = document
            .createTexture(name)
            .setURI(`/eq/textures/${name}`)
            .setExtras({
              name,
            });
          if (prop.name.includes('Normal')) {
            gltfMaterial.setNormalTexture(texture);
          }
          if (prop.name.includes('Diffuse') || (prop.name.includes('Detail') && !gltfMaterial.getBaseColorTexture())) {
            gltfMaterial.setBaseColorTexture(texture);
          }
        }

        gltfMaterial.setAlphaMode('OPAQUE');

        // Check shaders
        materials[mat.name] = gltfMaterial;
        matIndices[mat.name] = {};
      }
    }

    const flipMatrix = mat4.create();
    mat4.scale(flipMatrix, flipMatrix, [-1, 1, 1]);
    const terrain = this.zone.terrain;

    for (const pg of terrain.placeableGroups) {
      for (const p of pg.placeables) {
        const mod =
          this.models[p.modelFile.toLowerCase()] ||
          this.models[`${p.modelFile.toLowerCase()}.mod`];
        if (!mod?.name.includes('ter_')) {
          continue;
        }
        if (mod) {
          const gltfMesh = document.createMesh(mod.name);

          const primitiveMap = {};
          for (const p of mod.geometry.polys) {
            if (p.material === -1) {
              continue;
            }
            const mat = mod.geometry.mats[p.material];
            const linkedMat = materials[mat.name];
            if (!linkedMat) {
              console.warn(`Linked mat not found! ${mat.name}`);
              continue;
            }
            const v1 = mod.geometry.verts[p.verts[0]];
            const v2 = mod.geometry.verts[p.verts[1]];
            const v3 = mod.geometry.verts[p.verts[2]];

            let sharedPrimitive = primitiveMap[mat.name];
            if (!sharedPrimitive) {
              sharedPrimitive = primitiveMap[mat.name] = {
                gltfPrim: document
                  .createPrimitive()
                  .setMaterial(linkedMat)
                  .setName(mat.name),
                indices: [],
                vecs   : [],
                normals: [],
                uv     : [],
              };
            }
            const ln = sharedPrimitive.indices.length;
            sharedPrimitive.indices.push(ln + 0, ln + 1, ln + 2);
            sharedPrimitive.vecs.push(
              ...[v1, v2, v3].flatMap((v) => [v.pos[0], v.pos[2], v.pos[1]])
            );
            sharedPrimitive.normals.push(
              ...[v1, v2, v3].flatMap((v) => [v.nor[0], v.nor[2], v.nor[1]])
            );
            sharedPrimitive.uv.push(
              ...[v1, v2, v3].flatMap((v) => [v.tex[0], v.tex[1]])
            );
          }

          for (const { gltfPrim, indices, vecs, normals, uv } of Object.values(
            primitiveMap
          )) {
            const idc = new Uint16Array(indices);
            for (let i = 0; i < indices.length; i += 3) {
              idc[i] = indices[i];
              idc[i + 1] = indices[i + 2];
              idc[i + 2] = indices[i + 1];
            }

            const primIndices = document
              .createAccessor()
              .setType(Accessor.Type.SCALAR)
              .setArray(idc)
              .setBuffer(buffer);
            const primPositions = document
              .createAccessor()
              .setType(Accessor.Type.VEC3)
              .setArray(new Float32Array(vecs))
              .setBuffer(buffer);
            const primNormals = document
              .createAccessor()
              .setArray(new Float32Array(normals))
              .setType(Accessor.Type.VEC3);

            const primUv = document
              .createAccessor()
              .setType(Accessor.Type.VEC2)
              .setArray(new Float32Array(uv));

            gltfPrim
              .setIndices(primIndices)
              .setAttribute('POSITION', primPositions)
              .setAttribute('NORMAL', primNormals)
              .setAttribute('TEXCOORD_0', primUv);
            gltfMesh.addPrimitive(gltfPrim);
          }

          const node = document
            .createNode(`node-${mod.name}`)
            .setMesh(gltfMesh)
            .setTranslation([0, 0, 0])
            .setMatrix(flipMatrix);
          scene.addChild(node);
        } else {
          console.warn('Did not find model for placeable', p);
        }
      }
    }

    console.log('Doc', document);

    const io = new WebIO();

    const bytes = await io.writeBinary(document);
    window.bytes = bytes.buffer; // await new Blob([bytes], { type: 'application/octet-stream' }).arrayBuffer();// bytes;
    await gameController.loadModel(bytes);
  }

  async process() {
    console.log('process', this.#fileHandle.name);
    for (const file of this.#fileHandle.fileHandles) {
      const extension = file.name.split('.').pop();

      switch (extension) {
        case 'eqg':
          await this.processEQG(file);
          break;
        case 'txt':
          break;
        case 'eff':
          break;
        case 'xmi':
          break;

        case 'emt':
          break;
        default:
          console.warn(
            `Unhandled extension for ${this.#fileHandle.name} :: ${extension}`
          );
      }
    }
  }
}
