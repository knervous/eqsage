/* eslint-disable */
import { vec3 } from 'gl-matrix';
import { WldFragment } from '../wld/wld-fragment';

export class MeshAnimatedVertices extends WldFragment {
  delay = 0;
  frames = [];

  constructor(...args) {
    super(...args);
    this.initialize();
  }

  initialize() {
    const reader = this.reader;
    const flags = reader.readInt32();
    const vertexCount = reader.readUint16();
    const frameCount = reader.readUint16();
    this.delay = reader.readUint16();
    const param = reader.readUint16();
    const scale = 1.0 / (1 << reader.readUint16());
    for (let i = 0; i < frameCount; ++i) {
      const positions = [];

      for (let j = 0; j < vertexCount; ++j) {
        const x = reader.readUint16() * scale;
        const y = reader.readUint16() * scale;
        const z = reader.readUint16() * scale;

        positions.push(vec3.fromValues(x, y, z));
      }

      this.frames.push(positions);
    }
  }
}