
import { quailProcessor } from '../../modules/quail';
import { createBsp } from './bsp';
import { createBspVisualization, toggleRegion } from './debug';
import { createLights } from './lights';
import { createMaterials } from './materials';
import { createMeshes } from './mesh';
import { createZoneObjectInstances } from './objects';
import { createTemplate } from './template';

/**
 * @typedef ZoneObject
 * @property {string} name
 */

/**
 * @typedef ZoneLight
 */

/**
 * @typedef ZoneRegion
 */

/**
 *
 * @param {string} name
 * @param {import('@babylonjs/core/scene').Scene} scene
 * @param {[import('@babylonjs/core/Meshes/mesh').Mesh]} zoneMeshes
 * @param {[import('@babylonjs/core/Meshes/mesh').Mesh]} collisionMeshes
 * @param {[ZoneLight]} lights
 * @param {[ZoneObject]} objects
 * @param {[ZoneRegion]} regions
 * @returns
 */
export const createS3DZone = async (
  name,
  scene,
  zoneMeshes,
  collisionMeshes,
  lights,
  objects,
  eqRegions
) => {
  const regions = eqRegions.filter(r => {
    return r.maxVertex.some(v => v !== 0) || r.minVertex.some(v => v !== 0);
  });
  const zoneTemplate = createTemplate(name);
  // Mat Defs
  const {
    texturePromises,
    materialDefs,
    simpleSpriteDefs,
    materialPalette,
    materialMap,
  } = await createMaterials(name, scene, zoneMeshes, collisionMeshes);
  zoneTemplate.MaterialPalettes.push(materialPalette);
  zoneTemplate.MaterialDefs = materialDefs;
  zoneTemplate.SimpleSpriteDefs = simpleSpriteDefs;

  // Mesh defs
  const { dmSpriteDef2s } = createMeshes(
    scene,
    materialPalette,
    zoneMeshes,
    collisionMeshes,
    materialMap,
    regions
  );
  zoneTemplate.DMSpriteDef2s = dmSpriteDef2s;

  // Define WorldTree
  const { WorldTrees, Regions, Zones } = createBsp(dmSpriteDef2s, regions);
  zoneTemplate.WorldTrees = WorldTrees;
  zoneTemplate.Regions = Regions;
  zoneTemplate.Zones = Zones;
  zoneTemplate.AmbientLights[0].Regions = zoneTemplate.Regions.map((_, idx) => idx);

  // Lights
  const lightsTemplate = createLights();

  // Object instances
  const objectsTemplate = createZoneObjectInstances(objects);

  console.log('Template', zoneTemplate);
  const textures = await Promise.all(
    texturePromises.map(async (t) => ({ ...t, buffer: await t.buffer }))
  );
  console.log('Awaited Textures', textures);

  window.debug = (drawPlanes = false, onlyDivider = false, size = 300, doPolys) => {
    createBspVisualization(scene, { WorldTrees, Regions, Zones }, drawPlanes, onlyDivider, size, doPolys);
  };
  window.debugPoly = () => {
    createBspVisualization(scene, { WorldTrees, Regions, Zones }, false, false, 300, true);

  };
  window.debug(false);
  // window.debug(true, true);
  window.toggleRegion = () => {
    toggleRegion();
  };
  zoneTemplate.DMSpriteDef2s = zoneTemplate.DMSpriteDef2s.filter(d => d.A_originalMesh !== 'box');

  return await quailProcessor.convertS3D(
    name,
    zoneTemplate,
    textures,
    lightsTemplate,
    objectsTemplate
  );
};

export const createS3DObj = async () => {};
export const createS3DChr = async () => {};
