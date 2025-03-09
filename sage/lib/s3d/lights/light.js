import { WldFragment, WldFragmentReference } from '../wld/wld-fragment';
import { fragmentNameCleaner } from '../../util/util';
import { Color } from '../common/color';
import { vec3 } from 'gl-matrix';

class LightFlags {
  static HasCurrentFrame = 0x01;
  static HasSleep = 0x02;
  static HasLightLevels = 0x04;
  static SkipFrames = 0x08;
  static HasColor = 0x10;

  #flags = 0;
  constructor(flags) {
    this.#flags = flags;
  }
  #compareFlag(flag) {
    return (this.#flags & flag) === flag;
  }
  get hasCurrentFrame() {
    return this.#compareFlag(LightFlags.HasCurrentFrame);
  }
  get hasSleep() {
    return this.#compareFlag(LightFlags.HasSleep);
  }
  get hasLightLevels() {
    return this.#compareFlag(LightFlags.HasLightLevels);
  }
  get skipFrames() {
    return this.#compareFlag(LightFlags.SkipFrames);
  }
  get hasColor() {
    return this.#compareFlag(LightFlags.HasColor);
  }
}

export class AmbientLight extends WldFragment {
  regions = [];
  get lightReference() {
    return this.reference;
  }
  constructor(...args) {
    super(...args);
    this.initialize2();
  }
  initialize2() {
    const reader = this.reader;
    const _flags = reader.readUint32();
    const regionCount = reader.readUint32();
    for (let i = 0; i < regionCount; i++) {
      this.regions.push(reader.readInt32());
    }
  }
}

export class GlobalAmbientLight extends WldFragment {
  color = null;
  constructor(...args) {
    super(...args);
    this.initialize();
  }
  initialize() {
    const reader = this.reader;
    const [blue, green, red, alpha] = reader.readManyUint8(4);
    this.color = new Color(red, green, blue, alpha);
  }
}

export class LightInstance extends WldFragmentReference {
  position = vec3.create();
  radius = 0.0;
  get lightReference() {
    return this.reference;
  }
  constructor(...args) {
    super(...args);
    this.initialize2();
  }
  initialize2() {
    const reader = this.reader;
    const _flags = reader.readUint32();
    this.position = vec3.fromValues(reader.readFloat32(), reader.readFloat32(), reader.readFloat32());
    this.radius = reader.readFloat32();
  }
}

export class LightSourceReference extends WldFragmentReference {
  get lightSource() {
    return this.reference;
  }
}

export class LightSource extends WldFragment {
  /**
   * @type {LightFlags}
   */
  flags = null;
  frameCount = 0;
  currentFrame = 0;
  sleep = 0;
  lightLevels = [];
  colors = [];

  constructor(...args) {
    super(...args);
    this.initialize();
  }
  initialize() {
    const reader = this.reader;
    this.modelBase = fragmentNameCleaner(this);
    const flags = reader.readUint32();
    this.flags = new LightFlags(flags);
    this.frameCount = reader.readUint32();
    if (this.flags.hasCurrentFrame) {
      this.currentFrame = reader.readUint32();
    }
    if (this.flags.hasSleep) {
      this.sleep = reader.readUint32();
    }
    if (this.flags.hasLightLevels) {
      for (let i = 0; i < this.frameCount; i++) {
        this.lightLevels.push(reader.readFloat32());
      }
    }
    if (this.flags.hasColor) {
      for (let i = 0; i < this.frameCount; i++) {
        this.colors.push(
          new Color(
            reader.readFloat32(),
            reader.readFloat32(),
            reader.readFloat32()
          )
        );
      }
    }
  }
}
