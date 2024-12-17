import * as Comlink from 'comlink';
import { gameController } from '../../../viewer/controllers/GameController.js';
import { GlobalStore } from '../../../state/store.js';

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
  babylonWorkers = [];

  /**
   * @type {[FileSystemHandle]}
   */
  fileHandles = [];

  workerIdx = 0;

  current = 0;

  constructor() {
    this.initializeWorkers();
  }

  /**
   * @typedef QueueItem
   * @property {string} name
   * @property {ArrayBuffer} data
   */

  initializeWorkers(workers = Math.min(4, navigator.hardwareConcurrency ?? 4)) {
    console.log(`Initializing ${workers} image workers`);
    if (this.#workers.length) {
      console.log('Reusing initialized workers');
      return;
    }
    this.clearWorkers();
    for (let i = 0; i < workers; i++) {
      const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      this.#workers.push(worker);
      this.babylonWorkers.push(Comlink.wrap(worker));
    }
  }

  clearWorkers() {
    console.log('Cleared workers');
    this.current = 0;
    this.#workers.forEach((w) => {
      w.terminate();
    });
    this.#workers = [];
    this.babylonWorkers = [];
  }

  currentWorkerIdx = 0;
  /**
   * 
   * @param {ArrayBuffer} buffer 
   */
  async compressImage(arr) {
    const idx = this.currentWorkerIdx % 4;
    const worker = this.babylonWorkers[idx];
    this.currentWorker++;
    const newBuffer = new ArrayBuffer(arr.byteLength);
    const newArray = new Uint8Array(newBuffer);
    newArray.set(arr);
    return await worker.compressImage(newArray.buffer);
  }

  /**
   *
   * @param {[QueueItem]} images
   */
  async parseImages(images) {

    const imageChunks = chunkArray(images, this.#workers.length);
    GlobalStore.actions.setLoadingTitle('Loading Images');
    let count = 0;
    const workerLength = this.#workers.length;
    const incrementContainer = {
      incrementParsedImage() {
        count++;
        GlobalStore.actions.setLoadingText(
          `Decoded ${count} of ${images.length} images using ${
            workerLength
          } threads`
        );
      }
    };
    for (const worker of this.#workers) {
      Comlink.expose(incrementContainer, worker);
    }
   
    await Promise.all(
      imageChunks.map((imgs, idx) =>
        this.babylonWorkers[idx]
          .parseTextures(
            Comlink.transfer(
              imgs,
              imgs.map((i) => i.data)
            ),
            gameController.rootFileSystemHandle,
            idx
          )
      )
    );
    this.current++;
  }
}

export const imageProcessor = new ImageProcessor();

window.imageProcessor = imageProcessor;
