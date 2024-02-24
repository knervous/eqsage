import { FILE_TYPE } from './constants';
import { S3DDecoder } from '../s3d/s3d-decoder';
import { Document } from '@gltf-transform/core';
import { EQGDecoder } from '../eqg/eqg-decoder';
import { getEQFile } from '../util/fileHandler';

export const VERSION = 1.1;

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
    if (this.#fileHandles.some((f) => f.name === `${this.name}.eqg`)) {
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

  async process(doExport = true) {
    if (!this.#initialized) {
      console.warn('Was not initialized, cannot process');
      return;
    }
    const existingMetadata = await getEQFile('zones', `${this.name}.json`, 'json');
    if (existingMetadata?.version === VERSION) {
      console.log('Had cached version, skipping translation');
      return;
    }
    if (this.#type === FILE_TYPE.EQG) {
      const eqgDecoder = new EQGDecoder(this);
      await eqgDecoder.process();
      if (doExport) {
        await eqgDecoder.export();
      }
    } else if (this.#type === FILE_TYPE.S3D) {
      const s3dDecoder = new S3DDecoder(this);
      await s3dDecoder.process();
      if (doExport) {
        await s3dDecoder.export();
      }
    }
  }
}
