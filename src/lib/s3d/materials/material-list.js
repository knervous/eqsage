import { WldFragment } from '../wld/wld-fragment';

export class MaterialList extends WldFragment {
  materialListIndices = [];
  get materialList() {
    return this.materialListIndices.map((i) => this.wld.fragments[i]);
  }
  constructor(...args) {
    super(...args);
    this.initialize();
  }
  initialize() {
    const reader = this.reader;
    const flags = reader.readUint32();
    const materialCount = reader.readUint32();

    for (let i = 0; i < materialCount; ++i) {
      const reference = reader.readUint32() - 1;
      this.materialListIndices.push(reference);
      if (this.wld.fragments[reference]) {
        this.wld.fragments[reference].isHandled = true;
      }
    }
  }
}
