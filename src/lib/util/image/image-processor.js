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
  babylonWorkers = null;

  /**
   * @type {[FileSystemHandle]}
   */
  fileHandles = [];

  workerIdx = 0;

  /**
   * @typedef QueueItem
   * @property {string} name
   * @property {ArrayBuffer} data
   */

  initializeWorkers(workers = Math.min(4, navigator.hardwareConcurrency ?? 4)) {
    this.clearWorkers();
    for (let i = 0; i < workers; i++) {
      const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      this.#workers.push(worker);
      this.babylonWorkers.push(Comlink.wrap(worker));
    }
  }

  clearWorkers() {
    this.#workers.forEach((w) => {
      w.terminate();
    });
    this.#workers = [];
    this.babylonWorkers = [];
  }

  /**
   *
   * @param {[QueueItem]} images
   */
  async parseImages(images) {
    if (this.#workers.length === 0) {
      this.initializeWorkers();
    }
    const imageChunks = chunkArray(images, this.#workers.length);
    GlobalStore.actions.setLoadingTitle('Loading Images');
    let count = 0;

    GlobalStore.actions.setLoadingText(
      `Decoded ${count} of ${images.length} images using ${
        this.#workers.length
      } threads`
    );
    await Promise.all(
      imageChunks.map((imgs, idx) =>
        this.babylonWorkers[idx]
          .parseTextures(
            Comlink.transfer(
              imgs,
              imgs.map((i) => i.data)
            ),
            gameController.rootFileSystemHandle
          )
          .then(() => {
            count += imgs.length;
            GlobalStore.actions.setLoadingText(
              `Decoded ${count} of ${images.length} images using ${
                this.#workers.length
              } threads`
            );
          })
      )
    );
    this.clearWorkers();
  }
}

export const imageProcessor = new ImageProcessor();

window.imageProcessor = imageProcessor;
