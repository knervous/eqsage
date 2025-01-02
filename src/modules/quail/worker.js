import * as Comlink from 'comlink';
import { CreateQuail } from 'quail-wasm';
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
async function convertS3D(entries, fileHandle) {
  console.log('Worker convert');
  const { quail } = await CreateQuail('/static/quail.wasm');
  for (const entry of entries) {
    quail.fs.write('/qeynos2.s3d', new Uint8Array(entry.data));
  }
  quail.convert('/qeynos2.s3d', '/new.s3d');
  console.log('Quail', quail.fs);
  return 'test';
}

const exports = { convertS3D };

/** @type {typeof exports} */
const exp = Object.fromEntries(Object.entries(exports).map(([key, fn]) => [key, async (...args) => {
  try {
    return await fn(...args);
  } catch (error) {
    console.error('Worker error', error);
  }
}]));

export default exp;

Comlink.expose(exp);
