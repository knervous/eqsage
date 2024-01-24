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
 * @param {FileSystemDirectoryHandle} eqFileHandle
 * @returns {FileSystemDirectoryHandle}
 */
export const getTextureDir = async (eqFileHandle) => {
  const requiemDir = await eqFileHandle.getDirectoryHandle('requiem', {
    create: true,
  });
  return await requiemDir.getDirectoryHandle('textures', {
    create: true,
  });
};

/**
 *
 * @param {string} name
 * @returns {ArrayBuffer}
 */
export const getTexture = async (textureDir, name) => {
  return await textureDir
    .getFileHandle(name)
    .catch(() => undefined)
    .then((fh) => fh?.getFile())
    .then((f) => f?.arrayBuffer());
};
