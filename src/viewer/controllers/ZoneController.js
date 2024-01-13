
import { SceneLoader, Vector3,
  SceneOptimizer, SceneOptimizerOptions, SceneSerializer,
  Tools, Texture, HavokPlugin, PhysicsAggregate, PhysicsShapeType } from '@babylonjs/core';
import HavokPhysics from '@babylonjs/havok';
import { Vector3 as ThreeVector3 } from 'three';
import { PointOctree } from 'sparse-octree';
import zoneInfo from '../common/zoneData.json';
import { getDataEntry, setDataEntry } from '../services/idb';
import { textureAnimationMap } from '../helpers/textureAnimationMap';
import { GameControllerChild } from './GameControllerChild';
import { eqtoBabylonVector } from '../util/vector';
import supportedZones from '../common/supportedZones.json';

const sceneVersion = 1;
const storageUrl = 'https://eqrequiem.blob.core.windows.net/assets/zones/';
const objectsUrl = 'https://eqrequiem.blob.core.windows.net/assets/objects/';
const textureUrl = 'https://eqrequiem.blob.core.windows.net/assets/textures/';

async function getInitializedHavok() {
  return await HavokPhysics();
}
  
const testNode = (node, point) => {
  if (!node?.min || !node?.max) {
    return false;
  }
  const { min, max } = node;
  return point.x >= min.x &&
      point.y >= min.z &&
      point.z >= min.y &&
      point.x <= max.x &&
      point.y <= max.z &&
      point.z <= max.y;
};

const recurseNodeForRegion = (node, position) => {
  if (testNode(node, position)) {
    if (testNode(node.left, position)) {
      return recurseNodeForRegion(node.left, position);
    } else if (testNode(node.right, position)) {
      return recurseNodeForRegion(node.right, position);
    }
    return node;
  }
  return null;
};

const recurseTreeFromKnownNode = (node, position) => {
  while (node && !testNode(node, position)) {
    node = node.parent;
  }
  return recurseNodeForRegion(node, position);
};

  
class ZoneController extends GameControllerChild {
  /**
 * @type {import('@babylonjs/core/scene').Scene}
 */
  scene = null;
  hadStoredScene = false;
  zoneLoaded = false;
  zoneName = '';
  zoneMetadata = {};
  aabbTree = {};
  animatedMeshes = [];
  animationGroupMap = {};
  collideCounter = 0;
  objectAnimationPlaying = [];
  lastPosition = new Vector3(0, 0, 0);
  lastAabbNode = null;
  animationRange = 200;
  objectCullRange = 2000;
  /** @type {RecastJSPlugin} */
  navigationPlugin = null;

  dispose() {
    if (this.scene) {
      this.scene.onBeforeRenderObservable.remove(this.renderHook.bind(this));
      this.scene.onBeforeRenderObservable.remove(this.renderCharacterSelectHook.bind(this));
      this.scene.dispose();
    }
    this.scene = null;
    this.hadStoredScene = false;
    this.zoneLoaded = false;
    this.zoneName = '';
    this.zoneMetadata = {};
    this.aabbTree = {};
    this.animatedMeshes = [];
    this.animationGroupMap = {};
    this.collideCounter = 0;
    this.objectAnimationPlaying = [];
    this.lastPosition = new Vector3(0, 0, 0);
    this.lastAabbNode = null;

    this.zoneLoaded = false;
  }

