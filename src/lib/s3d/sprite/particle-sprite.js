import { Color } from '../common/color';
import { WldFragment, WldFragmentReference } from '../wld/wld-fragment';

class SpriteFlags {
  static Transparent = 0x100;

  #flags = 0;
  constructor(flags) {
    this.#flags = flags;
  }
  #compareFlag(flag) {
    return (this.#flags & flag) === flag;
  }
  get transparent() {
    return this.#compareFlag(SpriteFlags.Transparent);
  }
}

export const ParticleMovement = {
  Sphere: 0x1,
  Plane : 0x2,
  Stream: 0x3,
  None  : 0x4,
};

export class ParticleCloud extends WldFragment {
  spriteIdx = -1;
  get sprite() {
    return this.wld.fragments[this.spriteIdx];
  }
  constructor(...args) {
    super(...args);
    this.initialize();
  }
  initialize() {
    const reader = this.reader;
    const _1 = reader.readUint32();
    const _2 = reader.readUint32();
    this.particleMovement = reader.readUint32();
    this.flags = reader.readUint32();
    this.simultaneousParticles = reader.readUint32();
    const _6 = reader.readUint32();
    const _7 = reader.readUint32();
    const _8 = reader.readUint32();
    const _9 = reader.readUint32();
    const _10 = reader.readUint32();
    
    this.spawnRadius = reader.readFloat32();
    this.spawnAngle = reader.readFloat32();
    this.spawnLifespan = reader.readUint32();
    this.spawnVelocity = reader.readFloat32();
    this.spawnNormalZ = reader.readFloat32();
    this.spawnNormalX = reader.readFloat32();
    this.spawnNormalY = reader.readFloat32();
    this.spawnRate = reader.readUint32();
    this.spawnScale = reader.readFloat32();
    const [blue, green, red, alpha] = reader.readManyUint8(4);
    this.color = new Color(red, green, blue, alpha);
    this.spriteIdx = reader.readUint32() - 1;
  }
}

export class ParticleSpriteReference extends WldFragmentReference {
  get particleSprite() {
    return this.reference;
  }
}

export class ParticleSprite extends WldFragment {
  colors = [];
  bitmapReferenceIdx = -1;
  get bitmapReference() {
    return this.wld.fragments[this.bitmapReferenceIdx];
  }
  constructor(...args) {
    super(...args);
    this.initialize();
  }
  initialize() {
    const reader = this.reader;
    const flags = reader.readInt32();
    this.flags = new SpriteFlags(flags);
    this.bitmapReferenceIdx = reader.readInt32() - 1;
    const _unk = reader.readInt32();
  }
}
