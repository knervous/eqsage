import { vec3 } from 'gl-matrix';
import { TypedArrayReader } from '../../util/typed-array-reader';
import { heightWithinQuad } from '../common/util';
import { Placeable, PlaceableGroup, Region, Terrain } from '../common/models';
import { Tog } from '../tog/tog';

/**
 * @typedef V4Header
 * @property {number} coverMapInputSize
 * @property {number} layeringMapInputSize
 * @property {number} minLat
 * @property {number} maxLat
 * @property {number} minLng
 * @property {number} maxLng
 * @property {number} quadsPerTile
 * @property {number} unitsPerVert
 * @property {number} version
 * @property {[number]} minExtents
 * @property {[number]} maxExtents
 */

const fmod = function (a, b) {
  return Number((a - Math.floor(a / b) * b).toPrecision(8));
};

export class Zone {
  name = '';
  /**
   * @type {TypedArrayReader}
   */
  reader = null;
  /**
   * @type {import('../../model/file-handle').EQFileHandle}
   */
  fileHandle;

  /**
   * @type {V4Header}
   */
  header = {};

  /**
   * @type {Object.<string, Uint8array>}
   */
  files = {};

  terrain = new Terrain();

  /**
   *
   * @param {Uint8Array} data
   * @param {import('../../model/file-handle').EQFileHandle} fileHandle
   * @param {string} name
   * @param {Object.<string, Uint8Array>} files
   */
  constructor(data, fileHandle, name, files) {
    this.reader = new TypedArrayReader(data.buffer);
    this.fileHandle = fileHandle;
    this.files = files;
    this.name = name;
    this.init();
  }

  load() {
    const reader = this.reader;
    const magic = reader.readString(4);
    const [version, listLength, modelCount, objectCount, regionCount, lightCount] = reader.readManyUint32(6);

    const postHeaderIdx = reader.getCursor();
    reader.addCursor(listLength);

    const modelNames = [];
    for (let i = 0; i < modelCount; i++) {
      const modelId = reader.readUint32();
      const modelName = reader.readCStringFromIdx(postHeaderIdx + modelId).replace(')', '_');
      modelNames.push(modelName);
    }
    

    // Placeables
    const rotChange = 180 / Math.PI;
    // Simulate pg to have parity with v4
    const pg = new PlaceableGroup();
    this.terrain.placeableGroups.push(pg);

    for (let i = 0; i < objectCount; i++) {
      const id = reader.readInt32();
      const loc = reader.readUint32();
      const [x, y, z, rx, ry, rz, scale] = reader.readManyFloat32(7);
      const p = new Placeable();
      p.modelName = reader.readCStringFromIdx(postHeaderIdx + loc);
      if (id >= 0 && id < modelNames.length) {
        p.modelFile = modelNames[id];
      }
      p.x = x;
      p.y = y;
      p.z = z;
      p.rotateX = rx * rotChange;
      p.rotateY = ry * rotChange;
      p.rotateZ = rz * rotChange;
      p.scaleX = p.scaleY = p.scaleZ = scale;
      pg.placeables.push(p);
    }

    // Regions
    for (let i = 0; i < regionCount; i++) {
      const loc = reader.readUint32();
      const [x, y, z, rot] = reader.readManyFloat32(4);
      const [flag_unk1, flag_unk2] = reader.readManyUint32(2);
      const [extX, extY, extZ] = reader.readManyFloat32(3);
      const region = new Region();
      region.name = reader.readCStringFromIdx(postHeaderIdx + loc);
      region.x = x;
      region.y = y;
      region.z = z;
      region.rotateZ = rot / 512 * 360;
      region.extX = extX;
      region.extY = extY;
      region.extZ = extZ;
      region.flags = [flag_unk1, flag_unk2];
      this.terrain.regions.push(region);
    }

  }

