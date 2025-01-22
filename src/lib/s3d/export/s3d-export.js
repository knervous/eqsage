import { quailProcessor } from '../../../modules/quail';
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
  regions1
) => {
  const regions = regions1.slice(0, 1);
  const zoneTemplate = createTemplate(name);
  // Mat Defs
  const {
    texturePromises,
    materialDefs,
    simpleSpriteDefs,
    materialPalette,
    materialMap,
  } = await createMaterials(name, scene, zoneMeshes, collisionMeshes, regions);
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
  const { WorldTrees, Regions, Zones } = createBsp(dmSpriteDef2s);
  zoneTemplate.WorldTrees = WorldTrees;
  zoneTemplate.Regions = Regions;
  zoneTemplate.Zones = Zones;

  // Lights
  const lightsTemplate = createLights();

  // Object instances
  const objectsTemplate = createZoneObjectInstances(objects);

  console.log('Template', zoneTemplate);
  const textures = await Promise.all(
    texturePromises.map(async (t) => ({ ...t, buffer: await t.buffer }))
  );
  console.log('Awaited Textures', textures);

  window.debug = (draw = false, onlyDivider = false) => {
    createBspVisualization(scene, { WorldTrees, Regions, Zones }, draw, onlyDivider);
  };
  window.debug(false);

  window.toggleRegion = () => {
    toggleRegion();
  };
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
