import * as Comlink from 'comlink';

class ImageProcessor {
  /** @type {Comlink.Remote<import('./worker.js')['default']>} */
  #worker = null;

  /** @type {Comlink.Remote<import('./worker.js')['default']>} */
  babylonWorker = null;

  constructor() {
    this.initializeWorker();
  }

  initializeWorker() {
    this.#worker = new Worker(new URL('./worker', import.meta.url));
    this.babylonWorker = Comlink.wrap(this.#worker);

    this.#worker.addEventListener('message', event => {
      if (event?.data?.fatal) {
        this.initializeWorker();
      }
    });
    this.#worker.addEventListener('error', () => {
      this.initializeWorker();
    });
  }

  async parseTexture(name, data) {
    await this.babylonWorker.parseTexture(name, Comlink.transfer(data, [data]));
  }
  
}

export const imageProcessor = new ImageProcessor();