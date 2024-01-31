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
  Scene,
  Database,
  SceneLoader,
  ThinEngine,
  Vector3,
  Color3,
  Texture,
  MeshBuilder,
  StandardMaterial,
  CubeTexture,
  Color3Gradient,
  Tools,
  Mesh,
} from '@babylonjs/core';

import { Inspector } from '@babylonjs/inspector';
import { GlobalStore } from '../../state';
import { HemisphericLight } from 'babylonjs';
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
    progressCallBack,
    errorCallback,
    useArrayBuffer
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
          image._data =
            (await getEQFile('textures', 'citywal4.png')) ?? new ArrayBuffer();
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

  get exploreMode() {
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
  async loadZoneScene(zoneName, loadSpawns, location) {
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
    cameraController.createCamera(new Vector3(0, 250, 0));
    cameraController.camera.rotation = new Vector3(1.57, 1.548, 0);

    this.ambientLight = new HemisphericLight(
      '__ambient_light__',
      new Vector3(0, -0, 0),
      this.#scene
    );

    // Default intensity is 1. Let's dim the light a small amount
    this.ambientLight.intensity = 1.5;
  }

  async loadModel(name) {
    this.loadViewerScene();

    // Skybox
    const skybox = MeshBuilder.CreateBox(
      'skyBox',
      { size: 10000.0 },
      this.#scene
    );
    const skyboxMaterial = new StandardMaterial('skyBox', this.#scene);
    skyboxMaterial.backFaceCulling = false;

    const png_array = [];
    const map = ['px', 'py', 'pz', 'nx', 'ny', 'nz'];
    for (let i = 0; i < 6; i++) {
      png_array.push(
        `https://playground.babylonjs.com/textures/skybox_${map[i]}.jpg`
      );
    }
    skyboxMaterial.reflectionTexture = new CubeTexture(
      'https://playground.babylonjs.com/textures/',
      this.#scene,
      [],
      false,
      png_array,
      undefined,
      undefined,
      undefined,
      undefined,
      '.jpg'
    );
    skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new Color3Gradient(0, 0, 0);
    skyboxMaterial.specularColor = new Color3(0, 0, 0);
    skybox.material = skyboxMaterial;

    const zone = await SceneLoader.ImportMeshAsync(
      '',
      '/eq/zones/',
      `${name}.glb`,
      this.#scene,
      undefined,
      '.glb'
    );
    const metadata = await getEQFile('zones', `${name}.json`, 'json');
    if (metadata) {
      for (const [key, value] of Object.entries(metadata.objects)) {
        await this.instantiateObjects(key, value);
      }
    }
    await this.addTextureAnimations();

  }

  async instantiateObjects(modelName, model, forEditing = false) {
    const animatedMeshes = [];
    const container = await SceneLoader.LoadAssetContainerAsync(
      '/eq/objects/',
      `${modelName}.glb`,
      this.#scene,
      undefined,
      '.glb'
    );
    const meshes = [];
    const rn = [];
    for (const [idx, v] of Object.entries(model)) {
      const { x, y, z, rotateX, rotateY, rotateZ, scale } = v;
      const instanceContainer = container.instantiateModelsToScene(
        () => `${modelName}_${idx}`,
        undefined,
        { doNotInstantiate: forEditing ? false : true }
      );
      instanceContainer.animationGroups?.forEach((ag) =>
        this.#scene.removeAnimationGroup(ag)
      );

      const hasAnimations = instanceContainer.animationGroups.length > 0;
      rn.push(instanceContainer);
      for (const mesh of instanceContainer.rootNodes[0].getChildMeshes()) {
        
        mesh.position = new Vector3(x, y, z);

        mesh.rotation = new Vector3(Tools.ToRadians(rotateX), Tools.ToRadians(180) + Tools.ToRadians(-1 * rotateY), Tools.ToRadians(rotateZ));

        mesh.checkCollisions = true;
        mesh.scaling.z = mesh.scaling.y = mesh.scaling.x = scale;
        mesh.metadata = {
          animated  : hasAnimations,
          zoneObject: true,
        };
        if (forEditing) {
          mesh.addLODLevel(1000, null);
        }
        mesh.id = `${modelName}_${idx}`;
        if (!hasAnimations) {
          mesh.freezeWorldMatrix();
        }
        if (mesh.getTotalVertices() > 0) {
          meshes.push(mesh);
        }
      }
    }
    if (!forEditing) {
      Mesh.MergeMeshes(meshes, true, true, undefined, true, true);
      rn.forEach(r => r.dispose());
    }
    return animatedMeshes;
  }

  async addTextureAnimations() {
    const addTextureAnimation = (material, textureAnimation) => {
      const [baseTexture] = material.getActiveTextures();
      return textureAnimation.frames.map((f) => {
        return new Texture(
          f,
          this.#scene,
          baseTexture.noMipMap,
          baseTexture.invertY,
          baseTexture.samplingMode
        );
      });
    };

    let animationTimerMap = {};
    const animationTexturesCache = {};

    for (const material of this.#scene.materials) {
      if (!material.metadata?.gltf?.extras) {
        continue;
      }

      const textureAnimation = material.metadata?.gltf?.extras;
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
          [textureAnimation.animationDelay]: {
            ...(animationTimerMap[textureAnimation.animationDelay] ?? {}),
            materials: [
              ...(animationTimerMap[textureAnimation.animationDelay]
                ?.materials ?? []),
              {
                frames      : textureAnimation.frames,
                currentFrame: 1,
                allTextures,
                material,
              },
            ],
          },
        };
      }
    }

    for (const [time, value] of Object.entries(animationTimerMap)) {
      const interval = setInterval(() => {
        for (const material of value.materials) {
          material.currentFrame =
            material.currentFrame + 1 > material.frames.length
              ? 1
              : material.currentFrame + 1;
          for (const texture of material.material.getActiveTextures()) {
            if (material.allTextures[material.currentFrame - 1]) {
              texture._texture =
                material.allTextures[material.currentFrame - 1]._texture;
            }
          }
        }
      }, +time * 2);

      for (const material of value.materials) {
        material.material.onDisposeObservable.add(() => {
          clearInterval(interval);
        });
      }
    }
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
          Inspector.Show(gameController.scene, {
            embedMode: true,
            overlay  : true,
          });
        }
        break;
      }
      case 'g': {
        this.addToast(
          `Gravity ${
            gameController.CameraController.camera.applyGravity
              ? 'disabled'
              : 'enabled'
          }`,
          {}
        );
        gameController.CameraController.camera.applyGravity =
          !gameController.CameraController.camera.applyGravity;
        break;
      }
      case 'c': {
        this.addToast(
          `Collision ${
            gameController.CameraController.camera.checkCollisions
              ? 'disabled'
              : 'enabled'
          }`,
          {}
        );
        zoneController.CameraController.camera.checkCollisions =
          !gameController.CameraController.camera.checkCollisions;
        break;
      }
      case 'u': {
        this.showUi = !this.showUi;
        GlobalStore.actions.setZoneInfo({ ...GlobalStore.getState().zoneInfo });
        break;
      }
      case 'b': {
        Object.values(gameController.SpawnController.spawns).forEach(
          (spawn) => {
            spawn.rootNode.showBoundingBox = !spawn.rootNode.showBoundingBox;
            spawn.rootNode
              .getChildMeshes()
              .forEach((m) => (m.showBoundingBox = !m.showBoundingBox));
          }
        );
        break;
      }
      case 'f': {
        this.#scene.rootNodes.forEach((r) => {
          r.getChildMeshes().forEach((m) => {
            if (m.material) {
              m.material.wireframe = true;
            }
          });
        });
        break;
      }
      case 'r': {
        this.#scene.rootNodes.forEach((r) => {
          r.getChildMeshes().forEach((m) => {
            if (m.material) {
              m.material.wireframe = false;
            }
          });
        });
        break;
      }
      case 'l': {
        const { x, y, z } =
          gameController.CameraController.camera.globalPosition;
        sessionStorage.setItem(
          'cam-loc',
          JSON.stringify({
            x,
            y,
            z,
          })
        );
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

  /**
   * @typedef Spire
   * @property {any} SpireApi
   * @property {any} SpireApiTypes
   * @property {any} SpireQueryBuilder
   * @property {import ('../../tsdef/zones').Zones} Zones
   * @property {import ('../../tsdef/spawn').Spawn} Spawn
   * @property {import ('../../tsdef/npcs').Npcs} Npcs
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