  loadv4() {
    const header = this.reader
      .readString(this.reader.buffer.byteLength)
      .split(/\*/)
      .map((a) => a.trim());
    for (const line of header) {
      const [attr, ...rest] = line.split(' ');
      switch (attr) {
        case 'EQTZP':
          break;
        case 'NAME':
          this.header.version = rest[0];
          break;
        case 'MINLNG':
          this.header.minLng = +rest[0];
          break;
        case 'MAXLNG':
          this.header.maxLng = +rest[0];
          break;
        case 'MINLAT':
          this.header.minLat = +rest[0];
          break;
        case 'MAXLAT':
          this.header.maxLat = +rest[0];
          break;
        case 'MIN_EXTENTS':
          this.header.minExtents = rest.map((a) => +a);
          break;
        case 'MAX_EXTENTS':
          this.header.maxExtents = rest.map((a) => +a);
          break;
        case 'UNITSPERVERT':
          this.header.unitsPerVert = +rest[0];
          break;
        case 'QUADSPERTILE':
          this.header.quadsPerTile = +rest[0];
          break;
        case 'COVERMAPINPUTSIZE':
          this.header.coverMapInputSize = +rest[0];
          break;
        case 'LAYERINGMAPINPUTSIZE':
          this.header.layeringMapInputSize = +rest[0];
          break;
        case 'VERSION':
          this.header.version = +rest[0];
          break;
        default:
          console.warn(`Unknown attribute in EQG header v4 ${attr}`);
          break;
      }
    }
  }

  init() {
    const reader = this.reader;
    const magic = reader.previewString(5).trim();
    if (magic === 'EQTZP') {
      this.loadv4();
    } else {
      this.load();
    }
    // const [version, strings_len, model_count, object_count, region_count, light_count] = reader.readManyUint32(6);

    console.log('Load eqg', magic);
    // console.log('Version', reader.readUint32());
    // console.log('Strin len', reader.readUint32());
    //  console.log(magic, 'version, strings_len, model_count, object_count, region_count, light_count', version, strings_len, model_count, object_count, region_count, light_count);
  }
}

export class ZoneData {
  /**
   * @type {Zone}
   */
  #zone = null;
  /**
   *
   * @param {Uint8Array} data
   * @param {import('../../model/file-handle').EQFileHandle} fileHandle
   * @param {Zone} zone
   */
  constructor(data, fileHandle, name, zone) {
    this.reader = new TypedArrayReader(data.buffer);
    this.fileHandle = fileHandle;
    this.name = name;
    this.#zone = zone;
    this.load();
  }

