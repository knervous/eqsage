import { Color } from '../common/color';
import { WldFragment, WldFragmentReference } from '../wld/wld-fragment';

export class VertexColorReference extends WldFragmentReference {
  get vertexColor() {
    return this.reference;
  }
}

export class VertexColor extends WldFragment {
  colors = [];
  constructor(...args) {
    super(...args);
    this.initialize();
  }
  initialize() {
    const reader = this.reader;
    const _flags = reader.readInt32();
    const colorCount = reader.readInt32();
    const [_unk1, _unk2, _unk4] = reader.readManyInt32(3);
    for (let i = 0; i < colorCount; i++) {
      const [blue, green, red, alpha] = reader.readManyUint8(4);
      this.colors.push(new Color(red, green, blue, alpha));
    }
  }
}
