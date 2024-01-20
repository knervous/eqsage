import '@babylonjs/loaders/glTF';
import Dexie from 'dexie';
import { cameraController } from './CameraController';
import { lightController } from './LightController';
import { skyController } from './SkyController';
import { musicController } from './MusicController';
import { soundController } from './SoundController';
import { spawnController } from './SpawnController';
import { guiController } from './GUIController';
import { itemController } from './ItemController';
import { zoneController } from './ZoneController';
import { Engine, Scene, Database, SceneLoader, ThinEngine, Vector3, Color3 } from '@babylonjs/core';
  
import { Inspector } from '@babylonjs/inspector';
import { GlobalStore } from '../../state';
import { HemisphericLight } from 'babylonjs';
import { GLTFLoader } from '@babylonjs/loaders/glTF/2.0';
Database.IDBStorageEnabled = true;
SceneLoader.ShowLoadingScreen = false;


const dbVersion = 1;

const db = new Dexie('eq_textures');
db.version(dbVersion).stores({
  textureData: 'name,data',
});



const params = new Proxy(new URLSearchParams(window.location.search), {
  get: (searchParams, prop) => searchParams.get(prop),
});

class EQDatabase extends Database {
  loadImage(url, image) {
    console.log('Load image');

  }
  async loadFile(url, sceneLoaded, progressCallBack, errorCallback, useArrayBuffer) {
    console.log('Load file', url);
    if (window.bytes) {
      sceneLoaded(window.bytes);
    } else {
      errorCallback();
    }
  }

}

export class GameController {
  /** @type {Engine & WebGPUEngine} */
  engine = null;
  /** @type {Scene} */
  #scene = null;
  /** @type {HTMLCanvasElement} */
  canvas = null;

  loading = false;

  addToast(message) {
    console.log(message);
  }

  showUi = params.ui === 'true';
  dev = process.env.REACT_APP_DEV === 'true';


  CameraController = cameraController;
  LightController = lightController;
  SkyController = skyController;
  MusicController = musicController;
  SoundController = soundController;
  SpawnController = spawnController;
  GuiController = guiController;
  ItemController = itemController;
  ZoneController = zoneController;

  constructor() {
    this.CameraController.setGameController(this);
    this.LightController.setGameController(this);
    this.SkyController.setGameController(this);
    this.MusicController.setGameController(this);
    this.SoundController.setGameController(this);
    this.SpawnController.setGameController(this);
    this.GuiController.setGameController(this);
    this.ItemController.setGameController(this);
    this.ZoneController.setGameController(this);


    this.keyDown = this.keyDown.bind(this);
    this.resize = this.resize.bind(this);
    this.sceneMouseDown = this.sceneMouseDown.bind(this);
    this.sceneMouseUp = this.sceneMouseUp.bind(this);
    this.renderLoop = this.renderLoop.bind(this);


    const orig = ThinEngine._FileToolsLoadImage;
    ThinEngine._FileToolsLoadImage = function(buffer, onload, onInternalError, offlineProvider, mimeType, options) {
      return orig.call(undefined, buffer, onload, onInternalError, offlineProvider, mimeType, options);
    };

    // Override DB factory
    Engine.OfflineProviderFactory = (urlToScene, callbackManifestChecked, disableManifestCheck = false) => {
      return new EQDatabase(urlToScene, callbackManifestChecked, disableManifestCheck);
    };

    GLTFLoader.prototype.loadImageAsync = async function(context, image) {
      if (!image._data) {
        const entry = await db.textureData.get(image.name.split('_')[0].toLowerCase());
        if (entry?.data) {
          image._data = entry.data.buffer;
        } else {
          image._data = (await db.textureData.get('citywal4'))?.data?.buffer ?? new ArrayBuffer();
        }
        
      }

      return image._data;
    };
  }

  get currentScene() {
    return this.#scene;
  }

  async loadEngine(canvas) {
    if (this.engine) {
      this.engine.dispose();
    }
    this.canvas = canvas;
    this.engine = new Engine(canvas); // await EngineFactory.CreateAsync(canvas);
    this.engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
    this.engine.disableManifestCheck = true;
    this.engine.enableOfflineSupport = true;
    this.loading = false;
    this.engine.runRenderLoop(this.renderLoop);

  }

  resize() {
    this.engine?.resize();
  }

  setLoading(val) {
    this.loading = val;
    GlobalStore.actions.setLoading(val);
  }

  get exploreMode () {
    return GlobalStore.getState().exploreMode;
  }

  get state() {
    return GlobalStore.getState();
  }

  get actions() {
    return GlobalStore.actions;
  }

