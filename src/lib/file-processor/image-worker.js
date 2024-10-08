import * as Comlink from 'comlink';
import 'jimp/browser/lib/jimp';
import { convertDDS2Jimp } from '../util/image-processing';

const ShaderType = {
  Diffuse                        : 0,
  Transparent25                  : 1,
  Transparent50                  : 2,
  Transparent75                  : 3,
  TransparentAdditive            : 4,
  TransparentAdditiveUnlit       : 5,
  TransparentMasked              : 6,
  DiffuseSkydome                 : 7,
  TransparentSkydome             : 8,
  TransparentAdditiveUnlitSkydome: 9,
  Invisible                      : 10,
  Boundary                       : 11,
};
/**
 * @type {import('jimp/browser/lib/jimp')}
 */
const Jimp = globalThis.Jimp; // eslint-disable-line

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
  [ShaderType.TransparentAdditive]: 192,
};

const mainThreadFuncs = Comlink.wrap(self); // eslint-disable-line
/**
 *
 * @param {[QueueItem]} entries
 * @param {FileSystemDirectoryHandle} eqFileHandle
 */
async function parseTextures(entries, eqFileHandle, workerNum) {
  performance.mark(`${workerNum} entered function`);
  const requiemDir = await eqFileHandle.getDirectoryHandle('eqsage', {
    create: true,
  });
  const dirHandle = await requiemDir.getDirectoryHandle('textures', {
    create: true,
  });
  performance.mark(`${workerNum} started work`);
  const cleanupFuncs = [];
  await Promise.all(
    entries.map(async ({ name, data, shaderType }) => {
      name = name.toLowerCase().replace(/\.\w+$/, '.png');
      let textureHandle = await dirHandle
        .getFileHandle(name)
        .catch(() => undefined);
      if (!textureHandle) {
        textureHandle = await dirHandle.getFileHandle(name, { create: true });
      } else {
        mainThreadFuncs.incrementParsedImage(name);
        return;
      }
      const writable = await textureHandle.createWritable();
      if (writable.locked) {
        mainThreadFuncs.incrementParsedImage(name);
        return;
      }
      const imgData = await parseTexture(name, shaderType, data);
      await writable.write(imgData);
      cleanupFuncs.push(async () => {
        await writable.getWriter().releaseLock();
        await writable.close();
      });

      mainThreadFuncs.incrementParsedImage(name);
    })
  );
  performance.mark(`${workerNum} finished work`);
  performance.measure(
    `${workerNum} total time`,
    `${workerNum} entered function`,
    `${workerNum} finished work`
  );
  setTimeout(async () => {
    cleanupFuncs.forEach(fn => fn());
  }, 0);
}

/** @param {string} name */
async function parseTexture(name, shaderType, data) {
  name = name.toLowerCase().replace(/\.\w+$/, '');
  if (new DataView(data).getUint16(0, true) === 0x4d42) {
    // header for bitmap
    try {
      const img = await Jimp.read(data);
      await img.scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
        const thisColor = {
          r: img.bitmap.data[idx + 0],
          g: img.bitmap.data[idx + 1],
          b: img.bitmap.data[idx + 2],
          a: img.bitmap.data[idx + 3],
        };

        let alpha = thisColor.a; // a
        if (alphaShaderMap[shaderType]) {
          alpha = alphaShaderMap[shaderType];
        } else {
          const maxRgb = [thisColor.r, thisColor.g, thisColor.b].reduce(
            (acc, val) => (val > acc ? val : acc),
            0
          );
          alpha =
            maxRgb <= fullAlphaToDoubleAlphaThreshold
              ? maxRgb
              : Math.min(
                maxRgb + (maxRgb - fullAlphaToDoubleAlphaThreshold) * 2,
                255
              );
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
