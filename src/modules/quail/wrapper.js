const encoder = new TextEncoder('utf-8');
const decoder = new TextDecoder('utf-8');
const reinterpretBuf = new DataView(new ArrayBuffer(8));
let logLine = [];

const O_RDONLY = 0;
const O_WRONLY = 1;
const O_RDWR = 2;
const O_CREAT = 0x40;
const O_TRUNC = 0x200;
const O_APPEND = 0x400;

let nextFd = 4; // 0,1,2 typically reserved (stdin/stdout/stderr)
const openFiles = new Map(); // fd -> { path, position, flags }
const inMemoryFS = new Map(); // path -> { type: 'file'|'dir', data|children, mode, ctime, mtime }

function makeDirEntry(mode = 0o040000) {
  return {
    type    : 'dir',
    children: new Map(), // sub-paths
    mode,
    ctime   : new Date(),
    mtime   : new Date(),
  };
}

/**
 * Helper to create a "file" entry in the inMemoryFS.
 */
function makeFileEntry(mode = 0o666, data = new Uint8Array(0)) {
  return {
    type : 'file',
    data, // file contents
    mode,
    ctime: new Date(),
    mtime: new Date(),
  };
}

// Root directory by default:
inMemoryFS.set('/', makeDirEntry());

/**
 * Normalize path to avoid trailing slashes, etc.
 */
function normalizePath(path) {
  if (!path) {
    return '/';
  }
  // Remove trailing slash except if root
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  path = path.replaceAll('//', '/');
  return path || '/';
}

/**
 * Retrieve the entry from inMemoryFS by path.
 */
function getEntry(path) {
  path = normalizePath(path);
  const entry = inMemoryFS.get(path);
  if (!entry) {
    throw Object.assign(
      new Error(`ENOENT: no such file or directory, open '${path}'`),
      { code: 'ENOENT' }
    );
  }
  return entry;
}

/**
 * Create (or overwrite) an entry in inMemoryFS.
 */
function setEntry(path, entry) {
  path = normalizePath(path);
  inMemoryFS.set(path, entry);
}

/**
 * Remove an entry from inMemoryFS.
 */
function deleteEntry(path) {
  path = normalizePath(path);
  if (!inMemoryFS.delete(path)) {
    throw Object.assign(
      new Error(`ENOENT: no such file or directory, unlink '${path}'`),
      { code: 'ENOENT' }
    );
  }
}

/**
 * Get the parent directory path (for mkdir, etc.).
 */
function getParentPath(path) {
  path = normalizePath(path);
  if (path === '/') {
    return '/';
  }
  const idx = path.lastIndexOf('/');
  return idx > 0 ? path.slice(1, idx) : '/';
}

