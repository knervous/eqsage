import { AbstractMesh, Matrix, Scene, SceneLoader, Tools, Vector3 } from '@babylonjs/core';
import { PointOctree } from 'sparse-octree';
import { Vector3 as ThreeVector3 } from 'three';

import raceData from '../common/raceData.json';
import { eqtoBabylonVector } from '../util/vector';
import { cameraController } from './CameraController';
import { GameControllerChild } from './GameControllerChild';
import { BabylonSpawn } from '../models/BabylonSpawn';
import { AnimationNames } from '../helpers/animationUtils';

const modelsUrl = 'https://eqrequiem.blob.core.windows.net/assets/models/';

/**
 * @typedef {import('@babylonjs/core').AssetContainer} AssetContainer
 */

class SpawnController extends GameControllerChild {

  /**
   * @type {Object.<number, BabylonSpawn>}
   */
  spawns = {};

  /**
   * @type {BabylonSpawn}
   */
  characterSelectSpawn = null;

  /**
   * @type {BabylonSpawn[]}
   */
  interpolatingSpawns = [];

  /**
   * @type {Object.<string, Promise<AssetContainer>}
   */
  assetContainers = {};

  /**
   * @type {PointOctree}
   */
  octree = null;

  /**
   * @type {number}
   */
  spawnCullCounter = 0;

  /**
   * @type {number}
   */
  animationCullCounter = 0;

  /**
   * @type {number}
   */
  spawnCullRange = 750;

  /**
   * @type {number}
   */
  spawnAnimationRange = 750;

  /**
   * @type {number}
   */
  skipAnimCount = 0;

  /**
   * @type {import('@babylonjs/core').ICrowd}
   */
  crowd = null;

  remainingSpawnGroups = 0;

  /** @type {import('@babylonjs/core').Octree<AbstractMesh>} */

  constructor() {
    super();
    this.interpolateSpawns = this.interpolateSpawns.bind(this);
    this.sceneMouseDown = this.sceneMouseDown.bind(this);
  }

  dispose() {
    this.assetContainers = {};
    this.spawns = {};
  }

  setupSpawnController (aabbTree) {
    const { min, max } = aabbTree;
    this.octree = new PointOctree(new ThreeVector3(min.x, min.y, min.z), new ThreeVector3(max.x, max.y, max.z));
    const originalSceneAnimate = Scene.prototype.animate;
    const zoneThis = this;
    let count = 0;
    Scene.prototype.animate = function animate() {
      if (count < zoneThis.skipAnimCount) {
        count++;
        return false;
      }
      count = 0;
      return originalSceneAnimate.call(this);
    };
    const originalUpdateBoundingInfo = AbstractMesh.prototype._updateBoundingInfo; 
    AbstractMesh.prototype._updateBoundingInfo = function _updateBoundingInfo() {
      const result = originalUpdateBoundingInfo.call(this);
      if (this.onUpdateBoundingInfo) {
        this.onUpdateBoundingInfo();
      }
      return result;
    };
    this.currentScene.onAfterRenderObservable.add(this.interpolateSpawns);
    // this.spawnOctree = new Octree(Octree.CreationFuncForMeshes);
    // this.spawnOctree.update(new Vector3(min.x, min.z, min.y), new Vector3(max.x, max.z, max.y), []);
  }
  /**
   * 
   * @param {import('@babylonjs/core').RecastJSPlugin} navigationPlugin 
   */
  initializeCrowd(_navigationPlugin) {
    // this.crowd = navigationPlugin.createCrowd(1000, 0.1, this.currentScene);
    // this.currentScene.onAfterRenderObservable.add(this.interpolateSpawns);
  }

  /**
   * 
   * @param {MouseEvent} e 
   */
  sceneMouseDown(_e) {
    const ray = this.currentScene.createPickingRay(this.currentScene.pointerX, this.currentScene.pointerY, Matrix.Identity(), this.CameraController.camera);
    const hit = this.currentScene.pickWithRay(ray);
    if (hit.pickedMesh && /spawn_\d+/.test(hit.pickedMesh.id)) {
      const [, id] = hit.pickedMesh.id.split('_');
      const numericId = +id;
      const spawn = this.spawns[numericId];
      window.spawn = spawn;
      window.setTargetName?.(spawn.spawn.displayedName);
      console.log('Mesh clicked', spawn);

      // Dev interpolate spawn
      // const { _x, _y, _z } = this.CameraController.camera.globalPosition;
      // const { x, y, z } = babylonToEqVector(_x, _y, _z);
      // const update = { animation: 3, spawn_id: numericId, heading: 0, x, y, z };
      // this.netUpdateSpawn(update);
    }
  }

  /**
   * 
   * @param {string} modelName 
   * @returns {Promise<AssetContainer>}
   */
  getAssetContainer(modelName) {
    if (!this.assetContainers[modelName]) {
      this.assetContainers[modelName] = SceneLoader.LoadAssetContainerAsync(modelsUrl, `${modelName}.glb.gz`, this.currentScene, undefined, '.glb');
    }
    return this.assetContainers[modelName];
  }

