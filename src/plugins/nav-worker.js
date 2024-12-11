import * as Comlink from 'comlink';
import { exportNavMesh, init, NavMeshParams, NavMeshCreateParams, Recast } from '@recast-navigation/core';
import { generateTiledNavMesh } from '@recast-navigation/generators';
import { Vector3 } from '@babylonjs/core/Maths/math.js';

const NavigationPolyFlags = 
{
  NavigationPolyFlagNormal     : 1,
  NavigationPolyFlagWater      : 2,
  NavigationPolyFlagLava       : 4,
  NavigationPolyFlagZoneLine   : 8,
  NavigationPolyFlagPvP        : 16,
  NavigationPolyFlagSlime      : 32,
  NavigationPolyFlagIce        : 64,
  NavigationPolyFlagVWater     : 128,
  NavigationPolyFlagGeneralArea: 256,
  NavigationPolyFlagPortal     : 512,
  NavigationPolyFlagPrefer     : 1024,
  NavigationPolyFlagDisabled   : 2048,
  NavigationPolyFlagAll        : 0xFFFF,
};

const NavigationAreaFlags = {
  NavigationAreaFlagNormal     : 0,
  NavigationAreaFlagWater      : 1,
  NavigationAreaFlagLava       : 2,
  NavigationAreaFlagZoneLine   : 3,
  NavigationAreaFlagPvP        : 4,
  NavigationAreaFlagSlime      : 5,
  NavigationAreaFlagIce        : 6,
  NavigationAreaFlagVWater     : 7,
  NavigationAreaFlagGeneralArea: 8,
  NavigationAreaFlagPortal     : 9,
  NavigationAreaFlagPrefer     : 10,
  NavigationAreaFlagDisabled   : 11,
  NavigationAreaFlagMax        : 12
};


const generateNavMesh = async (positions, indices, config) => {
  await init();
  let params;
  const originalCreate = NavMeshParams.create;
  const original_setPolyMeshCreateParams = NavMeshCreateParams.prototype.setPolyMeshCreateParams;

  /**
   * 
   * @param {import('recast-navigation').RecastPolyMesh} pmesh 
   * @returns 
   */
  NavMeshCreateParams.prototype.setPolyMeshCreateParams = function(pmesh) {
    for (let i = 0; i < pmesh.npolys(); ++i) {
      if (pmesh.areas(i) === 0) {
        pmesh.setAreas(i, NavigationAreaFlags.NavigationAreaFlagNormal);
      }
      switch (pmesh.areas(i)) {
        case NavigationAreaFlags.NavigationAreaFlagNormal:
          pmesh.setFlags(i, NavigationPolyFlags.NavigationPolyFlagNormal);
          break;
        case NavigationAreaFlags.NavigationAreaFlagWater:
          pmesh.setFlags(i, NavigationPolyFlags.NavigationPolyFlagWater);
          break;
        case NavigationAreaFlags.NavigationAreaFlagLava:
          pmesh.setFlags(i, NavigationPolyFlags.NavigationPolyFlagLava);
          break;
        case NavigationAreaFlags.NavigationAreaFlagZoneLine:
          pmesh.setFlags(i, NavigationPolyFlags.NavigationPolyFlagZoneLine);
          break;
        case NavigationAreaFlags.NavigationAreaFlagPvP:
          pmesh.setFlags(i, NavigationPolyFlags.NavigationPolyFlagPvP);
          break;
        case NavigationAreaFlags.NavigationAreaFlagSlime:
          pmesh.setFlags(i, NavigationPolyFlags.NavigationPolyFlagSlime);
          break;
        case NavigationAreaFlags.NavigationAreaFlagIce:
          pmesh.setFlags(i, NavigationPolyFlags.NavigationPolyFlagIce);
          break;
        case NavigationAreaFlags.NavigationAreaFlagVWater:
          pmesh.setFlags(i, NavigationPolyFlags.NavigationPolyFlagVWater);
          break;
        case NavigationAreaFlags.NavigationAreaFlagGeneralArea:
          pmesh.setFlags(i, NavigationPolyFlags.NavigationPolyFlagGeneralArea);
          break;
        case NavigationAreaFlags.NavigationAreaFlagPortal:
          pmesh.setFlags(i, NavigationPolyFlags.NavigationPolyFlagPortal);
          break;
        case NavigationAreaFlags.NavigationAreaFlagPrefer:
          pmesh.setFlags(i, NavigationPolyFlags.NavigationPolyFlagPrefer);
          break;
        case NavigationAreaFlags.NavigationAreaFlagDisabled:
        default:
          pmesh.setFlags(i, NavigationPolyFlags.NavigationPolyFlagNormal);
      }
    }
    return original_setPolyMeshCreateParams.call(this, pmesh);
  };
  NavMeshParams.create = function(config) {
    // const { x, y, z } = config.orig;
    // config.orig = { x, y: y, z: z };
    params = config;
    return originalCreate.call(NavMeshParams, config);
  };
  const { success, navMesh, error } = generateTiledNavMesh(
    positions,
    indices,
    config
  );

  if (!success) {
    console.log('Error', error);
    return null;
  }
  const navMeshExport = exportNavMesh(navMesh);
  setTimeout(() => {
    navMesh.destroy();
  }, 500);
  return {
    params,
    data: Comlink.transfer(navMeshExport.buffer, [navMeshExport.buffer])
  };
};

const exports = { generateNavMesh };

/** @type {typeof exports} */
const exp = Object.fromEntries(Object.entries(exports).map(([key, fn]) => [key, async (...args) => {
  try {
    return await fn(...args);
  } catch (error) {
    console.error('Worker error', error);
  }
}]));

export default exp;

Comlink.expose(exp);