  /**
   * 
   * @param {string} zoneName 
   * @param {boolean} loadSpawns 
   * @param {import('@babylonjs/core').Vector3} location
   * @returns 
   */
  async loadZoneScene (scene, zoneName, location) {
    this.actions.setLoadingText(`Loading ${zoneInfo.find(z => z.shortName === zoneName)?.longName}`);
    this.dispose();
    this.scene = scene;
    this.zoneName = zoneName;
    this.scene.metadata = { version: sceneVersion };
    this.scene.collisionsEnabled = true;
    this.zoneInfo = this.state.zoneInfo;
    this.CameraController.createCamera(location);
   
    // Load serialized scene in IDB
    let storedScene = await getDataEntry(zoneName);
    if (storedScene) {
      if (storedScene.data.metadata?.version === sceneVersion) {
        const { animatedMeshes } = storedScene.data.metadata;
        delete storedScene.data.metadata;
        scene.metadata.animatedMeshes = animatedMeshes;
        await SceneLoader.AppendAsync('', `data:${JSON.stringify(storedScene.data)}`, scene);
        this.hadStoredScene = true;
      } else {
        storedScene = null;
      }
    }

    this.scene.gravity = new Vector3(0, -0.6, 0);

    if (!(await this.loadPhysicsEngine())) {
      console.error('Could not load physics engine');
      return;
    }

    // Zone texture
    await this.loadZoneTexture();
    this.actions.setLoadingText('Loading zone metadata');

    this.zoneMetadata = await fetch(`${storageUrl}${zoneName}.json`).then(r => r.json());

    this.actions.setLoadingText('Loading animated objects');

    // Objects
    if (!this.hadStoredScene) {
      this.animatedMeshes = (await Promise.all(Object.entries(this.zoneMetadata.objects).filter(([, val]) => val?.[0]?.animated).map(([key, val]) => this.instantiateObjects(key, val)))).flat();
    } else {
      for (const [key, val] of Object.entries(this.zoneMetadata.objects).filter(([key]) =>
        this.scene.metadata.animatedMeshes.includes(key))) {
        this.animatedMeshes = this.animatedMeshes.concat(await this.instantiateObjects(key, val));
      }
    }

    // Set up aabb tree
    await this.setupAabbTree();

    // Music
    this.actions.setLoadingText('Loading audio');
    this.MusicController.hookUpZoneMusic(scene, this.zoneName, this.zoneMetadata.music, this.aabbTree);

    // Sound
    this.SoundController.hookUpZoneSounds(scene, this.zoneMetadata.sound2d, this.zoneMetadata.sound3d);

    scene.audioListenerPositionProvider = () => this.CameraController.camera.globalPosition;

    // Lights
    this.actions.setLoadingText('Loading lights');
    this.LightController.loadLights(scene, this.zoneMetadata.lights, this.hadStoredScene, this.aabbTree);

    // Sky 
    if (this.zoneInfo.sky > 0) {
      this.actions.setLoadingText('Loading sky');
      await this.SkyController.loadSky(scene, this.zoneInfo.sky, this.hadStoredScene);
    }
    
    // Spawn controller
    this.SpawnController.setupSpawnController(this.aabbTree);

    // Item Controller
    this.ItemController.setupItemController(scene);

    // Start zone hook
    this.collideCounter = 0;
    this.lastPosition = { ...this.CameraController.camera.position };

    this.scene.onBeforeRenderObservable.add(this.renderHook.bind(this));

    // Optimize
    SceneOptimizer.OptimizeAsync(scene, SceneOptimizerOptions.ModerateDegradationAllowed());

    // Start texture animations
    this.actions.setLoadingText('Adding texture animations');
    await this.addTextureAnimations();

    // Serialize in background
    this.serializeScene();
    this.counter = 0;

    this.octree = new PointOctree(new ThreeVector3(this.aabbTree.min.x, this.aabbTree.min.z, this.aabbTree.min.y), 
      new ThreeVector3(this.aabbTree.max.x, this.aabbTree.max.z, this.aabbTree.max.y));

    this.scene.getMeshByName('__zone__').getChildMeshes().concat(this.animatedMeshes).forEach((mesh) => {
      if (mesh.parent?.metadata?.gltf?.extras?.zoneMesh || mesh.parent?.parent?.metadata?.gltf?.extras?.zoneMesh) {
        return;
      }
      mesh.addLODLevel?.(this.objectCullRange, null);
      
    });

    this.animatedMeshes.forEach(mesh => {
      const { x, y, z } = mesh.absolutePosition || mesh.position;
      const vec = new ThreeVector3(x, y, z);
      if (this.octree.get(vec)) {
        this.octree.set(vec, [...this.octree.get(vec), mesh]);
      } else {
        this.octree.set(vec, [mesh]);
      }
    });
   
    this.counter = 0;
    this.cullCounter = 0;
    window.perf = 0;
    this.zoneLoaded = true;
  }

