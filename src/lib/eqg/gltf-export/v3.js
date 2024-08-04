
import { Accessor, Document, WebIO } from '@gltf-transform/core';
import {
  draco,
  DRACO_DEFAULTS
} from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { quat } from 'gl-matrix';
import { writeEQFile } from '../../util/fileHandler';
import { VERSION } from '../../model/constants';

const io = new WebIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule()
  });


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
  // quat.fromEuler(zoneRotation, 0, -90, 0); // Rotate 90 degrees around the Y axis
  
  node.setRotation(zoneRotation);
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

  const materials = {};


  // Regions
  for (const region of this.zone.terrain.regions) {
    zoneMetadata.regions.push(region.parseRegion());
  }

  for (const [_key, mod] of Object.entries(this.models)) {
    for (const mat of mod.geometry.mats) {
      if (materials[mat.name]) {
        continue;
      }

      const gltfMaterial = document
        .createMaterial(mat.name)
        .setDoubleSided(false)
        //   .setExtension('KHR_materials_unlit')
        .setRoughnessFactor(1)
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
    }
  }

  const terrain = this.zone.terrain;
  const writtenModels = {};


  for (const pg of terrain.placeableGroups) {
    for (const p of pg.placeables) {
      let modelFile = p.modelFile.toLowerCase();
      const mod = this.models[modelFile] || this.models[`${modelFile}.mod`];
      modelFile = modelFile.replace('.mod', '');
      if (!mod) {
        continue;
      }
      if (!mod?.name.includes('ter_')) {
        await this.writeModels(p, zoneMetadata, modelFile, writtenModels, mod, true);
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

          let name = mat.name;
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
              gltfPrim: document
                .createPrimitive()
                .setMaterial(linkedMat)
                .setName(name),
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
  await document.transform(
    // Compress mesh geometry with Draco.
    draco({ ...DRACO_DEFAULTS, quantizationVolume: 'scene' }),
  );
  const bytes = await io.writeBinary(document);
  await writeEQFile('zones', zoneName, bytes.buffer);
}