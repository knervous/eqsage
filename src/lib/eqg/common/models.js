import { RegionType, ZoneLineType } from '../../s3d/bsp/bsp-tree';

export class TerrainTile {
  x = 0;
  y = 0;
  material = '';
  baseMaterial = '';
  allFloatsSame = true;
  /**
   * @type {Boolean}
   */
  get flat() {
    return this.allFloatsSame;
  }
  baseWaterLevel = 0;
  /**
   * @type {[Number]}
   */
  colors = [];
  /**
   * @type {[Number]}
   */
  colors2 = [];
  /**
   * @type {[Number]}
   */
  flags = [];
  /**
   * @type {[Number]}
   */
  floats = [];
}

export class WaterSheet {}

export class InvisWall {}

export class Placeable {
  x = 0;
  y = 0;
  z = 0;
  rotateX = 0;
  rotateY = 0;
  rotateZ = 0;
  scaleX = 1;
  scaleY = 1;
  scaleZ = 1;
  modelName = '';
  modelFile = '';
}

export class PlaceableGroup {
  x = 0;
  y = 0;
  z = 0;
  tileX = 0;
  tileY = 0;
  tileZ = 0;
  rotateX = 0;
  rotateY = 0;
  rotateZ = 0;
  scaleX = 1;
  scaleY = 1;
  scaleZ = 1;
  /**
   * @type {[Placeable]}
   */
  placeables = [];
  fromTog = false;
}

export class Region {
  x = 0;
  y = 0;
  z = 0;
  extX = 0;
  extY = 0;
  extZ = 0;
  rotateX = 0;
  rotateY = 0;
  rotateZ = 0;
  scaleX = 1;
  scaleY = 1;
  scaleZ = 1;
  /**
   * @type {[Number]}
   */
  flags = [];
  name = '';
  altName = '';

  translateToMinMaxVertex(box) {
    const { x, y, z, extX, extY, extZ } = box;

    return {
      minVertex: [x - extX, z - extZ, y - extY],
      maxVertex: [x + extX, z + extZ, y + extY],
      center   : [x, z, y],
    };
  }

  regionTypeMap = {
    AWT: RegionType.Water,
    ALV: RegionType.Lava,
    APK: RegionType.Pvp,
    ATP: RegionType.Zoneline,
    ASL: RegionType.Slippery,
    APV: RegionType.Normal,
  };

  parseRegion() {
    const eqRegion = this.translateToMinMaxVertex(this);
    const type = this.regionTypeMap[this.name.slice(0, 3)];
    eqRegion.region = {
      regionTypes: [type].filter((a) => a !== undefined),
    };
    if (type === RegionType.Zoneline) {
      eqRegion.region.zoneLineInfo = {};
      eqRegion.region.zoneLineInfo.type = ZoneLineType.Reference;
      const [, zoneIdRef] = /ATP_(\d+)/.exec(this.name) ?? [];
      if (zoneIdRef !== undefined) {
        const id = +zoneIdRef.split('').reverse('').join('');
        eqRegion.region.zoneLineInfo.index = id;
      }
    }
    return eqRegion;
  }
}

// //

export class Terrain {
  /**
   * @type {[TerrainTile]}
   */
  tiles = [];

  /**
   * @type {[WaterSheet]}
   */
  waterSheets = [];

  /**
   * @type {[InvisWall]}
   */
  invisWalls = [];

  /**
   * @type {[PlaceableGroup]}
   */
  placeableGroups = [];

  /**
   * @type {[Region]}
   */
  regions = [];

  quadsPerTile = 0;
  unitsPerVertex = 0;
}
