import { WldFragment } from '../wld/wld-fragment';

class BitMapInfoFlags {
  static SkipFramesFlag = 0x02;
  static UnknownFlag = 0x04;
  static AnimatedFlag = 0x08;
  static HasSleepFlag = 0x10;
  static HasCurrentFrameFlag = 0x20;

  #flags = 0;
  constructor(flags) {
    this.#flags = flags;
  }
  #compareFlag(flag) {
    return (this.#flags & flag) === flag;
  }
  get skipFrames() {
    return this.#compareFlag(BitMapInfoFlags.SkipFramesFlag);
  }
  get isAnimated() {
    return this.#compareFlag(BitMapInfoFlags.AnimatedFlag);
  }
  get hasSleep() {
    return this.#compareFlag(BitMapInfoFlags.HasSleepFlag);
  }
  get hasCurrentFrame() {
    return this.#compareFlag(BitMapInfoFlags.HasCurrentFrameFlag);
  }
}

export class BitmapInfo extends WldFragment {
  animationDelayMs = 0;
  bitmapNameIndices = [];

  /**
   * @type {BitMapInfoFlags}
   */
  flags = null;

  constructor(...args) {
    super(...args);
    this.initialize();
  }

  get bitmapNames() {
    return this.bitmapNameIndices.map((i) => this.wld.fragments[i]);
  }

  initialize() {
    const reader = this.reader;
    this.flags = new BitMapInfoFlags(reader.readInt32());

    const bitmapCount = reader.readInt32();

    if (this.flags.hasCurrentFrame) {
      this.currentFrame = reader.readUint32();
    }

    if (this.flags.isAnimated && this.flags.hasSleep) {
      this.animationDelayMs = reader.readInt32();
    }

    for (let i = 0; i < bitmapCount; ++i) {
      this.bitmapNameIndices.push(reader.readInt32() - 1);
    }
  }
}