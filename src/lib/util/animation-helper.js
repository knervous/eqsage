import {
  Accessor,
  AnimationChannel,
  Document,
  Node,
} from "@gltf-transform/core"; // eslint-disable-line
import { SkeletonHierarchy } from "../s3d/animation/skeleton"; // eslint-disable-line
import { Animation } from '../s3d/animation/animation';
import { quat, vec3, vec4 } from 'gl-matrix';

export const animationMap = {
  hum: 'elm',
  huf: 'elf',
  bam: 'elm',
  baf: 'elf',
  erm: 'elm',
  erf: 'elf',
  him: 'elm',
  hif: 'elf',
  dam: 'elm',
  daf: 'elf',
  ham: 'elm',
  haf: 'elf',
  trm: 'ogf',
  trf: 'ogf',
  ogm: 'ogf',
  hom: 'dwm',
  hof: 'dwf',
  gnm: 'dwm',
  gnf: 'dwf',
  brm: 'elm',
  brf: 'elf',
  gom: 'gia',
  gol: 'gia',
  bet: 'spi',
  cpf: 'cpm',
  frg: 'fro',
  gam: 'gar',
  ghu: 'gob',
  fpm: 'elm',
  imp: 'gar',
  gri: 'drk',
  kob: 'wer',
  lif: 'lim',
  min: 'gnn',
  bgm: 'elm',
  pif: 'faf',
  bgg: 'kgo',
  ske: 'elm',
  tig: 'lim',
  hhm: 'elm',
  zom: 'elm',
  zof: 'elf',
  qcm: 'elm',
  qcf: 'elf',
  pum: 'lim',
  ngm: 'elm',
  egm: 'elm',
  rim: 'dwm',
  rif: 'dwf',
  sku: 'rat',
  sph: 'drk',
  arm: 'rat',
  clm: 'dwm',
  clf: 'dwf',
  hlm: 'elm',
  hlf: 'elf',
  grm: 'ogf',
  grf: 'ogf',
  okm: 'ogf',
  okf: 'ogf',
  kam: 'dwm',
  kaf: 'dwf',
  fem: 'elm',
  fef: 'elf',
  gfm: 'elm',
  gff: 'elf',
  stc: 'lim',
  ikf: 'ikm',
  icm: 'ikm',
  icf: 'ikm',
  icn: 'ikm',
  ero: 'elf',
  tri: 'elm',
  bri: 'dwm',
  fdf: 'fdr',
  ssk: 'srw',
  vrf: 'vrm',
  wur: 'dra',
  iks: 'ikm',
  ikh: 'rea',
  fmo: 'drk',
  btm: 'rhi',
  sde: 'dml',
  tot: 'sca',
  spc: 'spe',
  ena: 'elm',
  yak: 'gnn',
  com: 'dwm',
  cof: 'dwf',
  cok: 'dwm',
  dr2: 'trk',
  hag: 'elf',
  sir: 'elf',
  stg: 'fsg',
  ccd: 'trk',
  abh: 'elf',
  bwd: 'trk',
  gdr: 'dra',
  pri: 'trk',
};

const loopedAnimationKeys = [
  'pos', // name is used for animated objects
  'p01', // Stand
  'l01', // Walk
  'l02', // Run
  'l05', // falling
  'l06', // crouch walk
  'l07', // climbing
  'l09', // swim treading
  'p03', // rotating
  'p06', // swim
  'p07', // sitting
  'p08', // stand (arms at sides)
  'sky',
];

/**
 *
 * @param {SkeletonHierarchy} skeletonModelBase
 * @param {int | null} instanceIndex
 * @returns
 */
const getSkeletonName = (skeletonModelBase, instanceIndex = null) => {
  if (skeletonModelBase === null) {
    return null;
  }

  if (instanceIndex !== null) {
    return `${skeletonModelBase}_${String(instanceIndex).padStart(3, '0')}`;
  }
  return skeletonModelBase;
};

/**
 *
 * @param {string} skeleton
 * @param {int | null} instanceIndex
 * @returns
 */
export const getSkeletonNameFromSkeleton = (skeleton, instanceIndex = null) => {
  if (skeleton === null || skeleton === undefined) {
    return null;
  }
  return getSkeletonName(skeleton.modelBase, instanceIndex);
};

export class S3DAnimationWriter {
  /** @type {Object.<string, [Node]>} **/
  skeletons = {};
  /** @type {Object.<string, Object.<string, string>>} **/
  skeletonChildrenAttachBones = {};
  /** @type {Document} **/
  document = null;

  samplers = new Map();

  constructor(doc) {
    this.document = doc;
  }