  load() {
    const reader = this.reader;
    const [unk000, unk004, unk008] = reader.readManyUint32(3);
    const baseTileTexture = reader.readCString();
    const tileCount = reader.readUint32();
    const { unitsPerVert, quadsPerTile, minLat, minLng } = this.#zone.header;

    const zoneMinX = minLat * quadsPerTile * unitsPerVert;
    const zoneMinY = minLng * quadsPerTile * unitsPerVert;
    const quadCount = quadsPerTile * quadsPerTile;
    const vertCount = (quadsPerTile + 1) * (quadsPerTile + 1);

    for (let i = 0; i < tileCount; i++) {
      const tile = {
        floats : [],
        colors : [],
        colors2: [],
        flags  : [],
      };
      const [tileLng, tileLat, _tileUnk] = reader.readManyUint32(3);
      const tileStartY =
        zoneMinY + (tileLng - 100000 - minLng) * unitsPerVert * quadsPerTile;
      const tileStartX =
        zoneMinX + (tileLat - 100000 - minLat) * unitsPerVert * quadsPerTile;
      let allFloatsSame = true;

      const currentAvg = 0;
      tile.floats = reader.readManyFloat32(vertCount);
      if (tile.floats.length) {
        const lastKnownFloat = tile.floats[0];
        for (const f of tile.floats) {
          if (f !== lastKnownFloat) {
            allFloatsSame = false;
            break;
          }
        }
      }
      
      tile.colors = reader.readManyUint32(vertCount);
      tile.colors2 = reader.readManyUint32(vertCount);
      tile.flags = reader.readManyUint8(quadCount);
      for (const flag of tile.flags) {
        if (flag & 0x01) {
          // allFloatsSame = false;
        }
      }
      tile.allFloatsSame = allFloatsSame;
      tile.baseWaterLevel = reader.readFloat32();
      tile.x = tileStartX;
      tile.y = tileStartY;
      const unk1 = reader.readInt32();

      if (unk1 > 0) {
        const unkByte = reader.readUint8();
        if (unkByte > 0) {
          const [f1, f2, f3, f4] = reader.readManyFloat32(4);
        }
        const f1 = reader.readFloat32();
      }

      const layerCount = reader.readUint32();

      const baseMaterial = reader.readCString();
      let overlayCount = 0;
      for (let layer = 1; layer < layerCount; layer++) {
        const material = reader.readCString();
        tile.material = material;
        tile.baseMaterial = baseMaterial;
        const detailMaskDim = reader.readUint32();
        const size = Math.pow(detailMaskDim, 2);
        for (let b = 0; b < size; b++) {
          const detailMaskByte = reader.readUint8();
        }
        overlayCount++;
      }

      const singlePlaceableCount = reader.readUint32();
      for (let i = 0; i < singlePlaceableCount; i++) {
        const modelName = reader.readCString().toLowerCase();
        const s = reader.readCString();

        const [longitude, latitude] = reader.readManyUint32(2);
        const [x, y, z] = reader.readManyFloat32(3);
        const [rotX, rotY, rotZ] = reader.readManyFloat32(3);
        const [scaleX, scaleY, scaleZ] = reader.readManyFloat32(3);

        const unk1 = reader.readUint8();
        if (unk000 & 2) {
          const unk = reader.readUint32();
        }
        const p = new Placeable();
        p.modelName = modelName;
        p.modelFile = modelName;
        p.x = 0;
        p.y = 0;
        p.z = 0;
        p.rotateX = rotX;
        p.rotateY = rotY;
        p.rotateZ = rotZ;
        p.scaleX = scaleX;
        p.scaleY = scaleY;
        p.scaleZ = scaleZ;

        const pg = new PlaceableGroup();
        pg.x = x;
        pg.y = y;
        pg.z = z;

        let terrainHeight = 0.0;
        let adjustedX = x;
        let adjustedY = y;
        const grid = unitsPerVert * quadsPerTile;
        if (adjustedX < 0) {
          adjustedX = adjustedX + (-(adjustedX / grid) + 1) * grid;
        } else {
          adjustedX = fmod(adjustedX, grid);
        }

        if (adjustedY < 0) {
          adjustedY = adjustedY + (-(adjustedY / grid) + 1) * grid;
        } else {
          adjustedY = fmod(adjustedY, grid);
        }

        const rowNumber = Math.floor(adjustedY / unitsPerVert);
        const column = Math.floor(adjustedX / unitsPerVert);
        const quad = rowNumber * quadsPerTile + column;

        const quadVertex1Z = tile.floats[quad + rowNumber];
        const quadVertex2Z = tile.floats[quad + rowNumber + quadsPerTile + 1];
        const quadVertex3Z = tile.floats[quad + rowNumber + quadsPerTile + 2];
        const quadVertex4Z = tile.floats[quad + rowNumber + 1];

        const p1 = vec3.fromValues(
          rowNumber * unitsPerVert,
          (quad % quadsPerTile) * unitsPerVert,
          quadVertex1Z
        );
        const p2 = vec3.fromValues(p1[0] + unitsPerVert, p1[1], quadVertex2Z);
        const p3 = vec3.fromValues(
          p1[0] + unitsPerVert,
          p1[1] + unitsPerVert,
          quadVertex3Z
        );
        const p4 = vec3.fromValues(p1[0], p1[1] + unitsPerVert, quadVertex4Z);

        terrainHeight = heightWithinQuad(p1, p2, p3, p4, adjustedY, adjustedX);
        pg.tileX = tileStartY;
        pg.tileY = tileStartX;
        pg.tileZ = terrainHeight;

        pg.placeables.push(p);
        this.#zone.terrain.placeableGroups.push(pg);
      }

      const areasCount = reader.readUint32();
      for (let i = 0; i < areasCount; i++) {
        const s = reader.readCString();
        const type = reader.readInt32();
        const s2 = reader.readCString();

        const [longitude, latitude] = reader.readManyUint32(2);

        const [
          x,
          y,
          z,
          rotX,
          rotY,
          rotZ,
          scaleX,
          scaleY,
          scaleZ,
          sizeX,
          sizeY,
          sizeZ,
        ] = reader.readManyFloat32(12);

        let terrainHeight = 0.0;
        let adjustedX = x;
        let adjustedY = y;
        const grid = unitsPerVert * quadsPerTile;
        if (adjustedX < 0) {
          adjustedX = adjustedX + (-(adjustedX / grid) + 1) * grid;
        } else {
          adjustedX = fmod(adjustedX, grid);
        }

        if (adjustedY < 0) {
          adjustedY = adjustedY + (-(adjustedY / grid) + 1) * grid;
        } else {
          adjustedY = fmod(adjustedY, grid);
        }

        const rowNumber = Math.floor(adjustedY / unitsPerVert);
        const column = Math.floor(adjustedX / unitsPerVert);
        const quad = rowNumber * quadsPerTile + column;

        const quadVertex1Z = tile.floats[quad + rowNumber];
        const quadVertex2Z = tile.floats[quad + rowNumber + quadsPerTile + 1];
        const quadVertex3Z = tile.floats[quad + rowNumber + quadsPerTile + 2];
        const quadVertex4Z = tile.floats[quad + rowNumber + 1];

        const p1 = vec3.fromValues(
          rowNumber * unitsPerVert,
          (quad % quadsPerTile) * unitsPerVert,
          quadVertex1Z
        );
        const p2 = vec3.fromValues(p1[0] + unitsPerVert, p1[1], quadVertex2Z);
        const p3 = vec3.fromValues(
          p1[0] + unitsPerVert,
          p1[1] + unitsPerVert,
          quadVertex3Z
        );
        const p4 = vec3.fromValues(p1[0], p1[1] + unitsPerVert, quadVertex4Z);

        terrainHeight = heightWithinQuad(p1, p2, p3, p4, adjustedY, adjustedX);
        const region = new Region();
        region.name = s;
        region.altName = s2;
        region.x = x + tileStartY;
        region.y = y + tileStartX;
        region.z = z + terrainHeight;
        region.rotateX = rotX;
        region.rotateY = rotY;
        region.rotateZ = rotZ;
        region.scaleX = scaleX;
        region.scaleY = scaleY;
        region.scaleZ = scaleZ;
        region.extX = sizeX / 2;
        region.extY = sizeY / 2;
        region.extZ = sizeZ / 2;
        region.flags = [type, 0];
        this.#zone.terrain.regions.push(region);
      }

      const lightFxCount = reader.readUint32();
      for (let i = 0; i < lightFxCount; i++) {
        const s = reader.readCString();
        const s2 = reader.readCString();
        const unk = reader.readUint8();
        const [longitude, latitude] = reader.readManyUint32(2);

        const [x, y, z, rotX, rotY, rotZ, scaleX, scaleY, scaleZ, unk1] =
          reader.readManyFloat32(10);

        
      }

      const togRefCount = reader.readUint32();
      for (let j = 0; j < togRefCount; j++) {
        const togName = reader.readCString();
        const [longitude, latitude] = reader.readManyUint32(2);

        const [x, y, z, rotX, rotY, rotZ, scaleX, scaleY, scaleZ, zAdjust] =
            reader.readManyFloat32(10);

        let togBuffer;
        for (const [key, buffer] of Object.entries(this.#zone.files)) {
          if (key.toLowerCase().startsWith(togName.toLowerCase())) {
            togBuffer = buffer;
            break;
          }
        }
        if (!togBuffer) {
          console.warn('Associated tog not found', togName);
          continue;
        }

        const pg = new PlaceableGroup();
        pg.fromTog = true;
        pg.x = x;
        pg.y = y;
        pg.z = z + (scaleZ + zAdjust);
        pg.rotateX = rotX;
        pg.rotateY = rotY;
        pg.rotateZ = rotZ;
        pg.scaleX = scaleX;
        pg.scaleY = scaleY;
        pg.scaleZ = scaleZ;
        pg.tileX = tileStartY;
        pg.tileY = tileStartX;
        pg.tileZ = 0;

        const tog = new Tog(togBuffer, pg);
        this.#zone.terrain.placeableGroups.push(tog.pg);
      }

      this.#zone.terrain.tiles.push(tile);
    }
  }
}
