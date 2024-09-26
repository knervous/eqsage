/* eslint-disable */
import {
  TypedArrayReader,
  TypedArrayWriter,
} from "../../util/typed-array-reader";
import { Placeable, PlaceableGroup, Region, Terrain } from "../common/models";
import { ZoneV4 } from "./v4-zone";

const rotChange = Math.PI / 180;

export class Light {
  name = '';
  x = 0.0;
  y = 0.0;
  z = 0.0;
  r = 0.0;
  g = 0.0;
  b = 0.0;
  radius = 0.0;
}
export class Zone {
  name = "";
  version = 3;
  zoneRotation = 0;
  zoneOffset = null;
  /**
   * @type {TypedArrayReader}
   */
  reader = null;
  /**
   * @type {import('../../model/file-handle').EQFileHandle}
   */
  fileHandle;

  /**
   * @type {Object.<string, Uint8array>}
   */
  files = {};

  terrain = new Terrain();

  /**
   * @type {[Region]}
   */
  regions = [];

  /**
   * @type {[Light]}
   */
  lights = [];

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
    this.load();
  }

  load() {
    const reader = this.reader;
    const magic = reader.readString(4);
    const [
      version,
      listLength,
      modelCount,
      objectCount,
      regionCount,
      lightCount,
    ] = reader.readManyUint32(6);

    const postHeaderIdx = reader.getCursor();
    reader.addCursor(listLength);

    const modelNames = [];
    for (let i = 0; i < modelCount; i++) {
      const modelId = reader.readUint32();
      const modelName = reader.readCStringFromIdx(postHeaderIdx + modelId);
      this.terrain.modelNames[modelId] = modelName;
      modelNames.push(modelName.replace(")", "_"));
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
      if (p.modelFile?.toLowerCase().includes('.ter')) {
        this.zoneRotation = p.rotateX;
        this.zoneOffset = {
          x,y,z
        }
      }
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
      region.rotateZ = (rot / 512) * 360;
      region.extX = extX;
      region.extY = extY;
      region.extZ = extZ;
      region.flags = [flag_unk1, flag_unk2];
      this.terrain.regions.push(region);
    }

    // Lights
    for (let i = 0; i < lightCount; i++) {
      const light = new Light();
      const loc = reader.readUint32();
      const [x,y,z,r,g,b,radius] = reader.readManyFloat32(7);
      light.name = reader.readCStringFromIdx(postHeaderIdx + loc);
      light.x = x;
      light.y = y;
      light.z = z;
      light.r = r;
      light.g = g;
      light.b = b;
      light.radius = radius;
      this.lights.push(light);
    }
  }

  static Factory(data, fileHandle, name, files) {
    const reader = new TypedArrayReader(data.buffer);
    const magic = reader.previewString(5).trim();
    console.log("Load eqg", magic);
    if (magic === "EQTZP") {
      return new ZoneV4(data, fileHandle, name, files);
    } else {
      return new Zone(data, fileHandle, name, files);
    }
  }
}
