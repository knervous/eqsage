import { Location } from '../common/location';
import { WldFragment } from '../wld/wld-fragment';

class ActorFlags {
  static HasCurrentAction = 0x01;
  static HasLocation = 0x02;
  static HasBoundingRadius = 0x04;
  static HasScaleFactor = 0x08;
  static HasSound = 0x10;
  static Active = 0x20;
  static SpriteVolumeOnly = 0x80;
  static HasVertexColorReference = 0x100;
    
  #flags = 0;
  constructor(flags) {
    this.#flags = flags;
  }
  #compareFlag(flag) {
    return (this.#flags & flag) === flag;
  }
  get hasCurrentAction() {
    return this.#compareFlag(ActorFlags.HasCurrentAction);
  }
  get hasLocation () {
    return this.#compareFlag(ActorFlags.HasLocation);
  }
  get hasBoundingRadius () {
    return this.#compareFlag(ActorFlags.HasBoundingRadius);
  }
  get hasScaleFactor() {
    return this.#compareFlag(ActorFlags.HasScaleFactor);
  }
  get hasSound() {
    return this.#compareFlag(ActorFlags.HasSound);
  }
  get active() {
    return this.#compareFlag(ActorFlags.Active);
  }
  get spriteVolumeOnly() {
    return this.#compareFlag(ActorFlags.SpriteVolumeOnly);
  }
  get hasVertexColorReference() {
    return this.#compareFlag(ActorFlags.HasVertexColorReference);
  }
}

class ActorDefFlags {
  static HasCurrentAction = 0x01;
  static HasLocation = 0x02;
  static ActiveGeometry = 0x40;
  static SpriteVolumeOnly = 0x80;
    
  #flags = 0;
  constructor(flags) {
    this.#flags = flags;
  }
  #compareFlag(flag) {
    return (this.#flags & flag) === flag;
  }
  get hasCurrentAction() {
    return this.#compareFlag(ActorDefFlags.HasCurrentAction);
  }
  get hasLocation () {
    return this.#compareFlag(ActorDefFlags.HasLocation);
  }
  get active() {
    return this.#compareFlag(ActorDefFlags.ActiveGeometry);
  }
  get spriteVolumeOnly() {
    return this.#compareFlag(ActorDefFlags.SpriteVolumeOnly);
  }
}
  

export class ActorInstance extends WldFragment {
  objectName = '';
  boundingRadius = 0.0;
  location = null;
  scaleFactor = 0.0;
  soundNameReference = null;
  vertexColorReferenceIdx = null;
  get vertexColor() {
    return this.wld.fragments[this.vertexColorReferenceIdx];
  }
  userData = null;

  constructor(...args) {
    super(...args);
    this.initialize();
  }
  initialize() {
    const reader = this.reader;
    const objectRef = reader.readInt32();
    this.objectName = this.wld.getString(objectRef).replace('_ACTORDEF', '').toLowerCase();
    const flags = reader.readInt32();
    this.flags = new ActorFlags(flags);
    this.sphereRefIdx = reader.readUint32() - 1;
    if (this.flags.hasCurrentAction) {
      this.action = reader.readUint32();
    }
    if (this.flags.hasLocation) {
      this.location = new Location(
        reader.readFloat32(),
        reader.readFloat32(),
        reader.readFloat32(),
        reader.readFloat32(),
        reader.readFloat32(),
        reader.readFloat32(),
      );
      reader.readUint32(); // Unknown last prop here
    }
    if (this.flags.hasBoundingRadius) {
      this.boundingRadius = reader.readFloat32();
    }
    if (this.flags.hasScaleFactor) {
      this.scaleFactor = reader.readFloat32();
    }
    if (this.flags.hasSound) {
      this.soundNameReference = this.wld.getString(reader.readInt32());
    }
    if (this.flags.hasVertexColorReference) {
      this.vertexColorReferenceIdx = reader.readUint32() - 1;
    }
    const userDataSize = reader.readUint32();
    this.userData = reader.readString(userDataSize);
  }
}



export class ActorDef extends WldFragment {
  /**
   * @type {ActorDefFlags}
   */
  flags = null;
  lodDistances = [];
  boundingRadius = 0.0;
  modelBase = '';
  fragmentReferences = [];

  get fragments() {
    return this.fragmentReferences.map(i => this.wld.fragments[i]);
  }
  /**
   * @type {import('../common/location').Location}
   */
  location = null;

  constructor(...args) {
    super(...args);
    this.initialize();
  }
  initialize() {
    const reader = this.reader;
    const flags = reader.readUint32();
    this.flags = new ActorDefFlags(flags);
    this.nameReference = this.wld.getString(reader.readInt32());
    const actionCount = reader.readUint32();
    const fragmentReferenceCount = reader.readUint32();
    const boundsReference = reader.readUint32();

    if (this.flags.hasCurrentAction) {
      this.currentAction = reader.readUint32();
    }

    if (this.flags.hasLocation) {
      this.location = new Location(
        reader.readFloat32(),
        reader.readFloat32(),
        reader.readFloat32(),
        reader.readFloat32(),
        reader.readFloat32(),
        reader.readFloat32(),
      );
      reader.readUint32(); // Unknown last prop here
    }

 
    const lodCount = reader.readUint32();
    const _unk1 = reader.readUint32();
    for (let i = 0; i < lodCount; i ++) {
      this.lodDistances.push(reader.readFloat32());
    }
    
    for (let i = 0; i < fragmentReferenceCount; i++) {
      this.fragmentReferences.push(reader.readUint32() - 1);
    }

  }
}