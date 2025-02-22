import * as Comlink from 'comlink';
import { SageFileSystemDirectoryHandle } from '@/lib/util/fileSystem';

class QuailProcessor {
  #worker = null;
  #wrappedWorker = null;
  async convertS3D(name, zone, textures, lights, objects) {
    const worker =
      this.#worker ||
      new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    const wrappedWorker = this.#wrappedWorker || Comlink.wrap(worker);
    this.#worker = worker;
    this.#wrappedWorker = wrappedWorker;
    const result = await wrappedWorker.convertS3D(
      name,
      zone,
      textures,
      lights,
      objects
    );
    return result;
  }

  async parseWce(fileHandle) {
    const worker =
      this.#worker ||
      new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    const wrappedWorker = this.#wrappedWorker || Comlink.wrap(worker);
    this.#worker = worker;
    this.#wrappedWorker = wrappedWorker;
    console.log(
      'FH',
      fileHandle,
      fileHandle instanceof SageFileSystemDirectoryHandle
    );
    const result = await wrappedWorker.parseWce(
      fileHandle instanceof SageFileSystemDirectoryHandle
        ? fileHandle.path
        : fileHandle,
    );
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
