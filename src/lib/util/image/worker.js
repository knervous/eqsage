import Dexie from 'dexie';
import * as Comlink from 'comlink';
import imageCompression from 'browser-image-compression';
import { convertDDS2Jimp } from '../image-processing';
import 'jimp/browser/lib/jimp';

/**
 * @type {import('jimp/browser/lib/jimp')}
 */
const Jimp = global.Jimp;
const dbVersion = 1;

const db = new Dexie('eq_textures');
db.version(dbVersion).stores({
  textureData: 'name,data',
});


let res;
const keys = new Promise(resolve => {
  res = resolve;
}); 

(async () => {
  await db.open();
  res(await db.textureData.toCollection().keys());
})();

/** @param {string} name */
async function parseTexture(name, data) {
  name = name.toLowerCase().replace(/\.\w+$/, '');
  const val = await db.textureData.get(name);
  if (val) {
    return;
  }
  const options = {
    maxSizeMB       : 1,
    maxWidthOrHeight: 1920,
    useWebWorker    : false,
  };
  if (new DataView(data).getUint16(0, true) === 0x4D42) {
    try {
      const img = await Jimp.read(data);
      const png = await img.getBufferAsync(Jimp.MIME_PNG);
      // const blob = new Blob([png.buffer], { type: 'image/png' });
      await db.textureData.add({ name, data: png });
    } catch (e) {
      console.warn('err', e, name);
    }
    return;
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
  await img.flip(false, true);
  const png = await img.getBufferAsync(Jimp.MIME_PNG);
  // const blob = new Blob([png.buffer], { type: 'image/png' });
  await db.textureData.add({ name, data: png });
}
const exports = {
  parseTexture,
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
