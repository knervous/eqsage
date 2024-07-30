import {
  AbstractMesh,
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  ParticleSystem,
  StandardMaterial,
  Texture,
  Tools,
  Vector3,
} from '@babylonjs/core';
import { Spawn } from './Spawn';
import { eqtoBabylonVector } from '../util/vector';
import { AnimationNames, mapAnimations } from '../helpers/animationUtils';

/** @typedef {import('@babylonjs/core/Meshes').Mesh} Mesh */

export class BabylonSpawn {
  /** @type {Spawn} */
  spawn = null;

  /** @type {Mesh} */
  rootNode = null;

  /** @type {TransformNode} */
  transform = null;

  modelName = '';

  /** @type {Mesh} */
  nameplateMesh = null;

  /** @type {Node} */
  parentNode = null;

  /** @type {import('@babylonjs/core').AnimationGroup[]} */
  animationGroups = [];

  /**
   * @type {Object.<number, import('@babylonjs/core').AnimationGroup>}
   */
  animationMap = {};

  /** @type {Animatable[]} */
  animatables = [];

  loopedAnimation = AnimationNames.Idle;

  animating = false;
  canAnimate = false;
  animatingIndex = AnimationNames.Idle;

  /**
   * @param {object} spawnData
   * @param {Node} parentNode
   * @param {Material} sphereMat
   *
   */
  constructor(spawnEntry, modelName, parentNode, sphereMat) {
    this.modelName = modelName;
    this.spawnEntry = spawnEntry;
    this.metadata = {
      spawn        : this.spawnEntry,
      emissiveColor: spawnEntry.grid?.length
        ? new Color3(0, 1, 1)
        : new Color3(1, 1, 1),
    };
    this.spawn = new Spawn(spawnEntry);
    this.parentNode = parentNode;
    this.sphereMat = sphereMat;
  }

  setLods(value) {
    this.rootNode.getLODLevels().forEach(lod => {
      this.rootNode.removeLODLevel(lod.mesh);
    });
    this.rootNode.addLODLevel(value, this.instance);
  }

