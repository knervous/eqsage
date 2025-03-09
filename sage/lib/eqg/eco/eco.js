import { TypedArrayReader } from '../../util/typed-array-reader';

class EcoLayer {
  name = '';
  minHeight = 0;
  maxHeight = 0;
  heightTol = 0;
  minSlope = 0;
  maxSlope = 0;
  slopeTol = 0;
}

export class TextureLayer extends EcoLayer {
  coverMap = '';
  blendMap = '';
  blendSoftness = 0;
  layeringMap = '';
  layeringArea = 0;
  detailMap = '';
  normalMap = '';
  detailRepeat = 0;
  normalRepeat = 0;
}

export class ObjectLayer extends EcoLayer {
  object = '';
  textureLayer = '';
  density = 0;
  iterations = 0;
  minScale = 0;
  maxScale = 0;
}

export class FloraLayer extends EcoLayer {
  flora = '';
  textureLayer = '';
  density = 0;
  iterations = 0;
  minScale = 0;
  maxScale = 0;
  minAlpha = 0;
}

// TODO these classes could extend from a parent metadata parsing class to make this a bit more streamlined
export class Eco {
  /**
   * @type {TypedArrayReader}
   */
  reader = null;

  /**
   * @type {[TextureLayer]}
   */
  textureLayers = [];

  /**
   * @type {[ObjectLayer]}
   */
  objectLayers = [];

  /**
   * @type {[FloraLayer]}
   */
  floraLayers = [];
  /**
   *
   * @param {Uint8Array} data
   */
  constructor(data) {
    this.reader = new TypedArrayReader(data.buffer);
    this.init();
  }

  init() {
    /**
     * @type {TextureLayer | ObjectLayer | FloraLayer}
     */
    let currentObj = null;
    let ObjType = '';
    const header = this.reader
      .readString(this.reader.buffer.byteLength)
      .split(/\*/)
      .map((a) => a.trim());
    for (const line of header) {
      const [attr, ...rest] = line.split(/[ \t]/).filter(Boolean);
      switch (attr) {
        case 'TEXTUREPART':
          ObjType = TextureLayer;
          break;
        case 'OBJECTPART':
          ObjType = ObjectLayer;
          break;
        case 'FLORAPART':
          ObjType = FloraLayer;
          break;
        case 'END_LAYER':
          if (currentObj instanceof TextureLayer) {
            this.textureLayers.push(currentObj);
          } else if (currentObj instanceof ObjectLayer) {
            this.objectLayers.push(currentObj);
          } else if (currentObj instanceof FloraLayer) {
            this.floraLayers.push(currentObj);
          }
          break;
        case 'END_TEXTUREPART':
        case 'END_OBJECTPART':
        case 'END_FLORAPART':
          break;
        case 'LAYER':
          currentObj = new ObjType();
          currentObj.name = rest[0];
          break;
        case 'MINHEIGHT':
          currentObj.minHeight = +rest[0];
          break;
        case 'MAXHEIGHT':
          currentObj.maxHeight = +rest[0];
          break;
        case 'HEIGHTTOL':
          currentObj.heightTol = +rest[0];
          break;
        case 'MINSLOPE':
          currentObj.minSlope = +rest[0];
          break;
        case 'MAXSLOPE':
          currentObj.maxSlope = +rest[0];
          break;
        case 'SLOPETOL':
          currentObj.slopeTol = +rest[0];
          break;
        case 'COVERMAP':
          currentObj.coverMap = rest[0];
          break;
        case 'BLENDMAP':
          currentObj.blendMap = rest[0];
          break;
        case 'BLENDSOFTNESS':
          currentObj.blendSoftness = +rest[0];
          break;
        case 'LAYERINGMAP':
          currentObj.layeringMap = rest[0];
          break;
        case 'LAYERINGAREA':
          currentObj.layeringArea = +rest[0];
          break;
        case 'DETAILMAP':
          currentObj.detailMap = rest[0];
          break;
        case 'NORMALMAP':
          currentObj.normalMap = rest[0];
          break;
        case 'DETAILREPEAT':
          currentObj.detailRepeat = +rest[0];
          break;
        case 'NORMALREPEAT':
          currentObj.normalRepeat = +rest[0];
          break;
        case 'OBJECT':
          currentObj.object = rest[0];
          break;
        case 'FLORA':
          currentObj.flora = rest[0];
          break;
        case 'TEXTURELAYER':
          currentObj.textureLayer = rest[0];
          break;
        case 'DENSITY':
          currentObj.density = +rest[0];
          break;
        case 'ITERATIONS':
          currentObj.iterations = +rest[0];
          break;
        case 'MINSCALE':
          currentObj.minScale = +rest[0];
          break;
        case 'MAXSCALE':
          currentObj.maxScale = +rest[0];
          break;
        case 'MINALPHA':
          currentObj.minAlpha = +rest[0];
          break;
        // Others not using for now?
        case undefined:
          break;
        default:
          console.warn(`Unknown attribute in ECO file ${attr}`);
          break;
      }
    }
  }
}
