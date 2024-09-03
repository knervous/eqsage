import { vec3, quat } from 'gl-matrix';

class AttachPoint {
  static Type = {
    NONE: 'NONE',
    // Add other types if needed
  };
}

export class ConvSkeleton {
  constructor() {
    this.m_boneCount = 0;
    this.m_boneArray = null;
    this.m_indexMap = new Map();
    this.m_indicesByBoneName = new Map();
  }

  static Bone = class {
    constructor() {
      this.name = '';
      this.children = [];
      this.attachPointType = AttachPoint.Type.NONE;
      this.pos = vec3.create();
      this.rot = quat.create();
      this.scale = vec3.fromValues(1.0, 1.0, 1.0);
    }
  };

  init(count) {
    this.m_boneCount = count;
    this.m_boneArray = new Array(count).fill(null).map(() => new ConvSkeleton.Bone());
  }

  setBone(index, pos, rot, scale = vec3.fromValues(1.0, 1.0, 1.0)) {
    const bone = this.m_boneArray[index];
    vec3.copy(bone.pos, pos);
    quat.copy(bone.rot, rot);
    vec3.copy(bone.scale, scale);
  }

  setAttachPointType(index, type) {
    this.m_boneArray[index].attachPointType = type;
  }

  addBoneNameToIndex(name, index) {
    this.m_indicesByBoneName.set(name, index);
    this.m_boneArray[index].name = name.slice(3); // Adjust as necessary
  }

  addChild(parent, child) {
    this.m_boneArray[parent].children.push(child);
  }

  buildIndexMap() {
    let index = 0;

    const recurse = (i) => {
      const bone = this.m_boneArray[i];
      this.m_indexMap.set(i, index++);
      bone.children.forEach(child => recurse(child));
    };

    recurse(0);
  }

  getIndexByName(name) {
    if (!this.m_indicesByBoneName.has(name)) {
      return { success: false, index: null };
    }
    const out = this.m_indicesByBoneName.get(name);
    return { success: true, index: out };
  }

  hasBones() {
    return this.m_boneArray !== null;
  }

  getBoneCount() {
    return this.m_boneCount;
  }

  getBoneArray() {
    return this.m_boneArray;
  }
}
