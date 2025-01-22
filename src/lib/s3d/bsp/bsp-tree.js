/* eslint-disable */
import { decodeString } from '../../util/util';
import { WldFragment } from '../wld/wld-fragment';
import { vec3 } from 'gl-matrix';

export class BspTree extends WldFragment {
  nodeCount = 0;
  /**
   * @type {[BspNode]}
   */
  nodes = [];
  /**
   * @type {[BspNode]}
   */
  leafNodes = [];
  /**
   * @type {[BspRegion]}
   */
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

  /**
   * 
   * @param {import('../wld/wld').Wld} wld 
   */
  constructRegions(wld) {
    const polygons = [];
    for (const mesh of wld.meshes) {
      const polyCount = mesh.materialGroups.reduce((acc, val) => acc + val.polygonCount, 0);
      for (let i = 0; i < polyCount; i++) {
        const idc = mesh.indices[i];
        if (!idc) {
          continue;
        }
        const idxArr = [idc.v1, idc.v2, idc.v3];
        const [v1, v2, v3] = idxArr.map((idx) => mesh.vertices[idx]);
        if ([v1, v2, v3].some(v => v === undefined)) {
          continue;
        }
        polygons.push(...[v1, v2, v3].map((v) => [
          v[0] + mesh.center[0],
          v[1] + mesh.center[1],
          v[2] + mesh.center[2],
        ]));
      }
    }

    const firstMinMax = this.getMinMax(polygons);
    const rootNode = this.nodes[0];
    rootNode.boundingBoxMin = firstMinMax[0];
    rootNode.boundingBoxMax = firstMinMax[1];
    this.populateWithSubset(rootNode, polygons);
  }

  /**
   * 
   * @param {BspNode} node 
   * @param {vec3} point 
   * @returns 
   */
  nodeSplitLeft(node, point) {
    return ((point[0] * node.normalX) + 0.00001 + (point[1] * node.normalY) + 0.00001 + (point[2] * node.normalZ) + 0.00001 + node.splitDistance) > 0;
  }

  /**
   * 
   * @param {[BspNode]} nodes 
   * @param {BspNode} node 
   * @param {[vec3]} polygons 
   */
  populateWithSubset(node, polygons) {
    const leftPolygons = [];
    const rightPolygons = [];

    for (let i = 0; i < polygons.length; i += 3) {
      const v1 = polygons[i];
      const v2 = polygons[i + 1];
      const v3 = polygons[i + 2];
      if (this.nodeSplitLeft(node, v1) && this.nodeSplitLeft(node, v2) && this.nodeSplitLeft(node, v3)) {
        leftPolygons.push(v1, v2, v3);
      } else {
        rightPolygons.push(v1, v2, v3);
      }
    }
    if (node.region?.regionType?.regionTypes?.length > 0) {
      this.leafNodes.push(node);
    }
    node.polygons = polygons;

    if (node.left !== -1) {
      const leftNode = this.nodes[node.left];
      leftNode.parent = node;
      leftNode.isLeftChild = true;
      node.leftChild = leftNode;
      const [min, max] = this.getMinMax(leftPolygons);
      leftNode.boundingBoxMin = min;
      leftNode.boundingBoxMax = max;
      const center = vec3.create();
      vec3.add(center, min, max);
      vec3.scale(center, center, 0.5);
      leftNode.center = center;
      this.populateWithSubset(leftNode, leftPolygons);
    }

    if (node.right !== -1) {
      const rightNode = this.nodes[node.right];
      rightNode.parent = node;
      rightNode.isRightChild = true;
      node.rightChild = rightNode;
      const [min, max] = this.getMinMax(rightPolygons);
      rightNode.boundingBoxMin = min;
      rightNode.boundingBoxMax = max;
      const center = vec3.create();
      vec3.add(center, min, max);
      vec3.scale(center, center, 0.5);
      rightNode.center = center;
      this.populateWithSubset(rightNode, rightPolygons); 
    }
  }


  /**
 * 
 * @param {[vec3]} points 
 * @returns {[vec3]}
 */
  getMinMax(points) {
    if (points.length === 0) {
      return [vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, 0)];
    }
    const firstVal = points[0];
    return points.reduce(
      (acc, point) => {
        const [min, max] = acc;
        if (point[0] < min[0]) {
          min[0] = point[0];
        } else if (point[0] > max[0]) {
          max[0] = point[0];
        }
        if (point[1] < min[1]) {
          min[1] = point[1];
        } else if (point[1] > max[1]) {
          max[1] = point[1];
        }
        if (point[2] < min[2]) {
          min[2] = point[2];
        } else if (point[2] > max[2]) {
          max[2] = point[2];
        }
        return [min, max];
      }, [vec3.clone(firstVal), vec3.clone(firstVal)]);
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
      const regionIdx = reader.readInt32();
      this.#bspTree.regions[regionIdx].regionType = this;
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
  /**
   * @type {BspRegionType}
   */
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

  /**
   * @type {BspNode | null}
   */
  parent = null;
  /**
   * @type {BspNode | null}
   */
  leftChild = null;
  /**
   * @type {BspNode | null}
   */
  rightChild = null;

  isLeftChild = false;
  isRightChild = false;
  normalX = 0;
  normalY = 0;
  normalZ = 0;
  splitDistance = 0;
  regionId = 0;
  left = 0;
  right = 0;
  boundingBoxMin = vec3.fromValues(0, 0, 0);
  boundingBoxMax = vec3.fromValues(0, 0, 0);
  center = vec3.fromValues(0, 0, 0);

  constructor(bspTree) {
    this.#bspTree = bspTree;
    const reader = this.#bspTree.reader;
    this.normalX = reader.readFloat32();
    this.normalY = reader.readFloat32();
    this.normalZ = reader.readFloat32();
    this.splitDistance = reader.readFloat32();
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