  /**
   * 
   * @param {string} zoneName 
   * @param {boolean} loadSpawns 
   * @param {import('@babylonjs/core').Vector3} location
   * @returns 
   */
  async loadZoneScene (zoneName, loadSpawns, location) {
    this.setLoading(true);
    this.dispose();
    this.#scene = null;
    if (!this.engine || !this.canvas) {
      return;
    }
    this.#scene = new Scene(this.engine);
    await this.ZoneController.loadZoneScene(this.#scene, zoneName, location);
    if (process.env.REACT_APP_INSPECTOR === 'true') {
      Inspector.Show(this.#scene, { embedMode: true, overlay: true });
    }

    if (this.exploreMode) {
      this.setLoading(false);
    }

    this.#scene.onPointerDown = this.sceneMouseDown;
    this.#scene.onPointerUp = this.sceneMouseUp;
  }

  renderLoop() {
    if (this.#scene && this.#scene?.activeCamera && !this.loading) {
      try {
        this.#scene.render();
      } catch (e) {
        console.warn(e);
      }
      
    }
  }

  loadViewerScene() {
    this.dispose();
    this.#scene = null;
    if (!this.engine || !this.canvas) {
      return;
    }
    this.#scene = new Scene(this.engine);
    this.#scene.onPointerDown = this.sceneMouseDown;
    this.#scene.onPointerUp = this.sceneMouseUp;
    cameraController.createCamera(new Vector3(0, 0, 0));
    
    this.ambientLight = new HemisphericLight('__ambient_light__', new Vector3(0, -0, 0), this.#scene);


    // Default intensity is 1. Let's dim the light a small amount
    this.ambientLight.intensity = 1.5;

    // This will be part of time of day
    // this.ambientLight.diffuse = Color3.FromHexString('#FF792F');
    // this.ambientLight.groundColor = Color3.FromHexString('#E69339');
  }

  async loadModel() {
    this.loadViewerScene();
    const texture = await SceneLoader.ImportMeshAsync(
      '',
      '/eq/',
      'test',
      this.#scene,
      undefined,
      '.glb'
    );
  }

  keyDown(e) {
    switch (`${e.key}`?.toLowerCase?.()) {
      case 'i': {
        if (!this.#scene) {
          break;
        }
        if (Inspector.IsVisible) {
          Inspector.Hide();
        } else {
          Inspector.Show(gameController.scene, { embedMode: true, overlay: true });
        }
        break;
      }
      case 'g': {
        this.addToast(`Gravity ${gameController.CameraController.camera.applyGravity ? 'disabled' : 'enabled'}`, {});
        gameController.CameraController.camera.applyGravity = !gameController.CameraController.camera.applyGravity;
        break;
      }
      case 'c': {
        this.addToast(`Collision ${gameController.CameraController.camera.checkCollisions ? 'disabled' : 'enabled'}`, {});
        zoneController.CameraController.camera.checkCollisions = !gameController.CameraController.camera.checkCollisions;
        break;
      }
      case 'u': {
        this.showUi = !this.showUi;
        GlobalStore.actions.setZoneInfo({ ...GlobalStore.getState().zoneInfo });
        break;
      }
      case 'b': {
        Object.values(gameController.SpawnController.spawns).forEach(spawn => {
          spawn.rootNode.showBoundingBox = !spawn.rootNode.showBoundingBox; 
          spawn.rootNode.getChildMeshes().forEach(m => m.showBoundingBox = !m.showBoundingBox);
        });
        break;
      }
      case 'f': {
        this.#scene.meshes.forEach(m => {
          if (m.material) {
            m.material.wireframe = !m.material.wireframe;
          }
          
        });
        break;
      }
      case 'l': {
        const { x, y, z } = gameController.CameraController.camera.globalPosition;
        sessionStorage.setItem('cam-loc', JSON.stringify({
          x, y, z
        }));
        this.addToast(`Storing cam lock at x: ${x}, y: ${y}, z: ${z}`, {});

        break;
      }
      default:
        break;
    }
  }

  sceneMouseDown(e) {
    this.SpawnController.sceneMouseDown(e);
    this.CameraController.sceneMouseDown(e);
  }

  sceneMouseUp(e) {
    this.CameraController.sceneMouseUp(e);
  }

  dispose() {
    this.ZoneController.dispose();
    this.CameraController.dispose();
    this.LightController.dispose();
    this.SkyController.dispose();
    this.MusicController.dispose();
    this.SoundController.dispose();
    this.SpawnController.dispose();
    this.ItemController.dispose();
  }

}

export const gameController = new GameController();
window.gameController = gameController;