  /**
   * 
   * @param {import('@babylonjs/core').Scene} scene 
   * @returns 
   */
  async loadCharacterSelect(scene) {
    this.actions.setLoadingText('Entering Character Selection');
    this.dispose();
    this.scene = scene;
    this.zoneName = 'load';
    this.scene.metadata = { version: sceneVersion };
    this.scene.collisionsEnabled = true;
    this.zoneInfo = this.state.zoneInfo;
    this.CameraController.createCamera(new Vector3());
   
    // Load serialized scene in IDB
    let storedScene = await getDataEntry(this.zoneName);
    if (storedScene) {
      if (storedScene.data.metadata?.version === sceneVersion) {
        const { animatedMeshes } = storedScene.data.metadata;
        delete storedScene.data.metadata;
        scene.metadata.animatedMeshes = animatedMeshes;
        await SceneLoader.AppendAsync('', `data:${JSON.stringify(storedScene.data)}`, scene);
        this.hadStoredScene = true;
      } else {
        storedScene = null;
      }
    }

    this.scene.gravity = new Vector3(0, 0, 0);

    if (!(await this.loadPhysicsEngine())) {
      console.error('Could not load physics engine');
      return;
    }

    // Zone texture
    await this.loadZoneTexture();

    this.zoneMetadata = await fetch(`${storageUrl}${this.zoneName}.json`).then(r => r.json());

    // Objects
    if (!this.hadStoredScene) {
      this.animatedMeshes = (await Promise.all(Object.entries(this.zoneMetadata.objects).filter(([, val]) => val?.[0]?.animated).map(([key, val]) => this.instantiateObjects(key, val)))).flat();
    } else {
      for (const [key, val] of Object.entries(this.zoneMetadata.objects).filter(([key]) =>
        this.scene.metadata.animatedMeshes.includes(key))) {
        this.animatedMeshes = this.animatedMeshes.concat(await this.instantiateObjects(key, val));
      }
    }

    // Set up aabb tree
    await this.setupAabbTree();

    // Music
    this.actions.setLoadingText('Loading audio');
    this.MusicController.hookUpZoneMusic(scene, this.zoneName, this.zoneMetadata.music, this.aabbTree);

    // Sound
    this.SoundController.hookUpZoneSounds(scene, this.zoneMetadata.sound2d, this.zoneMetadata.sound3d);

    scene.audioListenerPositionProvider = () => this.CameraController.camera.globalPosition;

    // Lights
    this.actions.setLoadingText('Loading lights');
    this.LightController.loadLights(scene, this.zoneMetadata.lights, this.hadStoredScene, this.aabbTree);

    this.LightController.setIntensity(1.75);
    this.LightController.setAmbientColor('#FFFFFF');
    // Sky 
    this.actions.setLoadingText('Loading sky');
    await this.SkyController.loadStaticSky(scene, 1, this.hadStoredScene);

    // Spawn controller
    this.SpawnController.setupSpawnController(this.aabbTree);

    // Item Controller
    this.ItemController.setupItemController(scene);

    // Start zone hook
    this.collideCounter = 0;
    this.counter = 0;
    this.lastPosition = { ...this.CameraController.camera.position };

    this.scene.onBeforeRenderObservable.add(this.renderCharacterSelectHook.bind(this));
    
    this.octree = new PointOctree(new ThreeVector3(this.aabbTree.min.x, this.aabbTree.min.z, this.aabbTree.min.y), 
      new ThreeVector3(this.aabbTree.max.x, this.aabbTree.max.z, this.aabbTree.max.y));

    // Optimize
    SceneOptimizer.OptimizeAsync(scene, SceneOptimizerOptions.ModerateDegradationAllowed());

    // Start texture animations
    await this.addTextureAnimations();

    // Serialize in background
    this.serializeScene();

    this.zoneLoaded = true;
  }

  renderCharacterSelectHook() {
    this.LightController.updateLights(this.CameraController.camera.globalPosition);
  }

