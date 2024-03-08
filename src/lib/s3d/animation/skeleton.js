
import { WldFragment } from '../wld/wld-fragment';
import { fragmentNameCleaner } from '../../util/util';
import { Animation } from './animation';
import { Mesh, MeshReference } from '../mesh/mesh';
import * as glMat from 'gl-matrix';
import { TrackFragment } from './track';

const vec3 = glMat.vec3;
const mat4 = glMat.mat4;
const quat = glMat.quat;

class SkeletonFlags {
  static HasCenterOffset = 0x01;
  static HasBoundingRadius = 0x02;
  static HasMeshReference = 0x200;

  #flags = 0;
  constructor(flags) {
    this.#flags = flags;
  }
  #compareFlag(flag) {
    return (this.#flags & flag) === flag;
  }
  get hasCenterOffset() {
    return this.#compareFlag(SkeletonFlags.HasCenterOffset);
  }

  get hasBoundingRadius() {
    return this.#compareFlag(SkeletonFlags.HasBoundingRadius);
  }
  get hasMeshReference() {
    return this.#compareFlag(SkeletonFlags.HasMeshReference);
  }
}

class SkeletonBone {
  index = -1;
  name = '';
  fullPath = '';
  cleanedName = '';
  cleanedFullPath = '';
  children = [];
  /**
   * @type {import('./track').TrackFragment}
   */
  track = null;
  meshReference = null;
  particleCloud = null;
  animationTracks = {};
  parent = null;
}

function evaluateGetters(obj) {
  // If obj is not an object or is null, return it as is
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  // Initialize evaluated object
  const evaluatedObj = Array.isArray(obj) ? [] : {};

  // Iterate over each property of obj
  for (const key in obj) {
    const descriptor = Object.getOwnPropertyDescriptor(obj, key);

    // If the property is a getter, evaluate it and assign the value
    if (descriptor && typeof descriptor.get === 'function') {
      evaluatedObj[key] = descriptor.get.call(obj);
    } else if (typeof obj[key] === 'object') {
      evaluatedObj[key] = evaluateGetters(obj[key]);
    } else {
      evaluatedObj[key] = obj[key];
    }
  }

  return evaluatedObj;
}

function deepCloneWithIgnore(obj, ignoreKeys = []) {
  const visited = new WeakMap();

  function clone(obj) {
    if (visited.has(obj)) {
      return visited.get(obj);
    }
    const newObj = Array.isArray(obj) ? [] : {};

    visited.set(obj, newObj);

    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) {
        continue;
      }

      if (ignoreKeys.includes(key)) {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(obj, key);
      if (descriptor && (descriptor.get || descriptor.set)) {
        newObj[key] = descriptor.get.call(obj);
      } else {
        newObj[key] = typeof obj[key] === 'object' && obj[key] !== null ? clone(obj[key]) : obj[key];
      }
    }
    return newObj;
  }

  return clone(obj);
}
export class SkeletonHierarchy extends WldFragment {
  /**
   * @type {SkeletonFlags}
   */
  flags = null;

  /**
   * @type {[Mesh]}
   */
  meshes = [];
  alternateMeshes = [];
  /**
   * @type {[SkeletonBone]}
   */
  skeleton = [];
  modelBase = '';
  isAssigned = false;
  skeletonPieceDictionary = {};

  /**
   * @type {Object.<string, Animation>}
   */
  animations = {};
  boneMappingClean = {};
  boneMapping = {};

  boundingRadius = 0.0;
  secondaryMeshes = [];
  hasBuiltData = false;

