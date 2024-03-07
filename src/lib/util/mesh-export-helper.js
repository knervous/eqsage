// Assuming glMatrix is already imported and available
import { vec3, mat4 } from 'gl-matrix';
import { Mesh } from '../s3d/mesh/mesh';
import { SkeletonHierarchy } from '../s3d/animation/skeleton';

export class MeshExportHelper {
  /**
     * Transforms vertices of mesh for the given animation and frame.
     * @param {Mesh} mesh - The mesh that will have vertices shifted
     * @param {SkeletonHierarchy} skeleton - The SkeletonHierarchy that contains the bone transformations
     * @param {boolean} isCharacterAnimation - Indicates if it's a character animation
     * @param {string} animName - The name of the animation used for the transform
     * @param {number} frame - The frame of the animation
     * @param {number} singularBoneIndex - The bone index for the mesh when there is a 1:1 relationship
     * @param {boolean} correctCenter - Indicates if center correction needs to be applied
     * @returns {vec3[]} The original vertex positions
     */
  static shiftMeshVertices(mesh, skeleton, isCharacterAnimation, animName, frame, singularBoneIndex = -1, correctCenter = false) {
    let originalVertices = [];
    if (!skeleton.animations.hasOwnProperty(animName) || mesh.vertices.length === 0) {
      return originalVertices;
    }

    let centerCorrection = vec3.create();
    if (correctCenter && !vec3.equals(mesh.center, vec3.create())) {
      centerCorrection = vec3.negate(vec3.create(), mesh.center);
    }

    const animation = skeleton.animations[animName];
    if (frame >= animation.frameCount) {
      return originalVertices;
    }

    const tracks = isCharacterAnimation ? animation.tracksCleanedStripped : animation.tracksCleaned;

    if (singularBoneIndex > -1) {
      const bone = skeleton.skeleton[singularBoneIndex].cleanedName;
      if (!tracks.hasOwnProperty(bone)) {
        return originalVertices;
      }

      const modelMatrix = skeleton.getBoneMatrix(singularBoneIndex, tracks, frame, centerCorrection);

      originalVertices = originalVertices.concat(this.shiftMeshVerticesWithIndices(0, mesh.vertices.length - 1, mesh, modelMatrix));

      return originalVertices;
    }

    mesh.mobPieces.forEach((mobVertexPiece, boneIndex) => {
      const bone = skeleton.skeleton[boneIndex].cleanedName;

      if (!tracks.hasOwnProperty(bone)) {
        return;
      }

      const modelMatrix = skeleton.getBoneMatrix(boneIndex, tracks, frame, centerCorrection);

      originalVertices = originalVertices.concat(this.shiftMeshVerticesWithIndices(mobVertexPiece.start, mobVertexPiece.start + mobVertexPiece.count - 1, mesh, modelMatrix));
    });

    return originalVertices;
  }

  static shiftMeshVerticesMultipleSkeletons(mesh, skeletons, isCharacterAnimations, animName, frame, singularBoneIndices = null, correctCenter = false) {
    let originalVertices = [];
    for (const skeleton of skeletons) {
      if (!skeleton.animations.hasOwnProperty(animName) || mesh.vertices.length === 0) {
        continue;
      }
    }

    let centerCorrection = vec3.create();
    if (correctCenter && !vec3.equals(mesh.center, vec3.create())) {
      centerCorrection = vec3.negate(vec3.create(), mesh.center);
    }

    const tracksList = [];
    skeletons.forEach((skeleton, index) => {
      const animation = skeleton.animations[animName];
      if (frame >= animation.frameCount) {
        return originalVertices;
      }

      const isCharacterAnimation = isCharacterAnimations[index];
      const tracks = isCharacterAnimation ? animation.tracksCleanedStripped : animation.tracksCleaned;
      tracksList.push(tracks);
    });

    let modelMatrix = mat4.fromTranslation(mat4.create(), centerCorrection);
    mat4.invert(modelMatrix, modelMatrix);
    mat4.multiply(modelMatrix, mat4.create(), modelMatrix); // Equivalent to mat4.identity in context

    skeletons.forEach((skeleton, i) => {
      if (singularBoneIndices[i] < 0) {
        mesh.mobPieces.forEach((mobVertexPiece, boneIndex) => {
          const bone = skeleton.skeleton[boneIndex].cleanedName;
          if (!tracksList[i].hasOwnProperty(bone)) {
            return;
          }

          const mobPieceMatrix = skeleton.getBoneMatrix(boneIndex, tracksList[i], frame, centerCorrection);
          const mobPieceVerticesBeforeShift = this.shiftMeshVerticesWithIndices(mobVertexPiece.start, mobVertexPiece.start + mobVertexPiece.count - 1, mesh, mobPieceMatrix);
          if (originalVertices.length < mesh.vertices.length - 1) {
            originalVertices = originalVertices.concat(mobPieceVerticesBeforeShift);
          }
        });
      } else {
        const bone = skeleton.skeleton[singularBoneIndices[i]].cleanedName;
        if (!tracksList[i].hasOwnProperty(bone)) {
          return;
        }

        modelMatrix = mat4.multiply(mat4.create(), skeleton.getBoneMatrix(singularBoneIndices[i], tracksList[i], frame), modelMatrix);
      }
    });

    mat4.multiply(modelMatrix, mat4.fromTranslation(mat4.create(), centerCorrection), modelMatrix);
    const verticesBeforeShift = this.shiftMeshVerticesWithIndices(0, mesh.vertices.length - 1, mesh, modelMatrix);

    if (originalVertices.length < mesh.vertices.length - 1) {
      originalVertices = originalVertices.concat(verticesBeforeShift);
    }

    return originalVertices;
  }

  static shiftMeshVerticesWithIndices(start, end, mesh, boneMatrix) {
    const originalVertices = [];
    for (let i = start; i <= end; i++) {
      if (i >= mesh.vertices.length) {
        break;
      }

      const vertex = mesh.vertices[i];
      originalVertices.push(vertex);
      const newVertex = vec3.transformMat4(vec3.create(), vertex, boneMatrix);
      mesh.vertices[i] = vec3.fromValues(newVertex[0], newVertex[1], newVertex[2]);
    }
    return originalVertices;
  }

  
}
