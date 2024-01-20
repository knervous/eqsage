import zlib from 'pako';
import { Buffer } from 'buffer';
import { Wld, WldType } from '../s3d/wld/wld';
import { TypedArrayReader } from '../util/typed-array-reader';
import { imageProcessor } from '../util/image/image-processor';
import { Accessor, WebIO, Writer } from '@gltf-transform/core';
import {} from '@gltf-transform/functions';
import { gameController } from '../../viewer/controllers/GameController';
import { mat4, vec3 } from 'gl-matrix';
import { ShaderType } from '../s3d/materials/material';
import { Zone, ZoneData } from './zone/zone';
import { Model } from './model/model';
// import { KHRTextureTransform } from '@gltf-transform/extensions';

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
    for (const [key, mod] of Object.entries(this.models)) {
      for (const mat of mod.geometry.mats) {
      }
    }
    const grayMaterial = document
      .createMaterial('GrayMaterial')
      .setBaseColorFactor([0.5, 0.5, 0.5, 1]); // RGB color values with alpha
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


          const collVerts = [];
          const collIndices = [];
          const collIdxMap = {};
          let currentCollIdx = 0;

          const nonCollVerts = [];
          const nonCollIndices = [];
          const nonCollIdxMap = {};
          let currentNonCollIdx = 0;

          for (const p of mod.geometry.polys) {
            if (p.material === -1) {
              // continue;
            }
            const v1 = mod.geometry.verts[p.verts[0]].pos;
            const v2 = mod.geometry.verts[p.verts[1]].pos;
            const v3 = mod.geometry.verts[p.verts[2]].pos;
            const v1Str = `${v1[0]}${v1[1]}${v1[2]}`;
            const v2Str = `${v2[0]}${v2[1]}${v2[2]}`;
            const v3Str = `${v3[0]}${v3[1]}${v3[2]}`;
            if (p.flags & 0x01) {
              // Not collidable

              if (!nonCollIdxMap[v1Str]) {
                nonCollIdxMap[v1Str] = currentNonCollIdx;
                nonCollVerts.push(v1);
                nonCollIndices.push(currentNonCollIdx);
                ++currentNonCollIdx;
              } else {
                nonCollIndices.push(nonCollIdxMap[v1Str]);
              }
              if (!nonCollIdxMap[v2Str]) {
                nonCollIdxMap[v2Str] = currentNonCollIdx;
                nonCollVerts.push(v2);
                nonCollIndices.push(currentNonCollIdx);
                ++currentNonCollIdx;
              } else {
                nonCollIndices.push(nonCollIdxMap[v2Str]);
              }
              if (!nonCollIdxMap[v3Str]) {
                nonCollIdxMap[v3Str] = currentNonCollIdx;
                nonCollVerts.push(v3);
                nonCollIndices.push(currentNonCollIdx);
                ++currentNonCollIdx;
              } else {
                nonCollIndices.push(nonCollIdxMap[v3Str]);
              }
            } else {
              // Collidable
              if (!collIdxMap[v1Str]) {
                collIdxMap[v1Str] = currentCollIdx;
                collVerts.push(v1);
                collIndices.push(currentCollIdx);
                ++currentCollIdx;
              } else {
                collIndices.push(collIdxMap[v1Str]);
              }

              if (!collIdxMap[v2Str]) {
                collIdxMap[v2Str] = currentCollIdx;
                collVerts.push(v2);
                collIndices.push(currentCollIdx);
                ++currentCollIdx;
              } else {
                collIndices.push(collIdxMap[v2Str]);
              }

              if (!collIdxMap[v3Str]) {
                collIdxMap[v3Str] = currentCollIdx;
                collVerts.push(v3);
                collIndices.push(currentCollIdx);
                ++currentCollIdx;
              } else {
                collIndices.push(collIdxMap[v3Str]);
              }
            }
          }

          const verts = nonCollVerts.concat(collVerts);
          const inds = nonCollIndices.concat(collIndices);

          const meshVertices = new Float32Array(
            collVerts.flatMap((v) => [v[0], v[2], v[1]])
          );

          const meshIndices = new Uint16Array(
            collIndices
          );

          const meshNormals = new Float32Array(
            mod.geometry.verts.flatMap((v) => [
              v.nor[0] * -1,
              v.nor[2],
              v.nor[1],
            ])
          );

          const meshUvMap = new Float32Array(
            mod.geometry.verts.flatMap((v) => [v.tex[0], v.tex[1]])
          );

          const position = document
            .createAccessor()
            .setType(Accessor.Type.VEC3)
            .setArray(meshVertices);
          const indices = document
            .createAccessor()
            .setType(Accessor.Type.SCALAR)
            .setArray(meshIndices);
          const normals = document
            .createAccessor()
            .setType(Accessor.Type.VEC3)
            .setArray(meshNormals);
          const uv = document
            .createAccessor()
            .setType(Accessor.Type.VEC2)
            .setArray(meshUvMap);
          const prim = document
            .createPrimitive()
            .setIndices(indices)
            .setAttribute('POSITION', position);
          //    .setAttribute('NORMAL', normals)
          //  .setAttribute('TEXCOORD_0', uv);
          prim.setMaterial(grayMaterial);
          gltfMesh.addPrimitive(prim);
          const node = document
            .createNode(`node-${mod.name}`)
            .setMesh(gltfMesh)
            .setTranslation([0, 0, 0]);
          // .setMatrix(flipMatrix);
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
