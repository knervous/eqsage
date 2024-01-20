import { TypedArrayReader } from '../../util/typed-array-reader';
import { Placeable } from '../common/models';

export class Tog {
  /**
   * @type {TypedArrayReader}
   */
  reader = null;

  /**
   * @type {import('../common/models').PlaceableGroup}
   */
  pg = null;

  /**
   *
   * @param {Uint8Array} data
   * @param {import('../common/models').PlaceableGroup} pg
   */
  constructor(data, pg) {
    this.reader = new TypedArrayReader(data.buffer);
    this.pg = pg;
    this.init();
  }

  init() {
    let placeable;
    const header = this.reader
      .readString(this.reader.buffer.byteLength)
      .split(/\*/)
      .map((a) => a.trim());
    for (const line of header) {
      const [attr, ...rest] = line.split(/[ \t]/).filter(Boolean);
      switch (attr) {
        case 'BEGIN_OBJECT':
          placeable = new Placeable();
          break;
        case 'NAME':
          placeable.modelName = rest[0];
          break;
        case 'POSITION':
          const [x, y, z] = rest.map((a) => +a);
          placeable.x = x;
          placeable.y = y;
          placeable.z = z;
          break;
        case 'ROTATION':
          const [rotX, rotY, rotZ] = rest.map((a) => +a);
          placeable.rotateX = rotX;
          placeable.rotateY = rotY;
          placeable.rotateZ = rotZ;
          break;
        case 'SCALE':
          placeable.scaleX = +rest[0];
          placeable.scaleY = +rest[0];
          placeable.scaleZ = +rest[0];
          break;
        case 'END_OBJECT':
          this.pg.placeables.push(placeable);
          break;

        // Others not using for now?
        case undefined:
        case '':
        case 'BEGIN_AREA':
        case 'END_AREA':
        case 'EXTENTS':
        case 'BEGIN_OBJECTGROUP':
        case 'END_OBJECTGROUP':
        case 'FILE':
          break;

        default:
          console.warn(`Unknown attribute in TOG file ${attr}`);
          break;
      }
    }
  }
}
