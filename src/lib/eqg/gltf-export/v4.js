
import { Accessor, Document, WebIO } from '@gltf-transform/core';


import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { quat } from 'gl-matrix';
import { writeEQFile } from '../../util/fileHandler';
import { VERSION } from '../../model/constants';

const io = new WebIO()
  .registerExtensions(ALL_EXTENSIONS);

export async function exportv4(zoneName) {
  const document = new Document();
  const buffer = document.createBuffer();
  if (!this.zone) {
    console.warn('No zone', this);
    return;
  }
  const scene = document.createScene(this.zone.name);
  const node = document
    .createNode(`zone-${this.zone.name.replace('.zon', '')}`)
    .setExtras({ uvMap: true })
    .setTranslation([0, 0, 0]);
  const zoneRotation = quat.create();
  quat.fromEuler(zoneRotation, 0, -90, 0); // Rotate 90 degrees around the Y axis

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

  const quadsPerTile = this.zone.header.quadsPerTile;
  const unitsPerVertex = this.zone.header.unitsPerVert;
  const ter_quad_count =
    quadsPerTile * quadsPerTile;

  const materials = {};
  for (const [key, eco] of Object.entries(this.eco)) {
    for (const tex of eco.textureLayers) {
      if (!materials[key]) {
        materials[key] = [];
      }

      const gltfMaterial = document
        .createMaterial(tex.name)
        .setDoubleSided(false)
        //  .setExtension('KHR_materials_unlit')
        .setRoughnessFactor(1)
        .setMetallicFactor(0);
      const detailText = tex.detailMap.replace('.dds', '');
      const _normalText = tex.normalMap.replace('.dds', '');
      gltfMaterial.setBaseColorTexture(document
        .createTexture(detailText)
        .setURI(`/eq/textures/${detailText}`));

      // gltfMaterial.setNormalTexture(document
      //   .createTexture(normalText)
      //   .setURI(`/eq/textures/${normalText}`));
      gltfMaterial.setAlphaMode('OPAQUE');
      materials[key].push(gltfMaterial);
    }
  }

  for (const [_key, mod] of Object.entries(this.models)) {
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
     
  // Base terrain
  let lastKnownBaseMaterial = '';

  const primitiveMap = {};

  for (const tile of this.zone.terrain.tiles) {
    const baseMat = tile.baseMaterial || lastKnownBaseMaterial || this.zone.terrain.tiles.find(a => a.baseMaterial)?.baseMaterial || 'obmain';
    lastKnownBaseMaterial = baseMat.toLowerCase();
    const linkedMat = materials[lastKnownBaseMaterial];
    if (!linkedMat) {
      console.warn(`Linked mat not found! ${lastKnownBaseMaterial}`);
      continue;
    }
    let name = lastKnownBaseMaterial;
    const endDigitRegex = /-(\d+)$/;
    while (primitiveMap[name]?.vecs?.length > 100000) {
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
          .setMaterial(linkedMat.at(-1))
          .setName(name),
        indices: [],
        vecs   : [],
        normals: [],
        uv     : [],
      };
      mesh.addPrimitive(sharedPrimitive.gltfPrim);
    }
    let row_number = -1;
    for (let quad = 0; quad < ter_quad_count; ++quad) {
      if (quad % quadsPerTile === 0) {
        ++row_number;
      }

      const QuadVertex1X = tile.x + row_number * unitsPerVertex;
      const QuadVertex1Y = tile.y + (quad % quadsPerTile) * unitsPerVertex;
      const QuadVertex1Z = tile.floats[quad + row_number];

      const QuadVertex2X = QuadVertex1X + unitsPerVertex;
      const QuadVertex2Y = QuadVertex1Y;
      const QuadVertex2Z = tile.floats[quad + row_number + quadsPerTile + 1];

      const QuadVertex3X = QuadVertex1X + unitsPerVertex;
      const QuadVertex3Y = QuadVertex1Y + unitsPerVertex;
      const QuadVertex3Z = tile.floats[quad + row_number + quadsPerTile + 2];

      const QuadVertex4X = QuadVertex1X;
      const QuadVertex4Y = QuadVertex1Y + unitsPerVertex;
      const QuadVertex4Z = tile.floats[quad + row_number + 1];

      const ln = (sharedPrimitive.vecs.length / 3);
      sharedPrimitive.vecs.push(QuadVertex1X, QuadVertex1Z, QuadVertex1Y);
      sharedPrimitive.vecs.push(QuadVertex2X, QuadVertex2Z, QuadVertex2Y);
      sharedPrimitive.vecs.push(QuadVertex3X, QuadVertex3Z, QuadVertex3Y);
      sharedPrimitive.vecs.push(QuadVertex4X, QuadVertex4Z, QuadVertex4Y);

      sharedPrimitive.uv.push(
        0, 0, 
        1, 0,
        1, 1,
        0, 1);
      sharedPrimitive.indices.push(ln + 3, ln + 2, ln + 1, ln + 1, ln + 0, ln + 3);
    }
  }

  for (const [
    name,
    { gltfPrim, indices, vecs, uv },
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
    const primUv = document
      .createAccessor()
      .setType(Accessor.Type.VEC2)
      .setArray(new Float32Array(uv));

    gltfPrim
      .setName(name)
      .setIndices(primIndices)
      .setAttribute('POSITION', primPositions)
      .setAttribute('TEXCOORD_0', primUv);
  }

  // Regions
  for (const region of this.zone.terrain.regions) {
    zoneMetadata.regions.push(region.parseRegion(true));
  }

  // Models
  const writtenModels = {};
  for (const pg of this.zone.terrain.placeableGroups) {
    for (const p of pg.placeables) {
      let modelFile = p.modelFile ? p.modelFile.toLowerCase() : p.modelName.toLowerCase();
      const mod = this.models[modelFile] || this.models[`${modelFile}.mod`];
      modelFile = modelFile.replace('.mod', '');

      if (!mod) {
        console.warn(`Mod not found: ${p.modelFile}`);
        continue;
      }

      p.y += pg.x + pg.tileX;
      p.x += pg.y + pg.tileY;
      p.z += pg.z + pg.tileZ;

      const t = p.rotateZ;
      p.rotateY = t;
      p.rotateZ = p.rotateY;
      p.rotateZ = 0;
      p.rotateX = 0;
       
      await this.writeModels(p, zoneMetadata, modelFile, writtenModels, mod);
    }
  }

  await writeEQFile(
    'zones',
      `${zoneName}.json`,
      JSON.stringify(zoneMetadata)
  );

  const bytes = await io.writeBinary(document);
  await writeEQFile('zones', `${zoneName}.glb`, bytes.buffer);
}