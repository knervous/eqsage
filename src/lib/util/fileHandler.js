import { gameController } from '../../viewer/controllers/GameController';

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

export async function getFiles(entry) {
  const files = [];
  for await (const file of getDirFiles(entry)) {
    files.push(file);
  }
  return files;
}
/**
 *
 * @param {string} name
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
export const getEQDir = async (name) => {
  if (!gameController.rootFileSystemHandle) {
    return;
  }
  const eqsageDir =
    await gameController.rootFileSystemHandle.getDirectoryHandle('eqsage', {
      create: true,
    });
  return await eqsageDir.getDirectoryHandle(name, {
    create: true,
  });
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
  const contents = await getEQDir(directory).then((dir) =>
    dir
      .getFileHandle(name)
      .catch(() => undefined)
      .then((fh) => fh?.getFile())
      .then((f) => f?.arrayBuffer())
  );

  switch (type) {
    default:
    case 'arrayBuffer':
      return contents;
    case 'json':
      return JSON.parse(
        new TextDecoder('utf-8').decode(new Uint8Array(contents))
      );
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
      .catch(() => false)
      .then(() => true)
  );
};