  /**
   * @returns {boolean}
   */
  async initializeSpawn() {
    const modelVariation =
      this.spawnEntry.texture >= 10
        ? `${this.modelName}${(Number(this.spawnEntry.texture.toString()[0]))
          .toString()
          .padStart(2, '0')}`
        : this.modelName;

    const assetContainer =
      await window.gameController.SpawnController.getAssetContainer(modelVariation);
    this.instanceContainer = assetContainer.instantiateModelsToScene();
    this.animationGroups = this.instanceContainer.animationGroups;

    this.animationMap = mapAnimations(this.animationGroups);
    this.rootNode = this.instanceContainer.rootNodes[0];

    if (!this.rootNode) {
      console.log('No root node for container spawn', this.spawn);
      return false;
    }

    this.rootNode.id = `spawn_${this.spawn.id}`;
    this.rootNode.name = this.spawn.name;
    const scale = this.modelName === 'fis' ? 0.005 : (this.spawn.size ?? 0) === 0 ? 1.5 : this.spawn.size / 4;
    this.scale = scale;
    for (const mesh of this.rootNode.getChildMeshes()) {
      mesh.checkCollisions = true;
      mesh.name = mesh.material.name;
      mesh.metadata = {
        spawn: true,
      };
    }

    this.rootNode.position.setAll(0);
    this.rootNode.scaling.setAll(1);
    this.rootNode.rotationQuaternion = null;
    this.rootNode.rotation.setAll(0);

    const instanceSkeleton = this.instanceContainer.skeletons[0];
    const skeletonRoot = this.rootNode.getChildren(undefined, true)[0];


    const secondaryMeshes = this.rootNode.getChildTransformNodes()[0]?.metadata?.gltf?.extras?.secondaryMeshes ?? 0;
  
    // Secondary mesh
    let secModel = null;
    if (secondaryMeshes > 0) {
      const variation = this.spawnEntry.helmtexture?.toString().padStart(2, '0') ?? '00';
      const container = await window.gameController.SpawnController.getAssetContainer(`${this.modelName}he${variation}`, true);
      const secondaryModel = container.instantiateModelsToScene();
      secModel = secondaryModel;
      try {
        secondaryModel.rootNodes[0].getChildMeshes()?.forEach(m => {
          this.rootNode.addChild(m);
        });


      } catch (e) {

      }
      // this.rootNode.addChild(secondaryModel.rootNodes[0].getChildMeshes()[0]);
      // if (secondaryModel.rootNodes.length) {
      //   this.rootNode.addChild(secondaryModel.rootNodes[0].getChildMeshes()[0]);

      // } else {
      //   console.warn(`Sec mesh for ${this.spawnEntry.name} not loaded`);
      // }
    }

    const merged = Mesh.MergeMeshes(
      this.rootNode.getChildMeshes(false),
      false,
      true,
      undefined,
      true,
      true
    );
    if (secModel) {
      secModel.dispose();
    }
    if (merged) {
      skeletonRoot.parent = merged;
      skeletonRoot.skeleton = instanceSkeleton;
      skeletonRoot.skeleton.name = `${this.spawn.name}_skeleton`;
      this.rootNode.dispose();
      this.rootNode = merged;
      this.rootNode.skeleton = skeletonRoot.skeleton;

      // Let's do textures
      /**
       * @type {MultiMaterial}
       */
      const multiMat = merged.material;
      if (
        this.spawnEntry.hasOwnProperty('texture') &&
        this.spawnEntry.texture > 0
      ) {
        for (const [idx, mat] of Object.entries(multiMat.subMaterials)) {
          if (!mat?._albedoTexture) {
            continue;
          }
          const isVariationTexture = this.spawnEntry.texture >= 10;
          let text =
            isVariationTexture
              ? this.spawnEntry.texture - 10
              : this.spawnEntry.texture;
          if (mat.name.startsWith('clk')) {
            text += 4;
          }
          const prefix = mat.name.slice(0, mat.name.length - 4);
          const suffix = mat.name.slice(mat.name.length - 4, mat.name.length);
          const textVer = suffix.slice(0, 2);
          const textNum = suffix.slice(2, 4);

          const thisText = text.toString().padStart(2, '0');

          const newFullName = `${prefix}${thisText}${textNum}`;
          if (thisText !== textVer) {
            const existing = window.gameController.currentScene.materials
              .flat()
              .find((m) => m.name === newFullName);
            if (existing) {
              multiMat.subMaterials[idx] = existing;
            } else {
              const newMat = new PBRMaterial(newFullName);
              newMat.metallic = 0;
              newMat.roughness = 1;
              newMat._albedoTexture = new Texture(
                newFullName,
                window.gameController.currentScene,
                mat._albedoTexture.noMipMap,
                mat._albedoTexture.invertY,
                mat._albedoTexture.samplingMode
              );
              multiMat.subMaterials[idx] = newMat;
            }
          }
        }
      }
    }
    const sphere = MeshBuilder.CreateSphere(
      this.spawn.name,
      { diameter: 3, segments: 32 },
      this.currentScene
    );
    // sphere.isVisible = false;
    sphere.metadata = { ...this.metadata, onlyOccluded: false };
    sphere.position = this.rootNode.position;
    sphere.parent = this.parentNode;
    sphere.isPickable = true;
    this.rootNode.parent = this.parentNode;
    this.instance = sphere;
    this.rootNode.metadata = { ...this.metadata, onlyOccluded: true };
    this.rootNode.addLODLevel(window.gameController.settings.spawnLOD, sphere);

    window.gameController.ZoneController.glowLayer.addIncludedOnlyMesh(this.rootNode);
    window.gameController.ZoneController.glowLayer.addIncludedOnlyMesh(this.instance);

    this.rootNode.id = `spawn_${this.spawn.id}`;
    this.rootNode.name = this.spawn.name;

    this.rootNode.position = eqtoBabylonVector(
      this.spawn.x,
      this.spawn.y,
      this.spawn.z
    );
    this.rootNode.scaling.z = scale;
    this.rootNode.scaling.x = scale;
    this.rootNode.scaling.y = Math.abs(scale);
    this.rootNode.rotation = new Vector3(
      Tools.ToRadians(0),
      Tools.ToRadians(this.spawn.heading),
      Tools.ToRadians(0)
    );

    this.rootNode.isPickable = true;
    this.rootNode.babylonSpawn = this;
    this.rootNode.forceRenderingWhenOccluded = true;
    this.rootNode.occlusionType = AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
    this.createNameplate();

    const anim =
      this.animationGroups.find((ag) => ag.name === 'Clone of p01') ??
      this.animationGroups?.[0];
    if (anim) {
      this.disableLoopedAnimation();
      anim.play(true);
    }
    setTimeout(() => {
      this.rootNode.refreshBoundingInfo(true, true);
      this.playAnimation();
    }, 1000);

    return true;
  }