  renderHook() {
    if (this.CameraController.camera.globalPosition.equals(this.lastCameraPosition) && this.CameraController.camera.rotation.equals(this.lastCameraRotation)) {
      return;
    }
    this.lastCameraPosition = { ...this.CameraController.camera.globalPosition };
    this.lastCameraRotation = { ...this.CameraController.camera.rotation };
    this.counter++;
    this.cullCounter++;
    let perf = performance.now();
    const threePosition = new ThreeVector3(this.lastCameraPosition._x, this.lastCameraPosition._y, this.lastCameraPosition._z);

    if (this.cullCounter % 120 === 0) {
      this.cullCounter = 0;
      for (const res of this.octree.findPoints(threePosition, Infinity)) {
        if (res.distance > this.animationRange) {
          for (const mesh of res.data) {
            if (this.animationGroupMap[mesh.id]) {
              this.animationGroupMap[mesh.id].forEach(ag => {
                if (this.objectAnimationPlaying.includes(ag)) {
                  this.objectAnimationPlaying = this.objectAnimationPlaying.filter(o => o !== ag);
                  ag.stop();
                }
              });
            }
          }
        }
      }
    }
    if (this.counter % 5 === 0) {
      this.counter = 0;
      for (const res of this.octree.findPoints(threePosition, this.objectCullRange)) {
        for (const mesh of res.data) {
          if (this.CameraController.camera.isInFrustum(mesh) && !mesh.isEnabled()) {
            mesh.setEnabled(true);
          } else if (!this.CameraController.camera.isInFrustum(mesh) && mesh.isEnabled()) {
            mesh.setEnabled(false);
          }
          if (mesh.isAnimated) {

            const animationGroups = this.animationGroupMap[mesh.id];
            if ((!this.CameraController.camera.isInFrustum(mesh)) && mesh.animating) {
              const animatables = animationGroups.map(ag => ag.animatables).flat();
              const startIdx = this.scene._activeAnimatables.findIndex(ag => animatables[0] === ag);
              if (startIdx > -1) {
                this.scene._activeAnimatables.splice(startIdx, animatables.length);
              }
              mesh.animating = false;
            } else if (this.CameraController.camera.isInFrustum(mesh) 
              && !mesh.animating
              && res.distance <= this.animationRange) {
              this.scene._activeAnimatables.push(...animationGroups.map(ag => ag.animatables).flat());
              animationGroups[0]?.play(true);
              mesh.animating = true;
            }
          }
        }
      }
      // this.leafNodes = this.leafNodes.sort((a, b) => 
      //   Vector3.Distance(new Vector3(a.min.x, a.min.y, a.min.z), this.CameraController.camera.globalPosition) -  
      // Vector3.Distance(new Vector3(b.min.x, b.min.y, b.min.z), this.CameraController.camera.globalPosition)
      // );
    }

    // TODO this will be backup logic for eqg zones that do not have a BSP and generated aabb node tree
    // So will use a format like zone bounds min max and leafNodes[] like we're transforming here in the setupAabbTree function
    // if (window.lnPerf === undefined) {
    //   window.lnPerf = 0;
    // }
    // const lnPerf = performance.now();
    // let count = 0;
    // for (const leafNode of this.leafNodes) {
    //   count++;
    //   window.lnCount = count;
    //   if (testNode(leafNode, threePosition)) {
    //     // const aabbRegion = res.data;
    //     // if (aabbRegion.regions?.includes(4)) {
    //     //   console.log(`Hit zoneline or teleporter!
    //     //                         ${JSON.stringify({ zone: aabbRegion.zone }, null, 4)}`);
    //     // } else if (aabbRegion.regions?.includes(1)) {
    //     //   console.log('Hit water!');
    //     // } else if (aabbRegion.regions.includes(3)) {
    //     //   console.log('Hit pvp zone');
    //     // }
    //     // break;
    //     break;
    //   }
    // }
    // window.lnPerf += performance.now() - lnPerf;

    window.perf += performance.now() - perf;
    const aabbPerf = performance.now();
    if (window.aabbPerf === undefined) {
      window.aabbPerf = 0;
    }
    const aabbRegion = recurseTreeFromKnownNode(this.lastAabbNode || this.aabbTree, this.CameraController.camera.globalPosition);
    window.aabbPerf += performance.now() - aabbPerf;
    if (aabbRegion) {
      this.lastAabbNode = aabbRegion;
      if (aabbRegion.regions?.includes?.(4)) {
        console.log(`Hit zoneline or teleporter!
                                ${JSON.stringify({ zone: aabbRegion.zone }, null, 4)}`);
        const zone = aabbRegion.zone;
       
        if (this.exploreMode) {
          const newZone = {
            x        : -1,
            y        : -1,
            z        : -1,
            zoneIndex: -1
          };
          switch (zone.type) {
            // Reference
            case 0:
              const refZone = this.state.zoneInfo.zonePoints[zone.index];
              newZone.x = refZone.target_y;
              newZone.y = refZone.target_x;
              newZone.z = refZone.target_z;
              newZone.zoneIndex = refZone.target_zone_id;
              break;
            // Absolute
            case 1:
              newZone.x = zone.position.x;
              newZone.y = zone.position.y;
              newZone.z = zone.position.z;
              newZone.zoneIndex = zone.zoneIndex;
              break;

            default:
              break;
          }
          if (newZone.zoneIndex > -1) {
            const magicNumber = 999999;
            // Teleport within zone
            const newLoc = eqtoBabylonVector(newZone.y, newZone.x, newZone.z);
            // newLoc.x *= -1;
            if (newLoc.x === magicNumber) {
              newLoc.x = this.CameraController.camera.globalPosition.x;
            }
            if (newLoc.y === magicNumber) {
              newLoc.y = this.CameraController.camera.globalPosition.y;
            }
            if (newLoc.z === magicNumber) {
              newLoc.z = this.CameraController.camera.globalPosition.z;
            }
            
            if (newZone.zoneIndex === this.state.zoneInfo.zone) {

            } else { // Zone to another zone
              const z = supportedZones[newZone.zoneIndex];
              this.setLoading(true);
              this.actions.setZoneInfo({ ...z, zone: newZone.zoneIndex });
              this.zone(z.shortName, newLoc);
              return;
            }
          }
        }
      } else if (aabbRegion.regions?.includes(1)) {
        console.log('Hit water!');
      } else if (aabbRegion.regions.includes(3)) {
        console.log('Hit pvp zone');
      }
    }
    if (window.lightPerf === undefined) {
      window.lightPerf = 0;
    }
    if (window.musicPerf === undefined) {
      window.musicPerf = 0;
    }
    if (window.spawnPerf === undefined) {
      window.spawnPerf = 0;
    }
    perf = performance.now();
    this.LightController.updateLights(this.CameraController.camera.globalPosition);
    window.lightPerf += performance.now() - perf;
    perf = performance.now();
    this.MusicController.updateMusic(this.CameraController.camera.globalPosition);
    window.musicPerf += performance.now() - perf;
    perf = performance.now();
    this.SpawnController.updateSpawns(this.CameraController.camera.globalPosition);
    window.spawnPerf += performance.now() - perf;
  }

