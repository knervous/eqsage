import { WldFragment, WldFragmentReference } from '../wld/wld-fragment';
import { vec2, vec3 } from 'gl-matrix';
import { Color } from '../common/color';
import { Polygon } from '../common/polygon';
import { MobVertexPiece } from '../common/mob-vertex-piece';
import { RenderGroup } from '../common/render-group';

export class MeshReference extends WldFragmentReference {
  get mesh() {
    return this.reference;
  }
}

export class Mesh extends WldFragment {
  materialListIdx = -1;
  get materialList() {
    return this.wld.fragments[this.materialListIdx];
  }

  animatedVerticesReferenceIdx = -1;
  get animatedVerticesReference() {
    return this.wld.fragments[this.animatedVerticesReferenceIdx];
  }
  constructor(...args) {
    super(...args);
    this.initialize();
  }
  center = null;
  maxDistance = -1;
  minPosition = null;
  maxPosition = null;
  vertices = [];
  normals = [];
  colors = [];
  textureUvCoordinates = [];
  indices = [];
  mobPieces = {};
  materialGroups = [];

  initialize() {
    const reader = this.reader;
    const flags = reader.readUint32();
    this.materialListIdx = reader.readUint32() - 1;
    this.animatedVerticesReferenceIdx = reader.readUint32() - 1;
    reader.addCursor(8);

    this.center = vec3.fromValues(
      reader.readFloat32(),
      reader.readFloat32(),
      reader.readFloat32()
    );

    reader.addCursor(12);

    this.maxDistance = reader.readFloat32();
    this.minPosition = vec3.fromValues(
      reader.readFloat32(),
      reader.readFloat32(),
      reader.readFloat32()
    );
    this.maxPosition = vec3.fromValues(
      reader.readFloat32(),
      reader.readFloat32(),
      reader.readFloat32()
    );

    const vertexCount = reader.readInt16();
    const textureCoordinateCount = reader.readInt16();
    const normalsCount = reader.readInt16();
    const colorsCount = reader.readInt16();
    const polygonCount = reader.readInt16();
    const vertexPieceCount = reader.readInt16();
    const polygonTextureCount = reader.readInt16();
    const vertexTextureCount = reader.readInt16();
    const size9 = reader.readInt16();
    const scale = 1.0 / (1 << reader.readInt16());

    for (let i = 0; i < vertexCount; ++i) {
      this.vertices.push(
        vec3.fromValues(
          reader.readInt16() * scale,
          reader.readInt16() * scale,
          reader.readInt16() * scale
        )
      );
    }

    for (let i = 0; i < textureCoordinateCount; ++i) {
      if (this.wld.isNewWldFormat) {
        this.textureUvCoordinates.push(
          vec2.fromValues(reader.readFloat32(), reader.readFloat32())
        );
      } else {
        this.textureUvCoordinates.push(
          vec2.fromValues(reader.readInt16() / 256.0, reader.readInt16() / 256.0)
        );
      }
    }

    for (let i = 0; i < normalsCount; ++i) {
      const x = reader.readInt8() / 128.0;
      const y = reader.readInt8() / 128.0;
      const z = reader.readInt8() / 128.0;
      this.normals.push(vec3.fromValues(x, y, z));
    }

    for (let i = 0; i < colorsCount; ++i) {
      this.colors.push(
        new Color(
          reader.readUint8(),
          reader.readUint8(),
          reader.readUint8(),
          reader.readUint8()
        )
      );
    }

    for (let i = 0; i < polygonCount; ++i) {
      const isSolid = reader.readInt16() === 0;

      if (!isSolid) {
        this.exportSeparateCollision = true;
      }

      this.indices.push(
        new Polygon(
          isSolid,
          reader.readInt16(),
          reader.readInt16(),
          reader.readInt16()
        )
      );
    }
    let mobStart = 0;

    for (let i = 0; i < vertexPieceCount; ++i) {
      const count = reader.readInt16();
      const index1 = reader.readInt16();
      const mobVertexPiece = new MobVertexPiece(count, mobStart);
      mobStart += count;
      this.mobPieces[index1] = mobVertexPiece;
    }

    let startTextureIndex = Infinity;

    for (let i = 0; i < polygonTextureCount; ++i) {
      const group = new RenderGroup(reader.readInt16(), reader.readUint16());
      this.materialGroups.push(group);

      if (group.materialIndex < startTextureIndex) {
        startTextureIndex = group.materialIndex;
      }
    }

    for (let i = 0; i < vertexTextureCount; ++i) {
      if (!reader.addCursor(4)) {
        break;
      }
    }

    for (let i = 0; i < size9; ++i) {
      if (!reader.addCursor(12)) {
        break;
      }
    }

    // In some rare cases, the number of uvs does not match the number of vertices
    if (this.vertices.length !== this.textureUvCoordinates.length) {
      const difference = this.vertices.length - this.textureUvCoordinates.length;

      for (let i = 0; i < difference; ++i) {
        this.textureUvCoordinates.push(vec2.fromValues(0.0, 0.0));
      }
    }
  }
}
