import zlib from 'pako';
import { Buffer } from 'buffer';
import { Wld, WldType } from './wld/wld';
import { TypedArrayReader } from '../util/typed-array-reader';
import { imageProcessor } from '../util/image/image-processor';
import { Accessor, WebIO } from '@gltf-transform/core';
import { mat4, quat, vec4 } from 'gl-matrix';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { Document } from '@gltf-transform/core';
import { draco, DRACO_DEFAULTS } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { ShaderType } from './materials/material';
import {
  getEQDir,
  getEQFile,
  getEQFileExists,
  writeEQFile,
} from '../util/fileHandler';
import { optimizeBoundingBoxes } from './bsp/region-utils';
import { VERSION } from '../model/file-handle';
import { fragmentNameCleaner } from '../util/util';
import { MeshExportHelper } from '../util/mesh-export-helper';
import {
  S3DAnimationWriter,
  animationMap,
  getSkeletonNameFromSkeleton,
} from '../util/animation-helper';
import { gameController } from '../../viewer/controllers/GameController';
import { GlobalStore } from '../../state';

const io = new WebIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

/**
 *
 * @param {[import('./materials/material-list').MaterialList]}
 * @param {Document} document
 */
const getMaterials = async (materialList, document, roughness = 0.0) => {
  const materials = {};
  for (const eqMaterial of materialList) {
    if (materials[eqMaterial.name]) {
      continue;
    }
    let [name] = eqMaterial.name.toLowerCase().split('_');

    if (/m\d+/.test(name) && eqMaterial.bitmapInfo?.reference) {
      name = eqMaterial.bitmapInfo.reference.bitmapNames[0].name;
    }
    const gltfMaterial = document
      .createMaterial()
      .setDoubleSided(false)
      .setRoughnessFactor(0)
      .setMetallicFactor(0)
      .setName(name);
    if (eqMaterial.bitmapInfo?.reference?.flags?.isAnimated) {
      name = eqMaterial.bitmapInfo.reference.bitmapNames[0].name;
      gltfMaterial.setName(name);
      gltfMaterial.setExtras({
        animationDelay: eqMaterial.bitmapInfo.reference.animationDelayMs,
        frames        : eqMaterial.bitmapInfo.reference.bitmapNames.map((m) =>
          m.name.toLowerCase()
        ),
      });
    }

    const texture = document
      .createTexture(name)
      // .setImage(new Uint8Array(await getEQFile('textures', `${name}.png`)))
      .setURI(`/eq/textures/${name}`)
      .setExtras({
        name,
      })
      .setMimeType('image/png');
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
      case ShaderType.Boundary:
        gltfMaterial.setAlphaMode('BLEND');
        gltfMaterial.setAlpha(0);
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
  }
  return materials;
};

export class S3DDecoder {
  /** @type {import('../model/file-handle').EQFileHandle} */
  #fileHandle = null;

  /**
   * @type {[Wld]}
   */
  wldFiles = [];

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
    const shaderMap = {};
    for (const f of fileList) {
      const fileName = dirBufferReader.readString(dirBufferReader.readUint32());
      this.files[fileName] = f.data;

      if (fileName.endsWith('.wld')) {
        console.log(`Processing WLD file - ${fileName}`);
        const wld = new Wld(f.data, fileName);
        for (const mat of wld.materialList.flatMap((ml) => ml.materialList)) {
          for (const bitmapName of mat.bitmapInfo?.reference?.bitmapNames ??
            []) {
            if (shaderMap[bitmapName.fileName.toLowerCase()]) {
              continue;
            }
            shaderMap[bitmapName.fileName.toLowerCase()] = mat.shaderType;
          }
        }
        this.wldFiles.push(wld);
      }

      if (fileName.endsWith('.bmp') || fileName.endsWith('.dds')) {
        images.push({ name: fileName, data: f.data.buffer });
        continue;
      }
    }

    // console.log('Files', Object.keys(this.files));