  async addTextureAnimations() {
    const addTextureAnimation = (material, textureAnimation) => {
      const [baseTexture] = material.getActiveTextures();
      return Array.from({ length: textureAnimation.frames }, (_, idx) => {
        const id = material.id.replace(/d_/, '');
        const newName = `${id.slice(0, id.length - 1)}${idx + 1}`;
        const url = `${textureUrl}${newName}.png`;
        return new Texture(
          url,
          this.scene,
          baseTexture.noMipMap,
          baseTexture.invertY,
          baseTexture.samplingMode,
        );
      });
    };

    let animationTimerMap = {};
    const animationTexturesCache = {};

    for (const material of this.scene.materials) {
      const textureAnimation = textureAnimationMap[material.id];
      if (textureAnimation) {
        let allTextures;
        if (animationTexturesCache[material.id]) {
          allTextures = animationTexturesCache[material.id];
        } else {
          allTextures = await addTextureAnimation(material, textureAnimation);
          animationTexturesCache[material.id] = allTextures;
        }
        animationTimerMap = {
          ...animationTimerMap,
          [textureAnimation.time]: {
            ...(animationTimerMap[textureAnimation.time] ?? {}),
            materials: [
              ...(animationTimerMap[textureAnimation.time]?.materials ?? []),
              {
                frames      : textureAnimation.frames,
                currentFrame: 1,
                allTextures,
                material
              }
            ]
          }
        };
      }
    }


    for (const [time, value] of Object.entries(animationTimerMap)) {
      const interval = setInterval(() => {
        for (const material of value.materials) {
          material.currentFrame = material.currentFrame + 1 > material.frames ? 1 : material.currentFrame + 1;
          for (const texture of material.material.getActiveTextures()) {
            if (material.allTextures[material.currentFrame - 1]) {
              texture._texture = material.allTextures[material.currentFrame - 1]._texture;
            }
          }
        }
      }, +time);

      for (const material of value.materials) {
        material.material.onDisposeObservable.add(() => {
          clearInterval(interval);
        });
      }
    }

  }

  async serializeScene() {
    if (!this.hadStoredScene) {
      const serializedScene = await SceneSerializer.SerializeAsync(this.scene);
      serializedScene.cameras = [];
      serializedScene.animationGroups = [];
      serializedScene.skeletons = [];
      const [nonAnimated, animated] = serializedScene.meshes.reduce((acc, val) => {
        if (val?.metadata?.animated) {
          acc[1].push(val);
        } else {
          acc[0].push(val);
        }
        return acc;
      }, [[], []]);
      serializedScene.meshes = nonAnimated;
      serializedScene.metadata.animatedMeshes = Array.from(new Set(animated.map(a => a.name.split('_')[0])));
      setDataEntry(this.zoneName, serializedScene);
    }
  }