  async setCharacterSelectModel(character) {
    if (this.characterSelectSpawn) {
      this.characterSelectSpawn.dispose();
    }
    const model = raceData.find(r => r.id === character.race);
    const modelName = (model?.[character.gender] || model?.['2'] || 'HUM').toLowerCase();

    const container = await this.getAssetContainer(modelName);
    if (!container) { 
      console.log('Did not load model', modelName);
      return;
    }
    const babylonSpawn = new BabylonSpawn(character, container, { skipPhysics: true });
    if (!(await babylonSpawn.initializeSpawn())) {
      console.log('Did not initialize character select', modelName);
      return;
    }
    this.characterSelectSpawn = babylonSpawn;
    this.enableSpawn(this.characterSelectSpawn);
 
    this.characterSelectSpawn.charSelectAnimation();
  }



  async addSpawn(modelName, models) {
    const container = await this.getAssetContainer(modelName);
  
    if (!container) { 
      console.log('Did not load model', modelName);
      return;
    }
    
    for (const [_idx, spawnEntry] of Object.entries(models)) {
    
      const babylonSpawn = new BabylonSpawn(spawnEntry, container);
      babylonSpawn.rootNode.addLODLevel(this.spawnCullRange, null);
      const id = babylonSpawn.spawn.id;
      if (!(await babylonSpawn.initializeSpawn())) {
        return;
      }
      // this.spawnOctree.addMesh(babylonSpawn.rootNode);
      // this.spawnOctree.dynamicContent.push(babylonSpawn.rootNode);
      this.spawns[id] = babylonSpawn;
      
      const vec = new ThreeVector3(babylonSpawn.rootNode.absolutePosition.x, babylonSpawn.rootNode.absolutePosition.z, babylonSpawn.rootNode.absolutePosition.y);
      if (this.octree.get(vec)) {
        this.octree.set(vec, [...this.octree.get(vec), id]);
      } else {
        this.octree.set(vec, [id]);
      }
    }
  
  }

  async addSpawns (spawns) {
    while (!this.zoneLoaded) {
      await new Promise(res => setTimeout(res, 10));
    }
    const spawnList = {}; 
    for (const spawn of spawns) {
      const model = raceData.find(r => r.id === spawn.race);

      // Temp filter
      if (!spawn.name.includes('Knervous') && !spawn.name.includes('Guard')) {
        // continue;
      }

      if (!spawn.name.includes('Leanon')) {
        // continue;
      }

      // Invisible man and spawn controllersa
      if ([127, 240].includes(model.id)) {
        continue;
      }
      const realModel = (model[spawn.gender] || model['2'] || 'HUM').toLowerCase();
      if (!spawnList[realModel]) {
        spawnList[realModel] = [];
      }
      spawnList[realModel].push(spawn);
    }
    this.remainingSpawnGroups += Object.keys(spawnList).length;
    this.actions.setLoadingText(`Loading ${this.remainingSpawnGroups} spawn types`);
    await Promise.all(Object.entries(spawnList).map(([modelName, models]) => this.addSpawn(modelName, models).then(() => {
      this.actions.setLoadingText(`Loading ${--this.remainingSpawnGroups} spawn types`);
    })));
  }
  /**
   * 
   * @param {BabylonSpawn} spawn 
   */
  enableSpawn(spawn) {
    spawn.rootNode.setEnabled(true);
    spawn.rootNode.refreshBoundingInfo();
    // const height = Math.abs(spawn.rootNode.getBoundingInfo().boundingBox.maximumWorld.y - spawn.rootNode.getBoundingInfo().boundingBox.minimumWorld.y);
    spawn.nameplateMesh.position.y = spawn.rootNode.getBoundingInfo().boundingBox.minimum.y - 1.2;
    // if (spawn.physicsAggregate) {
    //   spawn.physicsAggregate.dispose();
    //   delete spawn.physicsAggregate;
    // }
    // const ag = new PhysicsAggregate(spawn.rootNode, PhysicsShapeType.BOX, { extents: new Vector3(2, height, 2), mass: 3, restitution: 0, friction: 1 });
    // ag.body.setMassProperties({
    //   inertia: new Vector3(0, 0, 0)
    // });
    // spawn.physicsAggregate = ag;
    spawn.rootNode.scaling.z = Math.abs(spawn.rootNode.scaling.z) * -1;
  }

  /**
   * 
   * @param {BabylonSpawn} spawn 
   */
  disableSpawn(spawn) {
    spawn.rootNode.setEnabled(false);
    spawn.rootNode.scaling.z = Math.abs(spawn.rootNode.scaling.z);
  }

  interpolateSpawns() {
    if (this.loading) {
      return;
    }
    for (const spawn of this.interpolatingSpawns) {
      const { rootNode: mesh } = spawn;
      if (spawn.linearVelocity) {
        const normalizedDelta = this.engine.getDeltaTime();
        mesh.position.addInPlace(spawn.linearVelocity.multiplyByFloats(normalizedDelta, normalizedDelta, normalizedDelta));
      }
      
    }

  }