    for (const image of images) {
      image.shaderType = shaderMap[image.name];
    }
    console.log(`Processed - ${file.name}`);
    await imageProcessor.parseImages(images);
    console.log(`Done processing images ${file.name} - ${images.length}`);
  }

  /**
   *
   * @param {Wld} wld
   */
  async exportModels(wld, doExport = true) {
    for (const track of wld.tracks.filter(
      (t) => !t.isPoseAnimation && !t.isNameParsed
    )) {
      track.parseTrackData();
    }
    GlobalStore.actions.setLoadingTitle('Exporting models');

    const AnimationSources = {};
    for (const skeleton of wld.skeletons) {
      if (skeleton === null) {
        continue;
      }

      const modelBase = skeleton.modelBase;
      const alternateModel = AnimationSources.hasOwnProperty(modelBase)
        ? AnimationSources[modelBase]
        : modelBase;
      GlobalStore.actions.setLoadingText(`Exporting model ${modelBase}`);
      await new Promise((res) => setTimeout(res, 0));
      // TODO: Alternate model bases
      wld.tracks
        .filter(
          (t) => t.modelName === modelBase || t.modelName === alternateModel
        )
        .forEach((t) => skeleton.addTrackData(t));
      for (const mesh of wld.meshes) {
        if (mesh.isHandled) {
          continue;
        }

        let cleanedName = fragmentNameCleaner(mesh);

        let basename = cleanedName;

        const endsWithNumber = !isNaN(
          parseInt(cleanedName[cleanedName.length - 1])
        );

        if (endsWithNumber) {
          const id = cleanedName.slice(
            cleanedName.length - 2,
            cleanedName.length
          );
          cleanedName = cleanedName.slice(0, cleanedName.length - 2);

          if (cleanedName.length !== 3) {
            const modelType = cleanedName.slice(0, cleanedName.length - 3);
            cleanedName = cleanedName.slice(0, cleanedName.length - 2);
          }

          basename = cleanedName;
        }

        if (basename === modelBase) {
          skeleton.addAdditionalMesh(mesh);
        }
      }
    }

    for (const track of wld.tracks) {
      if (track.isPoseAnimation || track.isProcessed) {
        continue;
      }

      console.warn(`WldFileCharacters: Track not assigned: ${track.name}`);
    }

    for (const skeleton of wld.skeletons) {
      skeleton.buildSkeletonData(true);

      if (!doExport) {
        return;
      }
      for (const mesh of skeleton.meshes.concat(skeleton.secondaryMeshes)) {
        const material = mesh.materialList;
        const baseName = mesh.name.split('_')[0].toLowerCase();
        const scrubbedName = material.name.split('_')[0].toLowerCase();
        const document = new Document(scrubbedName);
        const buffer = document.createBuffer();
        const scene = document.createScene(scrubbedName);
        const secondary = /he\d+/.test(baseName);

        // Write skeleton data to json if we're a supplier of animations for other models
        if (!secondary && Object.values(animationMap).includes(baseName)) {
          if (!(await getEQFileExists('data', `${baseName}-animations.json`))) {
            GlobalStore.actions.setLoadingText(`Writing shared animations for ${baseName}`);
            await writeEQFile(
              'data',
              `${baseName}-animations.json`,
              JSON.stringify(skeleton.serializeAnimations())
            );
          }
        }

        // We need to map this to another skeleton supplied from those other models
        // e.g. ELM maps to a lot of different
        if (!secondary && animationMap[baseName]) {
          const existingSkeleton =
            wld.skeletons.find((s) => s.modelBase === animationMap[baseName]) ||
            this.globalWld?.skeletons.find(
              (s) => s.modelBase === animationMap[baseName]
            );
          const existingAnimations =
            existingSkeleton?.animations ??
            (await getEQFile('data', `${animationMap[baseName]}-animations.json`, 'json'));
          if (existingAnimations) {
            for (const [key, value] of Object.entries(existingAnimations)) {
              if (!skeleton.animations[key]) {
                skeleton.animations[key] = {
                  ...value,
                  animModelBase: baseName,
                };
              }
            }
          } else {
            console.warn(`Unmet dependency for animations for ${baseName}. Wanted {{ ${animationMap[baseName]} }}`);
          }
        
        }

        const node = document
          .createNode(scrubbedName)
          .setTranslation([0, 0, 0]);

        node.setExtras({ secondaryMeshes: skeleton.secondaryMeshes.length });

        scene.addChild(node);

        const materials = await getMaterials(material.materialList, document);

        const primitiveMap = {};

        let polygonIndex = 0;
        const gltfMesh = document.createMesh(baseName);

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
              gltfMesh: gltfMesh,
              gltfPrim: document
                .createPrimitive(name)
                .setMaterial(gltfMat)
                .setName(name),
              indices     : [],
              joints      : [],
              vecs        : [],
              normals     : [],
              uv          : [],
              polygonCount: 0,
            };
            gltfMesh.addPrimitive(sharedPrimitive.gltfPrim);
          }

          const getBoneIndexForVertex = (vertIndex) => {
            for (const [key, val] of Object.entries(mesh.mobPieces)) {
              if (val === undefined) {
                continue;
              }
              if (vertIndex >= val.start && vertIndex < val.start + val.count) {
                return +key;
              }
            }
            return 0;
          };
          for (let i = 0; i < mat.polygonCount; i++) {
            const idc = mesh.indices[polygonIndex];

            const idxArr = [idc.v1, idc.v2, idc.v3];

            const [b1, b2, b3] = idxArr.map((idx) =>
              getBoneIndexForVertex(idx)
            );
            const [v1, v2, v3] = idxArr.map((idx) => mesh.vertices[idx]);
            const [n1, n2, n3] = idxArr.map((idx) => mesh.normals[idx]);
            const [u1, u2, u3] = idxArr.map(
              (idx) => mesh.textureUvCoordinates[idx]
            );

            const { vecs, normals, uv } = sharedPrimitive;
            const ln = sharedPrimitive.indices.length;
            const newIndices = [ln + 0, ln + 1, ln + 2];
            sharedPrimitive.indices.push(...newIndices);
            // Joints are vec4
            const newJoints = [b1, 0, 0, 0, b2, 0, 0, 0, b3, 0, 0, 0];
            sharedPrimitive.joints.push(...newJoints);

            vecs.push(
              ...[v1, v2, v3].flatMap((v) => [
                -1 * (v[0] + mesh.center[0]),
                v[2] + mesh.center[2],
                v[1] + mesh.center[1],
              ])
            );
            normals.push(
              ...[n1, n2, n3].flatMap((v) => [v[0] * -1, v[2], v[1]])
            );
            uv.push(...[u1, u2, u3].flatMap((v) => [v[0], -1 * v[1]]));
            polygonIndex++;
          }
        }

        for (const [
          name,
          { gltfPrim, indices, vecs, normals, uv, joints },
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
          const primJoints = document
            .createAccessor()
            .setArray(new Uint16Array(joints))
            .setType(Accessor.Type.VEC4);
          const primWeights = document
            .createAccessor()
            .setArray(
              new Float32Array(joints.map((_, idx) => (idx % 4 === 0 ? 1 : 0)))
            )
            .setType(Accessor.Type.VEC4);

          const primUv = document
            .createAccessor()
            .setType(Accessor.Type.VEC2)
            .setArray(new Float32Array(uv));

          gltfPrim
            .setName(name)
            .setIndices(primIndices)
            .setAttribute('POSITION', primPositions)
            .setAttribute('NORMAL', primNormals)
            .setAttribute('TEXCOORD_0', primUv)
            .setAttribute('JOINTS_0', primJoints)
            .setAttribute('WEIGHTS_0', primWeights);
          const normalAccessor = gltfPrim.getAttribute('NORMAL');
          if (normalAccessor) {
            const normals = normalAccessor.getArray();
            for (let i = 0; i < normals.length; i += 3) {
              normals[i] = -normals[i]; // Negate the X component of normals
            }
            normalAccessor.setArray(normals);
          }

          // Reverse vertex winding order for each triangle
          const indices2 = gltfPrim.getIndices();
          if (indices2) {
            const indexArray = indices2.getArray();
            for (let i = 0; i < indexArray.length; i += 3) {
              // Swap the first and last indices to reverse the winding order
              [indexArray[i], indexArray[i + 2]] = [
                indexArray[i + 2],
                indexArray[i],
              ];
            }
            indices2.setArray(indexArray);
          }
        }

        const animWriter = new S3DAnimationWriter(document);
        const skeletonNodes = animWriter.addNewSkeleton(skeleton);

        if (!secondary) {
          animWriter.applyAnimationToSkeleton(
            skeleton,
            'pos',
            true,
            true,
            skeletonNodes
          );
          for (const animationKey of Object.keys(skeleton.animations)) {
            animWriter.applyAnimationToSkeleton(
              skeleton,
              animationKey,
              true,
              false,
              skeletonNodes
            );
          }
        }

        const skin = document.createSkin('mesh-skeleton');
        for (const n of skeletonNodes) {
          skin.addJoint(n);
        }

        node.setMesh(gltfMesh).setSkin(skin).addChild(skeletonNodes[0]);

        await document.transform(
          // Compress mesh geometry with Draco.
          draco({ ...DRACO_DEFAULTS, quantizationVolume: 'scene' })
        );
        const bytes = await io.writeBinary(document);

        await writeEQFile('models', `${baseName}.glb`, bytes);
      }
    }
  }

  /**
   *
   * @param {Wld} wld
   */
  async exportObjects(wld) {
    for (let i = 0; i < wld.meshes.length; i++) {
      const mesh = wld.meshes[i];
      const material = mesh.materialList;
      const scrubbedName = material.name.split('_')[0].toLowerCase();
      if (await getEQFileExists('objects', `${scrubbedName}.glb`)) {
        continue;
      }
      const document = new Document(scrubbedName);
      const buffer = document.createBuffer();
      const scene = document.createScene(scrubbedName);
      document.createPrimitive().setAttribute();
      const flipMatrix = mat4.create();
      mat4.scale(flipMatrix, flipMatrix, [-1, 1, 1]);
      const node = document
        .createNode(scrubbedName)
        .setTranslation([0, 0, 0])
        .setMatrix(flipMatrix);

      scene.addChild(node);

      const materials = await getMaterials(material.materialList, document);

      const primitiveMap = {};

      if (mesh.exportSeparateCollision) {
        //
      }
      let polygonIndex = 0;
      for (const mat of mesh.materialGroups) {
        let name = mesh.materialList.materialList[mat.materialIndex].name;
        const gltfMat = materials[name];
        if (!gltfMat) {
          console.warn(`S3D model had no material link ${name}`);
          continue;
        }
        let hasNotSolid = false;
        for (let i = 0; i < mat.polygonCount; i++) {
          const idc = mesh.indices[polygonIndex];
          if (!idc.isSolid) {
            hasNotSolid = true;
            break;
          }
        }
        name = hasNotSolid ? `${name}-passthrough` : name;
        let sharedPrimitive = primitiveMap[name];
        if (!sharedPrimitive) {
          const mesh = document.createMesh(name);
          const materialNode = document.createNode(name).setMesh(mesh);
          node.addChild(materialNode);
          sharedPrimitive = primitiveMap[name] = {
            gltfNode: materialNode,
            gltfMesh: mesh,
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
          mesh.addPrimitive(sharedPrimitive.gltfPrim);
        }
        if (hasNotSolid) {
          sharedPrimitive.gltfNode.setExtras({ solid: false });
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
      }

      await document.transform(
        // Compress mesh geometry with Draco.
        draco({ ...DRACO_DEFAULTS, quantizationVolume: 'scene' })
      );
      const bytes = await io.writeBinary(document);

      await writeEQFile('objects', `${scrubbedName}.glb`, bytes);
    }
  }

  /**
   *
   * @param {Wld} wld
   */
  async exportZone(wld) {
    const document = new Document();
    const buffer = document.createBuffer();
    const scene = document.createScene(wld.name);
    const flipMatrix = mat4.create();
    mat4.scale(flipMatrix, flipMatrix, [-1, 1, 1]);
    const node = document
      .createNode(`zone-${wld.name.replace('.wld', '')}`)
      .setTranslation([0, 0, 0])
      .setMatrix(flipMatrix);

    scene.addChild(node);

    const zoneMetadata = {
      version: VERSION,
      objects: {},
      lights : [],
      music  : [],
      sound2d: [],
      sound3d: [],
      regions: [],
    };

    wld.bspTree?.constructRegions(wld);

    // BSP regions
    const regions = [];
    for (const leafNode of wld.bspTree?.leafNodes ?? []) {
      regions.push({
        region   : leafNode.region.regionType,
        minVertex: [
          leafNode.boundingBoxMin[0],
          leafNode.boundingBoxMin[2],
          leafNode.boundingBoxMin[1],
        ],
        maxVertex: [
          leafNode.boundingBoxMax[0],
          leafNode.boundingBoxMax[2],
          leafNode.boundingBoxMax[1],
        ],
        center: [leafNode.center[0], leafNode.center[2], leafNode.center[1]],
      });
    }
    zoneMetadata.regions = await optimizeBoundingBoxes(regions);

    // Object Instances
    const objWld = this.wldFiles.find((f) => f.type === WldType.ZoneObjects);
    if (objWld) {
      const actorInstances = objWld.actors;
      for (const actor of actorInstances) {
        const entry = {
          y      : actor.location.z,
          z      : actor.location.y,
          x      : actor.location.x,
          rotateX: actor.location.rotateX,
          rotateY: actor.location.rotateY,
          rotateZ: actor.location.rotateZ,
          scale  : actor.scaleFactor,
        };
        if (!zoneMetadata.objects[actor.objectName]) {
          zoneMetadata.objects[actor.objectName] = [entry];
        } else {
          zoneMetadata.objects[actor.objectName].push(entry);
        }
      }
    }
    await document.transform(
      // Compress mesh geometry with Draco.
      draco({ ...DRACO_DEFAULTS, quantizationVolume: 'scene' })
    );

    // Object instances
    await writeEQFile(
      'zones',
      `${wld.name.replace('.wld', '.json')}`,
      JSON.stringify(zoneMetadata)
    );

    const primitiveMap = {};
    const materials = await getMaterials(
      wld.materialList.flatMap((a) => a.materialList),
      document
    );
    for (const mesh of wld.meshes) {
      let polygonIndex = 0;
      for (const mat of mesh.materialGroups) {
        if (!mesh.materialList.materialList[mat.materialIndex]) {
          continue;
        }
        let name = mesh.materialList.materialList[mat.materialIndex].name;
        const gltfMat = materials[name];
        if (!gltfMat) {
          console.warn(`S3D model had no material link ${name}`);
          continue;
        }
        let hasNotSolid = false;
        for (let i = 0; i < mat.polygonCount; i++) {
          const idc = mesh.indices[polygonIndex];
          if (!idc.isSolid) {
            hasNotSolid = true;
            break;
          }
        }
        name = hasNotSolid ? `${name}-passthrough` : name;
        const endDigitRegex = /-(\d+)$/;
        while (primitiveMap[name]?.vecs?.length > 20000) {
          if (endDigitRegex.test(name)) {
            const [, n] = endDigitRegex.exec(name);
            name = name.replace(endDigitRegex, `-${+n + 1}`);
          } else {
            name += '-0';
          }
        }

        let sharedPrimitive = primitiveMap[name];
        if (!sharedPrimitive) {
          const mesh = document.createMesh(name);
          const materialNode = document.createNode(name).setMesh(mesh);
          node.addChild(materialNode);
          sharedPrimitive = primitiveMap[name] = {
            gltfNode: materialNode,
            gltfMesh: mesh,
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
          mesh.addPrimitive(sharedPrimitive.gltfPrim);
        }
        if (hasNotSolid) {
          sharedPrimitive.gltfNode.setExtras({ solid: false });
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

          // TODO check this case out
          if ([v1, v2, v3].some((a) => a === undefined)) {
            continue;
          }
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
    }
    await document.transform(
      // Compress mesh geometry with Draco.
      draco({ ...DRACO_DEFAULTS, quantizationVolume: 'scene' })
    );
    const bytes = await io.writeBinary(document);
    const zoneName = `${wld.name.replace('wld', 'glb')}`;

    await writeEQFile('zones', zoneName, bytes.buffer);
  }

  async export() {
    /**
     * Textures first
     */

    for (const wld of this.wldFiles) {
      switch (wld.type) {
        case WldType.Zone:
          GlobalStore.actions.setLoadingText('Exporting zone');
          await this.exportZone(wld);
          break;
        case WldType.ZoneObjects:
          break;
        case WldType.Objects:
          GlobalStore.actions.setLoadingText('Exporting zone objects');
          await this.exportObjects(wld);
          break;
        case WldType.Characters:
          GlobalStore.actions.setLoadingText('Exporting zone models');
          await this.exportModels(wld);
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
            `Unhandled extension for ${this.#fileHandle.name} - ${extension}`
          );
      }
    }
    console.log(
      `Took ${((performance.now() - micro) / 1000).toFixed(4)} seconds.`
    );
    imageProcessor.clearWorkers();
  }
}
