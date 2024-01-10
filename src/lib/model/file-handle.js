import { FILE_TYPE } from './constants';
import { S3DDecoder } from '../s3d/s3d-decoder';

export class EQFileHandle {

  /**
     * @type {Array<FileSystemFileHandle>}
     */
  #fileHandles = [];
  #name = '';
  #type = -1;
  #initialized = false;
  /**
     * 
     * @param {FileSystemFileHandle} fileHandles 
     */
  constructor(name, fileHandles) {
    this.#name = name;
    this.#fileHandles = fileHandles;
  }

  get name() {
    return this.#name;
  }

  get fileHandles() {
    return this.#fileHandles;
  }

  async initialize() {
    if (this.#fileHandles.length === 0) {
      console.warn('File handle length was 0!');
      return;
    }
    if (this.#fileHandles.some(f => f.name.endsWith('eqg'))) {
      this.#type = FILE_TYPE.EQG;
    } else {
      this.#type = FILE_TYPE.S3D;
    }
    this.#initialized = true;
  }

  async process() {
    if (!this.#initialized) {
      console.warn('Was not initialized, cannot process');
      return;
    }
    if (this.#type === FILE_TYPE.EQG) {
      
    } else if (this.#type === FILE_TYPE.S3D) {
      const s3dDecoder = new S3DDecoder(this);
      await s3dDecoder.process();
    }
  }

}