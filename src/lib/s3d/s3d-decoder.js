import { Buffer } from 'buffer';
import { mat4 } from 'gl-matrix';
import { Accessor, WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, DRACO_DEFAULTS } from '@gltf-transform/functions';
import { Document } from '@gltf-transform/core';
import draco3d from 'draco3dgltf';

import { ShaderType } from './materials/material';
import {
  appendObjectMetadata,
  getEQFile,
  getEQFileExists,
  getEQRootDir,
  writeEQFile,
} from '../util/fileHandler';
import { VERSION } from '../model/constants';
import { fragmentNameCleaner } from '../util/util';
import { S3DAnimationWriter, animationMap } from '../util/animation-helper';
import { GlobalStore } from '../../state';
import { EQGDecoder } from '../eqg/eqg-decoder';
import { PFSArchive } from '../pfs/pfs';
import { Sound } from './sound/sound';
import { Wld, WldType } from './wld/wld';
import { imageProcessor } from '../util/image/image-processor';
import { ActorType } from './animation/actor';

const io = new WebIO()
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule({
      locateFile: (file) => {
        return `/static/${file}`;
      },
      print   : console.log,
      printErr: console.error,
    }),
    'draco3d.encoder': await draco3d.createEncoderModule({
      locateFile: (file) => {
        return `/static/${file}`;
      },
      print   : console.log,
      printErr: console.error,
    }),
  })
  .registerExtensions(ALL_EXTENSIONS);

export class S3DDecoder {
  /** @type {import('../model/file-handle').EQFileHandle} */
  #fileHandle = null;

  /**
   * @type {[Wld]}
   */
  wldFiles = [];

  /**
   * @type {Sound}
   */
  sound = null;

  /**
   *
   * @type {PFSArchive}
   */
  pfsArchive;

  gequip = false;

  constructor(fileHandle) {
    this.#fileHandle = fileHandle;
  }

  /**
   *
   * @param {FileSystemHandle} file
   */
  async processS3D(file) {
    const arrayBuffer = await file.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    if (buf.length === 0) {
      return;
    }
    this.pfsArchive = new PFSArchive();
    this.pfsArchive.openFromFile(arrayBuffer);
    this.files = {};
    const images = [];
    // Preprocess images
    this.shaderMap = {};
    for (const [fileName, data] of this.pfsArchive.files.entries()) {
      this.files[fileName] = this.pfsArchive.getFile(fileName);

      if (fileName.endsWith('.wld')) {
        console.log(`Processing WLD file - ${fileName}`);
        const wld = new Wld(this.files[fileName], fileName);
        for (const mat of wld.materialList.flatMap((ml) => ml.materialList)) {
          for (const bitmapName of mat.bitmapInfo?.reference?.bitmapNames ??
            []) {
            if (this.shaderMap[bitmapName.fileName.toLowerCase()]) {
              continue;
            }
            this.shaderMap[bitmapName.fileName.toLowerCase()] = mat.shaderType;
          }
        }
        this.wldFiles.push(wld);
      }

      if (fileName.endsWith('.bmp') || fileName.endsWith('.dds')) {
        //   await writeEQFile('img', `${fileName}`, this.files[fileName].buffer);
        images.push({ name: fileName, data: this.files[fileName].buffer });
        continue;
      }
    }

    for (const image of images) {
      image.shaderType = this.shaderMap[image.name];
    }

    console.log(`Processed - ${file.name}`);
    await imageProcessor.parseImages(images);
    console.log(`Done processing images ${file.name} - ${images.length}`);
  }