  constructor(...args) {
    super(...args);
    this.initialize();
  }
  serializeAnimations() {
    const ignored = deepCloneWithIgnore(this.animations, ['wld', 'reader']);
    return ignored;
  }
  initialize() {
    const reader = this.reader;
    this.modelBase = fragmentNameCleaner(this);
    const flags = reader.readUint32();
    this.flags = new SkeletonFlags(flags);
    const boneCount = reader.readUint32();

    const frag18Reference = reader.readUint32() - 1;
    const skeletonTrackParams1Exists = (flags & 1) === 1;
    if (this.flags.hasCenterOffset || skeletonTrackParams1Exists) {
      this.centerOffset = vec3.fromValues(reader.readFloat32(), reader.readFloat32(), reader.readFloat32());
    }
    if (this.flags.hasBoundingRadius) {
      this.boundingRadius = reader.readFloat32();
    }


    for (let i = 0; i < boneCount; ++i) {
      // An index into the string has to get this bone's name
      const boneNameIndex = reader.readInt32();
      const boneName = this.wld.getString(boneNameIndex);

      // Always 0 for object bones
      // Confirmed
      const boneFlags = reader.readInt32();

      // Reference to a bone track
      // Confirmed - is never a bad reference
      const trackReferenceIndex = reader.readInt32() - 1;
      const track = this.wld.fragments[trackReferenceIndex];

      this.addPoseTrack(track, boneName);
      const pieceNew = new SkeletonBone();
      pieceNew.index = i;
      pieceNew.track = track;
      pieceNew.name = boneName;
      pieceNew.track.isPoseAnimation = true;
      pieceNew.animationTracks = {};
      this.boneMappingClean[i] = Animation.CleanBoneAndStripBase(boneName, this.modelBase);
      this.boneMapping[i] = boneName;

      if (pieceNew.track === null) {
        console.warn('Unable to link track reference');
      }

      const meshReferenceIndex = reader.readUint32();

      if (meshReferenceIndex > 0) {
        pieceNew.meshReference = this.wld.fragments[meshReferenceIndex];

        if (pieceNew.meshReference?.constructor !== MeshReference) {
          pieceNew.particleCloud = this.wld.fragments[meshReferenceIndex];
        }

        if (pieceNew.name === 'root') {
          pieceNew.name = fragmentNameCleaner(pieceNew.meshReference.mesh);
        }
      }

      const childCount = reader.readInt32();
      pieceNew.children = [];

      for (let j = 0; j < childCount; ++j) {
        const childIndex = reader.readInt32();
        pieceNew.children.push(childIndex);
      }
      this.skeleton.push(pieceNew);

      if (pieceNew.name !== '' && !this.skeletonPieceDictionary.hasOwnProperty(pieceNew.name)) {
        this.skeletonPieceDictionary[pieceNew.name] = pieceNew;
      }
    }

    if (this.flags.hasMeshReference) {
      const size2 = reader.readUint32();

      for (let i = 0; i < size2; ++i) {
        const meshRefIndex = reader.readUint32() - 1;

        const meshRef = this.wld.fragments[meshRefIndex];

        if (meshRef?.mesh) {
          if (this.meshes.every(x => x.name !== meshRef.mesh.name)) {
            this.meshes.push(meshRef.mesh);
            meshRef.mesh.isHandled = true;
          }
        }

        // if (meshRef?.LegacyMesh != null)
        // {
        //     if (AlternateMeshes.All(x => x.Name != meshRef.LegacyMesh.Name))
        //     {
        //         AlternateMeshes.Add(meshRef.LegacyMesh);
        //     }
        // }
      }
    }
  }

  /**
   * 
   * @param {TrackFragment} track 
   * @param {boolean} isDefault 
   */
  addTrackData(track, isDefault = false) {
    let animationName = '';
    let modelName = '';
    let pieceName = '';

    let cleanedName = fragmentNameCleaner(track, true);

    if (isDefault) {
      animationName = 'pos';
      modelName = this.modelBase;
      cleanedName = cleanedName.replace(this.modelBase, String.Empty);
      pieceName = cleanedName === 'string.Empty ' ? 'root' : cleanedName;
    } else {
      if (cleanedName.length <= 3) {
        return;
      }

      animationName = cleanedName.slice(0, 3);
      cleanedName = cleanedName.slice(3, cleanedName.length);

      if (cleanedName.length < 3) {
        return;
      }

      modelName = cleanedName.slice(0, 3);
      cleanedName = cleanedName.slice(3, cleanedName.length);
      pieceName = cleanedName;

      if (pieceName === '') {
        pieceName = 'root';
      }
    }

    track.setTrackData(modelName, animationName, pieceName);

    if (this.animations.hasOwnProperty(track.animationName)) {
      if (modelName === this.modelBase && this.modelBase !== this.animations[animationName].animModelBase) {
        delete this.animations[animationName];
      }

      if (modelName !== this.modelBase && this.modelBase === this.animations[animationName].animModelBase) {
        return;
      }
    }

    if (!this.animations.hasOwnProperty(track.animationName)) {
      this.animations[track.animationName] = new Animation();
    }

    this.animations[track.animationName]
      .addTrack(track, track.name, Animation.CleanBoneName(track.pieceName),
        Animation.CleanBoneAndStripBase(track.pieceName, this.modelBase));
    track.trackDefFragment.isAssigned = true;
    track.isProcessed = true;
  }

  addPoseTrack(track, pieceName) {
    if (!this.animations['pos']) {
      this.animations['pos'] = new Animation();
    }
    if (pieceName.startsWith('SSNSSNBO_')) {
      pieceName = pieceName.slice(3, pieceName.length);
    }

    this.animations['pos'].addTrack(track, pieceName, Animation.CleanBoneName(pieceName),
      Animation.CleanBoneAndStripBase(pieceName, this.modelBase));
    track.trackDefFragment.isAssigned = true;
    track.isProcessed = true;
    track.isPoseAnimation = true;
  }

