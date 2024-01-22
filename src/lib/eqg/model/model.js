import { vec2, vec3 } from 'gl-matrix';
import { TypedArrayReader } from '../../util/typed-array-reader';

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
  name = '';
  type = 0;
  valueI = 0;
  valueF = 0.0;
  valueS = '';
}
export class Material {
  name = '';
  shader = '';
  /**
   * @type {[MaterialProperty]}
   */
  properties = [];
}

export class Geometry {
  name = '';
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

  init() {
    const reader = this.reader;
    const magic = reader.readString(4);
    if (magic.slice(0, 3) !== 'EQG') {
      throw new Error('Model does not contain EQG header', magic);
    }
    let boneCount = 0;

    const [version, listLength, materialCount, vertCount, triCount] =
      reader.readManyUint32(5);
    if (magic[3] === 'M') {
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
        vert.pos = vec3.fromValues(x, y, z);
        vert.nor = vec3.fromValues(i, j, k);
        vert.tex = vec2.fromValues(u, v);
        vert.col = 0xffffffff;
      } else {
        const [x, y, z, i, j, k] = reader.readManyFloat32(6);
        const color = reader.readUint32();
        const [_unk1, _unk2, u, v] = reader.readManyFloat32(4);
        vert.pos = vec3.fromValues(x, y, z);
        vert.nor = vec3.fromValues(i, j, k);
        vert.tex = vec2.fromValues(u, v);
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
  }
}
