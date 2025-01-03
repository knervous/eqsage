import * as Comlink from 'comlink';
import { convertDDS2Jimp } from '../image-processing';
import 'jimp/browser/lib/jimp';

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

  const requiemDir = await eqFileHandle.getDirectoryHandle('eqsage', { create: true });
  const dirHandle = await requiemDir.getDirectoryHandle('textures', { create: true });

  performance.mark(`${workerNum} started work`);
  const cleanupFuncs = [];
  await Promise.all(entries.map(async ({ name, data, shaderType }) => {
    name = name.toLowerCase().replace(/\.\w+$/, '.png');
    let textureHandle = await dirHandle.getFileHandle(name).catch(() => undefined);
    if (!textureHandle) {
      textureHandle = await dirHandle.getFileHandle(name, { create: true });
    } else {
      mainThreadFuncs.incrementParsedImage();
      return;
    }
    const writable = await textureHandle.createWritable();
    if (writable.locked) {
      mainThreadFuncs.incrementParsedImage();
      return;
    }
    const imgData = await parseTexture(name, shaderType, data);
    await writable.write(imgData);
    cleanupFuncs.push(async () => {
      await writable.close();
    });
    mainThreadFuncs.incrementParsedImage();
  }));

  performance.mark(`${workerNum} finished work`);
  performance.measure(`${workerNum} total time`, `${workerNum} entered function`, `${workerNum} finished work`);

  setTimeout(async () => {
    for (const cleanup of cleanupFuncs) {
      await cleanup();
    }
  }, 0);
}

/** @param {string} name */
async function parseTexture(name, shaderType, data) {
  name = name.toLowerCase().replace(/\.\w+$/, '');

  if (new DataView(data).getUint16(0, true) === 0x4d42) {
    // header for bitmap
    try {
      const img = await Jimp.read(data);
      let maskColor;

      // If TransparentMasked shader type, set maskColor to the first pixel
      if (shaderType === ShaderType.TransparentMasked) {
        const firstPixelIdx = 0;
        maskColor = {
          r: img.bitmap.data[firstPixelIdx],
          g: img.bitmap.data[firstPixelIdx + 1],
          b: img.bitmap.data[firstPixelIdx + 2],
          a: img.bitmap.data[firstPixelIdx + 3],
        };
      }

      img.scan(0, 0, img.bitmap.width, img.bitmap.height, (x, y, idx) => {
        const r = img.bitmap.data[idx];
        const g = img.bitmap.data[idx + 1];
        const b = img.bitmap.data[idx + 2];
        let alpha = img.bitmap.data[idx + 3];

        if (shaderType === ShaderType.TransparentMasked) {
          // If the current pixel matches the mask color, set alpha to 0
          if (
            r === maskColor.r &&
            g === maskColor.g &&
            b === maskColor.b &&
            alpha === maskColor.a
          ) {
            alpha = 0;
          }
        } else if (alphaShaderMap[shaderType]) {
          alpha = alphaShaderMap[shaderType];
        } else {
          const maxRgb = Math.max(r, g, b);
          alpha = maxRgb <= fullAlphaToDoubleAlphaThreshold
            ? maxRgb
            : Math.min(maxRgb + (maxRgb - fullAlphaToDoubleAlphaThreshold) * 2, 255);
        }

        img.bitmap.data[idx + 3] = alpha;
      });

      return await img.getBufferAsync(Jimp.MIME_PNG);
    } catch (e) {
      console.warn('Error processing BMP:', e, name);
      return null;
    }
  } else {
    // otherwise DDS
    const [decompressed, dds] = convertDDS2Jimp(new Uint8Array(data));
    const w = dds.mipmaps[0].width;
    const h = dds.mipmaps[0].height;
    const bmp = new Jimp(w, h);

    let maskColor;

    // If TransparentMasked shader type, set maskColor to the first pixel of decompressed data
    if (shaderType === ShaderType.TransparentMasked) {
      maskColor = {
        r: decompressed[0],
        g: decompressed[1],
        b: decompressed[2],
        a: decompressed[3],
      };
    }

    bmp.scan(0, 0, w, h, (x, y, idx) => {
      bmp.bitmap.data[idx] = decompressed[idx]; // r
      bmp.bitmap.data[idx + 1] = decompressed[idx + 1]; // g
      bmp.bitmap.data[idx + 2] = decompressed[idx + 2]; // b
      let alpha = decompressed[idx + 3]; // a

      if (shaderType === ShaderType.TransparentMasked) {
        // If the current pixel matches the mask color, set alpha to 0
        if (
          bmp.bitmap.data[idx] === maskColor.r &&
          bmp.bitmap.data[idx + 1] === maskColor.g &&
          bmp.bitmap.data[idx + 2] === maskColor.b &&
          alpha === maskColor.a
        ) {
          alpha = 0;
        }
      } else if (alphaShaderMap[shaderType]) {
        alpha = alphaShaderMap[shaderType];
      }

      bmp.bitmap.data[idx + 3] = alpha;
    });

    bmp.flip(false, true);

    return await bmp.getBufferAsync(Jimp.MIME_PNG);
  }
}

/**
 * 
 * @param {ArrayBuffer} buffer 
 */
async function compressImage(buffer) {
  const uint8Array = new Uint8Array(buffer);
  const blob = new Blob([uint8Array], { type: 'image/png' });

  try {
    const imageBitmap = await createImageBitmap(blob);
    const offscreen = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = offscreen.getContext('2d');

    // X axis flip
    // ctx.scale(1, -1);
    // ctx.translate(0, -imageBitmap.height);

    ctx.drawImage(imageBitmap, 0, 0);
    const quality = 0.7;
    const compressedBlob = await offscreen.convertToBlob({ type: 'image/jpeg', quality });
    const arrayBuffer = await compressedBlob.arrayBuffer();
    return Comlink.transfer(arrayBuffer, [arrayBuffer]);
  } catch (e) {
    console.warn('Error in compress', e);
  }
  return null;
}
const exports = { parseTextures, compressImage };

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
