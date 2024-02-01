
export class TerrainTile {
  x = 0;
  y = 0;
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