/* eslint-disable */
import { vec2, vec3 } from "gl-matrix";
import { TypedArrayReader } from "../../util/typed-array-reader";

export class Weight {
  bone = 0;
  weight = 0.0;
}
export class BoneAssignment {
  count = 0;
  /**
   * @type {[Weight]}
   */
  weights = [];
}

export class Vertex {
  /**
   * @type {vec3}
   */
  pos = null;

  /**
   * @type {vec3}
   */
  nor = null;

  /**
   * @type {vec2}
   */
  tex = null;
  col = 0;

  /**
   * @type {BoneAssignment}
   */
  boneAssignment = null;
}

export class Polygon {
  flags = 0;
  material = 0;

  /**
   * @type {[number]}
   */
  verts = [];
}

export class MaterialProperty {
  name = "";
  type = 0;
  valueI = 0;
  valueF = 0.0;
  valueS = "";
}
export class Material {
  ClassName = "Material";

  name = "";
  shader = "";
  /**
   * @type {[MaterialProperty]}
   */
  properties = [];
}

export class Geometry {
  name = "";
  /**
   * @type {[Vertex]}
   */
  verts = [];
  /**
   * @type {[Polygon]}
   */
  polys = [];
  /**
   * @type {[Material]}
   */
  mats = [];
}

export class Bone {
  name = "";
  next = 0;
  childrenCount = 0;
  childrenIndex = 0;
  x = 0.0;
  y = 0.0;
  z = 0.0;
  rotX = 0.0;
  rotY = 0.0;
  rotZ = 0.0;
  rotW = 0.0;
  scaleX = 0.0;
  scaleY = 0.0;
  scaleZ = 0.0;
  children = [];
}

export class BoneAnimationFrame {
  ms = 0;
  x = 0.0;
  y = 0.0;
  z = 0.0;
  rotX = 0.0;
  rotY = 0.0;
  rotZ = 0.0;
  rotW = 0.0;
  scaleX = 0.0;
  scaleY = 0.0;
  scaleZ = 0.0;
}

export class BoneAnimation {
  frameCount = 0;
  name = "";
  /**
   * @type {[BoneAnimationFrame]}
   */
  animationFrames = [];
}

export class Animation {
  /**
   * @type {TypedArrayReader}
   */
  reader = null;
  /**
   * @type {import('../../model/file-handle').EQFileHandle}
   */
  fileHandle;

  /**
   * @type {[BoneAnimation]}
   */
  boneAnimations = [];

  strictBoneNumbering = false;

  /**
   *
   * @param {Uint8Array} data
   * @param {import('../../model/file-handle').EQFileHandle} fileHandle
   */
  constructor(data, fileHandle, name) {
    this.reader = new TypedArrayReader(data.buffer);
    this.fileHandle = fileHandle;
    this.name = name;
    this.init();
  }

  static write() {
    const preamble = "EQGA";
  }

  init() {
    const reader = this.reader;
    const magic = reader.readString(4);
    if (magic.slice(0, 4) !== "EQGA") {
      throw new Error("Animation does not contain EQGA header", magic);
    }
    const version = reader.readUint32();
    const listLength = reader.readUint32();
    const frameCount = reader.readUint32();
    let strictBoneNumbering = 0;
    if (version > 1) {
      strictBoneNumbering = reader.readUint32();
      if (strictBoneNumbering === 1) {
        this.strictBoneNumbering = true;
      }
    }
    const listIdx = reader.getCursor();
    reader.addCursor(listLength);

    for (let i = 0; i < frameCount; i++) {
      const ba = new BoneAnimation();
      ba.frameCount = reader.readUint32();
      const boneNameIdx = reader.readUint32();
      ba.boneName = reader.readCStringFromIdx(listIdx + boneNameIdx).replaceAll(' ', '');
      for (let j = 0; j < ba.frameCount; j++) {
        const baf = new BoneAnimationFrame();
        baf.ms = reader.readUint32();
        const [x, y, z, rotX, rotY, rotZ, rotW, scaleX, scaleY, scaleZ] =
          reader.readManyFloat32(10);
        baf.x = x * -1;
        baf.y = y * -1;
        baf.z = z;
        baf.rotX = rotX * -1;
        baf.rotY = rotY * -1;
        baf.rotZ = rotZ;
        baf.rotW = rotW;
        baf.scaleX = scaleX;
        baf.scaleY = scaleY;
        baf.scaleZ = scaleZ;
        ba.animationFrames.push(baf);
      }
      this.boneAnimations.unshift(ba);
    }
  }
}

export class Model {
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
   * @type {Geometry}
   */
  geometry = new Geometry();

