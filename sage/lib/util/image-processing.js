/* eslint-disable */

// import Jimp from 'jimp';
import dxt from 'dxt-js';

const REVISION = '106';
const MOUSE = { LEFT: 0, MIDDLE: 1, RIGHT: 2 };
const CullFaceNone = 0;
const CullFaceBack = 1;
const CullFaceFront = 2;
const CullFaceFrontBack = 3;
const FrontFaceDirectionCW = 0;
const FrontFaceDirectionCCW = 1;
const BasicShadowMap = 0;
const PCFShadowMap = 1;
const PCFSoftShadowMap = 2;
const FrontSide = 0;
const BackSide = 1;
const DoubleSide = 2;
const FlatShading = 1;
const SmoothShading = 2;
const NoColors = 0;
const FaceColors = 1;
const VertexColors = 2;
const NoBlending = 0;
const NormalBlending = 1;
const AdditiveBlending = 2;
const SubtractiveBlending = 3;
const MultiplyBlending = 4;
const CustomBlending = 5;
const AddEquation = 100;
const SubtractEquation = 101;
const ReverseSubtractEquation = 102;
const MinEquation = 103;
const MaxEquation = 104;
const ZeroFactor = 200;
const OneFactor = 201;
const SrcColorFactor = 202;
const OneMinusSrcColorFactor = 203;
const SrcAlphaFactor = 204;
const OneMinusSrcAlphaFactor = 205;
const DstAlphaFactor = 206;
const OneMinusDstAlphaFactor = 207;
const DstColorFactor = 208;
const OneMinusDstColorFactor = 209;
const SrcAlphaSaturateFactor = 210;
const NeverDepth = 0;
const AlwaysDepth = 1;
const LessDepth = 2;
const LessEqualDepth = 3;
const EqualDepth = 4;
const GreaterEqualDepth = 5;
const GreaterDepth = 6;
const NotEqualDepth = 7;
const MultiplyOperation = 0;
const MixOperation = 1;
const AddOperation = 2;
const NoToneMapping = 0;
const LinearToneMapping = 1;
const ReinhardToneMapping = 2;
const Uncharted2ToneMapping = 3;
const CineonToneMapping = 4;
const ACESFilmicToneMapping = 5;
const UVMapping = 300;
const CubeReflectionMapping = 301;
const CubeRefractionMapping = 302;
const EquirectangularReflectionMapping = 303;
const EquirectangularRefractionMapping = 304;
const SphericalReflectionMapping = 305;
const CubeUVReflectionMapping = 306;
const CubeUVRefractionMapping = 307;
const RepeatWrapping = 1000;
const ClampToEdgeWrapping = 1001;
const MirroredRepeatWrapping = 1002;
const NearestFilter = 1003;
const NearestMipMapNearestFilter = 1004;
const NearestMipMapLinearFilter = 1005;
const LinearFilter = 1006;
const LinearMipMapNearestFilter = 1007;
const LinearMipMapLinearFilter = 1008;
const UnsignedByteType = 1009;
const ByteType = 1010;
const ShortType = 1011;
const UnsignedShortType = 1012;
const IntType = 1013;
const UnsignedIntType = 1014;
const FloatType = 1015;
const HalfFloatType = 1016;
const UnsignedShort4444Type = 1017;
const UnsignedShort5551Type = 1018;
const UnsignedShort565Type = 1019;
const UnsignedInt248Type = 1020;
const AlphaFormat = 1021;
const RGBFormat = 1022;
const RGBAFormat = 1023;
const LuminanceFormat = 1024;
const LuminanceAlphaFormat = 1025;
const RGBEFormat = RGBAFormat;
const DepthFormat = 1026;
const DepthStencilFormat = 1027;
const RedFormat = 1028;
const RGB_S3TC_DXT1_Format = 33776;
const RGBA_S3TC_DXT1_Format = 33777;
const RGBA_S3TC_DXT3_Format = 33778;
const RGBA_S3TC_DXT5_Format = 33779;
const RGB_PVRTC_4BPPV1_Format = 35840;
const RGB_PVRTC_2BPPV1_Format = 35841;
const RGBA_PVRTC_4BPPV1_Format = 35842;
const RGBA_PVRTC_2BPPV1_Format = 35843;
const RGB_ETC1_Format = 36196;
const RGBA_ASTC_4x4_Format = 37808;
const RGBA_ASTC_5x4_Format = 37809;
const RGBA_ASTC_5x5_Format = 37810;
const RGBA_ASTC_6x5_Format = 37811;
const RGBA_ASTC_6x6_Format = 37812;
const RGBA_ASTC_8x5_Format = 37813;
const RGBA_ASTC_8x6_Format = 37814;
const RGBA_ASTC_8x8_Format = 37815;
const RGBA_ASTC_10x5_Format = 37816;
const RGBA_ASTC_10x6_Format = 37817;
const RGBA_ASTC_10x8_Format = 37818;
const RGBA_ASTC_10x10_Format = 37819;
const RGBA_ASTC_12x10_Format = 37820;
const RGBA_ASTC_12x12_Format = 37821;
const LoopOnce = 2200;
const LoopRepeat = 2201;
const LoopPingPong = 2202;
const InterpolateDiscrete = 2300;
const InterpolateLinear = 2301;
const InterpolateSmooth = 2302;
const ZeroCurvatureEnding = 2400;
const ZeroSlopeEnding = 2401;
const WrapAroundEnding = 2402;
const TrianglesDrawMode = 0;
const TriangleStripDrawMode = 1;
const TriangleFanDrawMode = 2;
const LinearEncoding = 3000;
const sRGBEncoding = 3001;
const GammaEncoding = 3007;
const RGBEEncoding = 3002;
const LogLuvEncoding = 3003;
const RGBM7Encoding = 3004;
const RGBM16Encoding = 3005;
const RGBDEncoding = 3006;
const BasicDepthPacking = 3200;
const RGBADepthPacking = 3201;
const TangentSpaceNormalMap = 0;
const ObjectSpaceNormalMap = 1;

