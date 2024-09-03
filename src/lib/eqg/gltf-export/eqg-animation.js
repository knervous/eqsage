import { quat, vec3, mat4 } from 'gl-matrix';

export class EQGAnimationWriter {
  /** @type {import('@gltf-transform/core').Document} **/
  document = null;

  /**
   * @type {[import('@gltf-transform/core').Node]}
   */
  skeletonNodes = [];

  /**
   * @type {[import('../model/model').Bone]}
   */
  bones = [];

  /**
   * @type {[Number]}
   */
  boneIndices = [];

  /**
   *
   * @param {import('@gltf-transform/core').Document} doc
   * @param {[import('@gltf-transform/core').Node]} skeletonNodes
   */
  constructor(doc, skeletonNodes, bones, boneIndices) {
    this.document = doc;
    this.skeletonNodes = skeletonNodes;
    this.bones = bones;
    this.boneIndices = boneIndices;
  }

  /**
   * Apply the first frame of the animation directly to the skeleton nodes.
   *
   * @param {import('../model/model').Animation} animation - The animation data.
   * @param {string} name - The name of the animation.
   * @param {number} frameIndex - The frame index to apply (0 for the first frame).
   */
  applyAnimationFrame(animation) {
    if (!animation.boneAnimations.length) {
      return;
    }

    for (const ani of animation.boneAnimations) {
      const node = this.skeletonNodes.find((n) => n.getName() === ani.boneName);
      const bone = this.bones.find((b) => b.name === ani.boneName);
      if (!bone) {
        console.log(`No bone for node ${ani.boneName}`);
        continue;
      }

      const scaleVector = vec3.fromValues(
        bone.scaleX,
        bone.scaleZ,
        bone.scaleY
      );

      const rotationQuaternion = quat.fromValues(
        bone.rotX,
        bone.rotZ,
        bone.rotY,
        bone.rotW
      );

      const translationVector = vec3.fromValues(
        bone.x,
        bone.z,
        bone.y
      );

      // Apply transformations directly to the node
      node.setScale(scaleVector);
      node.setRotation(rotationQuaternion);
      node.setTranslation(translationVector);

      console.log(`Applied first frame to node: ${ani.boneName}`);
      
    }
  }
  /**
   *
   * @param {import('../model/model').Animation} animation
   * @param {string} name
   */
  applyAnimation(animation, name, noOffset = false) {
    if (!animation.boneAnimations.length) {
      return;
    }
    const samplers = new Map();

    const gltfAnimation = this.document.createAnimation(noOffset ? `${name}-nooffset` : name);
    for (const [_idx, ani] of Object.entries(animation.boneAnimations)) {
      const node = this.skeletonNodes.find((n) => n.getName() === ani.boneName);
      const bone = this.bones.find((b) => b.name === ani.boneName);
      if (!bone) {
        console.log(`No bone for node ${ani.boneName}`);
        continue;
      }
      const [rotX, rotY, rotZ, rotW] = node.getWorldRotation();
      const [x, y, z] = node.getWorldTranslation();
      const aniParents = [];
      const boneAccum = { ...bone };
      let parent = bone.parent;
      while (parent) {
        const parentAnimation = animation.boneAnimations.find(ba => ba.boneName === parent.name); // eslint-disable-line
        aniParents.push(parentAnimation);
        boneAccum.rotX += parent.rotX;
        boneAccum.rotY += parent.rotY;
        boneAccum.rotZ += parent.rotZ;
        boneAccum.rotW += parent.rotW;
        boneAccum.x += parent.x;
        boneAccum.y += parent.y;
        boneAccum.z += parent.z;
        parent = parent.parent;
      }

      for (const [idx, frame] of Object.entries(ani.animationFrames)) {
        const frameAcc = { ...frame };
        for (const p of aniParents) {
          const parentFrame = p.animationFrames[idx];
          frameAcc.rotX += parentFrame.rotX;
          frameAcc.rotY += parentFrame.rotY;
          frameAcc.rotZ += parentFrame.rotZ;
          frameAcc.rotW += parentFrame.rotW;
          frameAcc.x += parentFrame.x;
          frameAcc.y += parentFrame.y;
          frameAcc.z += parentFrame.z;
        }
        const scaleVector = vec3.fromValues(
          frame.scaleX,
          frame.scaleZ,
          frame.scaleY
        );
        const rotationQuaternion = noOffset ? quat.fromValues(
          frame.rotX,
          frame.rotZ,
          frame.rotY,
          frame.rotW
        ) : quat.fromValues(
          boneAccum.rotX - frameAcc.rotX,
          boneAccum.rotZ - frameAcc.rotZ,
          boneAccum.rotY - frameAcc.rotY,
          boneAccum.rotW - frameAcc.rotW
        );

        const translationVector = noOffset ? [frame.x, frame.z, frame.y] : [
          boneAccum.x - frameAcc.x,
          boneAccum.z - frameAcc.z,
          boneAccum.y - frameAcc.y,
        ];

        const timeDelta = frame.ms / 1000;
        if (!samplers.get(node)) {
          samplers.set(node, {
            input      : [timeDelta],
            scale      : [...scaleVector],
            rotation   : [...rotationQuaternion],
            translation: [...translationVector],
          });
        } else {
          samplers.get(node).input.push(timeDelta);
          samplers.get(node).scale.push(...scaleVector);
          samplers.get(node).rotation.push(...rotationQuaternion);
          samplers.get(node).translation.push(...translationVector);
        }
      }
    }
    for (const [
      node,
      { scale, rotation, translation, input },
    ] of samplers.entries()) {
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
  }
}