  /**
   * @type {[Bone]}
   */
  bones = [];

  /**
   *
   * @param {Uint8Array} data
   * @param {import('../../model/file-handle').EQFileHandle} fileHandle
   */
  constructor(data, fileHandle, name) {
    this.reader = new TypedArrayReader(data.buffer);
    this.fileHandle = fileHandle;
    this.name = name;
    this.init();
  }

  static write(terrain = false) {
    const preamble = terrain ? "EQGT" : "EQGM";
  }

  init() {
    const reader = this.reader;
    const magic = reader.readString(4);
    if (magic.slice(0, 3) !== "EQG") {
      throw new Error("Model does not contain EQG header", magic);
    }
    let boneCount = 0;

    const [version, listLength, materialCount, vertCount, triCount] =
      reader.readManyUint32(5);
    if (magic[3] === "M") {
      boneCount = reader.readUint32();
    }

    const listIdx = reader.getCursor();
    reader.addCursor(listLength);

    // Materials
    for (let i = 0; i < materialCount; i++) {
      const mat = new Material();
      const [_idx, nameOffset, shaderOffset, propertyCount] =
        reader.readManyUint32(4);
      mat.name = reader.readCStringFromIdx(listIdx + nameOffset);
      mat.shader = reader.readCStringFromIdx(listIdx + shaderOffset);
      for (let j = 0; j < propertyCount; j++) {
        const [nameOffset, type] = reader.readManyUint32(2);
        const value = type === 0 ? reader.readFloat32() : reader.readUint32();
        const prop = new MaterialProperty();
        prop.name = reader.readCStringFromIdx(listIdx + nameOffset);
        prop.type = type;
        if (prop.type === 2) {
          prop.valueS = reader.readCStringFromIdx(listIdx + value);
          prop.valueF = 0;
          prop.valueI = 0;
        } else if (prop.type === 0) {
          prop.valueF = value;
          prop.valueI = 0;
        } else {
          prop.valueI = value;
          prop.valueF = 0;
        }
        mat.properties.push(prop);
      }
      this.geometry.mats.push(mat);
    }

    // Vertices
    for (let i = 0; i < vertCount; i++) {
      const vert = new Vertex();
      if (version < 3) {
        const [x, y, z, i, j, k, u, v] = reader.readManyFloat32(8);
        vert.pos = vec3.fromValues(-x, -y, z);
        vert.nor = vec3.fromValues(-i, -j, k);
        vert.tex = vec2.fromValues(-u, -v);
        vert.col = 0xffffffff;
      } else {
        const [x, y, z, i, j, k] = reader.readManyFloat32(6);
        const color = reader.readUint32();
        const [_unk1, _unk2, u, v] = reader.readManyFloat32(4);
        vert.pos = vec3.fromValues(-x, -y, z);
        vert.nor = vec3.fromValues(-i, -j, k);
        vert.tex = vec2.fromValues(-u, -v);
        vert.col = color;
      }

      this.geometry.verts.push(vert);
    }

    // Polygons
    for (let i = 0; i < triCount; i++) {
      const poly = new Polygon();
      poly.verts = reader.readManyUint32(3);
      poly.material = reader.readInt32();
      poly.flags = reader.readUint32();
      this.geometry.polys.push(poly);
      if (poly.material >= 0) {
      }
    }

    // Bones
    for (let i = 0; i < boneCount; i++) {
      const bone = new Bone();
      const nameIdx = reader.readInt32();
      bone.name = reader.readCStringFromIdx(listIdx + nameIdx);
      bone.next = reader.readInt32();
      bone.childrenCount = reader.readUint32();
      bone.childrenIndex = reader.readInt32();
      const [x, y, z, rotX, rotY, rotZ, rotW, scaleX, scaleY, scaleZ] = reader.readManyFloat32(10);
      bone.x = x * -1;
      bone.y = y * -1;
      bone.z = z;
      bone.rotX = rotX * -1;
      bone.rotY = rotY * -1;
      bone.rotZ = rotZ;
      bone.rotW = rotW;
      bone.scaleX = scaleX;
      bone.scaleY = scaleY;
      bone.scaleZ = scaleZ;
      this.bones.push(bone);
    }

    if (this.bones.length) {
      for (let i = 0; i < vertCount; i++) {
        const vert = this.geometry.verts[i];
        const ba = new BoneAssignment();
        ba.count = reader.readUint32();
        for (let j = 0; j < 4; j++) {
          const weight = new Weight();
          weight.bone = reader.readInt32();
          weight.weight = reader.readFloat32();
          ba.weights.push(weight);
        }
        vert.boneAssignment = ba;
      }
    }
  }
}
