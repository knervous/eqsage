import { FILE_TYPE } from './constants';
import { S3DDecoder } from '../s3d/s3d-decoder';
import { GltfDocument } from './gltf-document';
import { Document } from '@gltf-transform/core';
import { EQGDecoder } from '../eqg/eqg-decoder';

export class EQFileHandle {

  /**
     * @type {Array<FileSystemFileHandle>}
     */
  #fileHandles = [];
  #name = '';
  #initialized = false;
  /**
   * @type {FileSystemDirectoryHandle}
   */
  #rootFileHandle = null;


  // gltf instances
  #zoneGltf = null;
  objectGltf = {};
  textures = [];

  /**
     * 
     * @param {FileSystemFileHandle} fileHandles 
     */
  constructor(name, fileHandles, rootFileHandle) {
    this.#name = name;
    this.#fileHandles = fileHandles;
    this.#rootFileHandle = rootFileHandle;
  }

  /**
   * @type {Document}
   */
  get zoneGltf() {
    if (this.#zoneGltf === null) {
      this.#zoneGltf = new Document(this.#name);
    }
    return this.#zoneGltf;
  }

  get name() {
    return this.#name;
  }

  get fileHandles() {
    return this.#fileHandles;
  }

  get rootFileHandle() {
    return this.#rootFileHandle;
  }

  get #type() {
    if (this.#fileHandles.some(f => f.name.endsWith('eqg'))) {
      return FILE_TYPE.EQG;
    } 
    return FILE_TYPE.S3D;
  }

  async initialize() {
    if (this.#fileHandles.length === 0) {
      console.warn('File handle length was 0!');
      return;
    }
    this.#initialized = true;
  }

  async process() {
    if (!this.#initialized) {
      console.warn('Was not initialized, cannot process');
      return;
    }
    if (this.#type === FILE_TYPE.EQG) {
      const eqgDecoder = new EQGDecoder(this);
      await eqgDecoder.process();
      await eqgDecoder.export();
    } else if (this.#type === FILE_TYPE.S3D) {
      const s3dDecoder = new S3DDecoder(this);
      await s3dDecoder.process();
      await s3dDecoder.export();
    }
  }

}