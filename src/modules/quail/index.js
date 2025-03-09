import * as Comlink from 'comlink';
import { SageFileSystemDirectoryHandle } from 'sage-core/util/fileSystem';

class QuailProcessor {
  /**
   * @type {Worker}
   */
  #worker = null;

  get quailWorker() {
    if (this.#worker) {
      this.#worker.terminate();
    }
    const worker =
      new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    const wrappedWorker = Comlink.wrap(worker);
    this.#worker = worker;
    return wrappedWorker;
  }
  async convertS3D(name, zone, textures, lights, objects) {
    const result = await this.quailWorker.convertS3D(
      name,
      zone,
      textures,
      lights,
      objects
    );
    return result;
  }

  async parseWce(fileHandle) {
    const result = await this.quailWorker.parseWce(
      fileHandle instanceof SageFileSystemDirectoryHandle
        ? fileHandle.path
        : fileHandle,
    );
    return result;
  }

  async createQuail(file, folder, name) {
    return this.quailWorker.createQuail(file, folder, name);
  }

  terminate() {
    this.#worker.terminate();
    this.#worker = null;
  }
}

export const quailProcessor = new QuailProcessor();

window.quailProcessor = quailProcessor;