let outputBuf = '';
class Go {
  fileSystem = {
    constants: {
      O_WRONLY   : -1,
      O_RDWR     : -1,
      O_CREAT    : -1,
      O_TRUNC    : -1,
      O_APPEND   : -1,
      O_EXCL     : -1,
      O_DIRECTORY: -1,
    }, //
    writeSync(fd, buf) {
      // For simplicity, treat fd=1 as console output:
      if (fd < 4) {
        // Collect the output, then print on newline
        outputBuf += new TextDecoder().decode(buf);
        const nl = outputBuf.lastIndexOf('\n');
        if (nl !== -1) {
          console.log(outputBuf.substring(0, nl));
          outputBuf = outputBuf.substring(nl + 1);
        }
        return buf.length;
      }
      // If it's any other fd, let's actually write to an open in-memory file:
      const fileHandle = openFiles.get(fd);
      if (!fileHandle) {
        throw new Error(`Bad file descriptor: ${fd}`);
      }
      const fileEntry = getEntry(fileHandle.path);
      if (fileEntry.type !== 'file') {
        throw new Error(
          `ENOTFILE: cannot write to directory '${fileHandle.path}'`
        );
      }

      let pos = fileHandle.position;
      // If O_APPEND, move to end
      if ((fileHandle.flags & O_APPEND) === O_APPEND) {
        pos = fileEntry.data.length;
      }

      // Expand data if needed
      const newLength = Math.max(fileEntry.data.length, pos + buf.length);
      if (newLength > fileEntry.data.length) {
        const newData = new Uint8Array(newLength);
        newData.set(fileEntry.data, 0);
        fileEntry.data = newData;
      }
      // Copy
      fileEntry.data.set(buf, pos);
      fileHandle.position = pos + buf.length;
      fileEntry.mtime = new Date();
      return buf.length;
    },

    write(fd, buf, offset, length, position, callback) {
      if (fd < 4) {
        const n = this.writeSync(fd, buf);
        callback(null, n);
        return;
      }
      try {
        const fileHandle = openFiles.get(fd);
        if (!fileHandle) {
          throw Object.assign(new Error(`EBADF: bad file descriptor ${fd}`), {
            code: 'EBADF',
          });
        }
        const fileEntry = getEntry(fileHandle.path);
        if (fileEntry.type !== 'file') {
          throw new Error(
            `ENOTFILE: cannot write to directory '${fileHandle.path}'`
          );
        }

        // 1) Validate offset/length range
        //    We want offset + length to be within buf's bounds.
        if (offset < 0 || length < 0 || offset + length > buf.length) {
          throw new RangeError(
            `Offset (${offset}) + length (${length}) out of buffer bounds (${buf.length})`
          );
        }
        // 2) Determine write position
        let pos;
        if (position !== null) {
          // If 'position' is given, use that, and do NOT update fileHandle.position
          pos = position;
        } else if ((fileHandle.flags & O_APPEND) === O_APPEND) {
          // O_APPEND means always write at the file's end
          pos = fileEntry.data.length;
        } else {
          // If 'position' is null, use the file handle's current position
          pos = fileHandle.position;
        }

        // 3) Prepare the new file size if writing beyond current end
        const endPos = pos + length;
        if (endPos > fileEntry.data.length) {
          // Expand the file data array
          const newData = new Uint8Array(endPos);
          newData.set(fileEntry.data, 0);
          fileEntry.data = newData;
        }

        // 4) Copy the requested slice from `buf` into the file at `pos`
        //    e.g. buf.subarray(offset, offset + length)
        const sliceToWrite = buf.subarray(offset, offset + length);
        fileEntry.data.set(sliceToWrite, pos);

        // 5) Update file times
        fileEntry.mtime = new Date();

        // 6) If 'position' was null, update fileHandle.position
        if (position === null && (fileHandle.flags & O_APPEND) !== O_APPEND) {
          fileHandle.position = endPos;
        }

        // 7) Callback with the number of bytes written
        callback(null, length);
      } catch (err) {
        callback(err);
      }
    },

    chmod(path, mode, callback) {
      // For simplicity, we just pretend to do it.
      // If you want, store `mode` in the entry’s metadata.
      try {
        const entry = getEntry(path);
        entry.mode = mode;
        entry.mtime = new Date();
        callback(null);
      } catch (err) {
        callback(err);
      }
    },

    chown(path, uid, gid, callback) {
      // Not really relevant in a pure JS in-memory FS. Stub it.
      callback(null);
    },

    close(fd, callback) {
      try {
        if (!openFiles.has(fd)) {
          throw Object.assign(new Error(`EBADF: bad file descriptor ${fd}`), {
            code: 'EBADF',
          });
        }
        openFiles.delete(fd);
        callback(null);
      } catch (err) {
        callback(err);
      }
    },

    fchmod(fd, mode, callback) {
      try {
        const fileHandle = openFiles.get(fd);
        if (!fileHandle) {
          throw new Error(`Bad fd ${fd}`);
        }
        const entry = getEntry(fileHandle.path);
        entry.mode = mode;
        entry.mtime = new Date();
        callback(null);
      } catch (err) {
        callback(err);
      }
    },

    fchown(fd, uid, gid, callback) {
      // Stubs
      callback(null);
    },

    fstat(fd, callback) {
      // Return the stats of the file behind this fd
      try {
        const fileHandle = openFiles.get(fd);
        if (!fileHandle) {
          throw new Error(`Bad fd ${fd}`);
        }
        const entry = getEntry(fileHandle.path);

        const stats = {
          dev        : 0,
          ino        : 0,
          mode       : entry.type === 'file' ? 0o666 : 0o040000,
          nlink      : 1,
          uid        : 0,
          gid        : 0,
          rdev       : 0,
          size       : entry.type === 'file' ? entry.data.length : 0,
          blksize    : 4096,
          blocks     : 1,
          atimeMs    : entry.atime ? entry.atime.getTime() : 0,
          mtimeMs    : entry.mtime ? entry.mtime.getTime() : 0,
          ctimeMs    : entry.ctime ? entry.ctime.getTime() : 0,
          isDirectory: function () {
            return entry.type === 'dir';
          },
        };

        // 3) callback with (err, stats)
        callback(null, stats);
      } catch (err) {
        console.log('Got err', err);
        callback(err);
      }
    },

    fsync(fd, callback) {
      // In-memory, no-op
      callback(null);
    },

    ftruncate(fd, length, callback) {
      // Basic truncate on the file behind fd
      try {
        const fileHandle = openFiles.get(fd);
        if (!fileHandle) {
          throw new Error(`Bad fd ${fd}`);
        }
        const entry = getEntry(fileHandle.path);
        if (entry.type !== 'file') {
          throw new Error('ENOTFILE: can\'t truncate a directory');
        }
        if (length < entry.data.length) {
          entry.data = entry.data.subarray(0, length);
        } else if (length > entry.data.length) {
          const newData = new Uint8Array(length);
          newData.set(entry.data, 0);
          entry.data = newData;
        }
        entry.mtime = new Date();
        // If position > length, move it back
        if (fileHandle.position > length) {
          fileHandle.position = length;
        }
        callback(null);
      } catch (err) {
        callback(err);
      }
    },

    link(path, link, callback) {
      // Hard links in a pure in-memory FS are trickier.
      // Could point to same underlying data object, but we skip for brevity.
      callback(new Error('ENOSYS: link not implemented'));
    },

    lstat(path, callback) {
      // If you want to treat symlinks differently, you'd do so here.
      // We’ll just do same as stat for this example.
      this.stat(path, callback);
    },

    mkdir(path, perm, callback) {
      try {
        path = normalizePath(path);
        if (inMemoryFS.has(path)) {
          throw Object.assign(
            new Error(`EEXIST: file already exists, mkdir '${path}'`),
            { code: 'EEXIST' }
          );
        }
        if (path !== '/') {
          // Ensure parent is a directory
          const parentPath = getParentPath(path);
          const parent = getEntry(parentPath);
          if (parent.type !== 'dir') {
            throw new Error(
              `ENOTDIR: cannot mkdir under a file '${parentPath}'`
            );
          }
          parent.mtime = new Date();
        }

        setEntry(path, makeDirEntry(perm));
        callback(null);
      } catch (err) {
        callback(err);
      }
    },

    open(path, flags, mode, callback) {
      try {
        path = normalizePath(path);
        let fileEntry;
        if (!inMemoryFS.has(path)) {
          // If file does not exist, see if O_CREAT:
          if ((flags & O_CREAT) === O_CREAT) {
            // Create a new file
            fileEntry = makeFileEntry(mode);
            setEntry(path, fileEntry);
          } else {
            throw Object.assign(
              new Error(`ENOENT: no such file or directory, open '${path}'`),
              { code: 'ENOENT' }
            );
          }
        } else {
          fileEntry = getEntry(path);
          if (
            fileEntry.type === 'dir' &&
            (flags & O_WRONLY || flags & O_RDWR)
          ) {
            // Trying to open a directory for writing
            throw new Error(
              `EISDIR: illegal operation on a directory, open '${path}'`
            );
          }
          // If O_TRUNC, empty the file
          if ((flags & O_TRUNC) === O_TRUNC && fileEntry.type === 'file') {
            fileEntry.data = new Uint8Array(0);
            fileEntry.mtime = new Date();
          }
        }

        const fd = nextFd++;
        openFiles.set(fd, {
          path,
          position: 0,
          flags,
        });

        callback(null, fd);
      } catch (err) {
        callback(err);
      }
    },

    read(fd, buffer, offset, length, position, callback) {
      try {
        const fileHandle = openFiles.get(fd);
        if (!fileHandle) {
          throw new Error(`Bad fd: ${fd}`);
        }
        const fileEntry = getEntry(fileHandle.path);
        if (fileEntry.type !== 'file') {
          throw new Error('Can\'t read a directory');
        }

        const pos = position !== null ? position : fileHandle.position;
        const end = Math.min(pos + length, fileEntry.data.length);
        const n = end - pos;
        buffer.set(fileEntry.data.subarray(pos, pos + n), offset);
        if (position === null) {
          fileHandle.position += n;
        }
        callback(null, n, buffer);
      } catch (err) {
        callback(err);
      }
    },

    readdir(path, callback) {
      try {
        const entry = getEntry(path);
        if (entry.type !== 'dir') {
          throw new Error(`ENOTDIR: not a directory '${path}'`);
        }
        // Return immediate children
        const children = [];
        for (const candidate of inMemoryFS.keys()) {
          if (candidate !== '/' && getParentPath(candidate) === path) {
            let child = candidate.slice(path === '/' ? 1 : path.length + 1);
            if (child.startsWith('/')) {
              child = child.slice(1, child.length);
            }
            children.push(child);
          }
        }
        callback(null, children);
      } catch (err) {
        callback(err);
      }
    },

    readlink(path, callback) {
      callback(new Error('ENOSYS: readlink not implemented'));
    },

    rename(from, to, callback) {
      try {
        const entry = getEntry(from);
        // Make sure 'to' parent is a directory
        const toParent = getParentPath(to);
        const parentEntry = getEntry(toParent);
        if (parentEntry.type !== 'dir') {
          throw new Error(`ENOTDIR: cannot rename under a file '${toParent}'`);
        }
        // Remove old entry, set new entry
        deleteEntry(from);
        setEntry(to, entry);
        entry.mtime = new Date();
        callback(null);
      } catch (err) {
        callback(err);
      }
    },

    rmdir(path, callback) {
      try {
        const entry = getEntry(path);
        if (entry.type !== 'dir') {
          throw new Error(`ENOTDIR: rmdir '${path}'`);
        }
        // Ensure directory is empty
        for (const candidate of inMemoryFS.keys()) {
          if (candidate !== path && getParentPath(candidate) === path) {
            throw new Error(`ENOTEMPTY: directory not empty '${path}'`);
          }
        }
        deleteEntry(path);
        callback(null);
      } catch (err) {
        callback(err);
      }
    },

    stat(path, callback) {
      if (path === '.') {
        path = '/';
      }
      path = path.replaceAll('//', '/');
      if (!path.startsWith('/')) {
        path = `/${path}`;
      }

      try {
        const entry = getEntry(path);
        const stats = {
          dev        : 0,
          ino        : 0,
          mode       : entry.type === 'file' ? 0o666 : 0o040000,
          nlink      : 1,
          uid        : 0,
          gid        : 0,
          rdev       : 0,
          size       : entry.type === 'file' ? entry.data.length : 0,
          blksize    : 4096,
          blocks     : 1,
          atimeMs    : entry.atime ? entry.atime.getTime() : 0,
          mtimeMs    : entry.mtime ? entry.mtime.getTime() : 0,
          ctimeMs    : entry.ctime ? entry.ctime.getTime() : 0,
          isDirectory: function () {
            return entry.type === 'dir';
          },
        };
        callback(null, stats);
      } catch (err) {
        callback(err);
      }
    },

    symlink(path, link, callback) {
      callback(new Error('ENOSYS: symlink not implemented'));
    },

    truncate(path, length, callback) {
      // Similar to ftruncate but by path
      try {
        const entry = getEntry(path);
        if (entry.type !== 'file') {
          throw new Error('ENOTFILE: can\'t truncate a directory');
        }
        if (length < entry.data.length) {
          entry.data = entry.data.subarray(0, length);
        } else if (length > entry.data.length) {
          const newData = new Uint8Array(length);
          newData.set(entry.data, 0);
          entry.data = newData;
        }
        entry.mtime = new Date();
        callback(null);
      } catch (err) {
        callback(err);
      }
    },

    unlink(path, callback) {
      try {
        const entry = getEntry(path);
        if (entry.type !== 'file') {
          throw new Error(
            `EISDIR: illegal operation on a directory, unlink '${path}'`
          );
        }
        // Make sure no fd is open on this file (optional)
        deleteEntry(path);
        callback(null);
      } catch (err) {
        callback(err);
      }
    },

    utimes(path, atime, mtime, callback) {
      try {
        const entry = getEntry(path);
        entry.atime = new Date(atime);
        entry.mtime = new Date(mtime);
        callback(null);
      } catch (err) {
        callback(err);
      }
    },
  };
  constructor() {
    this.argv = ['js'];
    this.env = {};
    this.exit = (code) => {
      if (code !== 0) {
        console.warn('exit code:', code);
      }
    };
    this._exitPromise = new Promise((resolve) => {
      this._resolveExitPromise = resolve;
    });
    this._pendingEvent = null;
    this._scheduledTimeouts = new Map();
    this._nextCallbackTimeoutID = 1;

    const setInt64 = (addr, v) => {
      this.mem.setUint32(addr + 0, v, true);
      this.mem.setUint32(addr + 4, Math.floor(v / 4294967296), true);
    };

    const setInt32 = (addr, v) => {
      this.mem.setUint32(addr + 0, v, true);
    };

    const getInt64 = (addr) => {
      const low = this.mem.getUint32(addr + 0, true);
      const high = this.mem.getInt32(addr + 4, true);
      return low + high * 4294967296;
    };

    const loadValue = (addr) => {
      const f = this.mem.getFloat64(addr, true);
      if (f === 0) {
        return undefined;
      }
      if (!isNaN(f)) {
        return f;
      }

      const id = this.mem.getUint32(addr, true);
      return this._values[id];
    };

    const storeValue = (addr, v) => {
      const nanHead = 0x7ff80000;

      if (typeof v === 'number' && v !== 0) {
        if (isNaN(v)) {
          this.mem.setUint32(addr + 4, nanHead, true);
          this.mem.setUint32(addr, 0, true);
          return;
        }
        this.mem.setFloat64(addr, v, true);
        return;
      }

      if (v === undefined) {
        this.mem.setFloat64(addr, 0, true);
        return;
      }

      let id = this._ids.get(v);
      if (id === undefined) {
        id = this._idPool.pop();
        if (id === undefined) {
          id = this._values.length;
        }
        this._values[id] = v;
        this._goRefCounts[id] = 0;
        this._ids.set(v, id);
      }
      this._goRefCounts[id]++;
      let typeFlag = 0;
      switch (typeof v) {
        case 'object':
          if (v !== null) {
            typeFlag = 1;
          }
          break;
        case 'string':
          typeFlag = 2;
          break;
        case 'symbol':
          typeFlag = 3;
          break;
        case 'function':
          typeFlag = 4;
          break;
      }
      this.mem.setUint32(addr + 4, nanHead | typeFlag, true);
      this.mem.setUint32(addr, id, true);
    };

    const loadSlice = (addr) => {
      const array = getInt64(addr + 0);
      const len = getInt64(addr + 8);
      return new Uint8Array(this._inst.exports.mem.buffer, array, len);
    };

    const loadSliceOfValues = (addr) => {
      const array = getInt64(addr + 0);
      const len = getInt64(addr + 8);
      const a = new Array(len);
      for (let i = 0; i < len; i++) {
        a[i] = loadValue(array + i * 8);
      }
      return a;
    };

    const loadString = (addr) => {
      const saddr = getInt64(addr + 0);
      const len = getInt64(addr + 8);
      return decoder.decode(
        new DataView(this._inst.exports.mem.buffer, saddr, len)
      );
    };

    const testCallExport = (a, b) => {
      this._inst.exports.testExport0();
      return this._inst.exports.testExport(a, b);
    };
    const mem = () => new DataView(this._inst.exports.mem.buffer);
    const timeOrigin = Date.now() - performance.now();
    this.importObject = {
      _gotest: {
        add       : (a, b) => a + b,
        callExport: testCallExport,
      },
      wasi_snapshot_preview1: {
        // https://github.com/WebAssembly/WASI/blob/main/phases/snapshot/docs.md#fd_write
        fd_write: function (fd, iovs_ptr, iovs_len, nwritten_ptr) {
          let nwritten = 0;
          if (fd == 1) {
            for (let iovs_i = 0; iovs_i < iovs_len; iovs_i++) {
              const iov_ptr = iovs_ptr + iovs_i * 8; // assuming wasm32
              const ptr = mem().getUint32(iov_ptr + 0, true);
              const len = mem().getUint32(iov_ptr + 4, true);
              nwritten += len;
              for (let i = 0; i < len; i++) {
                const c = mem().getUint8(ptr + i);
                if (c == 13) {
                  // CR
                  // ignore
                } else if (c == 10) {
                  // LF
                  // write line
                  const line = decoder.decode(new Uint8Array(logLine));
                  logLine = [];
                  console.log(line);
                } else {
                  logLine.push(c);
                }
              }
            }
          } else {
            console.error('invalid file descriptor:', fd);
          }
          mem().setUint32(nwritten_ptr, nwritten, true);
          return 0;
        },
        fd_close     : () => 0, // dummy
        fd_fdstat_get: () => 0, // dummy
        fd_seek      : () => 0, // dummy
        proc_exit    : (code) => {},
        random_get   : (bufPtr, bufLen) => {
          crypto.getRandomValues(loadSlice(bufPtr, bufLen));
          return 0;
        },
      },
      gojs: {
        // Go's SP does not change as long as no Go code is running. Some operations (e.g. calls, getters and setters)
        // may synchronously trigger a Go event handler. This makes Go code get executed in the middle of the imported
        // function. A goroutine can switch to a new stack if the current stack is too small (see morestack function).
        // This changes the SP, thus we have to update the SP used by the imported function.
        // func ticks() float64
        'runtime.ticks': () => {
          return timeOrigin + performance.now();
        },

        // func sleepTicks(timeout float64)
        'runtime.sleepTicks': (timeout) => {
          // Do not sleep, only reactivate scheduler after the given timeout.
          setTimeout(this._inst.exports.go_scheduler, timeout);
        },
        // func wasmExit(code int32)
        'runtime.wasmExit': (sp) => {
          sp >>>= 0;
          const code = this.mem.getInt32(sp + 8, true);
          this.exited = true;
          delete this._inst;
          delete this._values;
          delete this._goRefCounts;
          delete this._ids;
          delete this._idPool;
          this.exit(code);
        },

        // func wasmWrite(fd uintptr, p unsafe.Pointer, n int32)
        'runtime.wasmWrite': (sp) => {
          sp >>>= 0;
          const fd = getInt64(sp + 8);
          const p = getInt64(sp + 16);
          const n = this.mem.getInt32(sp + 24, true);
          this.fileSystem.writeSync(
            fd,
            new Uint8Array(this._inst.exports.mem.buffer, p, n)
          );
        },

        // func resetMemoryDataView()
        'runtime.resetMemoryDataView': (sp) => {
          sp >>>= 0;
          this.mem = new DataView(this._inst.exports.mem.buffer);
        },

        // func nanotime1() int64
        'runtime.nanotime1': (sp) => {
          sp >>>= 0;
          setInt64(sp + 8, (timeOrigin + performance.now()) * 1000000);
        },

        // func walltime() (sec int64, nsec int32)
        'runtime.walltime': (sp) => {
          sp >>>= 0;
          const msec = new Date().getTime();
          setInt64(sp + 8, msec / 1000);
          this.mem.setInt32(sp + 16, (msec % 1000) * 1000000, true);
        },

        // func scheduleTimeoutEvent(delay int64) int32
        'runtime.scheduleTimeoutEvent': (sp) => {
          sp >>>= 0;
          const id = this._nextCallbackTimeoutID;
          this._nextCallbackTimeoutID++;
          this._scheduledTimeouts.set(
            id,
            setTimeout(() => {
              this._resume();
              while (this._scheduledTimeouts.has(id)) {
                // for some reason Go failed to register the timeout event, log and try again
                // (temporary workaround for https://github.com/golang/go/issues/28975)
                console.warn('scheduleTimeoutEvent: missed timeout event');
                this._resume();
              }
            }, getInt64(sp + 8))
          );
          this.mem.setInt32(sp + 16, id, true);
        },

        // func clearTimeoutEvent(id int32)
        'runtime.clearTimeoutEvent': (sp) => {
          sp >>>= 0;
          const id = this.mem.getInt32(sp + 8, true);
          clearTimeout(this._scheduledTimeouts.get(id));
          this._scheduledTimeouts.delete(id);
        },

        // func getRandomData(r []byte)
        'runtime.getRandomData': (sp) => {
          sp >>>= 0;
          crypto.getRandomValues(loadSlice(sp + 8));
        },

        // func finalizeRef(v ref)
        'syscall/js.finalizeRef': (sp) => {
          sp >>>= 0;
          const id = this.mem.getUint32(sp + 8, true);
          this._goRefCounts[id]--;
          if (this._goRefCounts[id] === 0) {
            const v = this._values[id];
            this._values[id] = null;
            this._ids.delete(v);
            this._idPool.push(id);
          }
        },

        // func stringVal(value string) ref
        'syscall/js.stringVal': (sp) => {
          sp >>>= 0;
          storeValue(sp + 24, loadString(sp + 8));
        },

        // func valueGet(v ref, p string) ref
        'syscall/js.valueGet': (sp) => {
          sp >>>= 0;
          const result = Reflect.get(loadValue(sp + 8), loadString(sp + 16));
          sp = this._inst.exports.getsp() >>> 0; // see comment above
          storeValue(sp + 32, result);
        },

        // func valueSet(v ref, p string, x ref)
        'syscall/js.valueSet': (sp) => {
          sp >>>= 0;
          Reflect.set(
            loadValue(sp + 8),
            loadString(sp + 16),
            loadValue(sp + 32)
          );
        },

        // func valueDelete(v ref, p string)
        'syscall/js.valueDelete': (sp) => {
          sp >>>= 0;
          Reflect.deleteProperty(loadValue(sp + 8), loadString(sp + 16));
        },

        // func valueIndex(v ref, i int) ref
        'syscall/js.valueIndex': (sp) => {
          sp >>>= 0;
          storeValue(
            sp + 24,
            Reflect.get(loadValue(sp + 8), getInt64(sp + 16))
          );
        },

        // valueSetIndex(v ref, i int, x ref)
        'syscall/js.valueSetIndex': (sp) => {
          sp >>>= 0;
          Reflect.set(loadValue(sp + 8), getInt64(sp + 16), loadValue(sp + 24));
        },

        // func valueCall(v ref, m string, args []ref) (ref, bool)
        'syscall/js.valueCall': (sp) => {
          sp >>>= 0;
          try {
            const v = loadValue(sp + 8);
            const m = Reflect.get(v, loadString(sp + 16));
            const args = loadSliceOfValues(sp + 32);
            const result = Reflect.apply(m, v, args);
            sp = this._inst.exports.getsp() >>> 0; // see comment above
            storeValue(sp + 56, result);
            this.mem.setUint8(sp + 64, 1);
          } catch (err) {
            sp = this._inst.exports.getsp() >>> 0; // see comment above
            storeValue(sp + 56, err);
            this.mem.setUint8(sp + 64, 0);
          }
        },

        // func valueInvoke(v ref, args []ref) (ref, bool)
        'syscall/js.valueInvoke': (sp) => {
          sp >>>= 0;
          try {
            const v = loadValue(sp + 8);
            const args = loadSliceOfValues(sp + 16);
            const result = Reflect.apply(v, undefined, args);
            sp = this._inst.exports.getsp() >>> 0; // see comment above
            storeValue(sp + 40, result);
            this.mem.setUint8(sp + 48, 1);
          } catch (err) {
            sp = this._inst.exports.getsp() >>> 0; // see comment above
            storeValue(sp + 40, err);
            this.mem.setUint8(sp + 48, 0);
          }
        },

        // func valueNew(v ref, args []ref) (ref, bool)
        'syscall/js.valueNew': (sp) => {
          sp >>>= 0;
          try {
            const v = loadValue(sp + 8);
            const args = loadSliceOfValues(sp + 16);
            const result = Reflect.construct(v, args);
            sp = this._inst.exports.getsp() >>> 0; // see comment above
            storeValue(sp + 40, result);
            this.mem.setUint8(sp + 48, 1);
          } catch (err) {
            sp = this._inst.exports.getsp() >>> 0; // see comment above
            storeValue(sp + 40, err);
            this.mem.setUint8(sp + 48, 0);
          }
        },

        // func valueLength(v ref) int
        'syscall/js.valueLength': (sp) => {
          sp >>>= 0;
          setInt64(sp + 16, parseInt(loadValue(sp + 8).length));
        },

        // valuePrepareString(v ref) (ref, int)
        'syscall/js.valuePrepareString': (sp) => {
          sp >>>= 0;
          const str = encoder.encode(String(loadValue(sp + 8)));
          storeValue(sp + 16, str);
          setInt64(sp + 24, str.length);
        },

        // valueLoadString(v ref, b []byte)
        'syscall/js.valueLoadString': (sp) => {
          sp >>>= 0;
          const str = loadValue(sp + 8);
          loadSlice(sp + 16).set(str);
        },

        // func valueInstanceOf(v ref, t ref) bool
        'syscall/js.valueInstanceOf': (sp) => {
          sp >>>= 0;
          this.mem.setUint8(
            sp + 24,
            loadValue(sp + 8) instanceof loadValue(sp + 16) ? 1 : 0
          );
        },

        // func copyBytesToGo(dst []byte, src ref) (int, bool)
        'syscall/js.copyBytesToGo': (sp) => {
          sp >>>= 0;
          const dst = loadSlice(sp + 8);
          const src = loadValue(sp + 32);
          if (
            !(src instanceof Uint8Array || src instanceof Uint8ClampedArray)
          ) {
            this.mem.setUint8(sp + 48, 0);
            return;
          }
          const toCopy = src.subarray(0, dst.length);
          dst.set(toCopy);
          setInt64(sp + 40, toCopy.length);
          this.mem.setUint8(sp + 48, 1);
        },

        // func copyBytesToJS(dst ref, src []byte) (int, bool)
        'syscall/js.copyBytesToJS': (sp) => {
          sp >>>= 0;
          const dst = loadValue(sp + 8);
          const src = loadSlice(sp + 16);
          if (
            !(dst instanceof Uint8Array || dst instanceof Uint8ClampedArray)
          ) {
            this.mem.setUint8(sp + 48, 0);
            return;
          }
          const toCopy = src.subarray(0, dst.length);
          dst.set(toCopy);
          setInt64(sp + 40, toCopy.length);
          this.mem.setUint8(sp + 48, 1);
        },

        debug: (value) => {
          console.log(value);
        },
      },
    };
  }

