import {
  Texture,
  Scene,
  MeshBuilder,
  StandardMaterial,
  CubeTexture,
  Color3Gradient,
  Color3,
  GlowLayer,
  Color4,
  PointerEventTypes,
} from '@babylonjs/core';

import { GameControllerChild } from './GameControllerChild';

import { GlobalStore } from '../../state';

class ModelController extends GameControllerChild {
  /**
   * @type {import('@babylonjs/core/scene').Scene}
   */
  scene = null;
  /** @type {RecastJSPlugin} */
  navigationPlugin = null;

  loadCallbacks = [];
  clickCallbacks = [];

  /**
   * @type {Object.<string, Promise<AssetContainer>}
   */
  assetContainers = {};

  addClickCallback = (cb) => {
    this.clickCallbacks.push(cb);
  };
  removeClickCallback = (cb) => {
    this.clickCallbacks = this.clickCallbacks.filter((l) => l !== cb);
  };

  addLoadCallback = (cb) => {
    this.loadCallbacks.push(cb);
  };
  removeLoadCallback = (cb) => {
    this.loadCallbacks = this.loadCallbacks.filter((l) => l !== cb);
  };
  dispose() {
    this.SpawnController.dispose();
    if (this.scene) {
      this.scene.onPointerObservable.remove(this.onClick.bind(this));
      this.scene.onBeforeRenderObservable.remove(this.renderHook.bind(this));
      this.scene.dispose();
    }
    this.scene = null;
  }

  loadViewerScene() {
    this.dispose();
    this.scene = null;
    if (!this.engine || !this.canvas || !this.gc.engineInitialized) {
      return;
    }
    this.scene = new Scene(this.engine);
    this.scene.onPointerDown = this.sceneMouseDown;
    this.scene.onPointerUp = this.sceneMouseUp;
    this.CameraController.createModelCamera();
    const glowLayer = new GlowLayer('glow', this.scene, {
      blurKernelSize: 10
    });
    this.glowLayer = glowLayer;
    glowLayer.intensity = 0.7;
    glowLayer.customEmissiveColorSelector = function (mesh, subMesh, material, result) {
      if (mesh?.metadata?.emissiveColor) {
        result.set(mesh?.metadata?.emissiveColor.r, mesh?.metadata?.emissiveColor.g, mesh?.metadata?.emissiveColor.b, 0.5);
        if (mesh?.metadata?.onlyOccluded) {
          if (mesh.isOccluded) {
            result.set(mesh?.metadata?.emissiveColor.r, mesh?.metadata?.emissiveColor.g, mesh?.metadata?.emissiveColor.b, 0.5);
          } else {
            result.set(mesh?.metadata?.emissiveColor.r, mesh?.metadata?.emissiveColor.g, mesh?.metadata?.emissiveColor.b, 0.00);
          }
        }
      }
      
    };
    const hdrTexture = CubeTexture.CreateFromPrefilteredData('https://playground.babylonjs.com/textures/environment.env', this.scene);
    this.scene.environmentTexture = hdrTexture;
    this.scene.environmentIntensity = 1.0;
    this.regionMaterial = new StandardMaterial('region-material', this.scene);

    this.regionMaterial.alpha = 0.3;
    this.regionMaterial.diffuseColor = new Color3(0, 127, 65); // Red color
    this.regionMaterial.emissiveColor = new Color4(0, 127, 65, 0.3); // Red color

    // Click events
    this.scene.onPointerObservable.add(this.onClick.bind(this));

    // Setups
    // this.SpawnController.setupSpawnController();

    return true;
  }

  /**
   *
   * @param {PointerInfo} pointerInfo
   */
  onClick(pointerInfo) {
    switch (pointerInfo.type) {
      case PointerEventTypes.POINTERDOWN:
        if (
          pointerInfo.pickInfo.hit &&
          (pointerInfo.pickInfo.pickedMesh?.metadata?.spawn ?? null) !== null
        ) {
          this.clickCallbacks.forEach((c) =>
            c(pointerInfo.pickInfo.pickedMesh?.metadata?.spawn)
          );
        }
        break;
      default:
        break;
    }
  }

  renderHook() {
    this.skybox.position = this.CameraController.camera.position;
  }

  async initializeModelExporter() {
    GlobalStore.actions.setLoading(true);
    GlobalStore.actions.setLoadingTitle('Loading');
    GlobalStore.actions.setLoadingText('Initializing model exporter');
    if (!(await this.loadViewerScene(false))) {
      return;
    }
    if (this.cameraFlySpeed !== undefined && this.CameraController?.camera) {
      this.CameraController.camera.speed = this.cameraFlySpeed;
    }
    this.scene.onBeforeRenderObservable.add(this.renderHook.bind(this));
    // Skybox
    const skybox = MeshBuilder.CreateBox(
      'skyBox',
      { size: 10000.0 },
      this.scene
    );
    this.skybox = skybox;
    const skyboxMaterial = new StandardMaterial('skyBox', this.scene);
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
      this.scene,
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
    

    this.loadCallbacks.forEach((l) => l());

    GlobalStore.actions.setLoading(false);
  }


}

export const modelController = new ModelController();
window.modelController = modelController;
