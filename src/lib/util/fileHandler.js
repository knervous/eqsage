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

/**
 * Get top-level files from the root directory
 *
 * @returns {Promise<FileSystemFileHandle[]>} An array of file handles at the root level
 */
export const getRootFiles = async (filter, forName = false) => {
  const rootDir = getEQRootDir();
  const files = [];

  if (rootDir) {
    for await (const [name, entry] of rootDir.entries()) {
      const push = () => files.push(forName ? name : entry);
      if (filter && typeof filter === 'function') {
        if (filter(name)) {
          push();
        }
      } else {
        push();
      }
    }
  }

  return files;
};

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

export async function deleteEqFileOrFolder(directory, name) {
  const dir = directory === 'root' ? getEQRootDir() : await getEQDir(directory);
  const entry = await dir.getFileHandle(name).catch(() => undefined);
  if (entry.kind === 'file') {
    await dir.removeEntry(name);
  } else if (entry.kind === 'directory') {
    await deleteFolderRecursively(entry);
    await dir.removeEntry(name, { recursive: true });
  }
}

let cachedDirHandle = null;
const handles = {};

export const getEQSageDir = async () => {
  if (!window.gameController.rootFileSystemHandle) {
    return;
  }
  const eqsageDir =
    cachedDirHandle ||
    (await window.gameController.rootFileSystemHandle.getDirectoryHandle(
      'eqsage',
      {
        create: true,
      }
    ));
  cachedDirHandle = eqsageDir;

  return eqsageDir;
};

export const getEQRootDir = () => {
  return window.gameController.rootFileSystemHandle;
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
    const eqsageDir =
      cachedDirHandle ||
      (await window.gameController.rootFileSystemHandle.getDirectoryHandle(
        'eqsage',
        {
          create: true,
        }
      ));
    cachedDirHandle = eqsageDir;
    const handle =
      handles[name] ||
      (await eqsageDir.getDirectoryHandle(name, {
        create: true,
      }));
    handles[name] = handle;
    return handle;
  } catch (e) {
    return null;
  }
};

/**
 *
 * @param {string} directory
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export const writeEQFile = async (directory, name, buffer, subdir = undefined) => {
  let eqDir = directory === 'root' ? getEQRootDir() : await getEQDir(directory);
  if (subdir) {
    eqDir = await eqDir.getDirectoryHandle(subdir, { create: true });
  }
  const fileHandle = await eqDir.getFileHandle(name, { create: true }).catch(() => undefined);
  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    while (writable.locked) {
      console.log('Locked');
      await new Promise((res) => setTimeout(res, 50));
    }
    await writable.write(buffer);
    await writable.getWriter().releaseLock();
    await writable.close();
    return true;
  }
  return false;
};

export const writeFile = async (dirHandle, name, data) => {
  const fileHandle = await dirHandle.getFileHandle(name, { create: true }).catch(() => undefined);
  if (fileHandle) {
    const writable = await fileHandle.createWritable();
    while (writable.locked) {
      console.log('Locked');
      await new Promise((res) => setTimeout(res, 50));
    }
    await writable.write(data);
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
  const dir = directory === 'root' ? getEQRootDir() : await getEQDir(directory);
  const fh = await dir.getFileHandle(name).catch(() => undefined);
  const contents = await fh?.getFile().then((f) => f.arrayBuffer());
  if (!contents) {
    return false;
  }
  switch (type) {
    default:
    case 'text':
      return new TextDecoder('utf-8').decode(new Uint8Array(contents));
    case 'arrayBuffer':
      return contents;
    case 'json': {
      try {
        return contents
          ? JSON.parse(
            new TextDecoder('utf-8').decode(new Uint8Array(contents))
          )
          : {};
      } catch {
        return {};
      }
    }
  }
};

/**
 *
 * @param {string} directory
 * @param {string} name
 * @returns {Promise<ArrayBuffer>}
 */
export const getEQFileExists = async (directory, name) => {
  const dir = directory === 'root' ? getEQRootDir() : await getEQDir(directory);
  return await dir
    .getFileHandle(name)
    .then((f) => f?.getFile())
    .then((f) => !!f.name)
    .catch(() => false);
};

let existingMetadata = {};
let needFirst = true;
export const appendObjectMetadata = async (key, path) => {
  existingMetadata = needFirst ? (await getEQFile('data', 'objectPaths.json', 'json')) : existingMetadata;
  if (existingMetadata === false) {
    existingMetadata = {};
  }
  needFirst = false;
  const upperKey = key.toUpperCase();
  const existing = existingMetadata[upperKey];
  if (!existing) {
    existingMetadata[upperKey] = path;
    await writeEQFile(
      'data',
      'objectPaths.json',
      JSON.stringify(existingMetadata, null, 4)
    );
  } else if (existing !== path) {
    // console.log(`Tried writing same object ${upperKey} different path ${path}`);
  }
};
