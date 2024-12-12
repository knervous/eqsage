import '@babylonjs/core/Materials/Textures/Loaders/envTextureLoader';
import '@babylonjs/core/Helpers/sceneHelpers';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Light } from '@babylonjs/core/Lights/light';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { Tools } from '@babylonjs/core/Misc/tools';
import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { Color3Gradient } from '@babylonjs/core/Misc/gradients';
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture';
import { GameControllerChild } from './GameControllerChild';
import { GlobalStore } from '../../state';
import '@babylonjs/core/Rendering/edgesRenderer';
import { RegionType } from '../../lib/s3d/bsp/bsp-tree';
import { GLTF2Export } from '@babylonjs/serializers';
import { instantiate3dMover, teardown3dMover } from '../util/babylonUtil';

class ZoneBuilderController extends GameControllerChild {
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
  lights = [];
  lastPosition = new Vector3(0, 0, 0);
  lastAabbNode = null;
  animationRange = 200;
  objectCullRange = 2000;
  /** @type {RecastJSPlugin} */
  navigationPlugin = null;
  pickingRaycast = false;
  animationTextures = [];

  loadCallbacks = [];
  clickCallbacks = [];

  /**
   * @typedef {object} ProjectMetadata
   * 
   * @typedef {object} Project
   * @property {string} projectName
   * @property {Uint8Array} glb
   * @property {Record<string, Uint8Array>} modelFiles
   * @property {ProjectMetadata} metadata
   */
  /** @type {Project} */
  project = {};
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
    if (this.scene) {
      this.scene.unregisterBeforeRender(this.renderLoop);
      this.scene.onPointerObservable.remove(this.onClick.bind(this));
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
  downButtons = 0;
  loadViewerScene() {
    this.dispose();
    this.scene = null;
    if (!this.engine || !this.canvas || !this.gc.engineInitialized) {
      return;
    }

    this.scene = new Scene(this.engine);

    this.scene.registerBeforeRender(this.renderLoop.bind(this));
    this.scene.onPointerDown = (...args) => {
      if (this.pickingRaycast) {
        this.downButtons = args[0].buttons;
      }
      // this.CameraController.sceneMouseDown(...args);
    };
    // this.scene.onPointerUp = this.CameraController.sceneMouseUp;
    this.scene.onPointerMove = (...args) => {
      if (this.raycastMouseMove) {
        this.raycastMouseMove(...args);
      }
    };
    this.CameraController.createCamera(new Vector3(0, 250, 0));
    this.CameraController.camera.rotation = new Vector3(1.57, 1.548, 0);
    const glowLayer = new GlowLayer('glow', this.scene, {
      blurKernelSize: 10,
    });
    this.glowLayer = glowLayer;
    glowLayer.intensity = 0.7;
    glowLayer.customEmissiveColorSelector = function (
      mesh,
      subMesh,
      material,
      result
    ) {
      if (mesh?.metadata?.emissiveColor) {
        result.set(
          mesh?.metadata?.emissiveColor.r,
          mesh?.metadata?.emissiveColor.g,
          mesh?.metadata?.emissiveColor.b,
          mesh?.metadata?.emissiveColor.a ?? 0.5
        );
      }
    };
    this.regionMaterial = new StandardMaterial('region-material', this.scene);

    this.regionMaterial.alpha = 0.3;
    this.regionMaterial.diffuseColor = new Color3(0, 127, 65); // Red color
    this.regionMaterial.emissiveColor = new Color4(0, 127, 65, 0.3); // Red color
    this.regionMaterial.depthFunction = Engine.ALWAYS;

    const hdrTexture = CubeTexture.CreateFromPrefilteredData(
      '/static/environment.env',
      this.scene
    );
    this.scene.environmentTexture = hdrTexture;
    this.scene.environmentIntensity = 1.0;

    // Click events
    this.scene.onPointerObservable.add(this.onClick.bind(this));

    return true;
  }

  /**
   *
   * @param {PointerInfo} pointerInfo
   */
  onClick(pointerInfo) {
    if (pointerInfo.event.buttons !== 1) {
      return;
    }
    switch (pointerInfo.type) {
      case PointerEventTypes.POINTERDOWN:
        this.clickCallbacks.forEach((c) => c(pointerInfo.pickInfo.pickedMesh));
        break;
      default:
        break;
    }
  }

  showRegions(value) {
    this.regionsShown = value;
    this.scene?.getNodeById('regions')?.setEnabled(value);
  }

  moveSpawn(spawn) {
    if (!spawn) {
      return;
    }
    const spawnMesh = this.scene?.getMeshById(`zone-spawn-${spawn.id}`);
    if (spawnMesh) {
      spawnMesh.position.x = spawn.y;
      spawnMesh.position.y = spawn.z;
      spawnMesh.position.z = spawn.x;
      spawnMesh.metadata = { spawn };
    }
  }

  exportZone(terrain = true, boundary = false) {
    GlobalStore.actions.setLoading(true);
    GlobalStore.actions.setLoadingTitle(
      `Exporting zone ${this.project.projectName}`
    );
    GlobalStore.actions.setLoadingText('LOADING, PLEASE WAIT...');
    const zoneContainer = this.zoneContainer;
    const boundaryContainer = this.boundaryContainer;
    GLTF2Export.GLBAsync(this.scene, this.project.projectName, {
      shouldExportNode(node) {
        if (terrain) {
          if (boundary) {
            return (
              node.parent === zoneContainer ||
              node.parent === boundaryContainer ||
              node === zoneContainer ||
              node === boundaryContainer
            );
          }
          return node.parent === zoneContainer || node === zoneContainer;
        } else if (boundary) {
          return (
            node.parent === boundaryContainer || node === boundaryContainer
          );
        }
      },
      shouldExportAnimation() {
        return false;
      },
    })
      .then(async (glb) => {
        GlobalStore.actions.setLoadingTitle(
          `Optimizing ${this.project.projectName}`
        );
        GlobalStore.actions.setLoadingText('Applying GLB optimizations');
        const blob = Object.values(glb.glTFFiles)[0];

        const assetUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = assetUrl;
        link.download = `${this.project.projectName}.glb`;
        link.click();
      })
      .finally(() => {
        GlobalStore.actions.setLoading(false);
      });
  }

  /**
   *
   * @param {Mesh} mesh
   * @param {(commit: boolean) => void} cb
   */
  async editMesh(mesh, cb) {
    const originalPosition = mesh.position.clone();
    const originalScale = mesh.scaling.clone();
    const originalRotation = mesh.rotation.clone();
    this.pickingRaycast = true;
    mesh.isPickable = false;

    const pointLight = new PointLight(
      'pointLight',
      new Vector3(0, 10, 0),
      this.scene
    );
    // pointLight.parent = raycastMesh;
    // Set the intensity of the point light
    pointLight.intensity = 500.0;
    pointLight.range = 300;
    pointLight.radius = 50;

    // Optional: Adjust other properties like the light's color
    pointLight.diffuse = new Color3(1, 1, 1); // White light
    pointLight.position = mesh.position;

    let chosenLocation = null;

    const tooltip = document.createElement('div');
    tooltip.className = 'raycast-tooltip';
    document.body.appendChild(tooltip);

    let lastX = null;
    let lastY = null;
    /**
     * @param {MouseEvent} e
     */
    this.raycastMouseMove = (e) => {
      if (e.buttons === 1) {
        let diffX = 0,
          diffY = 0;
        if (lastX !== null && lastY !== null) {
          diffX = e.clientX - lastX;
          diffY = e.clientY - lastY;
        }
        if (e.shiftKey) {
          mesh.scaling.setAll(mesh.scaling.y - diffY / 50);
        } else {
          mesh.rotation.y += Tools.ToRadians(diffX);
        }
        lastX = e.clientX;
        lastY = e.clientY;
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      // Reset lastX and lastY when mouse button is not held down or Shift is not pressed
      lastX = null;
      lastY = null;
      // Calculate the pick ray from the camera position and mouse position

      const pickResult = this.scene.pick(
        this.scene.pointerX,
        this.scene.pointerY,
        null,
        false,
        this.CameraController.camera,
        (p0, p1, p2, ray) => {
          const p0p1 = p0.subtract(p1);
          const p2p1 = p2.subtract(p1);
          const normal = Vector3.Cross(p0p1, p2p1);
          return Vector3.Dot(ray.direction, normal) > 0;
        }
      );

      // Check if the ray intersects with the specific mesh
      if (pickResult.hit && mesh !== pickResult.pickedMesh) {
        // Perform actions based on the hit
        const hitPoint = pickResult.pickedPoint;
        mesh.position.set(hitPoint.x, hitPoint.y, hitPoint.z);
        chosenLocation = { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z };

        tooltip.style.left = `${e.pageX - tooltip.clientWidth / 2}px`;
        tooltip.style.top = `${e.pageY + tooltip.clientHeight / 2}px`;
        tooltip.innerHTML = `<p>[T] Commit - [ESC] Cancel</p>
         <p>X: ${hitPoint.z.toFixed(2)}, Y: ${hitPoint.x.toFixed(2)}, Z: ${(
          hitPoint.y + 5
        ).toFixed(2)}</p>
         <p>Left Mouse: Rotate and [Shift] Scale</p>`;
      }
    };
    this.CameraController.camera.inputs.attached.mouse.buttons = [2];

    const finish = async (commit) => {
      mesh.isPickable = true;
      this.CameraController.camera.inputs.attached.mouse.buttons = [0, 1, 2];
      this.pickingRaycast = false;
      if (!commit) {
        mesh.position = originalPosition;
        mesh.rotation = originalRotation;
        mesh.scaling = originalScale;
      }
      await cb(commit);
      window.removeEventListener('keydown', keyHandler);
      this.raycastMouseMove = null;
      pointLight.dispose();
      document.body.removeChild(tooltip);
    };
    function keyHandler(e) {
      if (e.key === 'Escape') {
        finish(false);
      }

      if (e.key?.toLowerCase() === 't') {
        finish(true);
      }
    }
    window.addEventListener('keydown', keyHandler);
  }

  make3DMover(mesh, moveCallback) {
    if (!mesh) {
      return;
    }
    instantiate3dMover(this.currentScene, mesh, moveCallback);
  }

  destroy3DMover() {
    teardown3dMover(this.currentScene);
  }

  async pickRaycastForLoc({
    commitCallback = null,
    modelName = '',
    extraHtml = '',
  }) {
    this.pickingRaycast = true;
    const meshMap = {};
    this.zoneContainer.getChildMeshes().forEach((m) => {
      meshMap[m] = m.isPickable;
      m.isPickable = true;
    });
    const resetPickable = () => {
      for (const [mesh, originalVal] of Object.entries(meshMap)) {
        mesh.isPickable = originalVal;
      }
    };
    /**
     * @type {Mesh}
     */
    let raycastMesh;
    if (modelName) {
      let container;
      try {
        // Create a Blob from the Uint8Array
        const blob = new Blob([this.project.modelFiles[modelName]], {
          type: 'model/gltf-binary',
        });

        // Create a URL for the blob
        const url = URL.createObjectURL(blob);

        container = await SceneLoader.LoadAssetContainerAsync(
          '',
          url,
          this.scene,
          undefined,
          '.glb'
        );
        const instanceContainer = container.instantiateModelsToScene(
          () => 'raycast-sphere',
          undefined,
          { doNotInstantiate: true }
        );
        instanceContainer.animationGroups?.forEach((ag) =>
          this.scene.removeAnimationGroup(ag)
        );
        const meshesToMerge = [];
        instanceContainer.rootNodes[0].getChildMeshes().forEach((mesh) => {
          if (mesh.getTotalVertices() > 0) {
            meshesToMerge.push(mesh);
          }
        });
        if (meshesToMerge.length > 0) {
          let mergedMesh;
          try {
            mergedMesh = Mesh.MergeMeshes(
              meshesToMerge,
              true,
              true,
              undefined,
              false,
              true
            );
          } catch (e) {
            console.warn('Error merging mesh', e);
            mergedMesh = instanceContainer.rootNodes[0].clone();
            mergedMesh.isPickable = false;
            mergedMesh.getChildMeshes().forEach((m) => {
              m.isPickable = false;
            });
          }

          mergedMesh.name = mergedMesh.id = 'raycast-mesh';
          if (mergedMesh) {
            raycastMesh = mergedMesh; // Add the merged mesh to the array of meshes
          }
        }
        instanceContainer.rootNodes[0].dispose();
      } catch (e) {
        console.warn('Error instantiating model', modelName);
        commitCallback?.(null);
        this.pickingRaycast = false;
        return;
      }
    } else {
      raycastMesh = MeshBuilder.CreateSphere(
        'raycast-sphere',
        { diameter: 3, segments: 32 },
        this.scene
      );
      const material = new StandardMaterial('raycast-sphere', this.scene);

      material.emissiveColor = new Color3(1, 1, 0);
      raycastMesh.material = material;
    }
    raycastMesh.isPickable = false;

    const pointLight = new PointLight(
      'pointLight',
      new Vector3(0, 10, 0),
      this.scene
    );
    // pointLight.parent = raycastMesh;
    // Set the intensity of the point light
    pointLight.intensity = 500.0;
    pointLight.range = 300;
    pointLight.radius = 50;

    // Optional: Adjust other properties like the light's color
    pointLight.diffuse = new Color3(1, 1, 1); // White light
    pointLight.position = raycastMesh.position;

    let chosenLocation = null;

    const tooltip = document.createElement('div');
    tooltip.className = 'raycast-tooltip';
    document.body.appendChild(tooltip);

    let lastX = null;
    let lastY = null;
    /**
     * @param {MouseEvent} e
     */
    this.raycastMouseMove = (e) => {
      if (e.buttons === 1) {
        let diffX = 0,
          diffY = 0;
        if (lastX !== null && lastY !== null) {
          diffX = e.clientX - lastX;
          diffY = e.clientY - lastY;
        }
        if (e.shiftKey) {
          raycastMesh.scaling.setAll(raycastMesh.scaling.y - diffY / 50);
        } else {
          raycastMesh.rotation.y += Tools.ToRadians(diffX);
        }
        lastX = e.clientX;
        lastY = e.clientY;
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      // Reset lastX and lastY when mouse button is not held down or Shift is not pressed
      lastX = null;
      lastY = null;
      // Calculate the pick ray from the camera position and mouse position

      const pickResult = this.scene.pick(
        this.scene.pointerX,
        this.scene.pointerY,
        null,
        false,
        this.CameraController.camera,
        (p0, p1, p2, ray) => {
          const p0p1 = p0.subtract(p1);
          const p2p1 = p2.subtract(p1);
          const normal = Vector3.Cross(p0p1, p2p1);
          return Vector3.Dot(ray.direction, normal) > 0;
        }
      );

      // Check if the ray intersects with the specific mesh
      if (pickResult.hit && raycastMesh !== pickResult.pickedMesh) {
        // Perform actions based on the hit
        const hitPoint = pickResult.pickedPoint;
        raycastMesh.position.set(hitPoint.x, hitPoint.y, hitPoint.z);
        chosenLocation = { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z };

        tooltip.style.left = `${e.pageX - tooltip.clientWidth / 2}px`;
        tooltip.style.top = `${e.pageY + tooltip.clientHeight / 2}px`;
        tooltip.innerHTML = `<p>[T] Commit - [ESC] Cancel</p>
         <p>X: ${hitPoint.z.toFixed(2)}, Y: ${hitPoint.x.toFixed(2)}, Z: ${(
          hitPoint.y + 5
        ).toFixed(2)}</p>
         ${extraHtml}`;
      }
    };
    this.CameraController.camera.inputs.attached.mouse.buttons = [2];

    const finish = async (loc, cleanup = false) => {
      if (!cleanup) {
        commitCallback?.(loc, raycastMesh);
        return;
      }
      this.CameraController.camera.inputs.attached.mouse.buttons = [0, 1, 2];

      this.pickingRaycast = false;
      await commitCallback?.(loc, raycastMesh);
      window.removeEventListener('keydown', keyHandler);
      this.raycastMouseMove = null;
      raycastMesh.dispose();
      pointLight.dispose();
      document.body.removeChild(tooltip);
      resetPickable();
    };
    function keyHandler(e) {
      if (e.key === 'Escape') {
        finish(null, true);
      }

      if (e.key?.toLowerCase() === 't') {
        finish(chosenLocation);
      }
    }
    window.addEventListener('keydown', keyHandler);
  }

  setFlySpeed(value) {
    this.cameraFlySpeed = value;
    if (!this.CameraController?.camera) {
      return;
    }
    this.CameraController.camera.speed = value;
  }

  setClipPlane(value) {
    if (!this.CameraController?.camera || !this.skybox) {
      return;
    }
    this.CameraController.camera.maxZ = value;
    const scaleValue = value / 10000;
    this.skybox.scaling.setAll(scaleValue);
  }

  setGlow(value) {
    if (!this.glowLayer) {
      return;
    }
    this.glowLayer.intensity = value ? 0.7 : 0;
    if (value) {
    } else {
    }
  }
  setSpawnLOD() {}

  async importZone(buffer) {
    this.zoneContainer.getChildMeshes().forEach((m) => m.dispose());
    const blob = new Blob([buffer], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);

    const zone = await SceneLoader.ImportMeshAsync(
      null,
      '',
      url,
      this.scene,
      undefined,
      '.glb'
    );

    zone.meshes.forEach((m) => {
      if (m.material?.metadata?.gltf?.extras?.boundary) {
        m.parent = this.boundaryContainer;
        m.isPickable = false;
      } else {
        m.isPickable = true;
        m.parent = this.zoneContainer;
      }
      if (m.name.endsWith('-passthrough')) {
        m.metadata = {
          gltf: {
            extras: {
              passThrough: true,
            },
          },
        };
      }
    });
  }

  async loadModel(project) {
    this.project = project;
    this.zoneMetadata = project.metadata;
    this.name = project.projectName;
    this.metadata = project.metadata;
    GlobalStore.actions.setLoading(true);
    GlobalStore.actions.setLoadingTitle(`Loading ${this.name}`);
    GlobalStore.actions.setLoadingText(`Loading ${this.name} zone`);

    if (!(await this.loadViewerScene())) {
      return;
    }
    if (this.cameraFlySpeed !== undefined && this.CameraController?.camera) {
      this.CameraController.camera.speed = this.cameraFlySpeed;
    }
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
      png_array.push(`/static/skybox_${map[i]}.jpg`);
    }
    skyboxMaterial.reflectionTexture = new CubeTexture(
      '/',
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

    const blob = new Blob([project.glb], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);

    const zone = await SceneLoader.ImportMeshAsync(
      null,
      '',
      url,
      this.scene,
      undefined,
      '.glb'
    );
    this.boundaryContainer = new TransformNode('boundary', this.scene);
    this.zoneContainer = new TransformNode('zone', this.scene);
    zone.meshes.forEach((m) => {
      if (m.material?.metadata?.gltf?.extras?.boundary) {
        m.parent = this.boundaryContainer;
        m.isPickable = false;
      } else {
        m.isPickable = true;
        m.parent = this.zoneContainer;
      }
      if (m.name.endsWith('-passthrough')) {
        m.metadata = {
          gltf: {
            extras: {
              passThrough: true,
            },
          },
        };
      }
    });

    const metadata = project.metadata;
    if (metadata) {
      const meshes = [];
      this.objectContainer = new TransformNode('objects', this.scene);
      this.regionContainer = new TransformNode('regions', this.scene);
      this.lightContainer = new TransformNode('lights', this.scene);
      this.soundContainer = new TransformNode('sounds', this.scene);
      // this.objectContainer.setEnabled(false);
      this.regionContainer.setEnabled(false);
      this.lightContainer.setEnabled(false);
      this.soundContainer.setEnabled(false);
      for (const [key, value] of Object.entries(metadata.objects)) {
        meshes.push(...(await this.instantiateObjects(key, value)));
      }

      for (const mesh of meshes.flat()) {
        mesh.parent = this.objectContainer;
      }
      this.instantiateRegions(metadata.regions);
      this.instantiateSounds(metadata.sounds);
      this.instantiateLights(metadata.lights);
    }
    await this.addTextureAnimations();
    this.loadCallbacks.forEach((l) => l());
    this.zoneLoaded = true;

    GlobalStore.actions.setLoading(false);
  }

  instantiateRegions(regions) {
    let idx = 0;
    this.regionContainer.getChildMeshes().forEach((m) => m.dispose());
    this.regionContainer.getChildren().forEach((c) => c.dispose());
    for (const region of regions) {
      const minVertex = new Vector3(
        region.minVertex[0],
        region.minVertex[1],
        region.minVertex[2]
      );
      const maxVertex = new Vector3(
        region.maxVertex[0],
        region.maxVertex[1],
        region.maxVertex[2]
      );

      // Calculate the dimensions of the box
      const width = maxVertex.x - minVertex.x;
      const height = maxVertex.y - minVertex.y;
      const depth = maxVertex.z - minVertex.z;

      // Create the box mesh
      const box = MeshBuilder.CreateBox(
        'box',
        {
          width    : width,
          height   : height,
          depth    : depth,
          updatable: true,
        },
        this.scene
      );

      box.name = `Region-${idx++}`;
      // Set the position of the box to the center
      box.position = new Vector3(
        region.center[0],
        region.center[1],
        region.center[2]
      );
      this.glowLayer.addIncludedOnlyMesh(box);
      box.material = this.regionMaterial;
      box.parent = this.regionContainer;
      box.forceRenderingWhenOccluded = true;
      box.occlusionType = AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
      box.isPickable = true;
      box.metadata = {
        region,
        emissiveColor: new Color3(0, 0.5, 1),
      };
    }
  }

  filterRegions(regions) {
    if (!this.regionContainer.isEnabled()) {
      this.regionContainer.setEnabled(true);
    }
    this.regionContainer.getChildMeshes().forEach((m) => {
      switch (m.metadata.region?.regionType) {
        default:
        case RegionType.Normal:
          break;
        case RegionType.Lava:
          m.metadata.emissiveColor = new Color4(1, 0.8, 0.0, 0.3);
          break;
        case RegionType.Pvp:
          m.metadata.emissiveColor = new Color4(1, 0.2, 0.2, 0.2);
          break;
        case RegionType.Slippery:
        case RegionType.WaterBlockLOS:
        case RegionType.FreezingWater:
        case RegionType.Water:
          m.metadata.emissiveColor = new Color4(0.2, 0.2, 1.0, 0.2);
          break;
        case RegionType.Zoneline:
          m.metadata.emissiveColor = new Color4(0.2, 1.0, 0.2, 0.2);
          break;
      }
      if (regions.includes(m.metadata.region)) {
        m.setEnabled(true);
      } else {
        m.setEnabled(false);
      }
    });
  }

  updateRegionBounds(mesh, width, height, depth) {
    // Create a temporary new box with updated dimensions
    const tempBox = MeshBuilder.CreateBox(
      'tempBox',
      { width, height, depth, updatable: true },
      this.currentScene
    );

    // Extract vertex data from the temporary box
    const newVertexData = VertexData.ExtractFromMesh(tempBox);

    // Apply the new vertex data to the original box
    newVertexData.applyToMesh(mesh);

    // Refresh bounding info on the original box
    mesh.refreshBoundingInfo();

    // Dispose of the temporary box
    tempBox.dispose();
  }

  /**
   *
   * @param {Mesh} mesh
   */
  overlayWireframe(mesh, withGlow = true, withEdges = false) {
    if (this.wireframeMesh) {
      this.wireframeMesh.dispose();
    }
    if (!mesh) {
      return;
    }

    this.wireframeMesh = mesh.clone('wireframeMesh');
    const wireframeMaterial = new StandardMaterial(
      'wireframeMaterial',
      this.scene
    );
    const threshold = 0.5;
    if (withGlow) {
      this.glowLayer.addIncludedOnlyMesh(mesh);
      mesh.metadata = {
        ...mesh.metadata,
        emissiveColor: new Color4(0, 0.5, 1, 0.05),
      };
    }

    this.editingMesh = mesh;
    wireframeMaterial.emissiveColor = new Color3(
      threshold,
      threshold,
      threshold
    );
    wireframeMaterial.diffuseColor = new Color3(
      threshold,
      threshold,
      threshold
    );
    wireframeMaterial.wireframe = true;
    wireframeMaterial.depthFunction = Engine.ALWAYS;
    this.wireframeMesh.material = wireframeMaterial;
    this.wireframeMesh.position = new Vector3(0, 0, 0);
    this.wireframeMesh.parent = mesh;
    this.wireframeMesh.isPickable = false;
    let direction = 1;
    let intensity = 0;
    this.wireframeMeshInterval = setInterval(() => {
      intensity += direction * 0.05;

      if (intensity >= 1) {
        intensity = 1;
        direction = -1;
      } else if (intensity <= threshold) {
        intensity = threshold;
        direction = 1;
      }
      wireframeMaterial.emissiveColor = new Color3(
        intensity,
        intensity,
        intensity
      );
    }, 75);
    if (withEdges) {
      this.wireframeMesh.enableEdgesRendering();
      const boundingInfo = this.wireframeMesh.getBoundingInfo();
      const min = boundingInfo.boundingBox.minimumWorld;
      const max = boundingInfo.boundingBox.maximumWorld;
      const width = Math.abs(max.x - min.x);
      const height = Math.abs(max.y - min.y);
      const depth = Math.abs(max.z - min.z);
      const avg = (width + height + depth) / 3;
      this.wireframeMesh.edgesWidth = Math.min(100, avg * 2);
      this.wireframeMesh.edgesColor = new Color4(1, 0, 0, 0.85);
    }
  }

  disposeOverlayWireframe(withGlow = true) {
    if (this.editingMesh && withGlow) {
      this.editingMesh.metadata = {
        ...this.editingMesh.metadata,
        emissiveColor: undefined,
      };
      this.glowLayer.removeIncludedOnlyMesh(this.editingMesh);
    }
    this.wireframeMesh?.dispose();
    clearInterval(this.wireframeMeshInterval);
    this.wireframeMesh = null;
  }

  assignGlow(mesh) {
    if (!mesh) {
      return;
    }
    this.glowLayer.addIncludedOnlyMesh(mesh);
    mesh.forceRenderingWhenOccluded = true;
    mesh.occlusionType = AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
    mesh.metadata = {
      emissiveColor: new Color3(0, 0.5, 1),
    };
  }
  unassignGlow(mesh) {
    if (!mesh) {
      return;
    }
    this.glowLayer.removeIncludedOnlyMesh(mesh);
    mesh.forceRenderingWhenOccluded = false;
    mesh.occlusionType = AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
    mesh.metadata = {};
  }

  toggleOpen(name) {
    if (!this.scene) {
      return;
    }
    this.wireframeMesh?.dispose();
    if (name && name !== 'zone' && name !== 'objects') {
      this.zoneContainer
        .getChildMeshes()
        .forEach((m) => (m.isPickable = false));
    } else {
      this.zoneContainer.getChildMeshes().forEach((m) => (m.isPickable = true));
    }
    setTimeout(() => {
      for (const node of [
        this.lightContainer,
        this.soundContainer,
        this.regionContainer,
      ]) {
        if (node.name !== name) {
          console.log('Disabling', node.name);
          node.setEnabled(false);
        } else {
          node.setEnabled(true);
        }
      }
    }, 0);
  }

  renderLoop() {
    if (!this.lightContainer.isEnabled()) {
    }
  }

  instantiateLights(lights) {
    let idx = 0;
    for (const light of lights) {
      const size = 3;
      // Create the box mesh
      const box = MeshBuilder.CreateBox(
        'box',
        {
          width : size,
          height: size,
          depth : size,
        },
        this.scene
      );

      box.name = `Light-${idx++}`;
      // Set the position of the box to the center
      box.position = new Vector3(light.x, light.y, light.z);
      this.glowLayer.addIncludedOnlyMesh(box);

      const pointLight = new PointLight(
        `light_${idx}`,
        box.position,
        this.scene
      );
      pointLight.diffuse = new Color3(light.r, light.g, light.b);
      pointLight.intensity = 1.2;
      pointLight.radius = light.radius;
      pointLight.intensityMode = Light.INTENSITYMODE_LUMINANCE;
      pointLight.falloffType = Light.FALLOFF_GLTF;
      pointLight.specular.set(0, 0, 0);
      pointLight.setEnabled(false);
      pointLight.zoneLight = true;
      this.lights.push(pointLight);
      box.light = pointLight;
      pointLight.parent = this.lightContainer;
      // this.scene.selectionOctree.addMesh(box);

      box.material = this.regionMaterial;
      box.parent = this.lightContainer;
      box.forceRenderingWhenOccluded = true;
      box.occlusionType = AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
      box.isPickable = true;
      box.metadata = {
        emissiveColor: new Color3(1, 0.5, 0),
      };
    }
  }

  instantiateSounds(sounds) {
    let idx = 0;
    for (const sound of sounds) {
      // Calculate the dimensions of the box
      const width = 3;
      const height = 3;
      const depth = 3;

      // Create the box mesh
      const box = MeshBuilder.CreateBox(
        'box',
        {
          width : width,
          height: height,
          depth : depth,
        },
        this.scene
      );

      box.name = `Sound-${idx++}`;
      // Set the position of the box to the center
      box.position = new Vector3(sound.x, sound.z, sound.y);
      this.glowLayer.addIncludedOnlyMesh(box);
      box.material = this.regionMaterial;
      box.parent = this.soundContainer;
      box.renderingGroupId = 50;
      box.forceRenderingWhenOccluded = true;
      box.occlusionType = AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
      box.isPickable = true;
      box.metadata = {
        emissiveColor: new Color3(1, 0.5, 1),
      };
    }
  }

  async instantiateObjects(modelName, model) {
    let container;

    try {
      // Create a Blob from the Uint8Array
      const blob = new Blob([this.project.modelFiles[modelName]], {
        type: 'model/gltf-binary',
      });

      // Create a URL for the blob
      const url = URL.createObjectURL(blob);

      container = await SceneLoader.LoadAssetContainerAsync(
        '',
        url,
        this.scene,
        undefined,
        '.glb'
      );
    } catch (e) {
      console.warn('Error instantiating model', modelName);
      return [];
    }

    const meshes = [];
    const rn = [];

    for (const [idx, v] of Object.entries(model)) {
      const meshesToMerge = []; // Array to hold meshes for merging

      const { x, y, z, rotateX, rotateY, rotateZ, scale } = v;
      const instanceContainer = container.instantiateModelsToScene(
        () => `${modelName}_${idx}`,
        undefined,
        { doNotInstantiate: true }
      );
      instanceContainer.animationGroups?.forEach((ag) =>
        this.scene.removeAnimationGroup(ag)
      );

      rn.push(instanceContainer);

      // Collect the meshes for merging
      instanceContainer.rootNodes[0].getChildMeshes().forEach((mesh) => {
        if (mesh.getTotalVertices() > 0) {
          meshesToMerge.push(mesh); // Add the mesh to the list for merging
        }
      });
      // Merge the meshes
      if (meshesToMerge.length > 0) {
        const mergedMesh = Mesh.MergeMeshes(
          meshesToMerge,
          true,
          true,
          undefined,
          false,
          true
        );
        mergedMesh.name = mergedMesh.id = `${modelName}_${idx}`;
        // mergedMesh.addLODLevel(1000, null);
        if (mergedMesh) {
          mergedMesh.position = new Vector3(x, y, z);
          mergedMesh.rotation = new Vector3(
            Tools.ToRadians(rotateX),
            Tools.ToRadians(rotateY),
            Tools.ToRadians(rotateZ)
          );
          mergedMesh.scaling.setAll(scale);
          mergedMesh.parent = this.objectContainer; // Set the parent to the object container
          mergedMesh.checkCollisions = true; // Enable collisions for the merged mesh
          mergedMesh.isPickable = true;
          meshes.push(mergedMesh); // Add the merged mesh to the array of meshes
          mergedMesh.dataReference = v;
          mergedMesh.dataContainerReference = model;
        }
      }
      instanceContainer.rootNodes[0].dispose();
    }
    return meshes;
  }

  async addTextureAnimations() {
    const addTextureAnimation = (material, textureAnimation) => {
      const [baseTexture] = material.getActiveTextures();
      return textureAnimation.frames.map((f) => {
        return new Texture(
          f,
          this.scene,
          baseTexture.noMipMap,
          baseTexture.invertY,
          baseTexture.samplingMode
        );
      });
    };

    let animationTimerMap = {};
    const animationTexturesCache = {};
    this.animationTextures = [];
    for (const material of this.scene.materials) {
      if (!material.metadata?.gltf?.extras?.animationDelay) {
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
        this.animationTextures.push(...allTextures);
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
}

export const zoneBuilderController = new ZoneBuilderController();
window.zb = zoneBuilderController;
