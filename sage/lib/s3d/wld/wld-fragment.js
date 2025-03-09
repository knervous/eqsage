

export class WldFragment {
  /**
   * @type {import('./wld').Wld}
   */
  wld = null;
  /**
   * @type {import('../../util/typed-array-reader').TypedArrayReader}
   */
  get reader() {
    return this.wld.reader;
  }
  name = '';

  /**
   * 
   * @param {import('./wld').Wld} wld 
   * @param {string} name 
   */
  constructor(wld, name) {
    this.name = name;
    this.wld = wld;
  }
}

export class WldFragmentReference extends WldFragment {
  #refIdx = -1;
  get reference() {
    return this.wld.fragments[this.#refIdx];
  }
  constructor(...args) {
    super(...args);
    this.initialize();
  }
  valueOf() {
    return this.reference;
  }
  initialize() {
    this.#refIdx = this.reader.readUint32() - 1;
  }
}