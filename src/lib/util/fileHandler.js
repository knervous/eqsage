
async function* getDirFiles(entry, path = '') {
  if (entry.kind === 'file') {
    const file = await entry;
    if (file !== null) {
      file.relativePath = path;
      yield file;
    }
  } else if (entry.kind === 'directory') {
    for await (const handle of entry.values()) {
      yield* getDirFiles(handle, `${path}/${handle.name}`);
    }
  }
}

export async function getFiles(entry, filter = undefined, forName = false) {
  const files = [];
  for await (const file of getDirFiles(entry)) {
    const push = () => files.push(forName ? file.name : file);
    if (filter && typeof filter === 'function') {
      if (filter(file.name)) {
        push();
      }
    } else {
      push();
    }
  }
  return files;
}

async function deleteFolderRecursively(handle) {
  for await (const [name, entry] of handle.entries()) {
    if (entry.kind === 'file') {
      await handle.removeEntry(name);
    } else if (entry.kind === 'directory') {
      await deleteFolderRecursively(entry);
      await handle.removeEntry(name, { recursive: true });
    }
  }
}
export async function deleteEqFolder(name) {
  const dir = await getEQDir(name);
  if (dir) {
    await deleteFolderRecursively(dir);
  }
}

let cachedDirHandle = null;
const handles = {

};
/**
 *
 * @param {string} name
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
export const getEQDir = async (name) => {
  if (!window.gameController.rootFileSystemHandle) {
    return;
  }
  try {
    const eqsageDir = cachedDirHandle ||
    await window.gameController.rootFileSystemHandle.getDirectoryHandle('eqsage', {
      create: true,
    });
    cachedDirHandle = eqsageDir;
    const handle = handles[name] || await eqsageDir.getDirectoryHandle(name, {
      create: true,
    });
    handles[name] = handle;
    return handle;
  } catch (e) {
    return null;
  }

};

/**
 *
 * @param {FileSystemDirectoryHandle} directory
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export const writeEQFile = async (directory, name, buffer) => {
  const fileHandle = await getEQDir(directory).then((dir) =>
    dir.getFileHandle(name, { create: true }).catch(() => undefined)
  );
  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    if (writable.locked) {
      return false;
    }
    await writable.write(buffer);
    await writable.getWriter().releaseLock();
    await writable.close();
    return true;
  }
  return false;
};

/**
 *
 * @param {string} directory
 * @param {string} name
 * @returns {Promise<ArrayBuffer> | Promise<object>}
 */
export const getEQFile = async (directory, name, type = 'arrayBuffer') => {
  const dir = await getEQDir(directory);
  const fh = await dir.getFileHandle(name).catch(() => undefined);
  const contents = await fh?.getFile().then(f => f.arrayBuffer());

  switch (type) {
    default:
    case 'arrayBuffer':
      return contents;
    case 'json':
      return contents ? JSON.parse(
        new TextDecoder('utf-8').decode(new Uint8Array(contents))
      ) : undefined;
  }
};

/**
 *
 * @param {string} directory
 * @param {string} name
 * @returns {Promise<ArrayBuffer>}
 */
export const getEQFileExists = async (directory, name) => {
  return await getEQDir(directory).then((dir) =>
    dir
      .getFileHandle(name)
      .then(f => f?.getFile())
      .then(f => !!f.name)
      .catch(() => false)
  );
};
