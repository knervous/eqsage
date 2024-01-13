import { Color3, DynamicTexture, Mesh, MeshBuilder, ParticleSystem, PhysicsAggregate, PhysicsShapeType, StandardMaterial, Tools, Vector3 } from '@babylonjs/core';
import { Spawn } from './Spawn';
import { gameController } from '../controllers/GameController';
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

  /** @type {import('@babylonjs/core').AssetContainer} */
  assetContainer = null;
  
  /** @type {Mesh} */
  nameplateMesh = null;

  /** @type {PhysicsAggregate} */
  physicsAggregate;

  /** @type {import('@babylonjs/core').AnimationGroup[]} */
  animationGroups = [];

  /**
   * @type {Object.<number, import('@babylonjs/core').AnimationGroup>}
   */
  animationMap = {};

  /** @type {Animatable[]} */
  animatables = [];

  /** @type {number | null} */
  timestamp = null;

  /** @type {Vector3} */
  linearVelocity = null;

  lastX = -1;
  lastY = -1;
  lastZ = -1;

  loopedAnimation = AnimationNames.Idle;

  animating = false;
  canAnimate = false;
  animatingIndex = AnimationNames.Idle;

  agentIndex = -1;

  /**
     * @param {object} spawnData
     * @param {import('@babylonjs/core').AssetContainer} container
     */
  constructor(spawnEntry, container, options = {}) {
    this.options = options;
    this.assetContainer = container;
    this.instanceContainer = container.instantiateModelsToScene();
    this.instanceContainer.animationGroups?.forEach(ag => gameController.currentScene.removeAnimationGroup(ag));
    const totalAnimatables = this.instanceContainer.animationGroups.reduce((acc, val) => acc + val.targetedAnimations.length, 0);
    gameController.currentScene._activeAnimatables = gameController.currentScene._activeAnimatables.slice(0, gameController.currentScene._activeAnimatables.length - totalAnimatables);
    this.spawn = new Spawn(spawnEntry);
    this.animationGroups = this.instanceContainer.animationGroups;
    this.animationMap = mapAnimations(this.animationGroups);
    this.rootNode = this.instanceContainer.rootNodes[0];
  }

  /**
   * @returns {boolean}
   */
  async initializeSpawn() {
    if (!this.rootNode) {
      console.log('No root node for container spawn', this.spawn);
      return false;
    }

    this.rootNode.id = `spawn_${this.spawn.id}`;
    this.rootNode.name = this.spawn.name;
    const scale = (this.spawn.size ?? 0) === 0 ? 1.5 : this.spawn.size / 4;

    for (const mesh of this.rootNode.getChildMeshes()) {
      mesh.checkCollisions = true;
      mesh.name = mesh.material.name;
      mesh.metadata = {
        spawn: true,
      };
    }
    // Initialize and delete excess textures before merging
    this.updateTextures(true);

    this.rootNode.position.setAll(0);
    this.rootNode.scaling.setAll(1);
    this.rootNode.rotationQuaternion = null;
    this.rootNode.rotation.setAll(0);

    const instanceSkeleton = this.instanceContainer.skeletons[0];
    const skeletonRoot = this.rootNode.getChildren(undefined, true).find(a => a.name.includes('root'));
    const merged = Mesh.MergeMeshes(this.rootNode.getChildMeshes(false), false, true, undefined, false, true);
    if (merged) {
      skeletonRoot.parent = merged;
      skeletonRoot.skeleton = instanceSkeleton;
      skeletonRoot.skeleton.name = `${this.spawn.name}_skeleton`;
      this.rootNode.dispose();
      this.rootNode = merged;
      this.rootNode.skeleton = skeletonRoot.skeleton;

    }
    this.rootNode.id = `spawn_${this.spawn.id}`;
    this.rootNode.name = this.spawn.name;
    // this.rootNode.setEnabled(false);

    await this.updatePrimarySecondary(instanceSkeleton, skeletonRoot).catch((e) => {
      console.warn('Error instantiating primary/secondary', e);
    });

    this.rootNode.position = eqtoBabylonVector(this.spawn.x, this.spawn.y, this.spawn.z + 2);
    this.rootNode.scaling.z = scale;
    this.rootNode.scaling.x = scale;
    this.rootNode.scaling.y = Math.abs(scale);
    this.rootNode.rotation = new Vector3(Tools.ToRadians(0), Tools.ToRadians(this.spawn.heading), Tools.ToRadians(0));
    this.rootNode.setEnabled(false);
    this.rootNode.isPickable = true;

    // Create nameplate
    this.createNameplate();

    // Create physics aggregate
    this.rootNode.refreshBoundingInfo();
    const height = Math.abs(this.rootNode.getBoundingInfo().boundingBox.maximumWorld.y - this.rootNode.getBoundingInfo().boundingBox.minimumWorld.y);
    this.nameplateMesh.position.y = Math.abs(this.rootNode.getBoundingInfo().boundingBox.minimum.y - 1.2);
    if (this.physicsAggregate) {
      this.physicsAggregate.dispose();
      delete this.physicsAggregate;
    }

    if (!this.options.skipPhysics) {
      const ag = new PhysicsAggregate(this.rootNode, PhysicsShapeType.BOX, { center: new Vector3(0, -1.5, 0), extents: new Vector3(2, height, 2), mass: 3, restitution: 0, friction: 1 });
      ag.body.setMassProperties({
        inertia: new Vector3(0, 0, 0)
      });
      this.physicsAggregate = ag;
    }
   
    // this.rootNode.forceRenderingWhenOccluded = true;
    // this.rootNode.occlusionType = AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;

    this.animatables = this.animationGroups.map(ag => ag.animatables).flat();

    this.rootNode.babylonSpawn = this;
    return true;
  }

  enableLoopedAnimation() {
    this.animationMap[this.loopedAnimation]?.play(this.loopedAnimation !== AnimationNames['Shuffle Feet']);
    this.animating = true;
  }

  disableLoopedAnimation(removeAnimatables = false) {
    if (removeAnimatables) {
      const startIdx = gameController.currentScene._activeAnimatables.findIndex(ag => this.animatables[0] === ag);
      if (startIdx > -1) {
        gameController.currentScene._activeAnimatables.splice(startIdx, this.animatables.length);
      }
    }
    
    this.animationMap[this.loopedAnimation]?.stop();
    this.animating = false;
  }

  swapLoopedAnimation(newIdx) {
    if (newIdx === this.loopedAnimation && this.animationMap[newIdx]?.isPlaying) {
      return;
    }
    this.disableLoopedAnimation();
    this.loopedAnimation = newIdx;
    this.enableLoopedAnimation();
  }

  playAnimation(idx, _speed = 0) {
    if (!this.rootNode.isEnabled() || this.animatingIndex === idx) {
      return;
    }
    this.animatingIndex = idx;
    const anim = this.animationMap[idx];
    if (anim) {
      this.disableLoopedAnimation();
      anim.play(false);
      anim.onAnimationEndObservable.addOnce(() => {
        this.enableLoopedAnimation();
        this.animatingIndex = -1;
      });
    }
  }

  dispose() {
    this.rootNode?.dispose();
    this.rootNode = null;
    clearInterval(this.charSelectInterval);
  }

  charSelectAnimation() {
    this.swapLoopedAnimation(AnimationNames.Idle);
    this.charSelectInterval = setInterval(() => {
      
      this.playAnimation(Math.floor(Math.random() * 5));
    }, 5000);
  }

  createNameplate() {
    const temp = new DynamicTexture('DynamicTexture', 64, gameController.currentScene);
    const tmpctx = temp.getContext();
    tmpctx.font = '16px Arial';
    const textWidth = tmpctx.measureText(this.spawn.displayedName).width + 20;
    const textureGround = new DynamicTexture(`${this.spawn.name}_nameplate_texture`, { width: textWidth, height: 30 }, gameController.currentScene);   
    textureGround.drawText(this.spawn.displayedName, null, null, '17px Arial', '#02c473', 'transparent', false, true);
    textureGround.update(false, true);
    const materialGround = new StandardMaterial(`${this.spawn.name}_nameplate_material`, gameController.currentScene);

    materialGround.diffuseTexture = textureGround;
    materialGround.diffuseTexture.hasAlpha = true;
    materialGround.useAlphaFromDiffuseTexture = true;
    materialGround.emissiveColor = Color3.White();// ('#fbdc02');// Color3.FromInts(100, 200, 100);
    materialGround.disableLighting = true;
    const nameplateMesh = MeshBuilder.CreatePlane(`${this.spawn.name}_nameplate`, { width: textWidth / 30, height: 1 }, gameController.currentScene);
    nameplateMesh.parent = this.rootNode;
    nameplateMesh.billboardMode = ParticleSystem.BILLBOARDMODE_ALL;
    nameplateMesh.material = materialGround;

    // materialGround.onBindObservable.add(() => {
    //   gameController.engine.alphaState.setAlphaBlendFunctionParameters(1, 0x0303 /* ONE MINUS SRC ALPHA */, 1, 0x0303 /* ONE MINUS SRC ALPHA */);
    // });

    this.nameplateMesh = nameplateMesh;
  }

  // eslint-disable-next-line
    updateTextures(doDelete = false) {
    const model = this.spawn.model;
    const isVariation = (name, variation) => {
      if (/\d{4}$/.test(name)) {
        return name.slice(name.length - 4, name.length - 2) === `${variation}`.padStart(2, '0');
      }
      return false;
    };
    const matchPrefix = (prefix, name) => {
      return name.includes(prefix);
    };
    for (const mesh of this.rootNode.getChildMeshes()) {
      // NPCs without equipment
      if (!this.spawn.hasEquip) {
        const texture = this.spawn.equipChest;
        if (isVariation(mesh.name, texture)) {
          mesh.setEnabled(true);
        } else {
          if (doDelete) {
            mesh.dispose();
          } else {
            mesh.setEnabled(false);
          }
              
        }
      } else {
        // Humanoid wearing equip
        const equip = this.spawn.equipment;
        // One-offs for helm
        let offsetHeadId = equip.head.id;
        if ([1].includes(this.spawn.race)) {
          offsetHeadId += 1;
          if (offsetHeadId > 4) {
            offsetHeadId = 0;
          }
        }
        if (mesh.name.includes('tm_helm') && !mesh.name.endsWith(offsetHeadId)) {
          if (doDelete) {
            mesh.dispose();
          } else {
            mesh.setEnabled(false);
          }
        }
    
        if (mesh.name.includes('chain') && !mesh.name.endsWith(offsetHeadId)) {
          if (doDelete) {
            mesh.dispose();
          } else {
            mesh.setEnabled(false);
          }
              
        }
        if (mesh.name.includes('leather') && !mesh.name.endsWith(offsetHeadId)) {
          if (doDelete) {
            mesh.dispose();
          } else {
            mesh.setEnabled(false);
          }
              
        }
    
        // Disable all clk for now
        if (mesh.name.startsWith('d_clk')) {
          if (isVariation(mesh.name, equip.chest.id - 6)) {
            mesh.setEnabled(true);
            const { blue, green, red, useTint } = this.spawn.equipment.chest.tint;
            if (useTint !== 0) {
              mesh.material.albedoColor = Color3.FromInts(red, green, blue);
            }
                
          } else {
            if (doDelete) {
              mesh.dispose();
            } else {
              mesh.setEnabled(false);
            }
          }
        }
    
        // Chest
        if (matchPrefix(`${model}ch`, mesh.name)) {
          if (isVariation(mesh.name, equip.chest.id)) {
            mesh.setEnabled(true);
            const { blue, green, red, useTint } = this.spawn.equipment.chest.tint;
            if (useTint !== 0) {
              mesh.material.albedoColor = Color3.FromInts(red, green, blue);
            }
          } else {
            if (doDelete) {
              mesh.dispose();
            } else {
              mesh.setEnabled(false);
            }
          }
        }
    
        // Face
        if (matchPrefix(`${model}he00`, mesh.name)) {
          if (offsetHeadId > 0) {
            if (!mesh.name.endsWith(`-${offsetHeadId}`) && !(offsetHeadId === 1 && mesh.name.endsWith(offsetHeadId))) {
              if (doDelete) {
                mesh.dispose();
              } else {
                mesh.setEnabled(false);
              }
            } else {
              const mat = gameController.currentScene.materials.find(m => m.name.endsWith(`${this.spawn.model}he00${this.spawn.face}1`));
              if (mat) {
                mesh.material = mat;
              }
            }
          } else if (mesh.name.endsWith(`${this.spawn.face}1`)) {
            mesh.setEnabled(true);
          } else {
            if (doDelete) {
              mesh.dispose();
            } else {
              mesh.setEnabled(false);
            }
          }
               
        }
    
        // Hands
        if (matchPrefix(`${model}hn`, mesh.name)) {
          if (!isVariation(mesh.name, 0)) {
            if (isVariation(mesh.name, equip.hands.id)) {
              mesh.setEnabled(true);
              const { blue, green, red, useTint } = this.spawn.equipment.hands.tint;
              if (useTint !== 0) {
                mesh.material.albedoColor = Color3.FromInts(red, green, blue);
              }
            } else {
              if (doDelete) {
                mesh.dispose();
              } else {
                mesh.setEnabled(false);
              }
            }
          }
        }
    
        // Arms
        if (matchPrefix(`${model}ua`, mesh.name)) {
          if (isVariation(mesh.name, equip.arms.id)) {
            mesh.setEnabled(true);
            const { blue, green, red, useTint } = this.spawn.equipment.arms.tint;
            if (useTint !== 0) {
              mesh.material.albedoColor = Color3.FromInts(red, green, blue);
            }
          } else {
            if (doDelete) {
              mesh.dispose();
            } else {
              mesh.setEnabled(false);
            }
          }
        }
    
        // Bracers
        if (matchPrefix(`${model}fa`, mesh.name)) {
          if (isVariation(mesh.name, equip.wrist.id)) {
            mesh.setEnabled(true);
            const { blue, green, red, useTint } = this.spawn.equipment.wrist.tint;
            if (useTint !== 0) {
              mesh.material.albedoColor = Color3.FromInts(red, green, blue);
            }
          } else {
            if (doDelete) {
              mesh.dispose();
            } else {
              mesh.setEnabled(false);
            }
          }
        }
            
        // Legs
        if (matchPrefix(`${model}lg`, mesh.name)) {
          if (isVariation(mesh.name, equip.legs.id)) {
            mesh.setEnabled(true);
            const { blue, green, red, useTint } = this.spawn.equipment.legs.tint;
            if (useTint !== 0) {
              mesh.material.albedoColor = Color3.FromInts(red, green, blue);
            }
          } else {
            if (doDelete) {
              mesh.dispose();
            } else {
              mesh.setEnabled(false);
            }
          }
        }
    
        // Feet
        if (matchPrefix(`${model}ft`, mesh.name)) {
          let feetId = equip.feet.id;
          let checkEnd = false;
          if (feetId >= 10 && feetId <= 16) {
            feetId = 0;
            checkEnd = true;
          }
          if (isVariation(mesh.name, feetId) && (!checkEnd || mesh.name.endsWith('02'))) {
            mesh.setEnabled(true);
            const { blue, green, red, useTint } = this.spawn.equipment.feet.tint;
            if (useTint !== 0) {
              mesh.material.albedoColor = Color3.FromInts(red, green, blue);
            }
          } else {
            if (doDelete) {
              mesh.dispose();
            } else {
              mesh.setEnabled(false);
            }
          }
        }
      }
    }
  }

  async updatePrimarySecondary(skeleton, skeletonRoot) {
    if (this.spawn.equipment.primary.id > 0) {
      const primary = await gameController.ItemController.createItem(this.spawn.equipment.primary.id);
      if (primary) {
        const transformNode = skeletonRoot.getChildTransformNodes().find(a => a.name.includes('r_point'));
        const primaryBone = skeletonRoot.skeleton.bones.find(b => b.name === 'r_point');
        if (primaryBone && transformNode) {
          primary.attachToBone(primaryBone);
          primary.parent = transformNode;
          primary.rotationQuaternion = null;
          primary.rotation.setAll(0);
          primary.scaling.setAll(1);
          primary.scaling.x = -1;
          primary.name = `it${this.spawn.equipment.primary.id}`;
          primary.skeleton = skeleton;
        }
      }
          
    }
    
    if (this.spawn.equipment.secondary.id > 0) {
      const secondary = await gameController.ItemController.createItem(this.spawn.equipment.secondary.id);
      if (secondary) {
        const secondaryBone = skeleton.bones.find(b => b.name === 'l_point');
        const transformNode = this.rootNode.getChildTransformNodes().find(a => a.name.includes('l_point'));
        // Some item type check here for shield_point
        if (secondaryBone && transformNode) {
          secondary.attachToBone(secondaryBone);
          secondary.parent = transformNode;
          secondary.rotationQuaternion = null;
          secondary.rotation.setAll(0);
          // secondary.scaling.setAll(-1);
          secondary.scaling.setAll(1);
          secondary.scaling.x = -1;
          secondary.name = `it${this.spawn.equipment.secondary.id}`;
        }
      }
          
    }
  }
    
}