  run(instance) {
    if (!(instance instanceof WebAssembly.Instance)) {
      throw new Error('Go.run: WebAssembly.Instance expected');
    }
    this._inst = instance;
    this.mem = new DataView(this._inst.exports.mem.buffer);
    globalThis.fs = this.fileSystem;
    globalThis.process = {
      cwd() {
        return '/';
      },
      chdir() {},
    };
    this._values = [
      // JS values that Go currently has references to, indexed by reference id
      NaN,
      0,
      null,
      true,
      false,
      globalThis,
      this,
    ];
    this._goRefCounts = new Array(this._values.length).fill(Infinity); // number of references that Go has to a JS value, indexed by reference id
    this._ids = new Map([
      // mapping from JS values to reference ids
      [0, 1],
      [null, 2],
      [true, 3],
      [false, 4],
      [globalThis, 5],
      [this, 6],
    ]);
    this._idPool = []; // unused ids that have been garbage collected
    this.exited = false; // whether the Go program has exited

    // Pass command line arguments and environment variables to WebAssembly by writing them to the linear memory.
    let offset = 4096;

    const strPtr = (str) => {
      const ptr = offset;
      const bytes = encoder.encode(`${str }\0`);
      new Uint8Array(this.mem.buffer, offset, bytes.length).set(bytes);
      offset += bytes.length;
      if (offset % 8 !== 0) {
        offset += 8 - (offset % 8);
      }
      return ptr;
    };

    const argvPtrs = [];
    this.argv.forEach((arg) => {
      argvPtrs.push(strPtr(arg));
    });
    argvPtrs.push(0);

    const keys = Object.keys(this.env).sort();
    keys.forEach((key) => {
      argvPtrs.push(strPtr(`${key}=${this.env[key]}`));
    });
    argvPtrs.push(0);

    argvPtrs.forEach((ptr) => {
      this.mem.setUint32(offset, ptr, true);
      this.mem.setUint32(offset + 4, 0, true);
      offset += 8;
    });

    // The linker guarantees global data starts from at least wasmMinDataAddr.
    // Keep in sync with cmd/link/internal/ld/data.go:wasmMinDataAddr.
    const wasmMinDataAddr = 4096 + 8192;
    if (offset >= wasmMinDataAddr) {
      throw new Error(
        'total length of command line and environment variables exceeds limit'
      );
    }

    this._inst.exports.run();
    if (this.exited) {
      this._resolveExitPromise();
    }
    return this._exitPromise;
  }

