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
async function convertS3D(entry) {
  console.log('Worker convert');
  const { quail, fs } = await CreateQuail('/static/quail.wasm');
  fs.setEntry('/input.s3d', fs.makeFileEntry(undefined, new Uint8Array(entry.data)));
  quail.convert('/input.s3d', '/input.json');

  const existingJson = JSON.parse(new TextDecoder().decode(fs.getEntry('/input.json').data));
  for (const [key, val] of Object.entries(entry.extra)) {
    existingJson[key] = val;
  }
  console.log('Output write json', existingJson);
  fs.getEntry('/input.json').data = new TextEncoder().encode(JSON.stringify(existingJson));
  quail.convert('/input.json', '/output.s3d');
    
  console.log('Quail', fs.files);
  const output = fs.files.get('/output.s3d');
  console.log('Out', output);
  return Comlink.transfer(output, [output]);
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
