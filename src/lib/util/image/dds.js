// import { PNG } from 'pngjs';

// // Based on:
// // https://docs.microsoft.com/en-us/windows/win32/direct3ddds/dx-graphics-dds-pguide

// // //////////////////////////////////////////////////////////////////////////////
// // //////////////////////////////////////////////////////////////////////////////
// // Configuration

// /**
//  * Some configuration to catch some errors in the processing of DDS files
//  */
// const config = {
//   /**
//    * If set to true, more check will be performed to see if the image is in
//    * a supported format
//    */
//   strongerFormatCheck: false,
// };

// // //////////////////////////////////////////////////////////////////////////////
// // //////////////////////////////////////////////////////////////////////////////
// // Bytes scanning

// /** A scanner on bytes */
// class BytesScanner {
//   /**
//    * Builds a byte scanner for the given buffer
//    * @param {Buffer} buffer The buffer to read
//    */
//   constructor(buffer) {
//     this.buffer = buffer;
//     this.i = 0;
//   }

//   /** Returns true if there are at least `quantity` bytes left to read */
//   hasXBytesLeft(quantity) {
//     return this.i + quantity <= this.buffer.length;
//   }

//   /** Reads the next DWORD */
//   nextDWORD() {
//     if (!this.hasXBytesLeft(4)) {
//       throw Error('Unexpected EOF');
//     }
//     const result = this.buffer.readUInt32LE(this.i);
//     this.i += 4;
//     return result;
//   }

//   /**
//    * Consumes the next `quantity` bytes and return them in an array
//    * @param {number} quantity The number of bytes to consume
//    * @returns An array with the content of the `quantity` consumed bytes
//    */
//   nextBytesAsArray(quantity) {
//     const r = this.buffer.subarray(this.i, this.i + quantity);
//     this.i += quantity;
//     return r;
//   }
// }

// // //////////////////////////////////////////////////////////////////////////////
// // //////////////////////////////////////////////////////////////////////////////
// // Colors and pixels computing

// /**
//  * Produce a function that takes a color masked by the given mask, and produce
//  * the color as a number on 8 bits.
//  * @param {number} mask The mask to get this color component
//  * @returns A function that maps a color value to its corresponding color in a
//  * 8 bits representation
//  */
// function colorFunctorFor8Bits(mask) {
//   let numberOfBits = 0;

//   let maskCopy = mask;
//   while (maskCopy !== 0) {
//     if (maskCopy & (1 == 1)) {
//       ++numberOfBits;
//     }
//     maskCopy = maskCopy >> 1;
//   }

//   if (numberOfBits === 0) {
//     return [0, 0];
//   }

//   let numberOfShift;
//   for (
//     numberOfShift = 0;
//     (mask >> numberOfShift) << numberOfShift == mask;
//     ++numberOfShift
//   ) {
//     // Ah bah super
//   }

//   const shift = numberOfShift - 1;
//   const max = mask >> shift;

//   return (a1r5g5b5) => Math.round((((a1r5g5b5 & mask) >> shift) / max) * 255);
// }

// // //////////////////////////////////////////////////////////////////////////////
// // //////////////////////////////////////////////////////////////////////////////
// // DDS parsing

// /** Constants related to DDS files */
// const DDS_H = {
//   DDSD_CAPS       : 0x1,
//   DDSD_HEIGHT     : 0x2,
//   DDSD_WIDTH      : 0x4,
//   DDSD_PITCH      : 0x8,
//   DDSD_PIXELFORMAT: 0x1000,
//   DDSD_MIPMAPCOUNT: 0x2000,
//   DDSD_LINEARSIZE : 0x8000,
//   DDSD_DEPTH      : 0x80000,

//   DDSCAPS_COMPLEX: 0x8,
//   DDSCAPS_MIPMAP : 0x400000,
//   DDSCAPS_TEXTURE: 0x1000,

//   DDSCAPS2_CUBEMAP          : 0x200,
//   DDSCAPS2_CUBEMAP_POSITIVEX: 0x400,
//   DDSCAPS2_CUBEMAP_NEGATIVEX: 0x800,
//   DDSCAPS2_CUBEMAP_POSITIVEY: 0x1000,
//   DDSCAPS2_CUBEMAP_NEGATIVEY: 0x2000,
//   DDSCAPS2_CUBEMAP_POSITIVEZ: 0x4000,
//   DDSCAPS2_CUBEMAP_NEGATIVEZ: 0x8000,
//   DDSCAPS2_VOLUME           : 0x200000,
// };