  netUpdateSpawn(update) {

    const { animation, spawn_id, heading, x, z } = update;
    const y = update.y + 1;
    const spawn = this.spawns[spawn_id];
    const rootNode = spawn?.rootNode;
    if (!rootNode) {
      return;
    }
    
    rootNode.intendedPosition = eqtoBabylonVector(x, y, z);
    rootNode.initialPosition = rootNode.position.clone();
    const nextPosition = eqtoBabylonVector(x, y, z);
    const realHeading = heading * 360 / 512;
    const nextRotation = new Vector3(Tools.ToRadians(0), Tools.ToRadians(realHeading * -1), Tools.ToRadians(0));
    const didRotate = heading !== spawn.lastHeading;
    let didMove = spawn.lastX !== x || spawn.lastY !== y || spawn.lastZ !== z;
    spawn.lastHeading = heading;
    spawn.lastX = x;
    spawn.lastY = y;
    spawn.lastZ = z;
    const thisTimestamp = performance.now();
    if (spawn.timestamp) {
      // Get per ms tick velocity
      const diff = thisTimestamp - spawn.timestamp;
      // console.log(`Update x y z - ${update.x} ${update.y} ${update.z} - diff ${diff}`);
      if (diff < 500) {
        didMove = false;
      }
      const linearVelocity = new Vector3(
        (nextPosition.x - rootNode.position.x) / diff, (nextPosition.y - rootNode.position.y) / diff, (nextPosition.z - rootNode.position.z) / diff);
      spawn.linearVelocity = linearVelocity;
    }
    spawn.timestamp = thisTimestamp;
    if (!spawn.physicsAggregate?.body) {
      return;
    }
    // this.crowd.agentGoto(spawn.agentIndex, nextPosition);
    if (didMove && !this.interpolatingSpawns.includes(spawn)) {
      this.interpolatingSpawns.push(spawn);
    } else if (!didMove) {
      // console.log('STOPPED!');
      this.interpolatingSpawns = this.interpolatingSpawns.filter(s => s !== spawn);
    }

    rootNode.previousPosition = nextPosition;
    const locomotionAnimMap = {
      0   : AnimationNames['Shuffle Feet'],
      27  : AnimationNames.Run,
      12  : AnimationNames.Walk,
      1012: AnimationNames.Walk,
      18  : AnimationNames.Walk
    };
    
    // console.log('Did rotate', didRotate);
    // console.log(`Spawn: ${spawn.spawn.displayedName} - Animation ${animation} - Mapped ${locomotionAnimMap[animation]}`);
    if (Vector3.Distance(this.CameraController.camera.globalPosition, rootNode.position) < 200) {
      if ((spawn.lastUpdate?.x === x && spawn.lastUpdate?.y === y && spawn.lastUpdate?.z === z) || (animation === 0 && !didRotate)) {
        spawn.swapLoopedAnimation(AnimationNames.Idle);
      } else {
        spawn.swapLoopedAnimation(locomotionAnimMap[animation]);
      }
    }

    rootNode.physicsBody.disablePreStep = false;
    rootNode.rotation = nextRotation;
    rootNode.position = nextPosition;
    // const oldThreePosition = new ThreeVector3(rootNode.absolutePosition.x, rootNode.absolutePosition.z, rootNode.absolutePosition.y);


    spawn.lastUpdate = update;

  }

  updateSpawns(position) {
    // const spawns = window.spawns = this.spawnOctree.intersects(new Vector3(position.x, position.y, position.z), 10, false);
    const threePosition = new ThreeVector3(position.x, position.z, position.y);

    for (const res of this.octree.findPoints(threePosition, this.spawnCullRange)) {
      for (const id of res.data) {
        const spawn = this.spawns[id];
        const isInCamera = cameraController.camera.isInFrustum(spawn.rootNode);
        if (spawn.rootNode.isEnabled()) {
          // console.log(`Disable spawn ${spawn.spawn.displayedName}`);
          // this.disableSpawn(spawn);
        } else if (!spawn.rootNode.isEnabled()) {
          // console.log(`Enable spawn ${spawn.spawn.displayedName}`);
          this.enableSpawn(spawn);
        }
    
        if (res.distance <= this.spawnAnimationRange && !spawn.animating && isInCamera) {
          spawn.swapLoopedAnimation(spawn.loopedAnimation);
        } else if (spawn.animating && (res.distance > this.spawnAnimationRange || !isInCamera)) {
          spawn.disableLoopedAnimation(true);
        }
      }
    }

    // this.animationCullCounter++;
    // if (this.animationCullCounter % 300 === 0) {
    //   this.animationCullCounter = 0;
      
    // }

    this.spawnCullCounter++;
    if (this.spawnCullCounter % 240 === 0) {
      this.spawnCullCounter = 0;
      for (const res of this.octree.findPoints(threePosition, Infinity)) {
        if (res.distance > (this.spawnCullRange)) {
          for (const id of res.data) {
            const spawn = this.spawns[id];
            if (spawn.rootNode.isEnabled()) {
              this.disableSpawn(spawn);
            }
          }
        }
      }
    }
    // if (window.spawnPerf === undefined) {
    //   window.spawnPerf = 0;
    // }
    // window.spawnPerf += performance.now() - perf;
  }
}

export const spawnController = new SpawnController();