  buildSkeletonData(stripModelBase) {
    if (this.hasBuiltData) {
      return;
    }
    this.buildSkeletonTreeData(0, this.skeleton, null, '', '', '', stripModelBase);
    this.hasBuiltData = true;
  }

  buildSkeletonTreeData(index, treeNodes, parent, 
    runningName, runningNameCleaned, runningIndex, stripModelBase) {
    const bone = treeNodes[index];
    bone.parent = parent;
    bone.cleanedName = this.cleanBoneName(bone.name, stripModelBase);
    this.boneMappingClean[index] = bone.cleanedName;
    
    if (bone.name !== '') {
      runningIndex += `${bone.index }/`;
    }

    runningName += bone.name;
    runningNameCleaned += bone.cleanedName;

    bone.fullPath = runningName;
    bone.cleanedFullPath = runningNameCleaned;

    if (bone.children.length === 0) {
      return;
    }

    runningName += '/';
    runningNameCleaned += '/';

    for (const childNode of bone.children) {
      this.buildSkeletonTreeData(childNode, treeNodes, bone, runningName, runningNameCleaned, runningIndex,
        stripModelBase);
    }
  }

  cleanBoneName(nodeName, stripModelBase) {
    nodeName = nodeName.replace('_DAG', '');
    nodeName = nodeName.toLowerCase();
    if (stripModelBase) {
      nodeName = nodeName.replace(this.modelBase, '');
    }

    nodeName += nodeName.length === 0 ? 'root' : '';
    return nodeName;
  }

  addAdditionalMesh(mesh) {
    if (this.meshes.some(x => x.name === mesh.name) 
        || this.secondaryMeshes.some(x => x.name === mesh.name)) {
      return;
    }
    
    if (Object.entries(mesh.mobPieces).length === 0) {
      return;
    }
    mesh.secondary = true;
    this.secondaryMeshes.push(mesh);
    this.secondaryMeshes = this.secondaryMeshes.sort((a, b) => a.name > b.name ? -1 : 1);
  }

  isValidSkeleton(trackName) {
    let boneName = '';  
    const track = trackName.slice(3, trackName.length);

    if (trackName == this.modelBase) {
      boneName = this.modelBase;
      return [true, boneName];
    }

    for (const bone of this.skeleton) {
      const cleanBoneName = bone.name.replace('_DAG', '').toLowerCase();
      if (cleanBoneName === track) {
        boneName = bone.name.toLowerCase();
        return [true, boneName];
      }
    }

    boneName = '';
    return [false, boneName];
  }

  getBoneMatrix(boneIndex, animationTracks, frame = 0, centerCorrectionVector = vec3.create()) {
    if (frame < 0) {
      return mat4.create();
    }

    let currentBone = this.skeleton[boneIndex];
    let boneMatrix = mat4.multiply(mat4.create(), mat4.invert(mat4.create(), mat4.fromTranslation(mat4.create(), centerCorrectionVector)), mat4.create());

    while (currentBone !== null) {
      if (!animationTracks.hasOwnProperty(currentBone.cleanedName)) {
        break;
      }

      const track = animationTracks[currentBone.cleanedName].trackDefFragment;
      const realFrame = frame >= track.frames.length ? 0 : frame;
      currentBone = this.skeleton[boneIndex].parent;

      const scaleValue = track.frames[realFrame].scale;
      const scaleMat = mat4.fromScaling(mat4.create(), [scaleValue, scaleValue, scaleValue]);

      const rotationQuat = quat.normalize(quat.create(), track.frames[realFrame].rotation); // Assuming rotation is a quaternion
      
      
      const rotationMatrix = mat4.fromQuat(mat4.create(), rotationQuat);
      

      const translation = track.frames[realFrame].translation;
      const translateMat = mat4.fromTranslation(mat4.create(), translation);

      const modelMatrix = mat4.multiply(mat4.create(), mat4.multiply(mat4.create(), translateMat, rotationMatrix), scaleMat);

      boneMatrix = mat4.multiply(mat4.create(), modelMatrix, boneMatrix);

      if (currentBone !== null) {
        boneIndex = currentBone.index;
      }
    }
    return mat4.multiply(mat4.create(), mat4.fromTranslation(mat4.create(), centerCorrectionVector), boneMatrix);
  }

  renameNodeBase(newBase) {
    for (const node of this.skeleton) {
      node.name = node.name.replace(this.modelBase.toUpperCase(), newBase.toUpperCase());
    }

    const newNameMapping = {};
    for (const [key, value] in Object.entries(this.boneMapping)) {
      newNameMapping[key] = value.replace(this.modelBase.toUpperCase(), newBase.toUpperCase());
    }

    this.boneMapping = newNameMapping;

    this.modelBase = newBase;
  }
}
