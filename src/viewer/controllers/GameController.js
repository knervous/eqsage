import '@babylonjs/loaders/glTF';

import { cameraController } from './CameraController';
import { lightController } from './LightController';
import { skyController } from './SkyController';
import { musicController } from './MusicController';
import { soundController } from './SoundController';
import { spawnController } from './SpawnController';
import { guiController } from './GUIController';
import { itemController } from './ItemController';
import { zoneController } from './ZoneController';
import {
  Engine,
  Database,
  SceneLoader,
  ThinEngine,
} from '@babylonjs/core';

import { Inspector } from '@babylonjs/inspector';
import { GlobalStore } from '../../state';
import { GLTFLoader } from '@babylonjs/loaders/glTF/2.0';
import { getEQFile } from '../../lib/util/fileHandler';
Database.IDBStorageEnabled = true;
SceneLoader.ShowLoadingScreen = false;

const params = new Proxy(new URLSearchParams(window.location.search), {
  get: (searchParams, prop) => searchParams.get(prop),
});

class EQDatabase extends Database {
  async loadImage(url, image) {
    if (url.startsWith('https://')) {
      console.log('spec');
      const res = await fetch(url).then((a) => a.arrayBuffer());
      image.src = URL.createObjectURL(
        new Blob([res], { type: 'image/png' } /* (1) */)
      );
      return;
    }
    const data = await getEQFile('textures', `${url}.png`);
    image.src = URL.createObjectURL(
      new Blob([data], { type: 'image/png' } /* (1) */)
    );
  }
  async loadFile(
    url,
    sceneLoaded,
    _progressCallBack,
    errorCallback,
    _useArrayBuffer
  ) {
    const [, eq, folder, file] = url.split('/');
    if (eq === 'eq') {
      const fileBuffer = await getEQFile(folder, file);
      if (!fileBuffer) {
        console.log('No bytes', url);
        errorCallback();
        return;
      }
      await sceneLoaded(fileBuffer);
      return;
    }
    console.log('No bytes', url);
    errorCallback();
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

  /**
   * @type {FileSystemDirectoryHandle}
   */
  rootFileSystemHandle = null;

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
    ThinEngine._FileToolsLoadImage = function (
      buffer,
      onload,
      onInternalError,
      offlineProvider,
      mimeType,
      options
    ) {
      return orig.call(
        undefined,
        buffer,
        onload,
        onInternalError,
        offlineProvider,
        mimeType,
        options
      );
    };

    // Override DB factory
    Engine.OfflineProviderFactory = (
      urlToScene,
      callbackManifestChecked,
      disableManifestCheck = false
    ) => {
      return new EQDatabase(
        urlToScene,
        callbackManifestChecked,
        disableManifestCheck
      );
    };

    GLTFLoader.prototype.loadImageAsync = async function (context, image) {
      if (!image._data) {
        const data = await getEQFile('textures', `${image.name}.png`);

        if (data) {
          image._data = data; // entry.data.buffer;
        } else {
          console.warn(`Unhandled image ${image.name}`);
          // Solid gray 1px png until this is solved
          const pngData = new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x68, 0x68, 0x68, 0x00,
            0x00, 0x03, 0x04, 0x01, 0x81, 0x4b, 0xd3, 0xd2, 0x10, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
            0x44, 0xae, 0x42, 0x60, 0x82
          ]);
          
          image._data = pngData.buffer;
          // (await getEQFile('textures', 'citywal4.png')) ?? new ArrayBuffer();
        }
      }

      return image._data;
    };
  }

  get currentScene() {
    return zoneController.scene;
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

  get exploreMode() {
    return GlobalStore.getState().exploreMode;
  }

  get state() {
    return GlobalStore.getState();
  }

  get actions() {
    return GlobalStore.actions;
  }

  renderLoop() {
    if (this.currentScene && this.currentScene?.activeCamera && !this.loading) {
      try {
        this.currentScene.render();
      } catch (e) {
        console.warn(e);
      }
    }
  }


  keyDown(e) {
    switch (`${e.key}`?.toLowerCase?.()) {
      case 'i': {
        if (!zoneController.scene) {
          break;
        }
        if (Inspector.IsVisible) {
          Inspector.Hide();
        } else {
          Inspector.Show(zoneController.scene, {
            embedMode: true,
            overlay  : true,
          });
        }
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
    if (zoneController.scene) {
      zoneController.scene.dispose();
    }
    this.aabbTree = null;
    this.ZoneController.dispose();
    this.CameraController.dispose();
    this.LightController.dispose();
    this.SkyController.dispose();
    this.MusicController.dispose();
    this.SoundController.dispose();
    this.SpawnController.dispose();
    this.ItemController.dispose();
  }

  /**
   * @typedef Spire
   * @property {import ('../../../../spire/frontend/src/app/api/spire-api')} SpireApi
   * @property {import ('../../../../spire/frontend/src/app/api')} SpireApiTypes
   * @property {import ('../../../../spire/frontend/src/app/api/spire-query-builder').SpireQueryBuilder} SpireQueryBuilder
   * @property {import ('../../../../spire/frontend/src/app/zones').Zones} Zones
   * @property {import ('../../../../spire/frontend/src/app/spawn').Spawn} Spawn
   * @property {import ('../../../../spire/frontend/src/app/grid').Grid} Grid
   * @property {import ('../../../../spire/frontend/src/app/npcs').Npcs} Npcs
   */

  /**
   * @type {Spire | null}
   */
  get Spire() {
    return window.Spire;
  }
}

export const gameController = new GameController();
window.gameController = gameController;
