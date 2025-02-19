let fsInterface = {};

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  console.log('cwd', process.cwd());
  fsInterface = require('./src/fsInterface').fsInterface;
} else {
  fsInterface = window.electronFS;
}

class SageFileSystemFileHandle {
  #path = '';
  kind = 'file';
  name = '';
  constructor(path) {
    this.#path = path;
    this.name = path.split('/').at(-1);

  }
  async createWritable() {
    return {
      locked: false,
      write(data) {

      },
      close() {},
      getWriter() {
        return {
          releaseLock() {}
        };
      }
    };
  }
  async getFile() {
    const rootPath = this.#path;
    return {
      name: this.name,
      async arrayBuffer() {
        return await fsInterface.readFile(`${rootPath}`);
      },
      async text() {
        const file = await fsInterface.readFile(`${rootPath}`);
        return new TextDecoder('utf-8').decode(file);
      }
    };
  }
}

export class SageFileSystemDirectoryHandle {
  #path = '';
  kind = 'directory';
  name = '';
  constructor(path) {
    this.#path = path;
    this.name = path.split('/').at(-1);
  }
  get path() {
    return this.#path;
  }
  async queryPermission() {
    console.log('Query my perms');
    return true;
  }

  async *values() {
    const flatFiles = await fsInterface.readDir(this.#path);
    for (const f of flatFiles) {
      yield f.isDirectory ? new SageFileSystemDirectoryHandle(f.path) : new SageFileSystemFileHandle(f.path);
    }
  }

  async *entries() {
    const flatFiles = await fsInterface.readDir(this.#path);
    for (const f of flatFiles) {
      yield [f.name, f.isDirectory ? new SageFileSystemDirectoryHandle(f.path) : new SageFileSystemFileHandle(f.path)];
    }
  }

  async getFileHandle(name) {
    return new SageFileSystemFileHandle(`${this.#path}/${name}`);
  }

  async getDirectoryHandle(name, options) {
    const path = `${this.#path}/${name}`;
    if (options.create) {
      await fsInterface.createIfNotExist(path); 
    }
    return new SageFileSystemDirectoryHandle(path);
  }
}


export const createDirectoryHandle = path => {
  return new SageFileSystemDirectoryHandle(path);
};