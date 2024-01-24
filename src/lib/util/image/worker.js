import * as Comlink from 'comlink';
import { convertDDS2Jimp } from '../image-processing';
import 'jimp/browser/lib/jimp';


/**
 * @type {import('jimp/browser/lib/jimp')}
 */
const Jimp = global.Jimp;

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
async function parseTextures(entries, eqFileHandle) {
  const requiemDir = await eqFileHandle.getDirectoryHandle('requiem', {
    create: true,
  });
  const dirHandle = await requiemDir.getDirectoryHandle('textures', {
    create: true,
  });

  await Promise.all(
    entries.map(async ({ name, data }) => {
      name = name.toLowerCase().replace(/\.\w+$/, '.png');
      let textureHandle = await dirHandle.getFileHandle(name).catch(() => undefined);
      if (!textureHandle) {
        textureHandle = await dirHandle.getFileHandle(name, { create: true });
      } else {
        return;
      }
      const writable = await textureHandle.createWritable();
      if (writable.locked) {
        return;
      }
      const imgData = await parseTexture(name, data);
      await writable.write(imgData);
      await writable.getWriter().releaseLock();
      await writable.close();
    })
  );
  // await db.textureData.bulkAdd(imgEntries);
}

/** @param {string} name */
async function parseTexture(name, data) {
  name = name.toLowerCase().replace(/\.\w+$/, '');
  if (new DataView(data).getUint16(0, true) === 0x4d42) {
    try {
      const img = await Jimp.read(data);
      return await img.getBufferAsync(Jimp.MIME_PNG);
    } catch (e) {
      console.warn('err', e, name);
    }
    return null;
  }
  const [decompressed, dds] = convertDDS2Jimp(new Uint8Array(data));
  const w = dds.mipmaps[0].width;
  const h = dds.mipmaps[0].height;
  const bmp = new Jimp(w, h);
  const img = await new Promise((resolve, reject) =>
    bmp.scan(
      0,
      0,
      w,
      h,
      (x, y, idx) => {
        bmp.bitmap.data[idx] = decompressed[idx];
        bmp.bitmap.data[idx + 1] = decompressed[idx + 1];
        bmp.bitmap.data[idx + 2] = decompressed[idx + 2];
        bmp.bitmap.data[idx + 3] = decompressed[idx + 3];
      },
      (err, newImg) => {
        if (err) {
          reject(new Error(err));
        }
        resolve(newImg);
      }
    )
  );

  return await img.getBufferAsync(Jimp.MIME_PNG);
}
const exports = {
  parseTextures,
};

/** @type {typeof exports} */
const exp = Object.entries(exports).reduce((acc, [key, fn]) => {
  acc[key] = async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error('Worker error', error);
    }
  };
  return acc;
}, {});

export default exp;

Comlink.expose(exp);
