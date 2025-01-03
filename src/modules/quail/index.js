import * as Comlink from 'comlink';

class QuailProcessor {
  async convertS3D(entries = []) {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    const wrappedWorker = Comlink.wrap(worker);
    const result = await wrappedWorker.convertS3D(Comlink.transfer(entries, entries.map(e => e.data)));
    worker.terminate();
    return result;
  }
}

export const quailProcessor = new QuailProcessor();

window.quailProcessor = quailProcessor;
