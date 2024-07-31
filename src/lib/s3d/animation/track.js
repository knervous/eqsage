import { WldFragment } from '../wld/wld-fragment';
import { BoneTransform } from '../common/bone-transform';
import * as glMat from 'gl-matrix';
import { fragmentNameCleaner } from '../../util/util';

const vec3 = glMat.vec3;
const quat = glMat.quat;

export class TrackDefFragment extends WldFragment {
  ClassName = 'TrackDefFragment';

  /**
     * @type {Array<import('../common/bone-transform').BoneTransform>}
     */
  frames = [];
  newModel = false;
  isAssigned = false;
  constructor(...args) {
    super(...args);
    this.initialize();
  }
  initialize() {
    const reader = this.reader;
    const _flags = reader.readUint32();
    const frameCount = reader.readUint32();

    for (let i = 0; i < frameCount; i++) {
      const rotDenominator = reader.readInt16();
      const rotX = reader.readInt16();
      const rotY = reader.readInt16();
      const rotZ = reader.readInt16();
      const shiftX = reader.readInt16();
      const shiftY = reader.readInt16();
      const shiftZ = reader.readInt16();
      const shiftDenominator = reader.readInt16();
        
      const frameTransform = new BoneTransform();
        
      if (shiftDenominator !== 0) {
        const x = shiftX / 256;
        const y = shiftY / 256;
        const z = shiftZ / 256;

        frameTransform.scale = shiftDenominator / 256;
        frameTransform.translation = vec3.fromValues(x, y * -1, z);
      } else {
        frameTransform.translation = vec3.fromValues(0, 0, 0);
      }
        
      frameTransform.rotation = quat.fromValues(rotX, rotY, rotZ, rotDenominator);
      quat.normalize(frameTransform.rotation, frameTransform.rotation);
      this.frames.push(frameTransform);
    }

  }
}


class TrackFragmentFlags {
  static HasFrameMs = 0x01;

  #flags = 0;
  constructor(flags) {
    this.#flags = flags;
  }
  #compareFlag(flag) {
    return (this.#flags & flag) === flag;
  }
  get hasFrameMs() {
    return this.#compareFlag(TrackFragmentFlags.HasFrameMs);
  }
}


export class TrackFragment extends WldFragment {
  ClassName = 'TrackFragment';

  /**
     * @type {Array<import('../common/bone-transform').BoneTransform>}
     */
  frames = [];

  /**
   * @type {TrackDefFragment}
   */
  trackDefFragment = null;
  trackDefFragmentIdx = -1;

  isPoseAnimation = false;
  isProcessed = false;
  frameMs = 0;
  modelName = '';
  animationName = '';
  pieceName = '';
  isNameParsed = false;

  constructor(...args) {
    super(...args);
    this.initialize();
  }
  initialize() {
    const reader = this.reader;
    this.trackDefFragmentIdx = reader.readUint32() - 1;
    this.trackDefFragment = this.wld.fragments[this.trackDefFragmentIdx];
    const flags = new TrackFragmentFlags(reader.readUint32());
    if (flags.hasFrameMs) {
      this.frameMs = reader.readInt32();
    }
  }

  setTrackData(modelName, animationName, pieceName) {
    this.modelName = modelName;
    this.animationName = animationName;
    this.pieceName = pieceName;
  }

  parseTrackData() {
    let cleanedName = fragmentNameCleaner(this);

    if (cleanedName.length < 6) {
      if (cleanedName.length === 3) {
        this.modelName = cleanedName;
        this.isNameParsed = true;
        return;
      }

      this.modelName = cleanedName;
      return;
    }

    // Equipment edge case
    if (cleanedName.slice(0, 3) === cleanedName.slice(3, 6)) {
      this.animationName = cleanedName.slice(0, 3);
      this.modelName = cleanedName.slice(Math.min(7, cleanedName.length), cleanedName.length);
      this.pieceName = 'root';
      this.isNameParsed = true;
      return;
    }

    // if (/_TRACK$/.test(this.name)) {
    //   const [animName] = /[A-Za-z]\d+/.exec(cleanedName) ?? [];
    //   this.animationName = animName;
    //   this.modelName = cleanedName.slice(4, 7);
    //   this.isNameParsed = true;
    //   this.newModel = true;
    //   return;
    // }

    // // Newer models
    // if (/_\w+$/.test(cleanedName)) {
    //   const [animName] = /[A-Za-z]\d+/.exec(cleanedName);
    //   this.animationName = animName;
    //   this.modelName = cleanedName.slice(cleanedName.length - 3, cleanedName.length);
    //   this.isNameParsed = true;
    //   this.newModel = true;
    //   return;
    // } 
    // const r = 123;
    

    this.animationName = cleanedName.slice(0, 3);
    cleanedName = cleanedName.slice(3, cleanedName.length);
    this.modelName = cleanedName.slice(0, 3);
    cleanedName = cleanedName.slice(3, cleanedName.length);
    this.pieceName = cleanedName;

    this.isNameParsed = true;
  }

  /**
   * 
   * @param {import('./skeleton').SkeletonHierarchy} skeletonHierarchy 
   * @returns 
   */
  parseTrackDataEquipment(skeletonHierarchy) {
    let cleanedName = fragmentNameCleaner(this);

    // Equipment edge case
    if ((cleanedName === skeletonHierarchy.modelBase && cleanedName.length > 6) || cleanedName.slice(0, 3) === cleanedName.slice(3, 6)) {
      this.animationName = cleanedName.slice(0, 3);
      this.modelName = cleanedName.slice(7, cleanedName.length);
      this.pieceName = 'root';
      this.isNameParsed = true;
      return;
    }

    this.animationName = cleanedName.slice(0, 3);
    cleanedName = cleanedName.slice(3, cleanedName.length);
    this.modelName = skeletonHierarchy.modelBase;
    cleanedName = cleanedName.slice(skeletonHierarchy.modelBase, '');
    this.pieceName = cleanedName;
    this.isNameParsed = true;
  }
}
