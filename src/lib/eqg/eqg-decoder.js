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
          if (prop.name.includes('Diffuse')) {
            gltfMaterial.setBaseColorTexture(texture);
          }
        }

        gltfMaterial.setAlphaMode('OPAQUE');

        // Check shaders
        materials[mat.name] = gltfMaterial;
        matIndices[mat.name] = {};
      }
    }
    // const grayMaterial = document
    //   .createMaterial('GrayMaterial')
    //   .setBaseColorFactor([0.5, 0.5, 0.5, 1]); // RGB color values with alpha
    const grayMaterial = Object.values(materials)[0];
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

          /**
           *
           * @param {[Polygon]} polys
           * @param {*} idx
           */
          const createMeshSlice = (polys, idx) => {
            const gltfMesh = document.createMesh(mod.name);
            const gltfMeshNonColl = document.createMesh(`${mod.name}-non-coll`);
            const collVerts = [];
            const collNormals = [];
            const collUvs = [];
            const collIndices = [];
            const collIdxMap = {};
            let currentCollIdx = 0;

            const nonCollVerts = [];
            const nonCollNormals = [];
            const nonCollUvs = [];
            const nonCollIndices = [];
            const nonCollIdxMap = {};
            let currentNonCollIdx = 0;

            for (const p of polys) {
              if (p.material === -1) {
                continue;
              }

              const v1 = mod.geometry.verts[p.verts[0]];
              const v2 = mod.geometry.verts[p.verts[1]];
              const v3 = mod.geometry.verts[p.verts[2]];

              const v1Str = `${v1.pos[0]},${v1.pos[1]},${v1.pos[2]}`;
              const v2Str = `${v2.pos[0]},${v2.pos[1]},${v2.pos[2]}`;
              const v3Str = `${v3.pos[0]},${v3.pos[1]},${v3.pos[2]}`;
              if (p.flags & 0x01) {
                // Not collidable

                if (!nonCollIdxMap.hasOwnProperty(v1Str)) {
                  nonCollIdxMap[v1Str] = currentNonCollIdx;
                  nonCollVerts.push(v1.pos);
                  nonCollNormals.push(v1.nor);
                  nonCollUvs.push(v1.tex);
                  nonCollIndices.push(currentNonCollIdx);
                  ++currentNonCollIdx;
                } else {
                  nonCollIndices.push(nonCollIdxMap[v1Str]);
                }
                if (!nonCollIdxMap.hasOwnProperty(v2Str)) {
                  nonCollIdxMap[v2Str] = currentNonCollIdx;
                  nonCollVerts.push(v2.pos);
                  nonCollNormals.push(v2.nor);
                  nonCollUvs.push(v2.tex);
                  nonCollIndices.push(currentNonCollIdx);
                  ++currentNonCollIdx;
                } else {
                  nonCollIndices.push(nonCollIdxMap[v2Str]);
                }
                if (!nonCollIdxMap.hasOwnProperty(v3Str)) {
                  nonCollIdxMap[v3Str] = currentNonCollIdx;
                  nonCollVerts.push(v3.pos);
                  nonCollNormals.push(v3.nor);
                  nonCollUvs.push(v3.tex);
                  nonCollIndices.push(currentNonCollIdx);
                  ++currentNonCollIdx;
                } else {
                  nonCollIndices.push(nonCollIdxMap[v3Str]);
                }
              } else {
                // Collidable
                if (!collIdxMap.hasOwnProperty(v1Str)) {
                  collIdxMap[v1Str] = currentCollIdx;
                  collVerts.push(v1.pos);
                  collNormals.push(v1.nor);
                  collUvs.push(v1.tex);
                  collIndices.push(currentCollIdx);
                  ++currentCollIdx;
                } else {
                  collIndices.push(collIdxMap[v1Str]);
                }

                if (!collIdxMap.hasOwnProperty(v2Str)) {
                  collIdxMap[v2Str] = currentCollIdx;
                  collVerts.push(v2.pos);
                  collNormals.push(v2.nor);
                  collUvs.push(v2.tex);
                  collIndices.push(currentCollIdx);
                  ++currentCollIdx;
                } else {
                  collIndices.push(collIdxMap[v2Str]);
                }

                if (!collIdxMap.hasOwnProperty(v3Str)) {
                  collIdxMap[v3Str] = currentCollIdx;
                  collVerts.push(v3.pos);
                  collNormals.push(v3.nor);
                  collUvs.push(v3.tex);
                  collIndices.push(currentCollIdx);
                  ++currentCollIdx;
                } else {
                  collIndices.push(collIdxMap[v3Str]);
                }
              }
            }

            const position = document
              .createAccessor()
              .setType(Accessor.Type.VEC3)
              .setArray(
                new Float32Array(collVerts.flatMap((v) => [v[0], v[2], v[1]]))
              )
              .setBuffer(buffer);
            const idc = new Uint16Array(collIndices);
            for (let i = 0; i < collIndices.length; i += 3) {
              idc[i] = collIndices[i];
              idc[i + 1] = collIndices[i + 2];
              idc[i + 2] = collIndices[i + 1];
            }

            const indices = document
              .createAccessor()
              .setType(Accessor.Type.SCALAR)
              .setArray(idc)
              .setBuffer(buffer);
            const normals = document
              .createAccessor()
              .setArray(
                new Float32Array(
                  collNormals.flatMap((v) => [v[0] * 1, v[2], v[1]])
                )
              )
              .setType(Accessor.Type.VEC3);

            const uv = document
              .createAccessor()
              .setType(Accessor.Type.VEC2)
              .setArray(new Float32Array(collUvs.flatMap((v) => [v[0], v[1]])));

            const prim = document
              .createPrimitive()
              .setName('coll')
              .setIndices(indices)
              .setAttribute('POSITION', position)
              .setAttribute('NORMAL', normals)
              .setAttribute('TEXCOORD_0', uv);

            const nonCollPosition = document
              .createAccessor()
              .setType(Accessor.Type.VEC3)
              .setArray(
                new Float32Array(
                  nonCollVerts.flatMap((v) => [v[0], v[2], v[1]])
                )
              )
              .setBuffer(buffer);

            const nonCollIndicesAccessor = document
              .createAccessor()
              .setType(Accessor.Type.SCALAR)
              .setArray(new Uint16Array(nonCollIndices))
              .setBuffer(buffer);

            const nonCollPrim = document
              .createPrimitive()
              .setIndices(nonCollIndicesAccessor)
              .setName('non-coll')
              .setAttribute('POSITION', nonCollPosition);

            nonCollPrim.setMaterial(grayMaterial);
            // gltfMesh.addPrimitive(nonCollPrim);

            prim.setMaterial(grayMaterial);
            gltfMesh.addPrimitive(prim);

            gltfMeshNonColl.addPrimitive(nonCollPrim);

            const node = document
              .createNode(`node-${mod.name}-${idx}`)
              .setMesh(gltfMesh)
              .setTranslation([0, 0, 0])
              .setMatrix(flipMatrix);
            scene.addChild(node);

            // const nodeNonColl = document
            //   .createNode(`node-${mod.name}-non-coll-${idx}`)
            //   .setMesh(gltfMeshNonColl)
            //   .setTranslation([0, 0, 0]);

            // scene.addChild(nodeNonColl);
          };

          // const polyChunks = chunkArray(mod.geometry.polys, 50000);
          // let idx = 0;
          // for (const polys of polyChunks) {
          //   createMeshSlice(polys, idx++);
          // }

          // Try with mats
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
