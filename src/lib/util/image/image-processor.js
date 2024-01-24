import * as Comlink from 'comlink';
import { getFiles, getTextureDir } from './fileHandler.js';

function chunkArray(array, numChunks) {
  if (numChunks < 1) {
    throw new Error('Number of chunks must be greater than or equal to 1');
  }

  const arrayLength = array.length;
  const chunkSize = Math.ceil(arrayLength / numChunks);
  const result = [];

  for (let i = 0; i < arrayLength; i += chunkSize) {
    const chunk = array.slice(i, i + chunkSize);
    result.push(chunk);
  }

  return result;
}


class ImageProcessor {
  /** @type {[Worker]} */
  #workers = [];

  /** @type {[Comlink.Remote<import('./worker.js')['default']>]} */
  babylonWorkers = null;

  /**
   * @type {[FileSystemHandle]}
   */
  fileHandles = [];

  workerIdx = 0;
  

  async initializeHandle(fileHandle) {
    const requiemDir = await getTextureDir(fileHandle);
    this.fileHandles = await getFiles(requiemDir);
  }

  /**
   * @typedef QueueItem
   * @property {string} name 
   * @property {ArrayBuffer} data 
   */

  initializeWorkers(workers = navigator.hardwareConcurrency ?? 4) {
    this.clearWorkers();
    for (let i = 0; i < workers; i++) {
      const worker = new Worker(new URL('./worker', import.meta.url));
      this.#workers.push(worker);
      this.babylonWorkers.push(Comlink.wrap(worker));
    }
  }

  clearWorkers() {
    this.#workers.forEach(w => {
      w.terminate();
    });
    this.#workers = [];
    this.babylonWorkers = [];
  }


  /**
   * 
   * @param {[QueueItem]} images 
   */
  async parseImages(images, fileHandle) {
    const imageChunks = chunkArray(images, this.#workers.length);
    await Promise.all(imageChunks.map((imgs, idx) => 
      this.babylonWorkers[idx].parseTextures(Comlink.transfer(imgs, imgs.map(i => i.data)), fileHandle)
    ));
  }
  
}

export const imageProcessor = new ImageProcessor();

window.imageProcessor = imageProcessor;