// /**
//  * Strucuted structs manipulated by DDS files
//  *
//  * A structured struct is a struct for which the first members are dwSize and
//  * dwFlags.
//  *
//  * Format is: `{ name: fields, ... }` where filedfields is an array of field.
//  * A field is described by
//  * `['type([size]?)', fieldName, relatedFlag?, shouldTheFlagAlwaysBeTrue?]`
//  */
// const structs = {
//   DDSURFACEDESC2: [
//     ['DWORD', 'dwHeight', DDS_H.DDSD_HEIGHT, true],
//     ['DWORD', 'dwWidth', DDS_H.DDSD_WIDTH, true],
//     ['DWORD', 'dwPitchOrLinearSize', DDS_H.DDSD_PITCH],
//     ['DWORD', 'dwDepth', DDS_H.DDSD_DEPTH],
//     ['DWORD', 'dwMipMapCount', DDS_H.DDSD_MIPMAPCOUNT],
//     ['DWORD[11]', 'dwReserved1'],
//     ['DDPIXELFORMAT', 'ddpfPixelFormat', DDS_H.DDSD_PIXELFORMAT],
//     ['DDCAPS2', 'ddsCaps'],
//     ['DWORD', 'dwReserved2'],
//   ],
//   DDPIXELFORMAT: [
//     ['DWORD', 'dwFourCC'],
//     ['DWORD', 'dwRGBBitCount'],
//     ['DWORD', 'dwRBitMask'],
//     ['DWORD', 'dwGBitMask'],
//     ['DWORD', 'dwBBitMask'],
//     ['DWORD', 'dwRGBAlphaBitMask'],
//   ],
// };

// /**
//  * Splits a type into two parts: the real type and the eventual array part
//  * (with the quantity). If there are no array, the second member will be `null`.
//  * @param {string} typeStr The type as written in `structs`
//  */
// function decomposeType(typeStr) {
//   const bracket = typeStr.indexOf('[');
//   if (bracket === -1) {
//     return [typeStr, null];
//   }

//   const endBracket = typeStr.indexOf(']');
//   return [
//     typeStr.substr(0, bracket),
//     typeStr.substr(bracket + 1, endBracket - bracket - 1),
//   ];
// }

// /**
//  * Consumes the next bytes of the scanner by using the given structured struct
//  * type.
//  * @param {BytesScanner} scanner The scanner
//  * @param {string} type The type to use for the consuming, must be in `structs`
//  * @returns A struct with data read from the scanner
//  */
// function nextStructuredStruct(scanner, type) {
//   const c = {};

//   const currentI = scanner.i;

//   // Header fields
//   c.dwSize = scanner.nextDWORD();
//   c.dwFlags = scanner.nextDWORD();

//   // Data fields
//   for (const s of structs[type]) {
//     const [type, fieldName, _flag, _forced] = s;

//     // For the considered files, the flag field actually has no impact
//     // on how to process the data
//     // TODO: look for dwFlags real impact and fix this code
//     // if (flag !== undefined && !(c.dwFlags & flag)) {
//     //    if (forced) {
//     //        throw Error(
//     //            `The flag for ${fieldName} is disabled but `
//     //            + `it should always be enabled`
//     //        );
//     //    }
//     // }

//     const [realType, cardinality] = decomposeType(type);
//     if (cardinality === null) {
//       c[fieldName] = nextOfType(scanner, realType);
//     } else {
//       const s = [];
//       for (let i = 0; i < cardinality; ++i) {
//         s.push(i);
//       }

//       c[fieldName] = s.map((_) => nextOfType(scanner, realType));
//     }
//   }

//   // Check if out of bound
//   if (scanner.i != currentI + c.dwSize) {
//     throw Error(
//       'Current i is not at the right position: ' +
//         `expected ${currentI + c.dwSize} but is at ${scanner.i}`
//     );
//   }

//   return c;
// }

// /**
//  * Produce a data of type realType by consuming the next bytes of the scanner
//  * @param {Scanner} scanner The scanner to use
//  * @param {string} realType The name of the type
//  * @returns The data
//  */
// function nextOfType(scanner, realType) {
//   if (realType === 'DWORD') {
//     return scanner.nextDWORD();
//   } else if (structs[realType] !== undefined) {
//     return nextStructuredStruct(scanner, realType);
//   } else if (realType == 'DDCAPS2') {
//     return {
//       dwCaps1 : scanner.nextDWORD(),
//       dwCaps2 : scanner.nextDWORD(),
//       Reserved: [1, 2].map((_) => scanner.nextDWORD()),
//     };
//   }
//   throw Error(`Unknown type: ${realType}`);
// }

