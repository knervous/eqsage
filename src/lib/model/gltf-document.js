
import { Document } from '@gltf-transform/core';

export class GltfDocument {
  name = '';
  /**
     * @type {Buffer}
     */
  buffer = null;
  /**
     * @type {Document}
     */
  document = null;
  constructor(name = '') {
    this.name = name;
    this.document = new Document();
    this.buffer = this.document.createBuffer();
  }

  setName(name) {
    this.name = name;
  }
}