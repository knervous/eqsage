import zlib from 'pako';
import { Buffer } from 'buffer';
import { TypedArrayReader } from '../util/typed-array-reader';
import { imageProcessor } from '../util/image/image-processor';
import { Accessor, Document, WebIO } from '@gltf-transform/core';
import { gameController } from '../../viewer/controllers/GameController';
import { mat4 } from 'gl-matrix';
import { Zone, ZoneData } from './zone/zone';
import { Model } from './model/model';
import { getEQFile, writeEQFile } from '../util/fileHandler';
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
    const images = [];
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
        images.push({ name: fileName, data: f.data.buffer });
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
    await imageProcessor.parseImages(images, this.#fileHandle.rootFileHandle);
    console.log('Done processing images');
  }

  async exportv4() {

  }

  async export() {
    if (this.zone.header.version === 4) {
      return this.exportv4();
    }
    const io = new WebIO();
    const document = new Document();
    const buffer = document.createBuffer();
    if (!this.zone) {
      console.warn('No zone', this);
      return;
    }
    const scene = document.createScene(this.zone.name);
    const flipMatrix = mat4.create();
    mat4.scale(flipMatrix, flipMatrix, [-1, 1, 1]);
    const node = document
      .createNode(`zone-${this.zone.name.replace('.zon', '')}`)
      .setTranslation([0, 0, 0])
      .setMatrix(flipMatrix);
    scene.addChild(node);

    const zoneMetadata = {
      objects: {},
      lights : [],
      music  : [],
      sound2d: [],
      sound3d: [],
      regions: [],
    };
    // Object Instances
    // const objWld = this.wldFiles.find((f) => f.type === WldType.ZoneObjects);
    // if (objWld) {
    //   const actorInstances = objWld.actors;
    //   for (const actor of actorInstances) {
    //     const entry = {
    //       y      : actor.location.z,
    //       z      : actor.location.y,
    //       x      : actor.location.x,
    //       rotateX: actor.location.rotateX,
    //       rotateY: actor.location.rotateY,
    //       rotateZ: actor.location.rotateZ,
    //       scale  : actor.scaleFactor,
    //     };
    //     if (!zoneMetadata.objects[actor.objectName]) {
    //       zoneMetadata.objects[actor.objectName] = [entry];
    //     } else {
    //       zoneMetadata.objects[actor.objectName].push(entry);
    //     }
    //   }
    // }


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
          if (
            prop.name.includes('Diffuse') ||
            (prop.name.includes('Detail') &&
              !gltfMaterial.getBaseColorTexture())
          ) {
            gltfMaterial.setBaseColorTexture(texture);
          }
        }

        gltfMaterial.setAlphaMode('OPAQUE');

        // Check shaders
        materials[mat.name] = gltfMaterial;
        matIndices[mat.name] = {};
      }
    }

    const terrain = this.zone.terrain;

    for (const pg of terrain.placeableGroups) {
      const writtenModels = {};
      for (const p of pg.placeables) {
        let modelFile = p.modelFile.toLowerCase();
        const mod =
          this.models[modelFile] ||
          this.models[`${modelFile}.mod`];
        modelFile = modelFile.replace('.mod', '');
        if (!mod) {
          continue;
        }
        if (!mod?.name.includes('ter_')) {
          const entry = {
            y      : p.z,
            z      : p.y,
            x      : p.x,
            rotateX: 0, // p.rotateX * -1,
            rotateY: p.rotateX,
            rotateZ: p.rotateZ,
            scale  : p.scaleY,
          };
          if (!zoneMetadata.objects[modelFile]) {
            zoneMetadata.objects[modelFile] = [entry];
          } else {
            zoneMetadata.objects[modelFile].push(entry);
          }

          if (writtenModels[p.modelFile.toLowerCase()]) {
            continue;
          }
          writtenModels[p.modelFile.toLowerCase()] = true;
          const document = new Document();
          const objectName = mod.name.replace('.mod', '');
          const buffer = document.createBuffer();
          const scene = document.createScene(objectName);
          const flipMatrix = mat4.create();
          mat4.scale(flipMatrix, flipMatrix, [-1, 1, 1]);
          const node = document
            .createNode(objectName)
            .setTranslation([0, 0, 0])
            .setMatrix(flipMatrix);
          scene.addChild(node);
          const materials = {};
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
                // .setImage(new Uint8Array(await getEQFile('textures', `${name}.png`)))
                .setURI(`/eq/textures/${name}`)
                .setExtras({
                  name,
                });
              if (prop.name.includes('Normal')) {
                gltfMaterial.setNormalTexture(texture);
              }
              if (
                prop.name.includes('Diffuse') ||
                (prop.name.includes('Detail') &&
                  !gltfMaterial.getBaseColorTexture())
              ) {
                gltfMaterial.setBaseColorTexture(texture);
              }
            }
    
            gltfMaterial.setAlphaMode('OPAQUE');
    
            // Check shaders
            materials[mat.name] = gltfMaterial;
            matIndices[mat.name] = {};
          }
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
              const mesh = document.createMesh(mat.name);
              const materialNode = document.createNode(mat.name).setMesh(mesh);
              node.addChild(materialNode);
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
              mesh.addPrimitive(sharedPrimitive.gltfPrim);
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
          }
          const bytes = await io.writeBinary(document);
          await writeEQFile('objects', `${modelFile}.glb`, bytes.buffer);

          continue;
        }
        if (mod) {
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
              const mesh = document.createMesh(mat.name);
              const materialNode = document.createNode(mat.name).setMesh(mesh);
              node.addChild(materialNode);
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
              mesh.addPrimitive(sharedPrimitive.gltfPrim);
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
          }

        } else {
          console.warn('Did not find model for placeable', p);
        }
      }
    }

    // Object instances
    await writeEQFile(
      'zones',
          `${this.zone.name.replace('.zon', '.json')}`,
          JSON.stringify(zoneMetadata)
    );
    const bytes = await io.writeBinary(document);
    const zoneName = `${this.zone.name.replace('.zon', '.glb')}`;
    await writeEQFile('zones', zoneName, bytes.buffer);
  }

  async process() {
    console.log('process', this.#fileHandle.name);
    imageProcessor.initializeWorkers();
    const micro = performance.now();

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
        case 'zon':
          this.zone = new Zone(new Uint8Array(await file.arrayBuffer()), this.#fileHandle, file.name, []);
          break;
        default:
          console.warn(
            `Unhandled extension for ${this.#fileHandle.name} :: ${extension}`
          );
      }
    }
    console.log(`Took ${((performance.now() - micro) / 1000).toFixed(4)} seconds.`);
    imageProcessor.clearWorkers();
  }
}
