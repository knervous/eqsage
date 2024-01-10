export class BoneTransform {
  /**
     * @type {import('gl-matrix').vec3}
     */
  translation = null;
  /**
   * @type {import('gl-matrix').quat}
   */
  rotation = null;
  /**
   * @type {number}
   */
  scale = null;
  /**
   * @type {import('gl-matrix').mat4}
   */
  modelMatrix = null;
  constructor(translation, rotation, scale, modelMatrix) {
    this.translation = translation;
    this.rotation = rotation;
    this.scale = scale;
    this.modelMatrix = modelMatrix;
  }
}