  /**
   * @param {SkeletonHierarchy} skeleton
   * @param {string} parent
   * @param {string} attachBoneName
   * @returns {[Node]}
   */
  addNewSkeleton(
    skeleton,
    parent = null,
    attachBoneName = null,
    instanceIndex = null
  ) {
    const skeletonNodes = [];
    const duplicateNameDictionary = {};
    const skeletonName = getSkeletonNameFromSkeleton(skeleton, instanceIndex);
    const boneNamePrefix = instanceIndex !== null ? `${skeletonName}_` : '';
    for (const bone of skeleton.skeleton) {
      const boneName = bone.cleanedName;
      if (duplicateNameDictionary.hasOwnProperty(boneName)) {
        skeletonNodes.push(
          this.document.createNode(
            `${boneNamePrefix}${boneName}_${String(
              duplicateNameDictionary[boneName]
            ).padStart(2, '0')}`
          )
        );
        duplicateNameDictionary[boneName] =
          duplicateNameDictionary[boneName] + 1;
      } else {
        skeletonNodes.push(
          this.document.createNode(`${boneNamePrefix}${boneName}`)
        );
        duplicateNameDictionary[boneName] = 0;
      }
    }

    for (let i = 0; i < skeletonNodes.length; i++) {
      const node = skeletonNodes[i];
      const bone = skeleton.skeleton[i];
      bone.children.forEach((bIndex) => node.addChild(skeletonNodes[bIndex]));
    }

    if (parent !== null && attachBoneName !== null) {
      const parentSkeleton = this.skeletons[parent];
      if (!parentSkeleton) {
        throw new Error(
          'Cannot attach child to skeleton parent it does not exist'
        );
      }
      const attachBone = parentSkeleton.find(
        (n) => n.getName().toLowerCase() === attachBone.toLowerCase()
      );

      if (attachBone === null) {
        throw new Error('Attach bone null');
      }
      attachBone.addChild(skeletonNodes[0]);

      if (!this.skeletonChildrenAttachBones.hasOwnProperty(parent)) {
        this.skeletonChildrenAttachBones[parent] = {};
      }
      this.skeletonChildrenAttachBones[parent][skeleton.modelBase] =
        attachBoneName;
    }
    this.skeletons[skeletonName] = skeletonNodes;
    return skeletonNodes;
  }

  /**
   *
   * @param {Node} node
   * @param {*} boneTransform
   * @param {*} animationKey
   * @param {*} timeMs
   * @param {*} staticPose
   */
  applyBoneTransformation(
    node,
    boneTransform,
    animationKey,
    timeMs,
    staticPose,
    gltfAnimation
  ) {
    // Assuming boneTransform properties are in camelCase
    const scaleVector = vec3.fromValues(
      boneTransform.scale,
      boneTransform.scale,
      boneTransform.scale
    );

    // Convert Euler angles (degrees) to a quaternion. Note the conversion to radians and inversion of axes if needed.
    const r = boneTransform.rotation;
    const rotationQuaternion = quat.fromValues(
      (r[0] * -1 * Math.PI) / 180,
      (r[2] * Math.PI) / 180,
      (r[1] * Math.PI) / 180,
      (r[3] * Math.PI) / 180
    );
    quat.normalize(rotationQuaternion, rotationQuaternion);

    const translationVector = [
      boneTransform.translation[0],
      boneTransform.translation[2],
      boneTransform.translation[1],
    ];

    translationVector[2] *= -1;
    translationVector[0] *= -1;
    const timeDelta = timeMs / 1000;
    if (!this.samplers.get(node)) {
      this.samplers.set(node, {
        input      : [timeDelta],
        scale      : [...scaleVector],
        rotation   : [...rotationQuaternion],
        translation: [...translationVector],
      });
    } else {
      this.samplers.get(node).input.push(timeDelta);
      this.samplers.get(node).scale.push(...scaleVector);
      this.samplers.get(node).rotation.push(...rotationQuaternion);
      this.samplers.get(node).translation.push(...translationVector);
    }
  }