  enableLoopedAnimation() {
    this.animationMap[this.loopedAnimation]?.play(
      this.loopedAnimation !== AnimationNames['Shuffle Feet']
    );
    this.animating = true;
  }

  disableLoopedAnimation(removeAnimatables = false) {
    if (removeAnimatables) {
      const startIdx = window.gameController.currentScene._activeAnimatables.findIndex(
        (ag) => this.animatables[0] === ag
      );
      if (startIdx > -1) {
        window.gameController.currentScene._activeAnimatables.splice(
          startIdx,
          this.animatables.length
        );
      }
    }

    this.animationMap[this.loopedAnimation]?.stop();
    this.animating = false;
  }

  swapLoopedAnimation(newIdx) {
    if (
      newIdx === this.loopedAnimation &&
      this.animationMap[newIdx]?.isPlaying
    ) {
      return;
    }
    this.disableLoopedAnimation();
    this.loopedAnimation = newIdx;
    this.enableLoopedAnimation();
  }

  playAnimation(idx, _speed = 0) {
    if (!this.rootNode.isEnabled()) {
      return;
    }

    const anim =
      this.animationGroups.find((ag) => ag.name === 'Clone of p01') ??
      this.animationGroups?.[0];

    if (anim) {
      this.disableLoopedAnimation();
      anim.play(true);
    }
  }

  dispose() {
    this.rootNode?.dispose();
    this.rootNode = null;
    this.nameplateMesh?.dispose();
    this.nameplateMesh = null;
    this.instance?.dispose();
    this.instance = null;
  }

  createNameplate() {
    const hasEntries =
      Array.isArray(this.spawnEntry.spawnentries) &&
      this.spawnEntry.spawnentries.length > 0;
    let text = ['No Associated Spawns'];
    if (hasEntries) {
      const lines = [];
      for (const entry of this.spawnEntry.spawnentries) {
        if (!entry.npc_type) {
          continue;
        }
        lines.push(
          `${entry.npc_type?.name} - Level ${entry.npc_type?.level} - ${entry.chance}% Chance`
        );
      }
      text = lines;
    }

    if (!text.length) {
      return;
    }

    const temp = new DynamicTexture(
      'DynamicTexture',
      64,
      window.gameController.currentScene
    );
    const tmpctx = temp.getContext();
    tmpctx.font = '32px Arial';
    const textWidth = text.reduce((acc, val) => {
      const newTextWidth = tmpctx.measureText(val).width;
      if (newTextWidth > acc) {
        return newTextWidth;
      }
      return acc;
    }, 0);

    const textLengthLongest = text.reduce((acc, val) => {
      const newTextLength = val.length;
      if (newTextLength > acc) {
        return newTextLength;
      }
      return acc;
    }, 0);
    temp.dispose();

    const dynamicTexture = new DynamicTexture(
      'DynamicTexture',
      { width: textWidth, height: 100 + text.length * 65 },
      window.gameController.currentScene
    );
    const ctx = dynamicTexture.getContext();
    const lineHeight = 40; // Adjust based on your font size
    ctx.font = '32px arial';
    ctx.fillStyle = 'white';
    for (let i = 0; i < text.length; i++) {
      let txt = text[i];
      txt = txt.padStart(textLengthLongest, ' ');
      ctx.fillText(txt, 0, lineHeight * (i + 1));
    }
    dynamicTexture.update();

    const plane = MeshBuilder.CreatePlane(
      'textPlane',
      { width: textWidth / 60, height: 2 + text.length },
      window.gameController.currentScene
    );
    plane.addLODLevel(500, null);
    plane.isPickable = false;
    // const height = Math.abs(this.rootNode.getBoundingInfo().boundingBox.maximumWorld.y - this.rootNode.getBoundingInfo().boundingBox.minimumWorld.y);
    plane.position.y = Math.abs(this.rootNode.getBoundingInfo().boundingBox.minimum.y - 1.2);
    plane.billboardMode = ParticleSystem.BILLBOARDMODE_ALL;
    plane.parent = this.rootNode;
    const material = new StandardMaterial(
      'nameplate',
      window.gameController.currentScene
    );
    plane.material = material;
    material.diffuseTexture = dynamicTexture;
    material.diffuseTexture.hasAlpha = true;
    material.useAlphaFromDiffuseTexture = true;
    material.emissiveColor = Color3.White();

    this.nameplateMesh = plane;
  }

  // eslint-disable-next-line
  updateTextures() {}
}
