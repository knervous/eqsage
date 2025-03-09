import { Accessor, Document, WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsSpecular } from '@gltf-transform/extensions';
import { quat } from 'gl-matrix';
import { getEQFile, writeEQFile } from '../../util/fileHandler';
import { VERSION } from '../../model/constants';
import { writeMetadata } from './common';

import { draco, DRACO_DEFAULTS } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

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

// Helper function to convert uint32 (assumed format 0xAARRGGBB) to normalized [r, g, b, a]
function uint32ToRGBA(color) {
  const a = ((color >> 24) & 0xFF) / 255;
  const r = ((color >> 16) & 0xFF) / 255;
  const g = ((color >> 8) & 0xFF) / 255;
  const b = (color & 0xFF) / 255;
  return [r, g, b, a];
}

export async function exportv3(zoneName) {
  const document = new Document();
  const buffer = document.createBuffer();

  if (!this.zone) {
    console.warn('No zone', this);
    return;
  }
  const scene = document.createScene(this.zone.name);
  const node = document
    .createNode(`zone-${this.zone.name.replace('.zon', '')}`)
    .setTranslation([0, 0, 0])
    .setScale([-1, 1, 1]);

  const zoneRotation = quat.create();
  node.setRotation(zoneRotation);
  scene.addChild(node);

  const zoneMetadata = {
    version: VERSION,
    objects: {},
    lights : [],
    sounds : [],
    regions: [],
  };

  const materials = {};

  // Regions
  for (const region of this.zone.terrain.regions) {
    zoneMetadata.regions.push(region.parseRegion());
  }

  // Create materials.
  for (const [_key, mod] of Object.entries(this.models)) {
    for (const mat of mod.geometry.mats) {
      const materialKey = mod.name + mat.name;
      if (materials[materialKey]) {
        continue;
      }

      const gltfMaterial = document
        .createMaterial(materialKey)
        .setDoubleSided(false)
        .setRoughnessFactor(1)
        .setMetallicFactor(0);
      const specularExtension = document.createExtension(KHRMaterialsSpecular);
      const specular = specularExtension.createSpecular()
        .setSpecularFactor(0.0)
        .setSpecularColorFactor([0, 0, 0]);
      gltfMaterial.setExtension('KHR_materials_specular', specular);
      for (const prop of mat.properties) {
        const [name] = prop.valueS.toLowerCase().split('.');
        const texture = document
          .createTexture(name)
          // .setImage(new Uint8Array(await getEQFile('textures', `${name}.png`)))
          .setURI(`/eq/textures/${name}`)
          .setExtras({ name, shader: mat.shader });
        if (prop.name.includes('Normal')) {
          gltfMaterial.setNormalTexture(texture);
        }
        if (
          prop.name.includes('Diffuse') ||
          (prop.name.includes('Detail') && !gltfMaterial.getBaseColorTexture())
        ) {
          gltfMaterial.setName(name);
          gltfMaterial.setBaseColorTexture(texture);
        }
      }
      if (mat.shader.startsWith('Alpha') || mat.shader.startsWith('Chroma')) {
        gltfMaterial.setAlphaMode('BLEND');
      } else {
        gltfMaterial.setAlphaMode('OPAQUE');
      }
      materials[materialKey] = gltfMaterial;
    }
  }

  const terrain = this.zone.terrain;
  const writtenModels = {};

  for (const [name, mod] of Object.entries(this.models)) {
    if (!name.includes('ter_')) {
      await this.writeModels(name, mod);
    }
  }

  // Loop over placeable groups
  for (const pg of terrain.placeableGroups) {
    // Rename outer loop variable to "placeable"
    for (const placeable of pg.placeables) {
      // Get the per-vertex lit data (uint32 array)
      const lit = placeable.lit ?? [];

      let modelFile = placeable.modelFile.toLowerCase();
      const mod = this.models[modelFile] || this.models[`${modelFile}.mod`];
      modelFile = modelFile.replace('.mod', '');
      if (!mod) {
        continue;
      }
      if (!mod?.name.toLowerCase().endsWith('.ter')) {
        await writeMetadata.call(this, placeable, zoneMetadata, modelFile, writtenModels, true);
        continue;
      }
      console.log('mod', mod);
      if (mod) {
        const primitiveMap = {};
        // Process each polygon in the model geometry.
        // (Renaming inner loop variable to "poly" for clarity.)
        for (const poly of mod.geometry.polys) {
          if (poly.material === -1) {
            continue;
          }
          const mat = mod.geometry.mats[poly.material];
          const linkedMat = materials[mod.name + mat.name];
          if (!linkedMat) {
            console.log(`Linked mat not found! ${mod.name + mat.name}`);
            continue;
          }

          // Get the vertices for this polygon.
          const v1 = mod.geometry.verts[poly.verts[0]];
          const v2 = mod.geometry.verts[poly.verts[1]];
          const v3 = mod.geometry.verts[poly.verts[2]];

          // Generate a primitive name (same as your current logic).
          let primName = mat.name;
          const endDigitRegex = /-(\d+)$/;
          while (primitiveMap[primName]?.vecs?.length > 200000) {
            if (endDigitRegex.test(primName)) {
              const [, n] = endDigitRegex.exec(primName);
              primName = primName.replace(endDigitRegex, `-${+n + 1}`);
            } else {
              primName += '-0';
            }
          }
          let sharedPrimitive = primitiveMap[primName];
          if (!sharedPrimitive) {
            const mesh = document.createMesh(primName);
            const materialNode = document.createNode(primName).setMesh(mesh);
            node.addChild(materialNode);
            sharedPrimitive = primitiveMap[primName] = {
              gltfPrim: document.createPrimitive().setMaterial(linkedMat).setName(primName),
              indices : [],
              vecs    : [],
              normals : [],
              uv      : [],
              colors  : [] // <-- Add a colors array to hold per-vertex RGBA data.
            };
            mesh.addPrimitive(sharedPrimitive.gltfPrim);
          }

          // Record indices. (Your logic swaps indices later for winding order.)
          const ln = sharedPrimitive.indices.length;
          sharedPrimitive.indices.push(ln + 0, ln + 1, ln + 2);

          // Push vertex positions (note the coordinate conversion).
          sharedPrimitive.vecs.push(
            ...[-v1.pos[0], v1.pos[2], -v1.pos[1]],
            ...[-v2.pos[0], v2.pos[2], -v2.pos[1]],
            ...[-v3.pos[0], v3.pos[2], -v3.pos[1]]
          );

          // Push normals.
          sharedPrimitive.normals.push(
            ...[-v1.nor[0], v1.nor[2], -v1.nor[1]],
            ...[-v2.nor[0], v2.nor[2], -v2.nor[1]],
            ...[-v3.nor[0], v3.nor[2], -v3.nor[1]]
          );

          // Push UV coordinates.
          sharedPrimitive.uv.push(
            ...[v1.tex[0], v1.tex[1]],
            ...[v2.tex[0], v2.tex[1]],
            ...[v3.tex[0], v3.tex[1]]
          );

          // Push vertex colors.
          // Here we use the vertex index from the polygon to look up the corresponding lit color.
          const col1 = uint32ToRGBA(lit[poly.verts[0]]);
          const col2 = uint32ToRGBA(lit[poly.verts[1]]);
          const col3 = uint32ToRGBA(lit[poly.verts[2]]);
          sharedPrimitive.colors.push(...col1, ...col2, ...col3);
        }
        console.log('Pri', primitiveMap);
        // Now create accessors for each primitive.
        for (const { gltfPrim, indices, vecs, normals, uv, colors } of Object.values(primitiveMap)) {
          const idc = new Uint16Array(indices);
          for (let i = 0; i < indices.length; i += 3) {
            // Adjust index order as per your winding requirements.
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
            .setType(Accessor.Type.VEC3)
            .setArray(new Float32Array(normals))
            .setBuffer(buffer);
          const primColors = document
            .createAccessor()
            .setType(Accessor.Type.VEC4)
            .setArray(new Float32Array(colors))
            .setBuffer(buffer);
          gltfPrim.setAttribute('COLOR_0', primColors);
          const primUv = document
            .createAccessor()
            .setType(Accessor.Type.VEC2)
            .setArray(new Float32Array(uv))
            .setBuffer(buffer);
          gltfPrim.setAttribute('TEXCOORD_0', primUv);

          // Create an accessor for vertex colors.
 
          gltfPrim
            .setIndices(primIndices)
            .setAttribute('POSITION', primPositions)
            .setAttribute('NORMAL', primNormals);
        }
      } else {
        console.warn('Did not find model for placeable', placeable);
      }
    }
  }

  // Write out metadata and the final GLB.
  await writeEQFile(
    'zones',
  `${this.zone.name.replace('.zon', '.json')}`,
  JSON.stringify(zoneMetadata)
  );
  console.log('Start', document);
  try {
    await document.transform(
      // Compress mesh geometry with Draco.
      draco({ ...DRACO_DEFAULTS, quantizationVolume: 'scene' })
    );
  } catch (e) {
    console.log('Error with draco compression', e);
  }
 
  console.log('Finish draco');
  const bytes = await io.writeBinary(document);
  await writeEQFile('zones', `${zoneName}.glb`, bytes.buffer);
}
