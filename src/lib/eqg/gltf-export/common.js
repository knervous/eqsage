import { Accessor, Document, WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

import { mat4, quat, vec3 } from 'gl-matrix';
import {
  appendObjectMetadata,
  getEQFile,
  getEQFileExists,
  writeEQFile,
} from '../../util/fileHandler';
import { EQGAnimationWriter } from './eqg-animation';

const io = new WebIO().registerExtensions(ALL_EXTENSIONS);

export async function writeMetadata(
  infP,
  zoneMetadata,
  modelFile,
  writtenModels,
  _v3
) {
  const p = JSON.parse(JSON.stringify(infP));
  const position = vec3.fromValues(p.x, p.y, p.z);
  const x = position[0], y = position[2], z = position[1];
  
  const entry = {
    x,
    y,
    z,
    rotateX: 0,
    rotateY: p.rotateX,
    rotateZ: p.rotateZ,
    scale  : p.scaleY,
  };
  if (!zoneMetadata.objects[modelFile]) {
    zoneMetadata.objects[modelFile] = [entry];
  } else {
    zoneMetadata.objects[modelFile].push(entry);
  }

  if (writtenModels[modelFile.toLowerCase()]) {
    return;
  }
  writtenModels[p.modelFile.toLowerCase()] = true;
}

/**
 *
 * @param {string} modelFile
 * @param {import('../model/model').Model} mod
 * @this {import('../eqg-decoder').EQGDecoder}
 * @returns
 */
export async function writeModels(modelFile, mod) {
  modelFile = modelFile.replace('.mod', '');
  const diskFileName = `${modelFile}.glb`;
  if (
    (await getEQFileExists('objects', diskFileName)) &&
    !modelFile.includes('et_drbanner') &&
    !modelFile.includes('dest') &&
    !modelFile.includes('ggy') &&
    !modelFile.includes('mnr') &&
    !modelFile.includes('zmm')
  ) {
    return;
  }
  await appendObjectMetadata(modelFile, `${this.name}.eqg`);
  const document = new Document();
  const objectName = mod.name.replace('.mod', '');
  const buffer = document.createBuffer();
  const scene = document.createScene(objectName);
  const flipMatrix = mat4.create();
  mat4.scale(flipMatrix, flipMatrix, [-1, 1, 1]);
  const node = document.createNode(objectName).setTranslation([0, 0, 0]).setMatrix(flipMatrix);
  const skeletonNodes = [];
  const boneIndices = [];

  if (mod.bones.length) {
    for (const bone of mod.bones) {
      if (bone.childrenCount > 0) {
        let nextIdx = bone.childrenIndex;
        while (nextIdx !== -1) {
          bone.children.push(nextIdx);
          nextIdx = mod.bones[nextIdx].next;
        }
      }
    }
    let idx = 0;
    function recurse(i) {
      const bone = mod.bones[i];
      const node = document.createNode(bone.name);

      skeletonNodes.push(node);
      boneIndices[i] = idx;
      idx++;
      for (const child of bone.children) {
        mod.bones[child].parent = bone;
        const [_b, n] = recurse(child);
        node.addChild(n);
      }
      return [bone, node];
    }
    recurse(0);
  }

  scene.addChild(node);
  const materials = {};
  for (const mat of mod.geometry.mats) {
    if (materials[mat.name]) {
      continue;
    }

    const gltfMaterial = document
      .createMaterial(mat.name)
      .setDoubleSided(false)
      //  .setExtension('KHR_materials_unlit')
      .setRoughnessFactor(1)
      .setMetallicFactor(0);

    for (const prop of mat.properties) {
      const [name] = prop.valueS.toLowerCase().split('.');
      const texture = document
        .createTexture(name)
        .setMimeType('image/png')
        .setImage(new Uint8Array(await getEQFile('textures', `${name}.png`)))
        .setURI(`/eq/textures/${name}`)
        .setExtras({
          name,
        });
      if (prop.name.includes('Normal')) {
        gltfMaterial.setNormalTexture(texture);
      }
      if (
        prop.name.includes('Diffuse') ||
        (prop.name.includes('Detail') && !gltfMaterial.getBaseColorTexture())
      ) {
        gltfMaterial.setBaseColorTexture(texture);
      }
    }
    switch (mat.shader) {
      case 'Alpha_MaxCBSG1.fx':
      case 'Chroma_MaxC1.fx':
        gltfMaterial.setAlpha(0.5).setAlphaMode('MASK');
        break;
      default:
        gltfMaterial.setAlphaMode('OPAQUE');

        break;
    }

    // Check shaders
    materials[mat.name] = gltfMaterial;
  }
  const primitiveMap = {};
  const gltfMesh = document.createMesh(modelFile);

  for (const p of mod.geometry.polys) {
    if (p.material === -1) {
      continue;
    }
    const mat = mod.geometry.mats[p.material];
    const linkedMat = materials[mat?.name];
    if (!linkedMat) {
      console.warn(`Linked mat not found! ${mat?.name}`);
      continue;
    }
    const v1 = mod.geometry.verts[p.verts[0]];
    const v2 = mod.geometry.verts[p.verts[1]];
    const v3 = mod.geometry.verts[p.verts[2]];

    const b1 = v1.boneAssignment?.weights ?? [];
    const b2 = v2.boneAssignment?.weights ?? [];
    const b3 = v3.boneAssignment?.weights ?? [];

    let sharedPrimitive = primitiveMap[mat.name];
    if (!sharedPrimitive) {
      sharedPrimitive = primitiveMap[mat.name] = {
        gltfMesh: gltfMesh,
        gltfPrim: document
          .createPrimitive()
          .setMaterial(linkedMat)
          .setName(mat.name),
        indices: [],
        vecs   : [],
        joints : [],
        weights: [],
        normals: [],
        uv     : [],
      };
      gltfMesh.addPrimitive(sharedPrimitive.gltfPrim);
    }
    const ln = sharedPrimitive.indices.length;
    if (false && b1.length && b2.length && b3.length) {
      const reducer = (acc, val, idx, obj) => {
        const boneVal = boneIndices[val.bone];
        let boneIdx, weight;
        if (val.bone === -1) {
          boneIdx = skeletonNodes.length;
          weight = idx === 0 ? 1 : 0;
        } else if (boneVal === undefined) {
          boneIdx = boneIndices[obj[0].bone];
          weight = 0;
        } else {
          boneIdx = boneVal;
          weight = val.weight;
        }

        let eqgBone = mod.bones[boneIndices.indexOf(boneIdx)];
        if (!eqgBone) {
          console.log('no bone', boneIdx);
          eqgBone = {
            x     : 0,
            y     : 0,
            z     : 0,
            scaleX: 1,
            scaleY: 1,
            scaleZ: 1,
            rotX  : 0,
            rotY  : 0,
            rotZ  : 0,
            rotW  : 1,
          };
        }

        acc.bones.push(boneIdx);
        acc.weights.push(weight);
        acc.eqgBones.push(eqgBone);
        return acc;
      };

      const bone1 = b1.reduce(reducer, {
        bones   : [],
        weights : [],
        eqgBones: [],
        v       : v1,
      });
      const bone2 = b2.reduce(reducer, {
        bones   : [],
        weights : [],
        eqgBones: [],

        v: v2,
      });
      const bone3 = b3.reduce(reducer, {
        bones   : [],
        weights : [],
        eqgBones: [],

        v: v3,
      });
      // Here i want to use the bones to apply an initial transform on vertices v1, v2, v3
      // Based on bone transform. That will include everything up the parent chain in bone

      const newJoints = [...bone1.bones, ...bone2.bones, ...bone3.bones];
      sharedPrimitive.joints.push(...newJoints);
      const newWeights = [...bone1.weights, ...bone2.weights, ...bone3.weights];
      sharedPrimitive.weights.push(...newWeights);
    }

    sharedPrimitive.indices.push(ln + 0, ln + 1, ln + 2);

    sharedPrimitive.vecs.push(
      ...[v1, v2, v3].flatMap((v) => [v.pos[0], v.pos[2], v.pos[1]])
    );
    sharedPrimitive.normals.push(
      ...[v1, v2, v3].flatMap((v) => [v.nor[0], v.nor[2], v.nor[1]])
    );
    sharedPrimitive.uv.push(
      ...[v1, v2, v3].flatMap((v) => [-v.tex[0], v.tex[1]])
    );
  }

  for (const {
    gltfPrim,
    indices,
    vecs,
    normals,
    uv,
    joints,
    weights,
  } of Object.values(primitiveMap)) {
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
    const primJoints = document
      .createAccessor()
      .setArray(new Uint16Array(joints))
      .setType(Accessor.Type.VEC4);
    const primWeights = document
      .createAccessor()
      .setArray(new Float32Array(weights))
      .setType(Accessor.Type.VEC4);
    gltfPrim
      .setIndices(primIndices)
      .setAttribute('POSITION', primPositions)
      .setAttribute('NORMAL', primNormals)
      .setAttribute('TEXCOORD_0', primUv)
      .setAttribute('JOINTS_0', primJoints)
      .setAttribute('WEIGHTS_0', primWeights);
  }

  if (false && mod.bones.length) {
    const animWriter = new EQGAnimationWriter(
      document,
      skeletonNodes,
      mod.bones,
      boneIndices
    );

    for (const [name, ani] of Object.entries(this.animations)) {
      //  if (name.startsWith(modelFile)) {
      console.log('ani', ani);
      animWriter.applyAnimation(ani, name);
      animWriter.applyAnimation(ani, name, true);
      // }
    }

    const skin = document.createSkin('mesh-skeleton');

    for (const node of skeletonNodes) {
      skin.addJoint(node);
    }

    // node.setMesh(gltfMesh)
    node.setMesh(gltfMesh).setSkin(skin);
    const rootBone = skeletonNodes[boneIndices[0]];
    node.addChild(rootBone);
    const dummyJoint = document.createNode('DUMMY_PLACEHOLDER');
    skin.addJoint(dummyJoint);
    node.addChild(dummyJoint);
  } else {
    node.setMesh(gltfMesh);
  }

  const bytes = await io.writeBinary(document);
  await writeEQFile("objects", diskFileName, bytes.buffer); // eslint-disable-line
}
