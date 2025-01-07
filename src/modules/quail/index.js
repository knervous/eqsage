import * as Comlink from 'comlink';

class QuailProcessor {
  #worker = null;
  #wrappedWorker = null;
  async convertS3D(entry) {
    const worker = this.#worker || new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    const wrappedWorker = this.#wrappedWorker || Comlink.wrap(worker);
    this.#worker = worker;
    this.#wrappedWorker = wrappedWorker;
    const result = await wrappedWorker.convertS3D(Comlink.transfer(entry, [entry.data]));
    return result;
  }

  terminate() {
    this.#worker.terminate();
    this.#worker = null;
    this.#wrappedWorker = null;
  }
}

export const quailProcessor = new QuailProcessor();

window.quailProcessor = quailProcessor;