  async exportSkinnedMeshes(
    wld,
    meshes,
    name,
    skeleton,
    path,
    isCharacterAnimation,
    boneIdx = -1
  ) {
    for (const mesh of meshes) {
      const material = mesh.materialList;
      const baseName = (name || mesh.name).split('_')[0].toLowerCase();
      const scrubbedName = material.name.split('_')[0].toLowerCase();
      const document = new Document(scrubbedName);
      const buffer = document.createBuffer();
      const scene = document.createScene(scrubbedName);
      const secondary = /he\d+/.test(baseName);

      // Write skeleton data to json if we're a supplier of animations for other models
      if (!secondary && Object.values(animationMap).includes(baseName)) {
        if (!(await getEQFileExists('data', `${baseName}-animations.json`))) {
          GlobalStore.actions.setLoadingText(
            `Writing shared animations for ${baseName}`
          );
          await writeEQFile(
            'data',
            `${baseName}-animations.json`,
            JSON.stringify(skeleton.serializeAnimations())
          );
        }
      }
      if (await getEQFileExists(path, `${baseName}.glb`)) {
        // continue;
      }

      // We need to map this to another skeleton supplied from those other models
      // e.g. ELM maps to a lot of different
      if (animationMap[baseName]) {
        const existingSkeleton =
          wld.skeletons.find((s) => s.modelBase === animationMap[baseName]) ||
          this.globalWld?.skeletons.find(
            (s) => s.modelBase === animationMap[baseName]
          );
        const existingAnimations =
          existingSkeleton?.animations ??
          (await getEQFile(
            'data',
            `${animationMap[baseName]}-animations.json`,
            'json'
          ));
        if (existingAnimations) {
          for (const [key, value] of Object.entries(existingAnimations)) {
            if (secondary) {
              continue;
            }
            if (!skeleton.animations[key]) {
              skeleton.animations[key] = {
                ...value,
                animModelBase: baseName,
              };
            }
          }
        } else {
          console.log(
            `Unmet dependency for animations for ${baseName}. Wanted {{ ${animationMap[baseName]} }}`
          );
        }
      }

      const node = document.createNode(scrubbedName).setTranslation([0, 0, 0]);

      node.setExtras({
        secondaryMeshes: skeleton.secondaryMeshes.length,
      });

      scene.addChild(node);

      const materials = await this.getMaterials(
        material.materialList,
        document
      );

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
            boneIdx !== -1 ? boneIdx : getBoneIndexForVertex(idx)
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
          normals.push(...[n1, n2, n3].flatMap((v) => [v[0] * -1, v[2], v[1]]));
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

      if (isCharacterAnimation) {
        animWriter.applyAnimationToSkeleton(
          skeleton,
          'pos',
          isCharacterAnimation,
          true,
          skeletonNodes
        );
      }

      if (!secondary) {
        for (const animationKey of Object.keys(skeleton.animations)) {
          animWriter.applyAnimationToSkeleton(
            skeleton,
            animationKey,
            isCharacterAnimation,
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
      // await document.transform(
      //   draco({ ...DRACO_DEFAULTS, quantizationVolume: 'scene' })
      // );
      const bytes = await io.writeBinary(document);

      await writeEQFile(path, `${baseName}.glb`, bytes);
    }
  }

  /**
   *
   * @param {Wld} wld
   */
  async exportModels(
    wld,
    doExport = true,
    path = 'models',
    itemExport = false
  ) {
    for (const track of wld.tracks.filter(
      (t) => !t.isPoseAnimation && !t.isNameParsed
    )) {
      track.parseTrackData();
    }
    GlobalStore.actions.setLoadingTitle('Exporting models');
    // Sort these to export animation suppliers first
    wld.skeletons = wld.skeletons.sort((a, _b) => {
      let isAnimationSupplier = false;
      for (const mesh of a.meshes.concat(a.secondaryMeshes)) {
        const baseName = mesh.name.split('_')[0].toLowerCase();
        if (Object.values(animationMap).includes(baseName)) {
          isAnimationSupplier = true;
          break;
        }
      }
      return isAnimationSupplier ? -1 : 1;
    });

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
        .forEach((t) => {
          skeleton.addTrackData(t);
        });
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
          cleanedName = cleanedName.slice(0, cleanedName.length - 2);
          if (cleanedName.length !== 3) {
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
      await this.exportSkinnedMeshes(
        wld,
        skeleton.meshes.concat(skeleton.secondaryMeshes),
        '',
        skeleton,
        path,
        true
      );
    }
  }

  /**
   *
   * @param {Wld} wld
   * @param {SkeletonHierarchy} skeleton
   * @param {*} path
   * @param {*} itemExport
   */
  async exportSkeletalActor(wld, skeleton, name, path = 'objects') {
    const meshes = [];
    let boneIdx = -1;
    for (const [idx, bone] of Object.entries(skeleton.skeleton)) {
      if (
        bone.meshReference &&
        bone.meshReference.mesh &&
        bone.meshReference.mesh.materialList
      ) {
        meshes.push(bone.meshReference.mesh);
        boneIdx = +idx;
      }
    }
    skeleton.buildSkeletonData(false);
    await this.exportSkinnedMeshes(
      wld,
      meshes,
      name,
      skeleton,
      path,
      false,
      boneIdx
    );
  }

  /**
   *
   * @param {Wld} wld
   * @param {Mesh} mesh
   * @param {*} path
   * @param {*} itemExport
   */
  async exportStaticActor(wld, mesh, name, path = 'objects') {
    const material = mesh.materialList;
    const scrubbedName = name.split('_')[0].toLowerCase();
    const diskFileName = `${name.split('_')[0].toLowerCase()}.glb`;

    await appendObjectMetadata(scrubbedName, wld.name.replace('.wld', ''));

    const document = new Document(scrubbedName);
    const scene = document.createScene(scrubbedName);
    const buffer = document.createBuffer();
    const node = document.createNode(scrubbedName).setTranslation([0, 0, 0]);
    scene.addChild(node);
    const materials = await this.getMaterials(material.materialList, document);

    // Build a primitiveMap for each material group.
    const primitiveMap = {};

    // Get animation data if it exists.
    const animatedVerticesRef = mesh.animatedVerticesReference?.reference;
    let delay = -1;
    let frames = [];
    if (animatedVerticesRef) {
      delay = animatedVerticesRef.delay; // delay (in ms) per frame, if provided
      frames = animatedVerticesRef.frames; // each frame is an array of [x,y,z] positions
    }

    let polygonIndex = 0;
    // Loop over each material group.
    for (const mat of mesh.materialGroups) {
      let name = mesh.materialList.materialList[mat.materialIndex].name;
      const gltfMat = materials[name];
      if (!gltfMat) {
        console.warn(`S3D model had no material link ${name}`);
        continue;
      }
      // Check if any polygon in this group is not solid.
      let hasNotSolid = false;
      for (let j = 0; j < mat.polygonCount; j++) {
        const idc = mesh.indices[polygonIndex + j];
        if (!idc.isSolid) {
          hasNotSolid = true;
          break;
        }
      }
      name = hasNotSolid ? `${name}-passthrough` : name;

      // If we haven't seen this material group yet, create a new primitive.
      let sharedPrimitive = primitiveMap[name];
      if (!sharedPrimitive) {
        const gltfMesh = document.createMesh(name);
        const materialNode = document.createNode(name).setMesh(gltfMesh);
        node.addChild(materialNode);
        sharedPrimitive = primitiveMap[name] = {
          gltfNode: materialNode,
          gltfMesh: gltfMesh,
          gltfPrim: document
            .createPrimitive(name)
            .setMaterial(gltfMat)
            .setName(name),
          indices       : [],
          vecs          : [],
          normals       : [],
          uv            : [],
          // vertexMapping will hold, in order, the original WLD index for each deduplicated vertex.
          vertexMapping : [],
          // vertexDedupMap maps a JSON key (transformed position + normal) to the deduplicated vertex index.
          vertexDedupMap: new Map(),
        };
        gltfMesh.addPrimitive(sharedPrimitive.gltfPrim);
        if (hasNotSolid) {
          gltfMesh.setExtras({ passThrough: true });
        }
      }

      // Process each polygon (triangle) in the material group.
      for (let j = 0; j < mat.polygonCount; j++) {
        const idc = mesh.indices[polygonIndex];
        // idxArr holds the indices into mesh.vertices.
        const idxArr = [idc.v1, idc.v2, idc.v3];
        const vertices = idxArr.map((idx) => mesh.vertices[idx]);
        const normalsArr = idxArr.map((idx) => mesh.normals[idx]);
        const uvs = idxArr.map((idx) => mesh.textureUvCoordinates[idx]);

        const transformedPositions = vertices.map((v) => [
          (v[0] + mesh.center[0]),
          v[2] + mesh.center[2],
          v[1] + mesh.center[1],
        ]);
        // Transform normals (negate X and swap Y/Z) as in C#.
        const transformedNormals = normalsArr.map((n) => [
          n[0] * -1,
          n[2],
          n[1],
        ]);

        // For each vertex of the triangle...
        const triangleIndices = [];
        for (let k = 0; k < 3; k++) {
          // Build a key from the transformed position and normal.
          const key = JSON.stringify({
            pos : transformedPositions[k],
            norm: transformedNormals[k],
          });
          let dedupIndex;
          if (sharedPrimitive.vertexDedupMap.has(key)) {
            // Reuse the existing vertex.
            dedupIndex = sharedPrimitive.vertexDedupMap.get(key);
          } else {
            // Create a new vertex.
            dedupIndex = sharedPrimitive.vertexMapping.length;
            sharedPrimitive.vertexDedupMap.set(key, dedupIndex);
            // Save the original WLD vertex index.
            sharedPrimitive.vertexMapping.push({ idx: idxArr[k], pos: transformedPositions[k], norm: transformedNormals[k] });
            // Push the vertex data.
            sharedPrimitive.vecs.push(...transformedPositions[k]);
            sharedPrimitive.normals.push(...transformedNormals[k]);
            sharedPrimitive.uv.push(...uvs[k]);
          }
          triangleIndices.push(dedupIndex);
        }
        // Add the triangle's indices.
        sharedPrimitive.indices.push(...triangleIndices);
        polygonIndex++;
      }
    }

    // Create accessors for the base geometry.
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
        .setType(Accessor.Type.VEC3)
        .setArray(new Float32Array(normals));
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

    // Build morph targets using the per-primitive vertexMapping.
    if (frames.length > 0) {
      const flipMatrix = mat4.create();
      mat4.scale(flipMatrix, flipMatrix, [-1, 1, 1]); // Flip X axis.
      node.setMatrix(flipMatrix);
  
      for (const [_name, primData] of Object.entries(primitiveMap)) {
        const { gltfPrim, vertexMapping } = primData;
        // For each animation frame...
        for (let f = 0; f < frames.length; f++) {
          const frame = frames[f];
          const morphPositions = [];
          const morphNormals = [];
          // Loop over the deduplicated vertices in the order of the base accessor.
          for (let i = 0; i < vertexMapping.length; i++) {
            const { idx, pos, norm } = vertexMapping[i];
            const originalIndex = idx;
            const v = frame[originalIndex]; // [x, y, z] from the animated frame
            morphPositions.push(
              (v[0] + mesh.center[0]) - pos[0],
              (v[2] + mesh.center[2]) - pos[1],
              (v[1] + mesh.center[1]) - pos[2]);
            morphNormals.push(
              ...norm
            );
          }
          // Create accessors for morph target data.
          const morphAccessor = document
            .createAccessor()
            .setType(Accessor.Type.VEC3)
            .setArray(new Float32Array(morphPositions))
            .setBuffer(buffer);
          const normalAccessor = document
            .createAccessor()
            .setType(Accessor.Type.VEC3)
            .setArray(new Float32Array(morphNormals))
            .setBuffer(buffer);
          // Create the morph target and add it.
          const target = document.createPrimitiveTarget();
          target.setAttribute('POSITION', morphAccessor);
          target.setAttribute('NORMAL', normalAccessor);
          gltfPrim.addTarget(target);
        }
        // Set default morph weights.
        primData.gltfMesh.setWeights(
          Array.from({ length: frames.length }, () => 0)
        );
      }
      // Optionally, create an animation for morph target weights.
      const numFrames = frames.length;
      const timeArray = frames.map((_, idx) => (idx * delay) / 1000);
      const timeAccessor = document
        .createAccessor()
        .setArray(new Float32Array(timeArray))
        .setType('SCALAR');
      const weightKeyframes = [];
      for (let i = 0; i < numFrames; i++) {
        const frameWeights = new Float32Array(numFrames);
        frameWeights[i] = 1;
        weightKeyframes.push(...frameWeights);
      }
      const weightsAccessor = document
        .createAccessor()
        .setArray(new Float32Array(weightKeyframes))
        .setType('SCALAR');
      const sampler = document
        .createAnimationSampler()
        .setInput(timeAccessor)
        .setOutput(weightsAccessor)
        .setInterpolation('LINEAR');
      const animation = document.createAnimation('MorphAnimation');
      // Instead of targeting the parent node, loop through each primitive and
      // add a channel for the node that actually holds the mesh with morph targets.
      for (const [_, primData] of Object.entries(primitiveMap)) {
        // Only add a channel if this primitive actually has morph targets.

        const channel = document
          .createAnimationChannel()
          .setTargetNode(primData.gltfNode) // target the node that has the mesh with morph targets
          .setTargetPath('weights')
          .setSampler(sampler);
        animation.addSampler(channel.getSampler());
        animation.addChannel(channel);
      }
    }

    const bytes = await io.writeBinary(document);
    await writeEQFile(path, diskFileName, bytes);
  }

  /**
   *
   * @param {Wld} wld
   */
  async exportObjects(wld, path = 'objects') {
    for (const obj of wld.objects) {
      switch (obj.actorType) {
        case ActorType.STATIC:
          await this.exportStaticActor(
            wld,
            obj.fragments[0].reference,
            obj.name,
            path
          );
          break;
        case ActorType.SKELETAL:
          await this.exportSkeletalActor(
            wld,
            obj.fragments[0].reference,
            obj.name,
            path
          );
          break;
        default:
          break;
      }
    }
  }
  async exportZone(wld) {
    // Create document, buffer, and scene.
    const document = new Document();
    const buffer = document.createBuffer();
    const scene = document.createScene(wld.name);
    const flipMatrix = mat4.create();
    mat4.scale(flipMatrix, flipMatrix, [-1, 1, 1]); // Flip X axis.
    const node = document
      .createNode(`zone-${wld.name.replace('.wld', '')}`)
      .setTranslation([0, 0, 0])
      .setMatrix(flipMatrix);
    scene.addChild(node);

    // Build zone metadata.
    const zoneMetadata = {
      version: VERSION,
      objects: {},
      lights : [],
      sounds : [],
      regions: [],
    };

    wld.bspTree?.constructRegions(wld);

    // Process lights.
    const lightWld = this.wldFiles.find((f) => f.type === WldType.Lights);
    if (lightWld) {
      for (const light of lightWld.lights) {
        const [x, y, z] = light.position;
        const l = { x, y: z, z: y, radius: 30 };
        const lightSource = light.reference.lightSource;
        l.r = lightSource.colors?.[0]?.r ?? 1;
        l.g = lightSource.colors?.[0]?.g ?? 1;
        l.b = lightSource.colors?.[0]?.b ?? 1;
        zoneMetadata.lights.push(l);
      }
    }
    if (this.sound) {
      zoneMetadata.sounds = this.sound.sounds;
    }

    // BSP regions.
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
    zoneMetadata.unoptimizedRegions = regions;

    // Process object instances.
    const objWld = this.wldFiles.find((f) => f.type === WldType.ZoneObjects);
    if (objWld) {
      const actorInstances = objWld.actors;
      for (const actor of actorInstances) {
        const entry = {
          x      : actor.location.x,
          y      : actor.location.z,
          z      : actor.location.y,
          rotateX: actor.location.rotateX,
          rotateY: actor.location.rotateY + 180,
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
    // Write out the zone metadata.
    await writeEQFile(
      'zones',
      `${wld.name.replace('.wld', '.json')}`,
      JSON.stringify(zoneMetadata)
    );

    // --- Build Geometry with Deduplication ---
    const primitiveMap = {};
    const materials = await this.getMaterials(
      wld.materialList.flatMap((a) => a.materialList),
      document
    );

    // Loop over each mesh in the zone.
    for (const mesh of wld.meshes) {
      let polygonIndex = 0;
      // Process each material group within the mesh.
      for (const mat of mesh.materialGroups) {
        if (!mesh.materialList.materialList[mat.materialIndex]) {
          continue;
        }
        // Get the material name and corresponding glTF material.
        let matName = mesh.materialList.materialList[mat.materialIndex].name;
        const gltfMat = materials[matName];
        if (!gltfMat) {
          console.warn(`S3D model had no material link ${matName}`);
          continue;
        }
        // Check if any polygon in this group is non‑solid.
        let hasNotSolid = false;
        for (let i = 0; i < mat.polygonCount; i++) {
          const idc = mesh.indices[polygonIndex + i];
          if (!idc.isSolid) {
            hasNotSolid = true;
            break;
          }
        }
        // Append "-passthrough" if needed.
        matName = hasNotSolid ? `${matName}-passthrough` : matName;
        // Optionally split if too large.
        const endDigitRegex = /-(\d+)$/;
        while (primitiveMap[matName]?.vecs?.length > 20000) {
          if (endDigitRegex.test(matName)) {
            const [, n] = endDigitRegex.exec(matName);
            matName = matName.replace(endDigitRegex, `-${+n + 1}`);
          } else {
            matName += '-0';
          }
        }
        // Get or create a primitive for this material group.
        let sharedPrimitive = primitiveMap[matName];
        if (!sharedPrimitive) {
          const zoneMesh = document.createMesh(matName);
          const materialNode = document.createNode(matName).setMesh(zoneMesh);
          node.addChild(materialNode);
          sharedPrimitive = primitiveMap[matName] = {
            gltfNode: materialNode,
            gltfMesh: zoneMesh,
            gltfPrim: document
              .createPrimitive(matName)
              .setMaterial(gltfMat)
              .setName(matName),
            indices       : [],
            vecs          : [],
            normals       : [],
            uv            : [],
            // Deduplication structures:
            vertexMapping : [], // will store the original WLD vertex indices for each unique vertex
            vertexDedupMap: new Map(),
            polygonCount  : 0,
          };
          zoneMesh.addPrimitive(sharedPrimitive.gltfPrim);
          if (hasNotSolid) {
            sharedPrimitive.gltfNode.setExtras({ passThrough: true });
          }
        }

        // Process each triangle (polygon) in the material group.
        for (let i = 0; i < mat.polygonCount; i++) {
          const idc = mesh.indices[polygonIndex];
          // Get indices into the mesh's arrays.
          const idxArr = [idc.v1, idc.v2, idc.v3];
          // Fetch vertex, normal, and UV data.
          const vertices = idxArr.map((idx) => mesh.vertices[idx]);
          const normalsArr = idxArr.map((idx) => mesh.normals[idx]);
          const uvs = idxArr.map((idx) => mesh.textureUvCoordinates[idx]);
          // Transform positions: add the mesh center and swap Y/Z.
          const transformedPositions = vertices.map((v) => [
            v[0] + mesh.center[0],
            v[2] + mesh.center[2],
            v[1] + mesh.center[1],
          ]);
          // Transform normals: negate X and swap Y/Z.
          const transformedNormals = normalsArr.map((n) => [
            n[0] * -1,
            n[2],
            n[1],
          ]);

          const triangleIndices = [];
          // Deduplicate each vertex.
          for (let k = 0; k < 3; k++) {
            // Build the deduplication key including UV (without flipping).
            const key = JSON.stringify({
              pos : transformedPositions[k],
              norm: transformedNormals[k],
              uv  : uvs[k],
            });
            let dedupIndex;
            if (sharedPrimitive.vertexDedupMap.has(key)) {
              dedupIndex = sharedPrimitive.vertexDedupMap.get(key);
            } else {
              dedupIndex = sharedPrimitive.vertexMapping.length;
              sharedPrimitive.vertexDedupMap.set(key, dedupIndex);
              sharedPrimitive.vertexMapping.push(idxArr[k]);
              // Add the transformed position and normal.
              sharedPrimitive.vecs.push(...transformedPositions[k]);
              sharedPrimitive.normals.push(...transformedNormals[k]);
              // Use UV exactly as in the original function.
              sharedPrimitive.uv.push(uvs[k][0], uvs[k][1]);
            }
            triangleIndices.push(dedupIndex);
          }
          sharedPrimitive.indices.push(...triangleIndices);
          polygonIndex++;
        }
      }
    }

    // Create accessors for each primitive.
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
        .setType(Accessor.Type.VEC3)
        .setArray(new Float32Array(normals));
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

    // (Optional) Uncomment to compress geometry with Draco.
    // await document.transform(draco({ ...DRACO_DEFAULTS, quantizationVolume: 'scene' }));

    const bytes = await io.writeBinary(document);
    const zoneName = `${wld.name.replace('wld', 'glb')}`;
    await writeEQFile('zones', zoneName, bytes.buffer);
  }

  /**
   *
   * @param {[import('./materials/material-list').MaterialList]}
   * @param {Document} document
   */
  async getMaterials(materialList, document, roughness = 0.0) {
    const materials = {};
    for (const eqMaterial of materialList) {
      if (materials[eqMaterial.name]) {
        continue;
      }
      let [name] = eqMaterial.name.toLowerCase().split(/_mdf/i);

      if (/m\d+/.test(name) && eqMaterial.bitmapInfo?.reference) {
        name = eqMaterial.bitmapInfo.reference.bitmapNames[0].name;
      }
      const gltfMaterial = document
        .createMaterial()
        .setDoubleSided(false)
        .setRoughnessFactor(1)
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
      let image = new Uint8Array(await getEQFile('textures', `${name}.png`));
      if (!image.byteLength) {
        console.log(`No byte length for image: ${name}`);
        image = new Uint8Array([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
          0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
          0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
          0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63,
          0x68, 0x68, 0x68, 0x00, 0x00, 0x03, 0x04, 0x01, 0x81, 0x4b, 0xd3,
          0xd2, 0x10, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
          0x42, 0x60, 0x82,
        ]);
      }
      const texture = document
        .createTexture(name.toLowerCase())
        // .setImage(image)
        .setURI(`/eq/textures/${name}`)
        .setExtras({
          name,
        })
        .setMimeType('image/png');
      gltfMaterial.setBaseColorTexture(texture);
      switch (eqMaterial.shaderType) {
        case ShaderType.TransparentMasked:
          gltfMaterial
            .setAlphaMode('MASK')
            .setDoubleSided(true)
            .setAlphaCutoff(0.5);
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
          gltfMaterial.setExtras({ boundary: true });
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
          await this.exportObjects(wld, 'items', true);

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
    const micro = performance.now();
    if (this.#fileHandle.name.startsWith('gequip')) {
      this.gequip = true;
    }
    // guarantee the main zone s3d will be parsed last
    this.#fileHandle.fileHandles.sort((a, _b) =>
      a.name === `${this.#fileHandle.name}.s3d` ? 1 : -1
    );
    for (const file of this.#fileHandle.fileHandles) {
      const extension = file.name.split('.').pop();
      switch (extension) {
        case 's3d':
          await this.processS3D(file);
          break;
        case 'txt':
          if (file.name.endsWith('_assets.txt')) {
            const contents = (await file.text()).split('\r\n');
            for (const line of contents) {
              if (line.endsWith('.eqg')) {
                console.log(`Loading dependent asset ${line}`);
                try {
                  const dir = getEQRootDir();
                  const fh = await dir
                    .getFileHandle(line)
                    .then((f) => f.getFile());
                  const decoder = new EQGDecoder(fh);
                  await decoder.processEQG(fh);
                  for (const [name, mod] of Object.entries(decoder.models)) {
                    if (!name.includes('ter_')) {
                      await decoder.writeModels(name, mod);
                    }
                  }
                } catch (e) {
                  console.log('Error loading dependent asset', e);
                }
              }
            }
          }
          break;
        case 'eff':
          if (file.name.endsWith('_sounds.eff')) {
            const bank = this.#fileHandle.fileHandles.find((f) =>
              f.name.endsWith('sndbnk.eff')
            );
            if (bank) {
              const root = await getEQRootDir();
              const mp3List = await root
                .getFileHandle('mp3index.txt')
                .then((f) => f.getFile().then((f) => f.text()));
              this.sound = new Sound(
                await file.arrayBuffer(),
                await bank.text(),
                mp3List,
                this.#fileHandle.name.split('.')[0]
              );
            }
          }
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
  }
}
