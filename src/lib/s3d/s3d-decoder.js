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
    const images = [];
    // Preprocess images 
    for (const f of fileList) {
      const fileName = dirBufferReader.readString(dirBufferReader.readUint32());
      this.files[fileName] = f.data;

      if (fileName.endsWith('.wld')) {
        console.log(`Processing WLD file :: ${fileName}`);
        this.#wld.push(new Wld(f.data, this.#fileHandle, fileName));
      }

      if (fileName.endsWith('.bmp') || fileName.endsWith('.dds')) {
        images.push({ name: fileName, data: f.data.buffer });
        continue;
      }
    }
    console.log(`Processed :: ${file.name}`);
    await imageProcessor.parseImages(images, this.#fileHandle.rootFileHandle);
    console.log(`Done processing images ${file.name} :: ${ images.length}`);
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

    const materials = {};
    for (const material of wld.materialList) {
      material.materialList.forEach((eqMaterial) => {
        if (materials[eqMaterial.name]) {
          return;
        }
        const [name] = eqMaterial.name.toLowerCase().split('_');

        const gltfMaterial = document
          .createMaterial(name)
          .setDoubleSided(false)
          .setExtension('KHR_materials_unlit')
          .setRoughnessFactor(0)
          .setMetallicFactor(0);
        const texture = document
          .createTexture(name)
          .setURI(`/eq/textures/${name}`)
          .setExtras({
            name,
          })
          .setMimeType();
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
    const gltfMesh = document.createMesh(wld.name);
    const primitiveMap = {};
    for (const mesh of wld.meshes) {
      if (mesh.exportSeparateCollision) {
        // continue;
      }
      let polygonIndex = 0;
      for (const mat of mesh.materialGroups) {
        const name = mesh.materialList.materialList[mat.materialIndex].name;
        const gltfMat = materials[name];
        if (!gltfMat) {
          console.warn(`S3D model had no material link ${name}`);
          continue;
        }
        let sharedPrimitive = primitiveMap[name];
        if (!sharedPrimitive) {
          sharedPrimitive = primitiveMap[name] = {
            gltfPrim: document
              .createPrimitive(name)
              .setMaterial(gltfMat)
              .setName(name),
            indices     : [],
            vecs        : [],
            normals     : [],
            uv          : [],
            polygonCount: 0,
          };
        }

        for (let i = 0; i < mat.polygonCount; i++) {
          const idc = mesh.indices[polygonIndex];
          const idxArr = [idc.v1, idc.v2, idc.v3];
          const [v1, v2, v3] = idxArr.map((idx) => mesh.vertices[idx]);
          const [n1, n2, n3] = idxArr.map((idx) => mesh.normals[idx]);
          const [u1, u2, u3] = idxArr.map(
            (idx) => mesh.textureUvCoordinates[idx]
          );

          const { vecs, normals, uv } = sharedPrimitive;
          const ln = sharedPrimitive.indices.length;
          const newIndices = [ln + 0, ln + 1, ln + 2];
          sharedPrimitive.indices.push(...newIndices);

          vecs.push(
            ...[v1, v2, v3].flatMap((v) => [
              v[0] + mesh.center[0],
              v[2] + mesh.center[2],
              v[1] + mesh.center[1],
            ])
          );
          normals.push(...[n1, n2, n3].flatMap((v) => [v[0] * -1, v[2], v[1]]));
          uv.push(...[u1, u2, u3].flatMap((v) => [v[0], v[1]]));
          polygonIndex++;
        }
      }
    }
    for (const [
      name,
      { gltfPrim, indices, vecs, normals, uv },
    ] of Object.entries(primitiveMap)) {
      const primIndices = document
        .createAccessor()
        .setType(Accessor.Type.SCALAR)
        .setArray(new Uint16Array(indices))
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
        .setName(name)
        .setIndices(primIndices)
        .setAttribute('POSITION', primPositions)
        .setAttribute('NORMAL', primNormals)
        .setAttribute('TEXCOORD_0', primUv);
      gltfMesh.addPrimitive(gltfPrim);
    }

    const node = document
      .createNode(`zone-${wld.name}`)
      .setMesh(gltfMesh)
      .setTranslation([0, 0, 0])
      .setMatrix(flipMatrix);
    scene.addChild(node);

    const io = new WebIO();
    const bytes = await io.writeBinary(document);
    await gameController.loadModel(wld.name, bytes.buffer);
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
    imageProcessor.initializeWorkers();
    const micro = performance.now();
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
    console.log(`Took ${((performance.now() - micro) / 1000).toFixed(4)} seconds.`);
    imageProcessor.clearWorkers();
  }
}
