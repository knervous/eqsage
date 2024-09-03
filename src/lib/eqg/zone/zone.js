/* eslint-disable */
import {
  TypedArrayReader,
  TypedArrayWriter,
} from "../../util/typed-array-reader";
import { Placeable, PlaceableGroup, Region, Terrain } from "../common/models";
import { ZoneV4 } from "./v4-zone";

const rotChange = Math.PI / 180;
export class Zone {
  name = "";
  version = 3;
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

  /**
   * Write the .zon file data
   * @param {string} name
   * @param {Terrain} terrain
   * @param {Object.<string, Uint8Array>} files
   * @returns {Uint8Array}
   */
  static write(terrain) {
    // Calculate necessary sizes and offsets
    const preamble = "EQGZ";
    const headerSize = 24;
    const placeableGroup = terrain.placeableGroups[0];
    // Calculate the total length of model names
    const modelNames = Object.values(terrain.modelNames);
    const modelIds = Object.keys(terrain.modelNames);
    const modelNamesLength = modelNames.reduce(
      (acc, name) => acc + name.length + 1,
      0
    ); // +1 for null terminator

    // Calculate the total length of region names
    const regionNames = new Map();
    let regionId = 0;
    terrain.regions.forEach((region) => {
      const regionName = region.name;
      if (!regionNames.has(regionName)) {
        regionNames.set(regionName, regionId++);
      }
    });
    const regionNamesLength = Array.from(regionNames.keys()).reduce(
      (acc, name) => acc + name.length + 1,
      0
    ); // +1 for null terminator

    const objectCount = terrain.placeableGroups.reduce(
      (acc, pg) => acc + pg.placeables.length,
      0
    );
    const regionCount = terrain.regions.length;

    const objectNameLength = placeableGroup.placeables.reduce(
      (acc, val) => acc + val.modelName.length + 1,
      0
    ); // +1 for null term

    // Calculate the total length for objects and regions
    const postHeaderIdx = preamble.length + headerSize;
    const objectSize = 4 + 4 + 7 * 4; // Model ID (int32) + Location (uint32) + 7 floats (7 * float32)
    const regionSize = 4 + 3 * 4 + 4 + 2 * 4 + 3 * 4; // Location (uint32) + 3 floats + rotation + 2 flags + 3 extents
    const modelIndicesLength = modelNames.length * 4;
    const listLength = modelNamesLength + regionNamesLength + objectNameLength;
    const totalLength =
      modelIndicesLength +
      postHeaderIdx +
      listLength +
      objectCount * objectSize +
      regionCount * regionSize;
    const buffer = new ArrayBuffer(totalLength);
    const writer = new TypedArrayWriter(buffer);

    // Write preamble
    writer.writeString(preamble);

    // Write header
    writer.writeUint32(1); // Version
    writer.writeUint32(listLength); // List length
    writer.writeUint32(modelNames.length); // Model count
    writer.writeUint32(objectCount); // Object count
    writer.writeUint32(regionCount); // Region count
    writer.writeUint32(0); // Light count (assuming 0 for simplicity)

    // Write model names
    const modelNameIdx = {};
    modelNames.forEach((name) => {
      modelNameIdx[name] = writer.getCursor() - postHeaderIdx;
      writer.writeCString(name); // Write null-terminated string
    });

    placeableGroup.placeables.forEach((p) => {
      p.MODEL_NAME_LOC = writer.getCursor() - postHeaderIdx;
      writer.writeCString(p.modelName);

      modelNames.forEach((name, idx) => {
        if (p.modelFile === name) {
          p.MODEL_FILE_LOC = idx;
        }
      });
    });

    const regionNameIdx = {};
    // Write region names
    regionNames.forEach((id, name) => {
      regionNameIdx[name] = writer.getCursor() - postHeaderIdx;
      writer.writeCString(name); // Write null-terminated string
    });

    for (const [_key, idx] of Object.entries(modelNameIdx)) {
      writer.writeUint32(idx);
    }

    placeableGroup.placeables.forEach((p, _i) => {
      writer.writeInt32(p.MODEL_FILE_LOC); // Placeholder for location
      writer.writeUint32(p.MODEL_NAME_LOC); // Placeholder for location
      writer.writeFloat32(p.x);
      writer.writeFloat32(p.y);
      writer.writeFloat32(p.z);
      writer.writeFloat32(p.rotateX * rotChange);
      writer.writeFloat32(p.rotateY * rotChange);
      writer.writeFloat32(p.rotateZ * rotChange);
      writer.writeFloat32(p.scaleX * 4); // Assuming uniform scale
    });

    // Write regions
    terrain.regions.forEach((region) => {
      writer.writeUint32(regionNameIdx[region.name]); // Location
      writer.writeFloat32(region.x);
      writer.writeFloat32(region.y);
      writer.writeFloat32(region.z);
      writer.writeFloat32((region.rotateZ / 360) * 512);
      writer.writeUint32(region.flags[0]); // Flag unknown 1
      writer.writeUint32(region.flags[1]); // Flag unknown 2
      writer.writeFloat32(region.extX);
      writer.writeFloat32(region.extY);
      writer.writeFloat32(region.extZ);
    });

    return new Uint8Array(buffer);
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