  /**
   * @param {SkeletonHierarchy} skeleton
   * @param {string} animationKey
   * @param {bool} isCharacterAnimation
   * @param {bool} staticPose
   * @param {Node} parentNode
   * @param {int | null} instanceIndex
   * @returns
   */
  applyAnimationToSkeleton(
    skeleton,
    animationKey,
    isCharacterAnimation,
    staticPose,
    skeletonNodes
  ) {
    if (isCharacterAnimation && !staticPose && animationKey === 'pos') {
      return;
    }

    // skeletonNodes.ForEach(node => node.SetLocalTransform(new AffineTransform(MirrorXAxisMatrix), false));
    const animation = skeleton.animations[animationKey];
    /**
     * @type {Object.<string, import('../s3d/animation/track').TrackFragment>}
     */
    const trackArray = isCharacterAnimation
      ? animation.tracksCleanedStripped
      : animation.tracksCleaned;
    /**
     * @type {Object.<string, import('../s3d/animation/track').TrackFragment>}
     */
    const poseArray = isCharacterAnimation
      ? skeleton.animations['pos'].tracksCleanedStripped
      : skeleton.animations['pos'].tracksCleaned;

    if (poseArray === null) {
      return;
    }

    const skeletonChildrenAttachBones =
      this.skeletonChildrenAttachBones[skeleton.model];
    const hasChildren = !!skeletonChildrenAttachBones;
    const gltfAnimation = this.document.createAnimation(animationKey);

    for (let i = 0; i < skeleton.skeleton.length; i++) {
      const boneName = isCharacterAnimation
        ? Animation.CleanBoneAndStripBase(
          skeleton.boneMapping[i],
          skeleton.modelBase
        )
        : Animation.CleanBoneName(skeleton.boneMapping[i]);

      if (staticPose || !trackArray.hasOwnProperty(boneName)) {
        if (!poseArray.hasOwnProperty(boneName)) {
          return;
        }

        const poseTransform = poseArray[boneName].trackDefFragment.frames[0];
        if (poseTransform === null) {
          return;
        }
        // poseTransform.Translation = new vec3(poseTransform.Translation.x * -1, poseTransform.Translation.y, poseTransform.Translation.z);
        this.applyBoneTransformation(
          skeletonNodes[i],
          poseTransform,
          animationKey,
          0,
          staticPose,
          gltfAnimation
        );
        if (
          hasChildren &&
          Object.values(skeletonChildrenAttachBones).some((c) => c === boneName)
        ) {
          for (const [key, value] of Object.entries(
            skeletonChildrenAttachBones
          ).filter((c) => c[1] === boneName)) {
            const childSkeleton = this.skeletons[key];
            for (const childBone of childSkeleton) {
              this.applyBoneTransformation(
                childBone,
                poseTransform,
                animationKey,
                0,
                staticPose,
                gltfAnimation
              );
            }
          }
        }
        continue;
      }

      let totalTimeForBone = 0;
      for (let frame = 0; frame < animation.frameCount; frame++) {
        if (frame >= trackArray[boneName].trackDefFragment.frames.length) {
          break;
        }

        const boneTransform =
          trackArray[boneName].trackDefFragment.frames[frame];
        const add = isCharacterAnimation
          ? animation.animationTimeMs / animation.frameCount
          : skeleton.skeleton[i].track.frameMs;
        this.applyBoneTransformation(
          skeletonNodes[i],
          boneTransform,
          animationKey,
          totalTimeForBone,
          staticPose,
          gltfAnimation
        );

        if (
          frame === animation.frameCount.length - 1 &&
          loopedAnimationKeys.includes(animationKey)
        ) {
          this.applyBoneTransformation(
            skeletonNodes[i],
            trackArray[boneName].trackDefFragment.frames[0],
            animationKey,
            animation.animationTimeMs,
            staticPose,
            gltfAnimation
          );
        }

        if (
          hasChildren &&
          Object.values(skeletonChildrenAttachBones).some((c) => c === boneName)
        ) {
          for (const [key, value] in Object.entries(
            skeletonChildrenAttachBones
          ).filter((c) => c[1] === boneName)) {
            const childSkeleton = this.skeletons[key];
            this.applyBoneTransformation(
              childSkeleton[0],
              boneTransform,
              animationKey,
              0,
              staticPose,
              gltfAnimation
            );
          }
        }

        totalTimeForBone += add;
      }
    }

    for (const [
      node,
      { scale, rotation, translation, input },
    ] of this.samplers.entries()) {
      const inputAccessor = this.document
        .createAccessor('time')
        .setArray(new Float32Array(input))
        .setType('SCALAR');

      const samplerScale = this.document
        .createAnimationSampler()
        .setInput(inputAccessor)
        .setOutput(
          this.document
            .createAccessor('scale')
            .setArray(new Float32Array(scale))
            .setType('VEC3')
        );
      const rotationScale = this.document
        .createAnimationSampler()
        .setInput(inputAccessor)
        .setOutput(
          this.document
            .createAccessor('rotation')
            .setArray(new Float32Array(rotation))
            .setType('VEC4')
        );
      const translationSampler = this.document
        .createAnimationSampler()
        .setInput(inputAccessor)
        .setOutput(
          this.document
            .createAccessor('translation')
            .setArray(new Float32Array(translation))
            .setType('VEC3')
        );
      const channelScale = this.document
        .createAnimationChannel()
        .setTargetNode(node)
        .setTargetPath('scale')
        .setSampler(samplerScale);
      const channelRotation = this.document
        .createAnimationChannel()
        .setTargetNode(node)
        .setTargetPath('rotation')
        .setSampler(rotationScale);
      const channelTranslation = this.document
        .createAnimationChannel()
        .setTargetNode(node)
        .setTargetPath('translation')
        .setSampler(translationSampler);

      gltfAnimation.addSampler(channelScale.getSampler());
      gltfAnimation.addSampler(channelRotation.getSampler());
      gltfAnimation.addSampler(channelTranslation.getSampler());
      gltfAnimation
        .addChannel(channelScale)
        .addChannel(channelRotation)
        .addChannel(channelTranslation);
    }
    this.samplers.clear();
  }
}
