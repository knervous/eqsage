import zlib from 'pako';
import { Buffer } from 'buffer';
import { Wld, WldType } from './wld/wld';
import { TypedArrayReader } from '../util/typed-array-reader';
import { imageProcessor } from '../util/image/image-processor';
import { Accessor, WebIO, Writer } from '@gltf-transform/core';
import {} from '@gltf-transform/functions';
import { gameController } from '../../viewer/controllers/GameController';
import { mat4, vec3 } from 'gl-matrix';
import { ShaderType } from './materials/material';
// import { KHRTextureTransform } from '@gltf-transform/extensions';

export class S3DDecoder {
  /** @type {import('../model/file-handle').EQFileHandle} */
  #fileHandle = null;

  /**
   * @type {Wld}
   */
  #wld = [];

  #imageProcessingPromises = [];

  constructor(fileHandle) {
    this.#fileHandle = fileHandle;
  }

  /**
   *
   * @param {FileSystemHandle} file
   */
  async processS3D(file) {
    console.log('handle s3d', file.name);
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
    for (const f of fileList) {
      const fileName = dirBufferReader.readString(dirBufferReader.readUint32());
      this.files[fileName] = f.data;

      if (fileName.endsWith('.wld')) {
        console.log(`Processing WLD file :: ${fileName}`);
        this.#wld.push(new Wld(f.data, this.#fileHandle, fileName));
      }

      if (fileName.endsWith('.bmp') || fileName.endsWith('.dds')) {
        this.#imageProcessingPromises.push(
          imageProcessor.parseTexture(fileName, f.data.buffer)
        );
        continue;
      }
    }
    console.log(`Processed :: ${file.name}`);
    await Promise.all(this.#imageProcessingPromises);
    console.log('Done processing images');
  }

  /**
   *
   * @param {Wld} wld
   */
  async exportZone(wld) {
    const document = this.#fileHandle.zoneGltf;
    const buffer = document.createBuffer();
    const scene = document.createScene(wld.name);
    document.createPrimitive().setAttribute();
    // for (const material of wld.materialList) {
    //   material.materialList[0].bitmapInfo.name
    // }
    const grayMaterial = document
      .createMaterial('GrayMaterial')
      .setBaseColorFactor([0.5, 0.5, 0.5, 1]); // RGB color values with alpha
    const materials = {};
    for (const material of wld.materialList) {
      material.materialList.forEach((eqMaterial) => {
        if (materials[eqMaterial.name]) {
          return;
        }
        const gltfMaterial = document
          .createMaterial(eqMaterial.name)
          .setDoubleSided(false)
          .setExtension('KHR_materials_unlit')
          .setRoughnessFactor(0)
          .setMetallicFactor(0);
        const texture = document
          .createTexture(eqMaterial.name)
          .setURI(`/eq/textures/${eqMaterial.name}`).setExtras({
            name: eqMaterial.name
          }).setMimeType();
        gltfMaterial.setBaseColorTexture(texture);
        switch (eqMaterial.shaderType) {
          case ShaderType.TransparentMasked:
            gltfMaterial.setAlpha(0.5).setAlphaMode('MASK');
            break;
          case ShaderType.Transparent25:
          case ShaderType.Transparent50:
          case ShaderType.Transparent75:
          case ShaderType.TransparentAdditive:
          case ShaderType.TransparentAdditiveUnlit:
          case ShaderType.TransparentSkydome:
          case ShaderType.TransparentAdditiveUnlitSkydome:
            gltfMaterial.setAlphaMode('BLEND');
            break;
          default:
            gltfMaterial.setAlphaMode('OPAQUE');
            break;
        }

        if (
          eqMaterial.ShaderType === ShaderType.TransparentAdditiveUnlit ||
          eqMaterial.ShaderType === ShaderType.DiffuseSkydome ||
          eqMaterial.ShaderType === ShaderType.TransparentAdditiveUnlitSkydome
        ) {
          // gltfMaterial.WithUnlitShader();
        }
        materials[eqMaterial.name] = gltfMaterial;
      });
    }
    const flipMatrix = mat4.create();
    mat4.scale(flipMatrix, flipMatrix, [-1, 1, 1]);
    for (const mesh of wld.meshes) {
      const gltfMesh = document.createMesh(mesh.name);

      if (mesh.exportSeparateCollision) {
        // continue;
      }
      const meshVertices = new Float32Array(
        mesh.vertices.flatMap((v) => [
          v[0] + mesh.center[0],
          v[2] + mesh.center[2],
          v[1] + mesh.center[1],
        ])
      );
      const meshIndices = new Uint16Array(
        mesh.indices.flatMap((i) => [i.v1, i.v2, i.v3])
      );
      const meshNormals = new Float32Array(
        mesh.normals.flatMap((v) => [v[0] * -1, v[2], v[1]])
      );
      const meshUvMap = new Float32Array(
        mesh.textureUvCoordinates.flatMap((v) => [v[0], v[1]])
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
        .setAttribute('POSITION', position)
        .setAttribute('NORMAL', normals)
        .setAttribute('TEXCOORD_0', uv);
      for (const mat of mesh.materialGroups) {
        const gltfMat = materials[mesh.materialList.materialList[mat.materialIndex].name];
        if (gltfMat) {
          prim.setMaterial(gltfMat);
        }
      }

      gltfMesh.addPrimitive(prim);
      const node = document
        .createNode(`node-${mesh.name}`)
        .setMesh(gltfMesh)
        .setTranslation([0, 0, 0])
        .setMatrix(flipMatrix);
      scene.addChild(node);

    }


         

    // .setScale([-1, 1, 1])
    
    
    console.log('Doc', document);

    const io = new WebIO();
    const bytes = await io.writeBinary(document);
    window.bytes = bytes.buffer; // await new Blob([bytes], { type: 'application/octet-stream' }).arrayBuffer();// bytes;
    await gameController.loadModel(bytes);
  }

  async export() {
    /**
     * Textures first
     */

    for (const wld of this.#wld) {
      switch (wld.type) {
        case WldType.Zone:
          this.exportZone(wld);
          break;
        case WldType.ZoneObjects:
          break;
        case WldType.Objects:
          break;
        case WldType.Characters:
          break;
        case WldType.Equipment:
          break;
        case WldType.Lights:
          break;
        case WldType.Sky:
          break;
        default:
          console.warn('Unknown type', wld.type);
          break;
      }
    }
  }

  async process() {
    console.log('process', this.#fileHandle.name);
    for (const file of this.#fileHandle.fileHandles) {
      const extension = file.name.split('.').pop();

      switch (extension) {
        case 's3d':
          await this.processS3D(file);
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