// /**
//  * Put the buffer in a scanner, and consumes the header bytes. Returns both the
//  * result of the header parsing and the scanner, as a `{ scanner, dict }` object
//  * @param {Buffer} buffer The buffer that contains the data
//  * @returns `{ scanner, dds: ddsHeaderData }`
//  */
// function readDDSHeader(buffer) {
//   const scanner = new BytesScanner(buffer);
//   const dds = {};
//   //   dds.dwMagic = scanner.nextDWORD();
//   //   if (dds.dwMagic !== 542327876) {
//   //     throw Error('Bad value for dwMagic');
//   //   }
//   dds.ddsd = nextOfType(scanner, 'DDSURFACEDESC2');
//   return { scanner, dds };
// }

// /**
//  * Consume the following bytes of a scanner on a DDS file, considering the
//  * header was `dds` and the scanner is exactly at the first byte of the matrice
//  * in the DDS file.
//  *
//  * Parameters are intended to be the values returned by `readDDSHeader`
//  * @param {BytesScanner} scanner The scanner that contains the data of the DDS
//  * @param {*} dds A struct with the header information of the DDS file
//  * @param {boolean} readMipMap If set to true, the `mipMaps` member may be
//  * added to the returned array if there are any stored in the image
//  * @returns A matrix of pixels, in the order `result[line][column]`
//  */
// function toMatrixOfPixels(scanner, dds, readMipMap = false) {
//   // Rename some constants
//   const height = dds.ddsd.dwHeight;
//   const width = dds.ddsd.dwWidth;
//   const pixelFormat = dds.ddsd.ddpfPixelFormat;
//   const bitsPerPixel = pixelFormat.dwRGBBitCount;

//   // Check if we can support this
//   if (scanner.buffer.length - scanner.i < dds.ddsd.dwPitchOrLinearSize) {
//     throw Error('Unsupported format of dds (has too few information)');
//   }

//   if (config.strongerFormatCheck) {
//     let expectedLeftBytes = (height * width * bitsPerPixel) / 8;

//     for (let i = 0; i < dds.ddsd.dwMipMapCount; ++i) {
//       const localH = height >> (1 + i);
//       const localW = width >> (1 + i);
//       expectedLeftBytes += (localH * localW * bitsPerPixel) / 8;
//     }

//     if (scanner.buffer.length - scanner.i != expectedLeftBytes) {
//       throw Error('Unsupported format of dds - Caugth be stronger check');
//     }
//   }

//   if (dds.ddsd.dwPitchOrLinearSize != (height * width * bitsPerPixel) / 8) {
//     throw Error(
//       'Unsupported format of dds (some kind of compression is involved)'
//     );
//   }

//   if (bitsPerPixel % 8 !== 0) {
//     throw Error(
//       'Current implementation only supports bit count multiples of 8'
//     );
//   }

//   // Produce functors
//   const alpha = colorFunctorFor8Bits(pixelFormat.dwRGBAlphaBitMask);
//   const red = colorFunctorFor8Bits(pixelFormat.dwRBitMask);
//   const green = colorFunctorFor8Bits(pixelFormat.dwGBitMask);
//   const blue = colorFunctorFor8Bits(pixelFormat.dwBBitMask);

//   const bytesPerPixel = bitsPerPixel / 8;

//   const mainImage = readPixels(
//     scanner,
//     dds.ddsd.dwHeight,
//     dds.ddsd.dwWidth,
//     bytesPerPixel,
//     alpha,
//     red,
//     green,
//     blue
//   );

//   if (readMipMap && dds.ddsd.dwMipMapCount > 0) {
//     mainImage.mipMaps = [];

//     for (let iMipMap = 0; iMipMap < dds.ddsd.dwMipMapCount; ++iMipMap) {
//       const height = dds.ddsd.dwHeight >> (iMipMap + 1);
//       const width = dds.ddsd.dwWidth >> (iMipMap + 1);
//       const requiredBytes = height * width * bytesPerPixel;

//       if (requiredBytes > 0) {
//         if (scanner.buffer.length - scanner.i < requiredBytes) {
//           throw Error('Unsupported format of dds (has too few information)');
//         }

//         mainImage.mipMaps.push(
//           readPixels(
//             scanner,
//             height,
//             width,
//             bytesPerPixel,
//             alpha,
//             red,
//             green,
//             blue
//           )
//         );
//       } else {
//         mainImage.mipMaps.push([]);
//       }
//     }
//   }

//   return mainImage;
// }

// /**
//  * @typedef { function(number): number } ToColor
//  */

