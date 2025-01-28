import BABYLON from '@bjs';
import { cameraController } from './CameraController';
import { skyController } from './SkyController';
import { modelController } from './ModelController';
import { spawnController } from './SpawnController';
import { zoneController } from './ZoneController';
import { zoneBuilderController } from './ZoneBuilderController';

import { GlobalStore } from '../../state';
import { getEQFile } from '../../lib/util/fileHandler';

const { Engine, ThinEngine, WebGPUEngine, Database, SceneLoader, GLTFLoader } =
  BABYLON;

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

Database.IDBStorageEnabled = true;
SceneLoader.ShowLoadingScreen = false;

const params = new Proxy(new URLSearchParams(window.location.search), {
  get: (searchParams, prop) => searchParams.get(prop),
});

class EQDatabase extends Database {
  async loadImage(url, image, ..._rest) {
    if (url.startsWith('http')) {
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

  async open(success, _failure) {
    try {
      await success();
    } catch (e) {
      console.log('err in open', e);
    }
  }
  async loadFile(
    url,
    sceneLoaded,
    _progressCallBack,
    errorCallback,
    _useArrayBuffer
  ) {
    if (url.startsWith('blob')) {
      const res = await fetch(url)
        .then((a) => a.arrayBuffer())
        .catch(() => null);
      if (res) {
        await sceneLoaded(res);
      } else {
        errorCallback();
      }
      return;
    }
    const [, eq, folder, file] = url.split('/');
    if (eq === 'eq') {
      const fileBuffer =
        (await getEQFile(folder, file)) ||
        (await getEQFile('textures', `${url}.png`));
      if (!fileBuffer) {
        console.log('No bytes', url);
        errorCallback();
        return;
      }
      try {
        await sceneLoaded(fileBuffer);
      } catch (e) {
        console.warn(e);
      }
      return;
    }

    const fileBuffer = await getEQFile('textures', `${url}.png`);
    if (!fileBuffer) {
      console.log('No bytes for png', url);
      errorCallback();
      return;
    }
    await sceneLoaded(fileBuffer);

    // console.log('No bytes', url);
    // errorCallback();
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

  /** @type {Spire} */
  Spire = null;

  /**
   * @type {FileSystemDirectoryHandle}
   */
  rootFileSystemHandle = null;

  addToast(message) {
    console.log(message);
  }

  showUi = params.ui === 'true';
  dev = import.meta.env.VITE_DEV === 'true';

  CameraController = cameraController;
  SkyController = skyController;
  SpawnController = spawnController;
  ZoneController = zoneController;
  ModelController = modelController;
  ZoneBuilderController = zoneBuilderController;

  constructor() {
    this.CameraController.setGameController(this);
    this.SkyController.setGameController(this);
    this.SpawnController.setGameController(this);
    this.ZoneController.setGameController(this);
    this.ModelController.setGameController(this);
    this.ZoneBuilderController.setGameController(this);

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
    const origCreate = ThinEngine.prototype.createTexture;
    ThinEngine.prototype.createTexture = function (
      url,
      noMipmap,
      _invertY,
      scene,
      samplingMode,
      onLoad,
      onError,
      buffer,
      fallback,
      format,
      forcedExtension,
      mimeType,
      loaderOptions,
      creationFlags,
      useSRGBBuffer
    ) {
      const doFlip =
        zoneBuilderController.scene ||
        (!url.includes('eq/models') && !/\w+\d{4}/.test(url));
      return origCreate.call(
        this,
        url,
        noMipmap,
        doFlip,
        scene,
        samplingMode,
        onLoad,
        onError,
        buffer,
        fallback,
        format,
        forcedExtension,
        mimeType,
        loaderOptions,
        creationFlags,
        useSRGBBuffer
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
    const originalLoadImageAsync = GLTFLoader.prototype.loadImageAsync;
    GLTFLoader.prototype.loadImageAsync = async function (context, image) {
      if (zoneBuilderController?.scene) {
        try {
          const result = await originalLoadImageAsync.apply(this, arguments);
          return result;
        } catch (e) {
          console.warn('Error with image', image);
        }
      }
      if (!image._data) {
        const data = await getEQFile('textures', `${image.name}.png`);

        if (data) {
          image._data = data; // entry.data.buffer;
        } else {
          console.warn(`Unhandled image ${image.name}`);
          try {
          } catch {}
          // Solid gray 1px png until this is solved
          const pngData = new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
            0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
            0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
            0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63,
            0x68, 0x68, 0x68, 0x00, 0x00, 0x03, 0x04, 0x01, 0x81, 0x4b, 0xd3,
            0xd2, 0x10, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
            0x42, 0x60, 0x82,
          ]);

          image._data = pngData.buffer;
          // (await getEQFile('textures', 'citywal4.png')) ?? new ArrayBuffer();
        }
      }

      return image._data;
    };
  }

  get currentScene() {
    return (
      zoneController.scene ??
      modelController.scene ??
      zoneBuilderController.scene
    );
  }

  async loadEngine(canvas, webgpu = false) {
    if (this.engine) {
      this.engine.dispose();
    }
    if (this.currentScene) {
      this.currentScene.dispose();
    }
    this.ZoneController.dispose();
    this.ZoneBuilderController.dispose();
    this.#scene = null;
    this.canvas = canvas;
    if (navigator.gpu && webgpu) {
      this.engine = new WebGPUEngine(canvas);
      if (window.define) {
        window.define.amd = undefined;
      }
      await this.engine.initAsync();
      this.engineInitialized = true;
    } else {
      this.engine = new Engine(canvas); // await EngineFactory.CreateAsync(canvas);
      this.engineInitialized = true;
    }
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

  async keyDown(e) {
    switch (`${e?.key}`?.toLowerCase?.()) {
      case 'i': {
        if (!this.currentScene) {
          break;
        }
        let inspector; 
        await import('@babylonjs/inspector').then((i) => {
          inspector = i.Inspector;
        });
        if (inspector.IsVisible) {
          inspector.Hide();
        } else {
          inspector.Show(zoneController.scene, {
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
    if (this.currentScene) {
      this.currentScene.dispose();
    }
    this.ZoneController.dispose();
    this.aabbTree = null;
    this.ZoneController.dispose();
    this.CameraController.dispose();
    this.SkyController.dispose();
    this.SpawnController.dispose();
  }
}

export const gameController = new GameController();
window.gc = window.gameController = gameController;