  _resume() {
    if (this.exited) {
      throw new Error('Go program has already exited');
    }
    this._inst.exports.resume();
    if (this.exited) {
      this._resolveExitPromise();
    }
  }

  _makeFuncWrapper(id) {
    const go = this;
    return function () {
      const event = { id: id, this: this, args: arguments };
      go._pendingEvent = event;
      go._resume();
      return event.result;
    };
  }
}
let cached;

export const CreateQuail = (url) =>
  cached ??
  new Promise((res) => {
    const go = new Go();
    if ('instantiateStreaming' in WebAssembly) {
      WebAssembly.instantiateStreaming(fetch(url), go.importObject).then(
        (obj) => {
          const wasm = obj.instance;
          go.run(wasm);
          cached = {
            ...wasm.exports,
            quail: go._values?.find((v) => v?.quail),
            fs   : {
              getEntry,
              setEntry,
              makeFileEntry,
              makeDirEntry,
              files: inMemoryFS,
            },
          };
          res(cached);
        }
      );
    } else {
      fetch(url)
        .then((resp) => resp.arrayBuffer())
        .then((bytes) =>
          WebAssembly.instantiate(bytes, go.importObject).then((obj) => {
            const wasm = obj.instance;
            go.run(wasm);
            cached = {
              ...wasm.exports,
              quail: go._values?.find((v) => v?.quail),
              fs   : {
                getEntry,
                setEntry,
                makeFileEntry,
                makeDirEntry,
                files: inMemoryFS,
              },
            };
            res(cached);
          })
        );
    }
  });
