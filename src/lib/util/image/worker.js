import * as Comlink from 'comlink';
import { convertDDS2Jimp } from '../image-processing';
import 'jimp/browser/lib/jimp';
import { ShaderType } from '../../s3d/materials/material';


/**
 * @type {import('jimp/browser/lib/jimp')}
 */
const Jimp = global.Jimp;

/**
 * @typedef QueueItem
 * @property {string} name
 * @property {ArrayBuffer} data
 */

const fullAlphaToDoubleAlphaThreshold = 64;
const alphaShaderMap = {
  [ShaderType.Transparent25]      : 64,
  [ShaderType.Transparent50]      : 128,
  [ShaderType.TransparentSkydome] : 128,
  [ShaderType.Transparent75]      : 192,
  [ShaderType.TransparentAdditive]: 192
};

/**
 *
 * @param {[QueueItem]} entries
 * @param {FileSystemDirectoryHandle} eqFileHandle
 */
async function parseTextures(entries, eqFileHandle) {
  const requiemDir = await eqFileHandle.getDirectoryHandle('eqsage', {
    create: true,
  });
  const dirHandle = await requiemDir.getDirectoryHandle('textures', {
    create: true,
  });

  await Promise.all(
    entries.map(async ({ name, data, shaderType }) => {
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
      const imgData = await parseTexture(name, shaderType, data);
      await writable.write(imgData);
      await writable.getWriter().releaseLock();
      await writable.close();
    })
  );
  // await db.textureData.bulkAdd(imgEntries);
}

/** @param {string} name */
async function parseTexture(name, shaderType, data) {
  name = name.toLowerCase().replace(/\.\w+$/, '');
  if (new DataView(data).getUint16(0, true) === 0x4d42) { // header for bitmap
    try {
      const img = await Jimp.read(data);
      await img.scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
        const thisColor = {
          r: img.bitmap.data[idx + 0],
          g: img.bitmap.data[idx + 1],
          b: img.bitmap.data[idx + 2],
          a: img.bitmap.data[idx + 3]
        };

        let alpha = thisColor.a; // a
        if (alphaShaderMap[shaderType]) {
          alpha = alphaShaderMap[shaderType];
        } else {
          const maxRgb = [thisColor.r, thisColor.g, thisColor.b].reduce((acc, val) => val > acc ? val : acc, 0);
          alpha = maxRgb <= fullAlphaToDoubleAlphaThreshold ? maxRgb :
            Math.min(maxRgb + ((maxRgb - fullAlphaToDoubleAlphaThreshold) * 2), 255);
        }
      
        img.bitmap.data[idx + 0] = thisColor.r;
        img.bitmap.data[idx + 1] = thisColor.g;
        img.bitmap.data[idx + 2] = thisColor.b;
        img.bitmap.data[idx + 3] = alpha;
      
      });
      return await img.getBufferAsync(Jimp.MIME_PNG);
    } catch (e) {
      console.warn('err', e, name);
    }
    return null;
  }
  // otherwise dds
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
        bmp.bitmap.data[idx] = decompressed[idx]; // r
        bmp.bitmap.data[idx + 1] = decompressed[idx + 1]; // g
        bmp.bitmap.data[idx + 2] = decompressed[idx + 2]; // b

        let alpha = decompressed[idx + 3]; // a
        if (alphaShaderMap[shaderType]) {
          alpha = alphaShaderMap[shaderType];
        } else {
          // const maxRgb = [decompressed[idx], decompressed[idx + 1], decompressed[idx + 2]].reduce((acc, val) => val > acc ? val : acc, 0);
          // alpha = maxRgb <= fullAlphaToDoubleAlphaThreshold ? 0 : alpha;
          // fullAlphaToDoubleAlphaThreshold ? 0 :
          // Math.min(maxRgb + ((maxRgb - fullAlphaToDoubleAlphaThreshold) * 2), 255);
        }
        bmp.bitmap.data[idx + 3] = alpha;


      },
      (err, newImg) => {
        if (err) {
          reject(new Error(err));
        }
        resolve(newImg);
      }
    )
  );
  img.flip(false, true);

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
