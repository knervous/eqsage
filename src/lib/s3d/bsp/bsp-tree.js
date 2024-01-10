import { decodeString } from '../../util/util';
import { WldFragment } from '../wld/wld-fragment';

export class BspTree extends WldFragment {
  nodeCount = 0;
  nodes = [];
  regions = [];
  regionTypes = [];
  constructor(...args) {
    super(...args);
    this.initialize();
  }
  initialize() {
    this.nodeCount = this.reader.readUint32();
    for (let i = 0; i < this.nodeCount; i++) {
      this.nodes.push(new BspNode(this));
    }
  }

  addRegion(name) {
    this.regions.push(new BspRegion(this, name));
  }

  addRegionType(name) {
    this.regionTypes.push(new BspRegionType(this, name));
  }
}

export const RegionType = {
  Normal       : 0,
  Water        : 1,
  Lava         : 2,
  Pvp          : 3,
  Zoneline     : 4,
  WaterBlockLOS: 5,
  FreezingWater: 6,
  Slippery     : 7,
  Unknown      : 8,
};

export const ZoneLineType = {
  Reference: 0,
  Absolute : 1,
};

class BspRegionType {
  /**
   * @type {BspTree}
   */
  #bspTree = null;

  regionTypes = [];
  zoneLineInfo = null;

  /**
   *
   * @param {BspTree} bspTree
   * @param {string} name
   */
  constructor(bspTree, name) {
    this.#bspTree = bspTree;
    const reader = this.#bspTree.reader;

    const flags = reader.readInt32();
    const regionCount = reader.readInt32();
    for (let i = 0; i < regionCount; i++) {
      this.#bspTree.regions[reader.readInt32()].regionType = this;
    }
    const stringSize = reader.readInt32();
    const regionTypeString = (
      decodeString(reader, stringSize) || name
    ).toLowerCase();

    if (
      regionTypeString.startsWith('wtn_') ||
      regionTypeString.startsWith('wt_')
    ) {
      // Ex: wt_zone, wtn_XXXXXX
      this.regionTypes.push(RegionType.Water);
    } else if (regionTypeString.startsWith('wtntp')) {
      this.regionTypes.push(RegionType.Water);
      this.regionTypes.push(RegionType.Zoneline);
      this.decodeZoneline(regionTypeString);
    } else if (
      regionTypeString.startsWith('lan_') ||
      regionTypeString.startsWith('la_')
    ) {
      this.regionTypes.push(RegionType.Lava);
    } else if (regionTypeString.startsWith('lantp')) {
      // TODO: Figure this out - soldunga
      this.regionTypes.push(RegionType.Lava);
      this.regionTypes.push(RegionType.Zoneline);
      this.decodeZoneline(regionTypeString);
    } else if (regionTypeString.startsWith('drntp')) {
      this.regionTypes.push(RegionType.Zoneline);
      this.decodeZoneline(regionTypeString);
    } else if (regionTypeString.startsWith('drp_')) {
      this.regionTypes.push(RegionType.Pvp);
    } else if (regionTypeString.startsWith('drn_')) {
      if (regionTypeString.includes('_s_')) {
        this.regionTypes.push(RegionType.Slippery);
      } else {
        this.regionTypes.push(RegionType.Unknown);
      }
    } else if (regionTypeString.startsWith('sln_')) {
      // gukbottom, cazicthule (gumdrop), runnyeye, velketor
      this.regionTypes.push(RegionType.WaterBlockLOS);
    } else if (regionTypeString.startsWith('vwn_')) {
      this.regionTypes.push(RegionType.FreezingWater);
    } else {
      // All trilogy client region types are accounted for
      // This is here in case newer clients have newer types
      // tox - "wt_zone' - Possible legacy water zonepoint for boat?
      this.regionTypes.push(RegionType.Normal);
    }
  }

  decodeZoneline(regionTypeString) {
    this.zoneLineInfo = {};
    if (regionTypeString === 'drntp_zone') {
      this.zoneLineInfo.type = ZoneLineType.Reference;
      this.zoneLineInfo.index = 0;
      return;
    }

    const zoneId = +regionTypeString.slice(5, 10);
    if (zoneId === 255) {
      const zonelineId = +regionTypeString.slice(10, 16);
      this.zoneLineInfo.type = ZoneLineType.Reference;
      this.zoneLineInfo.index = zonelineId;
      return;
    }


    this.zoneLineInfo = {
      zoneIndex: zoneId,
      x        : +regionTypeString.slice(10, 16),
      y        : +regionTypeString.slice(16, 22),
      z        : +regionTypeString.slice(22, 28),
      rot      : +regionTypeString.slice(28, 31)
    };
  }
}

class BspRegion {
  /**
   * @type {BspTree}
   */
  #bspTree = null;
  meshReference = -1;
  containsPolygons = false;
  regionType = null;

  constructor(bspTree) {
    this.#bspTree = bspTree;
    const reader = this.#bspTree.reader;
    const flags = reader.readInt32();
    this.containsPolygons = flags === 0x181;

    // Always 0
    const unknown1 = reader.readInt32();
    const data1Size = reader.readInt32();
    const data2Size = reader.readInt32();

    // Always 0
    const unknown2 = reader.readInt32();
    const data3Size = reader.readInt32();
    const data4Size = reader.readInt32();

    // Always 0
    const unknown3 = reader.readInt32();
    const data5Size = reader.readInt32();
    const data6Size = reader.readInt32();

    reader.addCursor(12 * data1Size + 12 * data2Size);

    // Move past data3
    for (let i = 0; i < data3Size; ++i) {
      const data3Flags = reader.readInt32();
      const data3Size2 = reader.readInt32();
      reader.addCursor(data3Size2 * 4);
    }

    // Move past the data 4
    for (let i = 0; i < data4Size; ++i) {
      // Unhandled for now
    }

    // Move past the data5
    for (let i = 0; i < data5Size; i++) {
      reader.addCursor(7 * 4);
    }

    const pvsSize = reader.readInt16();
    reader.addCursor(pvsSize);

    // Move past the unknowns
    const bytes = reader.readUint32();
    reader.addCursor(16);

    if (this.containsPolygons) {
      this.meshReference = reader.readInt32();
    }
  }
}

class BspNode {
  /**
   * @type {BspTree}
   */
  #bspTree = null;

  x = 0;
  y = 0;
  z = 0;
  split = 0;
  regionId = 0;
  left = 0;
  right = 0;

  constructor(bspTree) {
    this.#bspTree = bspTree;
    const reader = this.#bspTree.reader;
    this.x = reader.readFloat32();
    this.y = reader.readFloat32();
    this.z = reader.readFloat32();
    this.split = reader.readInt32();
    this.regionId = reader.readInt32();
    this.left = reader.readInt32() - 1;
    this.right = reader.readInt32() - 1;
  }
  get leftNode() {
    return this.#bspTree.nodes[this.left] ?? null;
  }
  get rightNode() {
    return this.#bspTree.nodes[this.right] ?? null;
  }
  get isLeafNode() {
    return this.leftNode === null && this.rightNode === null;
  }
  get region() {
    if (this.regionId === 0) {
      return null;
    }
    return this.#bspTree.regions[this.regionId - 1];
  }
}
