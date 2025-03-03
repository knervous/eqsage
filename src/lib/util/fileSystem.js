let fsInterface = {};
const isElectron = () =>
  typeof process !== 'undefined' &&
  process.versions != null &&
  process.versions.electron != null;

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  if (isElectron()) {
    const { promises: fs } = require('fs');
    const path = require('path');
    fsInterface = {
      readFile    : async (filePath) => (await fs.readFile(filePath).catch(() => null))?.buffer,
      deleteFile  : async (filePath) => (await fs.unlink(filePath).catch(() => null)),
      deleteFolder: async (folderPath) => {
        await fs.rm(folderPath, { recursive: true, force: true }).catch(() => {});
      },
      readDir: async (filePath) => {
        const entries = await fs.readdir(filePath);
        const detailedEntries = await Promise.all(
          entries.map(async (entry) => {
            const fullPath = path.join(filePath, entry);
            const stats = await fs.stat(fullPath);
            return {
              name       : entry,
              path       : fullPath.replaceAll('\\', '/'),
              isDirectory: stats.isDirectory(),
              isFile     : stats.isFile()
            };
          })
        );
        return detailedEntries;
      },
      createIfNotExist: async (path) => {
        try {
          await fs.access(path);
        } catch {
          await fs.mkdir(path);
        }
      },
      writeFile: async (filePath, data) => await fs.writeFile(filePath, data),
    };
  }
} else if (window.electronAPI) {
  fsInterface = window.electronFS;
  // Debounce helper function
  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  let lastZoomFactor = null;
  let ignoreResize = false;

  // Adjusts zoom based on aspect ratio (desired ratio: 16:9)
  function adjustZoomByAspectRatio() {
    if (ignoreResize) {
      return;
    }

    // Define the desired aspect ratio
    const desiredAspectRatio = 16 / 9;
    // Compute the current window aspect ratio
    const currentAspectRatio = window.innerWidth / window.innerHeight;

    // If the window is "squashed" (i.e. current is less than desired), calculate a scale
    const newZoom = currentAspectRatio < desiredAspectRatio 
      ? currentAspectRatio / desiredAspectRatio 
      : 1;

    // Only update if the zoom factor changes significantly
    if (lastZoomFactor !== null && Math.abs(newZoom - lastZoomFactor) < 0.01) {
      return;
    }
    lastZoomFactor = newZoom;

    // Temporarily ignore resize events to prevent feedback loops
    ignoreResize = true;
    // Set the zoom factor via your Electron API (assumed exposed from preload)
    window.electronAPI.setZoomFactor(newZoom);
    console.log(
    `Window aspect ratio: ${currentAspectRatio.toFixed(2)} vs. desired: ${desiredAspectRatio.toFixed(2)} → Zoom factor: ${newZoom.toFixed(2)}`
    );

    // Release the resize lock after a short delay
    setTimeout(() => {
      ignoreResize = false;
    }, 300);
  }

  // Create a debounced version to avoid rapid firing
  const debouncedAdjustZoom = debounce(adjustZoomByAspectRatio, 50);

  // Initial call on load
  adjustZoomByAspectRatio();
  // Listen for window resize events using the debounced function
  window.addEventListener('resize', debouncedAdjustZoom);

  
}

class SageFileSystemFileHandle {
  #path = '';
  kind = 'file';
  name = '';
  constructor(path) {
    this.#path = path.endsWith('/') ? path.slice(0, path.length - 2) : path;
    this.name = path.split('/').at(-1);

  }
  async createWritable() {
    const path = this.#path;
    return {
      locked: false,
      async write(data) {
        await fsInterface.writeFile(path, data instanceof ArrayBuffer ? new Uint8Array(data) : data);
      },
      close() {},
      getWriter() {
        return {
          releaseLock() {}
        };
      }
    };
  }
  async removeEntry(path) {
    await fsInterface.delete(`${this.#path}/${path}`);
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

  async removeEntry() {
    await fsInterface.deleteFolder(this.#path);
  }

  async getDirectoryHandle(name, options) {
    const path = `${this.#path}/${name}`;
    if (options?.create) {
      await fsInterface.createIfNotExist(path); 
    }
    return new SageFileSystemDirectoryHandle(path);
  }
}

export const createFileSystemHandle = path => {
  return new SageFileSystemFileHandle(path);
};

export const createDirectoryHandle = path => {
  return new SageFileSystemDirectoryHandle(path);
};