  async loadZoneTexture () {
    let zoneRoot;
    if (!this.hadStoredScene) {
      const texture = await SceneLoader.ImportMeshAsync(
        '',
        storageUrl,
          `${this.zoneName}.glb.gz`,
          this.scene,
          undefined,
          '.glb'
      );
      zoneRoot = texture.meshes[0];
    } else {
      zoneRoot = this.scene.getMeshByName('__zone__');
    }

    zoneRoot.name = '__zone__';
    for (const mesh of zoneRoot.getChildMeshes()) {
      mesh.checkCollisions = true;
      if (mesh.parent?.metadata?.gltf?.extras?.zoneMesh || mesh.parent?.parent?.metadata?.gltf?.extras?.zoneMesh) {
        new PhysicsAggregate(mesh, PhysicsShapeType.MESH, { mass: 0, restitution: 0, friction: 1 });
      }
      mesh.freezeWorldMatrix();
      mesh.isPickable = false;
      mesh.doNotSyncBoundingInfo = true;
      mesh.scaling.z = 1;
    }

    const recurse = (node) => {
      const matOutliers = ['t75_rea1', 't50_w1', 'd_w1'];
      if (matOutliers.includes(node.material?.name)) {
        node.checkCollisions = false;
      }
      if (node._children) {
        node._children.forEach(recurse, node.checkCollisions);
      }
    };
    recurse(zoneRoot);
    return zoneRoot;
  }

  async loadPhysicsEngine() {
    const HK = await getInitializedHavok();
    const havokPlugin = window.hp = new HavokPlugin(true, HK);
    const didEnable = this.scene.enablePhysics(new Vector3(0, -4.3, 0), havokPlugin);
    this.scene._physicsEngine.setGravity(new Vector3(0, -9.5, 0));
    return didEnable;
  }

  async instantiateObjects (modelName, model) {
    const animatedMeshes = [];
    const container = await SceneLoader.LoadAssetContainerAsync(objectsUrl, `${modelName}.glb.gz`, this.scene, undefined, '.glb');
    for (const [idx, v] of Object.entries(model)) {
      const [x, y, z] = v.pos;
      const [rotX, rotY, rotZ] = v.rot;
      const instanceContainer = container.instantiateModelsToScene(() => `${modelName}_${idx}`, undefined, { doNotInstantiate: true });
      instanceContainer.animationGroups?.forEach(ag => this.scene.removeAnimationGroup(ag));

      const hasAnimations = instanceContainer.animationGroups.length > 0;

      for (const mesh of instanceContainer.rootNodes[0].getChildMeshes()) {
        mesh.position = new Vector3(-1 * x, y, z);
        mesh.rotation = new Vector3(Tools.ToRadians(rotX), Tools.ToRadians(180) + Tools.ToRadians(-1 * rotY), Tools.ToRadians(rotZ));
        mesh.checkCollisions = true;
        mesh.scaling.z = 1;
        mesh.metadata = {
          animated  : hasAnimations,
          zoneObject: true,
        };
        mesh.id = `${modelName}_${idx}`;
        this.animationGroupMap[mesh.id] = instanceContainer.animationGroups;
        if (!hasAnimations) {
          mesh.freezeWorldMatrix();
        }
        mesh.isAnimated = true;
        mesh.isAnimating = false;
        animatedMeshes.push(mesh);
      }
    }

    return animatedMeshes;
  }

  async setupAabbTree() {
    const aabb = await fetch(`${storageUrl}${this.zoneName}_aabb_tree.json`).then(a => a.json()).catch(() => ({}));
    const leafNodes = [];
    const addParents = node => {
      if (node.left) {
        node.left.parent = node;
        addParents(node.left);
      }
      if (node.right) {
        node.right.parent = node;
        addParents(node.right);
      }
      if (!node.right && !node.left && node.regions?.length) {
        leafNodes.push(node);
      }
    };
    this.leafNodes = leafNodes;
    addParents(aabb);
    this.aabbTree = aabb;
  }
}

export const zoneController = new ZoneController();
window.zone = zoneController;