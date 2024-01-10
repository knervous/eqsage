import { decodeString } from '../../util/util';
import { WldFragment } from '../wld/wld-fragment';

export class BitmapName extends WldFragment {
  fileName = '';

  constructor(...args) {
    super(...args);
    this.initialize();
  }

  initialize() {
    const fileCount = this.reader.readUint32();
    if (fileCount > 1) {
      console.log('BitmapName: Bitmap count exceeds 1');
    }
    const nameLength = this.reader.readUint16();
    this.fileName = decodeString(this.reader, nameLength - 1);
  }
}