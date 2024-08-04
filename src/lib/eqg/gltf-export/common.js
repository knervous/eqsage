import { Accessor, Document, WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  draco,
  DRACO_DEFAULTS
} from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { mat4, quat, vec3 } from 'gl-matrix';
import { getEQFileExists, writeEQFile } from '../../util/fileHandler';

const io = new WebIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule()
  });

export async function writeModels(p, zoneMetadata, modelFile, writtenModels, mod, v3) {
  const position = vec3.fromValues(p.x, p.y, p.z); // Replace x, y, z with the object's position

  // let flippedPosition;
  let x, y, z;
  if (v3) {
      
    const flipMatrix = mat4.create();
    mat4.scale(flipMatrix, flipMatrix, [-1, 1, 1]); // Scale X and Z by -1
      
    // Apply the flip transformation to the rotated position
    const flippedPosition = vec3.create();
    vec3.transformMat4(flippedPosition, position, flipMatrix);
    x = flippedPosition[0];
    y = flippedPosition[2];
    z = flippedPosition[1];
  } else {
    // Create a quaternion representing a 270-degree rotation around the X-axis
    const rotation = quat.create();
    quat.rotateY(rotation, rotation, 3 * (Math.PI / 2)); // Rotate 270 degrees

    // Apply the rotation to the position
    const rotatedPosition = vec3.create();
    vec3.transformQuat(rotatedPosition, position, rotation);

    const flipMatrix = mat4.create();
    mat4.scale(flipMatrix, flipMatrix, [-1, -1, 1]); // Scale X and Z by -1
      
    // Apply the flip transformation to the rotated position
    const flippedPosition = vec3.create();
    vec3.transformMat4(flippedPosition, rotatedPosition, flipMatrix);
    x = flippedPosition[1];
    y = flippedPosition[0];
    z = flippedPosition[2];
  }

  const entry = {
    x,
    y,
    z,
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

  if (writtenModels[modelFile.toLowerCase()]) {
    return;
  }
  writtenModels[p.modelFile.toLowerCase()] = true;
  if (await getEQFileExists('objects', `${modelFile}.glb`)) {
    return;
  }
  const document = new Document();
  const objectName = mod.name.replace('.mod', '');
  const buffer = document.createBuffer();
  const scene = document.createScene(objectName);
  const node = document
    .createNode(objectName)
    .setTranslation([0, 0, 0]);
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
  await document.transform(
    // Compress mesh geometry with Draco.
    draco({ ...DRACO_DEFAULTS, quantizationVolume: 'scene' }),
  );
  const bytes = await io.writeBinary(document);
  await writeEQFile('objects', `${modelFile}.glb`, bytes.buffer);
}