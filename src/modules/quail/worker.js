import * as Comlink from 'comlink';
import { CreateQuail } from './wrapper';
import { createDirectoryHandle } from '@/lib/util/fileSystem';
/**
 * @typedef QueueItem
 * @property {string} name
 * @property {ArrayBuffer} data
 */

/**
 *
 * @param {[QueueItem]} entries
 * @param {FileSystemDirectoryHandle} eqFileHandle
 */
async function convertS3D(name, zone, textures, lights, objects) {
  console.log('Quail Worker convert');
  const { quail, fs } = await CreateQuail('/static/quail.wasm');

  // Write JSON
  const encoder = new TextEncoder();
  fs.setEntry(
    `/${name}.json`,
    fs.makeFileEntry(undefined, encoder.encode(JSON.stringify(zone)))
  );
  if (lights) {
    fs.setEntry(
      `/${name}_lights.json`,
      fs.makeFileEntry(undefined, encoder.encode(JSON.stringify(lights)))
    );
  }
  if (objects) {
    fs.setEntry(
      `/${name}_objects.json`,
      fs.makeFileEntry(undefined, encoder.encode(JSON.stringify(objects)))
    );
  }

  fs.setEntry(`/${name}`, fs.makeDirEntry());
  // Write textures
  for (const texture of textures) {
    fs.setEntry(`/${name}/${texture.name}`, fs.makeFileEntry(undefined, new Uint8Array(texture.buffer)));
  }

  quail.convert(`/${name}.json`, `/${name}.s3d`);
  const output = fs.files.get(`/${name}.s3d`);

  return output ? Comlink.transfer(output.data.buffer, [output.data.buffer]) : null;
}

/**
 *
 * @param {FileSystemDirectoryHandle} fileHandle
 */
async function parseWce(fileHandle) {
  if (typeof fileHandle === 'string') {
    fileHandle = createDirectoryHandle(fileHandle);
  }
  console.log('Quail Worker convert');
  const { quail, fs } = await CreateQuail('/static/quail.wasm');
  const prefix = `${fileHandle.name}`;
  fs.files.set(`/${prefix}`, {
    type    : 'dir',
    children: new Map(), // sub-paths
    mode    : 0o040000,
    ctime   : new Date(),
    mtime   : new Date(),
  });
  const recurse = async (dirHandle, path = '') => {
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === 'directory') {
        fs.files.set(`/${path}${name}`, {
          type    : 'dir',
          children: new Map(),
          mode    : 0o040000,
          ctime   : new Date(),
          mtime   : new Date(),
        });
        await recurse(handle, `${path}${name}/`);
      } else {
        fs.setEntry(
          `${path}${name}`,
          fs.makeFileEntry(undefined, new Uint8Array(await handle.getFile().then(f => f.arrayBuffer())))
        );
      }
    }
  };

  await recurse(fileHandle, `${prefix}/`);
  quail.convert(prefix, `${fileHandle.name}.s3d`);
  const data = fs.files.get(`/${fileHandle.name}.s3d`).data;
  return data;
}


const exports = { convertS3D, parseWce };

/** @type {typeof exports} */
const exp = Object.fromEntries(
  Object.entries(exports).map(([key, fn]) => [
    key,
    async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        console.error('Worker error', error);
      }
    },
  ])
);

export default exp;

Comlink.expose(exp);
