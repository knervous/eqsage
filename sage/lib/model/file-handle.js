import { FILE_TYPE, VERSION } from './constants';
import { S3DDecoder } from '../s3d/s3d-decoder';
import { Document } from '@gltf-transform/core';
import { EQGDecoder } from '../eqg/eqg-decoder';
import { getEQFile, getEQFileExists } from '../util/fileHandler';


export class EQFileHandle {
  /**
   * @type {Array<FileSystemFileHandle>}
   */
  #fileHandles = [];
  #name = '';
  #initialized = false;
  #settings = {};
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
  constructor(name, fileHandles, rootFileHandle, settings) {
    this.#name = name;
    this.#fileHandles = fileHandles;
    this.#rootFileHandle = rootFileHandle;
    this.#settings = settings;
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
    const eqgExists = this.#fileHandles.some(f => f.name === `${this.name}.eqg`);
    const s3dExists = this.#fileHandles.some(f => f.name === `${this.name}.s3d`);
  
    return eqgExists ? FILE_TYPE.EQG : s3dExists ? FILE_TYPE.S3D : FILE_TYPE.NONE;
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
    const exists = await getEQFileExists('zones', `${this.name}.glb`);
    if (exists && existingMetadata?.version === VERSION && !this.#settings.forceReload) {
      console.log('Had cached version, skipping translation');
      return;
    }
    if (this.#type === FILE_TYPE.EQG) {
      const eqgDecoder = new EQGDecoder(this);
      await eqgDecoder.process();
      if (doExport) {
        await eqgDecoder.export();
        return true;
      }
    } else if (this.#type === FILE_TYPE.S3D) {
      const s3dDecoder = new S3DDecoder(this);
      await s3dDecoder.process();
      if (doExport) {
        await s3dDecoder.export();
        return true;
      }
    }
  }
}