export function convertDDS2Jimp(buf, name) {
  const loadMipmaps = false;
  const dds = {
    mipmaps    : [],
    width      : 0,
    height     : 0,
    format     : null,
    mipmapCount: 1,
  };

  // Adapted from @toji's DDS utils
  // https://github.com/toji/webgl-texture-utils/blob/master/texture-util/dds.js

  // All values and structures referenced from:
  // http://msdn.microsoft.com/en-us/library/bb943991.aspx/

  const DDS_MAGIC = 0x20534444;

  const DDSD_CAPS = 0x1,
    DDSD_HEIGHT = 0x2,
    DDSD_WIDTH = 0x4,
    DDSD_PITCH = 0x8,
    DDSD_PIXELFORMAT = 0x1000,
    DDSD_MIPMAPCOUNT = 0x20000,
    DDSD_LINEARSIZE = 0x80000,
    DDSD_DEPTH = 0x800000;

  const DDSCAPS_COMPLEX = 0x8,
    DDSCAPS_MIPMAP = 0x400000,
    DDSCAPS_TEXTURE = 0x1000;

  const DDSCAPS2_CUBEMAP = 0x200,
    DDSCAPS2_CUBEMAP_POSITIVEX = 0x400,
    DDSCAPS2_CUBEMAP_NEGATIVEX = 0x800,
    DDSCAPS2_CUBEMAP_POSITIVEY = 0x1000,
    DDSCAPS2_CUBEMAP_NEGATIVEY = 0x2000,
    DDSCAPS2_CUBEMAP_POSITIVEZ = 0x4000,
    DDSCAPS2_CUBEMAP_NEGATIVEZ = 0x8000,
    DDSCAPS2_VOLUME = 0x200000;

  const DDPF_ALPHAPIXELS = 0x1,
    DDPF_ALPHA = 0x2,
    DDPF_FOURCC = 0x4,
    DDPF_RGB = 0x40,
    DDPF_YUV = 0x200,
    DDPF_LUMINANCE = 0x20000;

  function fourCCToInt32(value) {
    return (
      value.charCodeAt(0) +
      (value.charCodeAt(1) << 8) +
      (value.charCodeAt(2) << 16) +
      (value.charCodeAt(3) << 24)
    );
  }

  function int32ToFourCC(value) {
    return String.fromCharCode(
      value & 0xff,
      (value >> 8) & 0xff,
      (value >> 16) & 0xff,
      (value >> 24) & 0xff
    );
  }

  function loadARGBMip(buffer, dataOffset, width, height) {
    const dataLength = width * height * 4;
    const srcBuffer = new Uint8Array(buffer, dataOffset, dataLength);
    const byteArray = new Uint8Array(dataLength);
    let dst = 0;
    let src = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const b = srcBuffer[src];
        src++;
        const g = srcBuffer[src];
        src++;
        const r = srcBuffer[src];
        src++;
        const a = srcBuffer[src];
        src++;
        byteArray[dst] = r;
        dst++; // r
        byteArray[dst] = g;
        dst++; // g
        byteArray[dst] = b;
        dst++; // b
        byteArray[dst] = a;
        dst++; // a
      }
    }
    return byteArray;
  }

  const buffer = new ArrayBuffer(buf.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < buf.length; i++) {
    view[i] = buf[i];
  }
  const FOURCC_UNCOMPRESSED = 0;
  const FOURCC_DXT1 = fourCCToInt32('DXT1');
  const FOURCC_DXT3 = fourCCToInt32('DXT3');
  const FOURCC_DXT5 = fourCCToInt32('DXT5');
  const FOURCC_ETC1 = fourCCToInt32('ETC1');

  const headerLengthInt = 31; // The header length in 32 bit ints

  // Offsets into the header array

  const off_magic = 0;

  const off_size = 1;
  const off_flags = 2;
  const off_height = 3;
  const off_width = 4;

  const off_mipmapCount = 7;

  const off_pfFlags = 20;
  const off_pfFourCC = 21;
  const off_RGBBitCount = 22;
  const off_RBitMask = 23;
  const off_GBitMask = 24;
  const off_BBitMask = 25;
  const off_ABitMask = 26;

  const off_caps = 27;
  const off_caps2 = 28;
  const off_caps3 = 29;
  const off_caps4 = 30;

  // Parse header

  const header = new Int32Array(buffer, 0, headerLengthInt);

  if (header[off_magic] !== DDS_MAGIC) {
    throw new Error('DDSLoader.parse: Invalid magic number in DDS header.');
  }

  if (!header[off_pfFlags] & DDPF_FOURCC) {
    throw new Error(
      'DDSLoader.parse: Unsupported format, must contain a FourCC code.'
    );
  }

  let blockBytes;

  const fourCC = header[off_pfFourCC];

  let isRGBAUncompressed = false;

  switch (fourCC) {
    case FOURCC_DXT1:
      blockBytes = 8;
      dds.format = RGB_S3TC_DXT1_Format;
      break;

    case FOURCC_DXT3:
      blockBytes = 16;
      dds.format = RGBA_S3TC_DXT3_Format;
      break;

    case FOURCC_DXT5:
      blockBytes = 16;
      dds.format = RGBA_S3TC_DXT5_Format;
      break;

    case FOURCC_ETC1:
      blockBytes = 8;
      dds.format = RGB_ETC1_Format;
      break;
    case FOURCC_UNCOMPRESSED:
    //  isRGBAUncompressed = true;
      switch (header[off_RGBBitCount]) {
        case 16:
          dds.format = header[off_ABitMask] === 0 ? 16 : 15;
          break;
        case 24:
          dds.format = 24;
          break;
        case 32:
          dds.format = 32;
          break;
        default:
          throw new Error('Unsupported RGB bit count');
      }
      break;
    default:
      if (
        header[off_RGBBitCount] === 32 &&
        header[off_RBitMask] & 0xff0000 &&
        header[off_GBitMask] & 0xff00 &&
        header[off_BBitMask] & 0xff &&
        header[off_ABitMask] & 0xff000000
      ) {
        isRGBAUncompressed = true;
        blockBytes = 64;
        dds.format = RGBAFormat;
      } else {
        console.log('Error parsing texture', name)
        throw new Error(
          `DDSLoader.parse: Unsupported FourCC code  ${ int32ToFourCC(fourCC)}`,
          int32ToFourCC(fourCC)
        );
      }
  }

  dds.mipmapCount = 1;

  if (header[off_flags] & DDSD_MIPMAPCOUNT && loadMipmaps !== false) {
    dds.mipmapCount = Math.max(1, header[off_mipmapCount]);
  }

  const caps2 = header[off_caps2];
  dds.isCubemap = caps2 & DDSCAPS2_CUBEMAP ? true : false;
  if (
    dds.isCubemap &&
    (!(caps2 & DDSCAPS2_CUBEMAP_POSITIVEX) ||
      !(caps2 & DDSCAPS2_CUBEMAP_NEGATIVEX) ||
      !(caps2 & DDSCAPS2_CUBEMAP_POSITIVEY) ||
      !(caps2 & DDSCAPS2_CUBEMAP_NEGATIVEY) ||
      !(caps2 & DDSCAPS2_CUBEMAP_POSITIVEZ) ||
      !(caps2 & DDSCAPS2_CUBEMAP_NEGATIVEZ))
  ) {
    throw new Error('DDSLoader.parse: Incomplete cubemap faces');
  }

  dds.width = header[off_width];
  dds.height = header[off_height];

  let dataOffset = header[off_size] + 4;

  // Extract mipmaps buffers

  const faces = dds.isCubemap ? 6 : 1;

  for (let face = 0; face < faces; face++) {
    let width = dds.width;
    let height = dds.height;
    let byteArray, dataLength;
    for (let i = 0; i < dds.mipmapCount; i++) {
      if (isRGBAUncompressed) {
        byteArray = loadARGBMip(buffer, dataOffset, width, height);
        dataLength = byteArray.length;
      } else {
        dataLength =
          (((Math.max(4, width) / 4) * Math.max(4, height)) / 4) * blockBytes;
        byteArray = new Uint8Array(buffer, dataOffset, dataLength);
      }

      const mipmap = { data: byteArray, width: width, height: height };
      dds.mipmaps.push(mipmap);

      dataOffset += dataLength;

      width = Math.max(width >> 1, 1);
      height = Math.max(height >> 1, 1);
    }
  }
  const data = dds.mipmaps[0].data;
  const w = dds.mipmaps[0].width;
  const h = dds.mipmaps[0].height;
  const uncompressed = dxt.decompress(
    data,
    w,
    h,
    fourCC === FOURCC_DXT1 ? dxt.flags.DXT1 : dxt.flags.DXT5
  );
  return [uncompressed, dds];
}