// /**
//  * Consumes the next `height * width * bytesPerPixel` bytes of the scanner
//  * to produce a 2D matrix with the read image.
//  * @param {BytesScanner} scanner The scanner where the image is stored
//  * @param {number} height The height of the image
//  * @param {number} width The width of the image
//  * @param {number} bytesPerPixel Number of bytes to consume for each pixels
//  * @param {ToColor} a Function to convert the read bytes to the alpha component
//  * @param {ToColor} r Function to convert the read bytes to the red component
//  * @param {ToColor} g Function to convert the read bytes to the green component
//  * @param {ToColor} b Function to convert the read bytes to the blue component
//  * @returns A 2D matrix of pixels, in row-major order, with an alpha, a red,
//  * a green and a blue component. Return null if not enoguh pixels are left in
//  * the scanner
//  */
// function readPixels(scanner, height, width, bytesPerPixel, a, r, g, b) {
//   const matrice = [];
//   for (let line = 0; line != height; ++line) {
//     const thisLine = [];
//     for (let column = 0; column != width; ++column) {
//       const pixel = [...scanner.nextBytesAsArray(bytesPerPixel)]
//         .reverse()
//         .reduce((acc, v) => acc * 0x100 + v, 0);

//       thisLine.push({
//         alpha: a(pixel),
//         red  : r(pixel),
//         green: g(pixel),
//         blue : b(pixel),
//       });
//     }

//     matrice.push(thisLine);
//   }

//   return matrice;
// }

// /**
//  * Converts the matrix of pixels to a PNGJS image
//  * @param {any[][]} matrix The matrix of pixels
//  * @param {number} w The width of the image
//  * @param {number} h The height of the image
//  * @returns {PNG} The PNG image
//  */
// function matrixToPNG(matrix, w, h) {
//   const outputBuffer = Buffer.alloc(w * h * 4);
//   const bitmap = new Uint8Array(outputBuffer.buffer);
//   for (let i = 0; i < h; i++) {
//     for (let j = 0; j < w; j++) {
//       bitmap[i * 4 * w + 4 * j + 0] = matrix[i][j].red;
//       bitmap[i * 4 * w + 4 * j + 1] = matrix[i][j].green;
//       bitmap[i * 4 * w + 4 * j + 2] = matrix[i][j].blue;
//       bitmap[i * 4 * w + 4 * j + 3] = matrix[i][j].alpha;
//     }
//   }

//   const png = new PNG({
//     width         : w,
//     height        : h,
//     bitDepth      : 8,
//     colorType     : 6,
//     inputColorType: 6,
//     inputHasAlpha : true,
//   });

//   png.data = outputBuffer;

//   return png;
// }

// // //////////////////////////////////////////////////////////////////////////////
// // //////////////////////////////////////////////////////////////////////////////
// // Main API

// /**
//  * Converts the given DDS content to PNG
//  * @param {Buffer} buffer The buffer that contains the bytes of the DDS file
//  * @returns {pngjs.PNG} The same image but in PNG
//  */
// export function DDStoPNG(buffer) {
//   const { scanner, dds } = readDDSHeader(buffer);

//   const matrix = toMatrixOfPixels(scanner, dds, false);
//   return matrixToPNG(matrix, dds.ddsd.dwWidth, dds.ddsd.dwHeight);
// }

// /**
//  * Converts the given DDS content to PNG. Multiple PNG are returned: the first
//  * one is the main image, and the following are the mipmaps
//  * @param {Buffer} buffer The buffer that contains the bytes of the DDS file
//  * @returns {pngjs.PNG[]} The same image but in PNG, with the mipmaps
//  */
// function DDStoPNGs(buffer) {
//   const { scanner, dds } = readDDSHeader(buffer);

//   const matrix = toMatrixOfPixels(scanner, dds, true);

//   const pngs = [];
//   pngs.push(matrixToPNG(matrix, dds.ddsd.dwWidth, dds.ddsd.dwHeight));

//   if (matrix.mipMaps !== undefined) {
//     for (const mipMapMatrix of matrix.mipMaps) {
//       const h = mipMapMatrix.length;
//       if (h == 0) {
//         continue;
//       }
//       const w = mipMapMatrix[0].length;

//       pngs.push(matrixToPNG(mipMapMatrix, w, h));
//     }
//   }

//   return pngs;
// }


// // Some extra hidden exports because why not
// // module.exports.BytesScanner = BytesScanner;
// // module.exports.readDDSHeader = readDDSHeader;
// // module.exports.toMatrixOfPixels = toMatrixOfPixels;
// // module.exports.DDStoPNGs = DDStoPNGs;
// // module.exports._config = config;
