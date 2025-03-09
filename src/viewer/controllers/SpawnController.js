import BABYLON from '@bjs';

import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { WebIO } from '@gltf-transform/core';
import assimpjs from '../../modules/assimp';
import raceData from '../common/raceData.json';
import { GameControllerChild } from './GameControllerChild';
import { BabylonSpawn } from '../models/BabylonSpawn';
import { GlobalStore } from '../../state';
import { dedup, prune, textureCompress } from '@gltf-transform/functions';
import { getEQFile, getEQFileExists } from 'sage-core/util/fileHandler';
import {
  GLOBAL_VERSION,
  processGlobal,
} from '../../components/zone/processZone';

const {
  AbstractMesh,
  Color3,
  Vector3,
  DynamicTexture,
  Texture,
  TransformNode,
  Mesh,
  PBRMaterial,
  StandardMaterial,
  PointLight,
  PointerDragBehavior,
  PointerEventTypes,
  SceneLoader,
  VertexBuffer,
  GLTF2Export,
  STLExport,
  MeshBuilder,
} = BABYLON;
/**
 * @typedef {import('@babylonjs/core').AssetContainer} AssetContainer
 */
class SpawnController extends GameControllerChild {
  /**
   * @type {Object.<number, BabylonSpawn>}
   */
  spawns = {};

  loadCallbacks = [];
  clickCallbacks = [];

  /**
   * @type {Object.<string, Promise<AssetContainer>}
   */
  assetContainers = {};

  /**
   * @type {Mesh}
   */
  baseSphere = null;

  /**
   * @type {Mesh}
   */
  zoneSpawnsNode = null;

  tubePath = [];
  pathPoints = [];

  addClickCallback = (cb) => {
    this.clickCallbacks.push(cb);
  };
  removeClickCallback = (cb) => {
    this.clickCallbacks = this.clickCallbacks.filter((l) => l !== cb);
  };

  /** @type {import('@babylonjs/core').Octree<AbstractMesh>} */

  constructor() {
    super();
    this.sceneMouseDown = this.sceneMouseDown.bind(this);
  }

  dispose() {
    this.assetContainers = {};
    if (this.currentScene) {
      this.currentScene.unregisterBeforeRender(this.renderCallback);
      this.currentScene.onPointerObservable.remove(
        this.sceneMouseDown.bind(this)
      );
    }
    for (const spawn of Object.values(this.spawns)) {
      spawn.dispose();
    }
    this.baseSphere?.dispose();
    this.sphereMat?.dispose();
    this.zoneSpawnsNode?.dispose();
    this.baseSphere = null;
    this.sphereMat = null;
    this.spawns = {};
    this.zoneSpawnsNode = null;
  }

  setupSpawnController() {
    this.sphereMat = new StandardMaterial(
      'zone-spawns-material',
      this.currentScene
    );
    this.currentScene.onPointerObservable.add(this.sceneMouseDown.bind(this));
    this.currentScene.registerBeforeRender(this.renderCallback.bind(this));
  }

  onDragBehavior() {
    const scene = this.currentScene;
    if (!scene) {
      return;
    }
    const zoneMesh = scene.getMeshByName('zone');
    if (!zoneMesh) {
      return;
    }

    const node = this.planeDragTarget;

    if (!node) {
      return;
    }
    const pickResult = scene.pick(
      scene.pointerX,
      scene.pointerY,
      (m) => m === zoneMesh,
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
    if (pickResult.hit && pickResult.pickedMesh === zoneMesh) {
      const hitPoint = pickResult.pickedPoint;
      node.position.set(hitPoint.x, hitPoint.y + 5, hitPoint.z);
      node.resetPlane();
      this.tubePath[node.metadata.idx] = new Vector3(
        hitPoint.x,
        hitPoint.y + 5,
        hitPoint.z
      );
      this.updateTube();
    }
  }

  npcLight(spawn) {
    let light = this.currentScene?.getLightById('spawn-light');

    if (!light) {
      // Create the light if it doesn't exist
      light = new PointLight(
        'spawn-light',
        new Vector3(0, 0, 0),
        this.currentScene
      );
    }

    // Set light properties
    light.intensity = 500.0;
    light.diffuse = new Color3(1, 0.84, 0); // Gold color
    light.range = 300;
    light.radius = 50;

    if (!spawn) {
      // If there's no spawn, dispose of the light
      if (light) {
        light.dispose();
      }
      return;
    }

    const spawnMesh = this.spawns[spawn.id]?.rootNode;
    if (spawnMesh) {
      // Attach the light to the spawn mesh's position
      light.position = spawnMesh.position;
    } else {
      // If spawnMesh doesn't exist, dispose of the light
      if (light) {
        light.dispose();
      }
    }
  }
  dynamicPlanes = [];

  renderCallback() {
    for (const plane of this.dynamicPlanes) {
      const distance = this.currentScene.activeCamera.position
        .subtract(plane.position)
        .length();

      // Scale factor based on distance (adjust multiplier as needed)
      const scaleFactor = Math.max(distance / 160, 0.5); // Minimum scale factor to avoid too small billboards

      // Apply the scaling
      plane.scaling = new Vector3(scaleFactor, scaleFactor, scaleFactor);
    }
  }

  updateTube() {
    const scene = this.currentScene;
    const tube = scene.getMeshById('spawn-path');

    if (tube) {
      MeshBuilder.CreateTube(
        'tube',
        {
          path    : this.tubePath,
          radius  : 0.5,
          instance: tube,
        },
        scene
      );
    }
  }

  createGridNode(tube, point, tubeMaterial, idx, selectedIdx, updateCallback) {
    const scene = this.currentScene;
    if (!scene) {
      return;
    }
    const name = `box${idx}`;
    // Create box with initial size, will scale later
    const selected = idx === selectedIdx;
    const size = selected ? 4 : 3;
    const box = MeshBuilder.CreateBox(
      name,
      { height: size, width: size, depth: size },
      scene
    );
    box.parent = tube;
    box.position = point;
    box.material = tubeMaterial;
    box.metadata = {
      emissiveColor: selected ? new Color3(1, 0.5, 0) : new Color3(0, 0.5, 1),
      idx,
    };
    this.ZoneController.glowLayer.addIncludedOnlyMesh(box);

    // Create a dynamic texture for the label
    const dynamicTexture = new DynamicTexture(
      `dynamicTexture${idx}`,
      { width: 256, height: 256 },
      scene,
      false
    );
    dynamicTexture.hasAlpha = true;

    // Define the text, font, and colors
    const text = (idx + 1).toString();
    const font = 'bold 150px Arial';
    const textColor = 'white';
    const outlineColor = '#000';

    // Manual outline by drawing black text at slightly offset positions
    const offset = 4;
    dynamicTexture.drawText(
      text,
      50 - offset,
      140 - offset,
      font,
      outlineColor,
      null,
      true
    );
    dynamicTexture.drawText(
      text,
      50 + offset,
      140 - offset,
      font,
      outlineColor,
      null,
      true
    );
    dynamicTexture.drawText(
      text,
      50 - offset,
      140 + offset,
      font,
      outlineColor,
      null,
      true
    );
    dynamicTexture.drawText(
      text,
      50 + offset,
      140 + offset,
      font,
      outlineColor,
      null,
      true
    );

    // Draw the white text on top
    dynamicTexture.drawText(text, 50, 135, font, textColor, null, true);

    // Create a plane for the billboard
    const plane = MeshBuilder.CreatePlane(
      `labelPlane${idx}`,
      { width: 6, height: 6 },
      scene
    );
    plane.material = new StandardMaterial(`labelMat${idx}`, scene);
    plane.material.diffuseTexture = dynamicTexture;
    plane.material.emissiveColor = new Color3(1, 1, 1); // Set emissive color to make it visible in dark scenes
    plane.material.backFaceCulling = false; // Ensure the texture is visible from all angles
    this.ZoneController.glowLayer.addIncludedOnlyMesh(plane);
    plane.metadata = {
      emissiveColor: selected ? new Color3(1, 0.5, 0) : new Color3(0, 0, 0),
      occludedColor: new Color3(1, 1, 1),
      spawn        : {
        gridIdx: idx,
      },
    };
    const db = new PointerDragBehavior();
    plane.onDragStart = () => {
      this.planeDragTarget = box;
    };
    plane.onDragEnd = () => {
      updateCallback(this.pathPoints[idx], box.position);
    };
    db.onDragStartObservable.add(plane.onDragStart);
    db.onDragEndObservable.add(plane.onDragEnd);
    db.onDragObservable.add(this.onDragBehavior.bind(this));

    db.attach(plane);
    plane.db = db;

    // Position the plane above the box
    plane.position = new Vector3(0, 1 + size, 0);
    plane.parent = box;
    plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    plane.forceRenderingWhenOccluded = true;
    plane.occlusionType = AbstractMesh.OCCLUSION_TYPE_OPTIMISTIC;
    plane.isPickable = true;
    box.resetPlane = () => {
      plane.position = new Vector3(0, 1 + size, 0);
    };
    this.dynamicPlanes.push(plane);
  }

  showSpawnPath(coords, selectedIdx, updateCallback = () => {}) {
    if (!this.currentScene) {
      return;
    }
    for (const plane of this.dynamicPlanes) {
      plane.db.detach();
      plane.db.onDragStartObservable.removeCallback(plane.onDragStart);
      plane.db.onDragEndObservable.removeCallback(plane.onDragEnd);
      plane.db.onDragObservable.removeCallback(this.onDragBehavior);
    }
    this.dynamicPlanes = [];

    if (this.currentScene.getMeshById('spawn-path')) {
      this.currentScene.getMeshById('spawn-path').dispose();
    }
    if (!coords || coords.length === 0) {
      return;
    }
    const path = coords.map((a) => new Vector3(a.y, a.z, a.x));
    this.pathPoints = coords;
    this.tubePath = path;
    if (path.length <= 1) {
      return;
    }
    const tube = MeshBuilder.CreateTube(
      'tube',
      {
        path,
        radius         : 0.5,
        sideOrientation: Mesh.DOUBLESIDE,
        updatable      : true,
      },
      this.currentScene
    );

    tube.id = 'spawn-path';
    const tubeMaterial = new StandardMaterial(
      'tubeMaterial',
      this.currentScene
    );
    tubeMaterial.emissiveColor = new Color3(0, 0.5, 1); // A bright color for glowing effect
    tube.material = tubeMaterial;
    this.ZoneController.glowLayer.addIncludedOnlyMesh(tube);
    tube.metadata = {
      emissiveColor: new Color3(0, 0.5, 1),
    };

    // Place directional boxes along the path with updated scaling
    for (let i = 0; i < path.length; i++) {
      this.createGridNode(
        tube,
        path[i],
        tubeMaterial,
        i,
        selectedIdx,
        updateCallback
      );
    }
  }

  /**
   * @param {PointerInfo} e
   */
  sceneMouseDown(pointerInfo) {
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

        if (
          pointerInfo.pickInfo.hit &&
          (pointerInfo.pickInfo.pickedMesh?.metadata?.debug ?? null) !== null
        ) {
          console.log(
            'Hit debug mesh. METADATA:',
            pointerInfo.pickInfo.pickedMesh?.metadata
          );
        }
        break;
      default:
        break;
    }
  }

  /**
   *
   * @param {string} modelName
   * @returns {Promise<AssetContainer>}
   */
  getAssetContainer(modelName, secondary = false) {
    if (!this.assetContainers[modelName]) {
      this.assetContainers[modelName] = SceneLoader.LoadAssetContainerAsync(
        '/eq/models/',
        `${modelName}.glb`,
        this.currentScene,
        undefined,
        '.glb'
      ).catch(() =>
        secondary
          ? null
          : SceneLoader.LoadAssetContainerAsync(
            '/eq/models/',
            'hum.glb',
            this.currentScene,
            undefined,
            '.glb'
          ).catch(() => null)
      );
    }
    return this.assetContainers[modelName];
  }

  clearAssetContainer() {
    this.assetContainers = {};
  }

  getObjectAssetContainer(objectName, path = 'objects') {
    if (!this.assetContainers[objectName]) {
      this.assetContainers[objectName] = SceneLoader.LoadAssetContainerAsync(
        `/eq/${path}/`,
        `${objectName}.glb`,
        this.currentScene,
        undefined,
        '.glb'
      ).catch(() => {});
    }
    return this.assetContainers[objectName];
  }

  secondaryHelm = (name) => {
    return [
      'bam',
      'baf',
      'erm',
      'erf',
      'elf',
      'elm',
      'gnf',
      'gnm',
      'trf',
      'trm',
      'hum',
      'huf',
      'daf',
      'dam',
      'dwf',
      'dwm',
      'haf',
      'ikf',
      'ikm',
      'ham',
      'hif',
      'him',
      'hof',
      'hom',
      'ogm',
      'ogf',
      'gia',
      'yak',
      'kem',
      'kef',
      'tri',
      'tun',
    ].some((l) => name.startsWith(l));
  };

  skipTextureSwap(modelName) {
    return ['tri', 'tun', 'els', 'rhi', 'ogs', 'aelobject02'].some((l) =>
      modelName.startsWith(l)
    );
  }

  wearsRobe(modelName) {
    return [
      'daf01',
      'dam01',
      'erf01',
      'erm01',
      'gnf01',
      'gnm01',
      'huf01',
      'hum01',
      'ikf01',
      'ikm01',
      'hif01',
      'him01',
    ].includes(modelName);
  }

  async exportSTL() {
    const clone = this.modelExport.rootNode.clone();
    clone.skeleton = this.modelExport.skeleton?.clone();
    const children = clone.getChildMeshes().filter(m => m.name !== 'nameplate').map((c) => {
      c?.clone();
      c?.makeGeometryUnique();
      return c;
    });
    clone.makeGeometryUnique();
    const position = clone.getPositionData(true, true);
    clone.setVerticesData(VertexBuffer.PositionKind, position);
    STLExport.CreateSTL(
      [clone, ...children],
      true,
      `${this.modelExport?.modelName}`,
      undefined,
      undefined,
      false
    );
    clone.dispose();
  }

  async exportFBX(imgCompression) {
    const glb = await this.exportModel(false, false, imgCompression);
    assimpjs({
      locateFile: (file) => {
        return `/static/${file}`;
      },
      print   : console.log,
      printErr: console.error,
    }).then((ajs) => {
      const fileList = new ajs.FileList();
      fileList.AddFile('model.glb', glb);
      const result = ajs.ConvertFileList(fileList, 'fbx');
      window.rr = result;
      if (result.IsSuccess()) {
        const bin = result.GetFile(0).GetContent();
        const assetBlob = new Blob([bin]);
        const assetUrl = URL.createObjectURL(assetBlob);
        const link = document.createElement('a');
        link.href = assetUrl;
        link.download = `${this.modelExport?.modelName}.fbx`;
        link.click();
      }
    });
  }

  async exportModel(
    withAnimations = true,
    download = true,
    imgCompression = 'png'
  ) {
    GlobalStore.actions.setLoading(true);
    GlobalStore.actions.setLoadingTitle(
      `Exporting model ${this.modelExport?.modelName} with animations ${withAnimations}`
    );
    GlobalStore.actions.setLoadingText('LOADING, PLEASE WAIT...');

    let originalPosition;
    if (!withAnimations) {
      const position = this.modelExport.rootNode.getPositionData(true, true);
      originalPosition = this.modelExport.rootNode.getPositionData(
        false,
        false
      );
      this.modelExport.rootNode.setVerticesData(
        VertexBuffer.PositionKind,
        position
      );
      this.modelExport.rootNode.skeleton = null;
    }

    return GLTF2Export.GLBAsync(
      this.currentScene,
      this.modelExport?.modelName,
      {
        shouldExportNode(node) {
          if (node.name === 'nameplate') {
            return false;
          }
          while (node.parent) {
            node = node.parent;
          }
          return node.id === 'model_export';
        },
        shouldExportAnimation() {
          return withAnimations;
        },
      }
    )
      .then(async (glb) => {
        if (!withAnimations) {
          this.modelExport.rootNode.skeleton = this.modelExport.skeleton;
          this.modelExport.rootNode.setVerticesData(
            VertexBuffer.PositionKind,
            originalPosition
          );
        }

        GlobalStore.actions.setLoadingTitle(
          `Optimizing model ${this.modelExport?.modelName}`
        );
        GlobalStore.actions.setLoadingText('Applying GLB optimizations');
        const blob = Object.values(glb.glTFFiles)[0];
        const arr = new Uint8Array(await blob.arrayBuffer());
        const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
        const doc = await io.readBinary(arr);
        await doc.transform(
          dedup(),
          prune(),
          textureCompress({
            targetFormat: imgCompression,
          })
        );
        const bin = await io.writeBinary(doc);
        if (download) {
          const assetBlob = new Blob([bin]);
          const assetUrl = URL.createObjectURL(assetBlob);
          const link = document.createElement('a');
          link.href = assetUrl;
          link.download = `${this.modelExport?.modelName}.glb`;
          link.click();
        }
        return bin;
      })
      .finally(() => {
        GlobalStore.actions.setLoading(false);
      });
  }
  backgroundContainer = null;
  async addBackgroundMesh(blobUrl, { x, y, z }) {
    this.currentScene.getMeshByName('__root__')?.dispose();
    const container = await SceneLoader.LoadAssetContainerAsync(
      '',
      blobUrl,
      this.gc.currentScene,
      undefined,
      '.glb'
    );
    container.addAllToScene();
    const node = this.currentScene.getMeshByName('__root__');

    if (node) {
      node.position.set(x, y, z);
      node.getChildMeshes().forEach((mesh) => {
        if (!mesh.name.includes('MDF')) {
          setTimeout(() => {
            if (mesh.material && mesh.material instanceof BABYLON.PBRMaterial) {
              if (mesh.material.albedoTexture) {
                mesh.material.albedoTexture.uScale = -1;
              }
            }
          }, 1000);
        }
      });
    }
  }

  async addObject(modelName, path) {
    GlobalStore.actions.setLoading(true);
    GlobalStore.actions.setLoadingTitle(`Loading ${modelName}`);
    GlobalStore.actions.setLoadingText('Loading, please wait...');
    this.disposeModel();

    const assetContainer = await this.getObjectAssetContainer(modelName, path);
    if (!assetContainer) {
      GlobalStore.actions.setLoading(false);

      console.warn(`Cannot instantiate ${modelName}`);
      return;
    }
    const instanceContainer = assetContainer.instantiateModelsToScene();
    const animationGroups = instanceContainer.animationGroups;
    animationGroups.forEach((ag) => {
      ag.name = ag.name.replace('Clone of ', '');
    });
    let rootNode = instanceContainer.rootNodes[0];
    if (!rootNode) {
      console.log('No root node for container model', modelName);
      GlobalStore.actions.setLoading(false);
      return;
    }
    rootNode.id = 'model_export';
    rootNode.name = modelName;
    rootNode.position.setAll(0);
    rootNode.scaling.set(1, 1, 1);
    rootNode.rotationQuaternion = null;
    rootNode.rotation.setAll(0);

    const instanceSkeleton = instanceContainer.skeletons[0];
    const skeletonRoot = rootNode.getChildren(undefined, true)[0];
    const merged = Mesh.MergeMeshes(
      rootNode.getChildMeshes(false),
      false,
      true,
      undefined,
      true,
      true
    );

    if (merged) {
      skeletonRoot.parent = merged;
      skeletonRoot.skeleton = instanceSkeleton;
      if (skeletonRoot.skeleton) {
        skeletonRoot.skeleton.name = 'export_model_skeleton';
      }
      rootNode.dispose();
      rootNode = merged;
      rootNode.skeleton = skeletonRoot.skeleton;
      rootNode.id = 'model_export';
      rootNode.name = modelName;
      rootNode.computeWorldMatrix(true);
      rootNode.refreshBoundingInfo();
    }
    rootNode.position.y = 0;
    if (this.modelExport?.modelName !== modelName) {
      this.CameraController.camera.setTarget(rootNode.position.clone());
    }
    if (this.modelExport?.modelName !== modelName) {
      this.doResetCamera = true;
    }

    const hasMorphTargets = rootNode
      .getChildMeshes()
      .some(mesh => mesh.morphTargetManager !== null);

    if (hasMorphTargets) {
      rootNode.visibility = 0;
    }
    this.modelExport = {
      modelName,
      rootNode,
      animationGroups,
      skeleton: skeletonRoot.skeleton,
    };
    GlobalStore.actions.setLoading(false);
    
    return this.modelExport;
  }

  async createItem(item) {
    try {
      const container = await this.getObjectAssetContainer(item, 'items');

      if (!container) {
        console.log('Did not load item model', item);
        return;
      }

      const instanceContainer = container.instantiateModelsToScene();
      instanceContainer.animationGroups?.forEach((ag) =>
        this.currentScene.removeAnimationGroup(ag)
      );
      let rootNode = instanceContainer.rootNodes[0];
      const merged = Mesh.MergeMeshes(
        rootNode.getChildMeshes(false),
        false,
        true,
        undefined,
        true,
        true
      );
      if (merged) {
        rootNode.dispose();
        rootNode = merged;
        rootNode.skeleton = container.skeletons[0];
      }
      return rootNode;
    } catch (e) {
      console.warn(e);
      return null;
    }
  }

  disposeModel() {
    if (this.modelExport) {
      this.modelExport.rootNode.dispose();
      this.modelExport.animationGroups.forEach((a) => a.dispose());
      this.modelExport.skeleton?.dispose?.();
    }
    this.currentScene.meshes.forEach((m) => {
      if (m.id === 'model_export') {
        m.dispose();
      }
    });
    this.currentScene.animationGroups.forEach((ag) => {
      ag.dispose();
    });
    this.currentScene.skeletons.forEach((s) => {
      s.dispose();
    });
  }

  async addExportModel(
    modelName,
    headIdx = 0,
    texture = -1,
    primary = null,
    secondary = null,
    secondaryPoint = false,
    npc = false
  ) {
    const wearsRobe = this.wearsRobe(modelName);
    GlobalStore.actions.setLoading(true);
    GlobalStore.actions.setLoadingTitle(`Loading ${modelName}`);
    GlobalStore.actions.setLoadingText('Loading, please wait...');
    this.modelName = modelName;
    this.disposeModel();

    const assetContainer =
      await window.gameController.SpawnController.getAssetContainer(modelName);
    const instanceContainer = assetContainer?.instantiateModelsToScene();
    if (!instanceContainer) {
      console.log('Did not instantiate models to scene', modelName);
      return;
    }
    const animationGroups = instanceContainer.animationGroups;
    animationGroups.forEach((ag) => {
      ag.name = ag.name.replace('Clone of ', '');
    });
    let rootNode = instanceContainer.rootNodes[0];
    if (!rootNode) {
      console.log('No root node for container model', modelName);
      GlobalStore.actions.setLoading(false);
      return;
    }
    rootNode.refreshBoundingInfo();
    rootNode.id = 'model_export';
    rootNode.name = modelName;
    rootNode.position.setAll(0);
    rootNode.scaling.set(1, 1, 1);
    rootNode.rotationQuaternion = null;
    rootNode.rotation.setAll(0);

    const instanceSkeleton = instanceContainer.skeletons[0];
    const skeletonRoot = rootNode.getChildren(undefined, true)[0];
    const newModel =
      rootNode.getChildTransformNodes()[0]?.metadata?.gltf?.extras?.newModel ??
      false;
    const variation = headIdx.toString().padStart(2, '0') ?? '00';
    const container = await this.getAssetContainer(
      `${rootNode.name.slice(0, 3)}he${variation}`,
      true
    );
    let sec = null;
    if (container) {
      try {
        const secondaryModel = container.instantiateModelsToScene();
        const secondaryRootNode = secondaryModel.rootNodes[0];

        secondaryRootNode.getChildMeshes().forEach((m) => {
          m.parent = rootNode;
        });
        sec = secondaryModel;
      } catch (e) {
        console.warn('Err', e);
      }
    }
    const merged = Mesh.MergeMeshes(
      rootNode.getChildMeshes(false),
      true,
      true,
      undefined,
      true,
      true
    );

    sec?.dispose();

    if (merged) {
      skeletonRoot.parent = merged;
      skeletonRoot.skeleton = instanceSkeleton;
      skeletonRoot.skeleton.name = 'export_model_skeleton';
      rootNode.dispose();
      rootNode = merged;
      rootNode.rotation.y = Math.PI;
      rootNode.skeleton = skeletonRoot.skeleton;
      rootNode.id = 'model_export';
      rootNode.name = modelName;
    }
    // rootNode.position.y = (initialHeight / 2);

    /**
     * @type {MultiMaterial}
     */
    const multiMat = merged.material;
    // if (wearsRobe) {
    //   texture += 10;
    // }
    if (npc && texture !== -1 && !this.skipTextureSwap(modelName)) {
      for (const [idx, mat] of Object.entries(multiMat.subMaterials)) {
        if (!mat?._albedoTexture) {
          continue;
        }

        const isVariationTexture = wearsRobe && texture >= 10;
        let text = isVariationTexture ? texture - 10 : texture;
        if (mat.name.startsWith('clk')) {
          text += 4;
        } else if (wearsRobe) {
          continue;
        }
        const prefix = mat.name.slice(0, mat.name.length - 4);
        const suffix = mat.name.slice(mat.name.length - 4, mat.name.length);
        const textVer = suffix.slice(0, 2);
        const textNum = suffix.slice(2, 4);
        const thisText = text.toString().padStart(2, '0');
        let newFullName = `${prefix}${thisText}${textNum}`;
        const isHead = newFullName.includes(`he${thisText}`);

        if (isHead && newModel) {
          newFullName = `${prefix}sk${textNum}`;
        } else if (isHead && this.secondaryHelm(modelName)) {
          continue;
        }

        if (thisText !== textVer && npc) {
          const exists = await getEQFileExists('textures', `${newFullName}.png`);
          if (!exists) {
            console.log('Texture did not exist, skipping', newFullName);
            continue;
          }
          multiMat.subMaterials[idx]._albedoTexture = new Texture(
            newFullName,
            window.gameController.currentScene,
            mat._albedoTexture.noMipMap,
            mat._albedoTexture.invertY,
            mat._albedoTexture.samplingMode
          );
        }
      }
    }

    rootNode.scaling.z = -1;

    if (primary) {
      const primaryHeld = await this.createItem(primary);
      if (primaryHeld) {
        const transformNode = skeletonRoot
          .getChildTransformNodes()
          .find((a) => a.name.includes('r_point'));
        const primaryBone = skeletonRoot.skeleton.bones.find(
          (b) => b.name === 'r_point'
        );
        if (primaryBone && transformNode) {
          primaryHeld.attachToBone(primaryBone);
          primaryHeld.parent = transformNode;
          primaryHeld.rotationQuaternion = null;
          primaryHeld.rotation.setAll(0);
          primaryHeld.scaling.setAll(1);
          primaryHeld.name = primary;
        } else {
          primaryHeld.dispose();
        }
      }
    }

    if (secondary) {
      const secondaryHeld = await this.createItem(secondary);
      if (secondaryHeld) {
        const secondaryBone = skeletonRoot.skeleton.bones.find(
          (b) => b.name === (secondaryPoint ? 'shield_point' : 'l_point')
        );
        const transformNode = rootNode
          .getChildTransformNodes()
          .find((a) =>
            a.name.includes(secondaryPoint ? 'shield_point' : 'l_point')
          );
        // Some item type check here for shield_point
        if (secondaryBone && transformNode) {
          secondaryHeld.attachToBone(secondaryBone);
          secondaryHeld.parent = transformNode;
          secondaryHeld.rotationQuaternion = null;
          secondaryHeld.rotation.setAll(0);
          secondaryHeld.scaling.setAll(1);
          secondaryHeld.name = secondary;
        } else {
          secondaryHeld.dispose();
        }
      }
    }
    if (this.modelExport?.modelName !== modelName) {
      this.doResetCamera = true;
    }

    this.modelExport = {
      modelName,
      rootNode,
      animationGroups,
      skeleton: skeletonRoot.skeleton,
    };
    GlobalStore.actions.setLoading(false);
    return this.modelExport;
  }

  async addSpawn(modelName, models) {
    for (const [_idx, spawnEntry] of Object.entries(models)) {
      const babylonSpawn = new BabylonSpawn(
        spawnEntry,
        modelName,
        this.zoneSpawnsNode,
        this.sphereMat
      );
      if (!(await babylonSpawn.initializeSpawn())) {
        return;
      }
      this.spawns[spawnEntry.id] = babylonSpawn;
    }
  }

  async deleteSpawn(spawn) {
    this.spawns[spawn.id]?.dispose();
  }

  async updateSpawn(spawn) {
    const firstSpawn = spawn.spawnentries?.[0]?.npc_type;
    const model = raceData.find((r) => r.id === firstSpawn?.race);
    const realModel = (
      model?.[firstSpawn?.gender] ||
      model?.['2'] ||
      'HUM'
    ).toLowerCase();
    const newSpawn = {
      ...firstSpawn,
      ...spawn,
    };
    this.spawns[spawn.id]?.dispose();
    this.addSpawn(realModel, [newSpawn]);
  }

  async addSpawns(spawns, skipDispose = false) {
    if (!this.currentScene || spawns.length === 0) {
      return;
    }
    if (!this.gc.settings.showSpawns) {
      return;
    }

    this.zoneSpawnsNode = this.currentScene?.getNodeById('zone-spawns');
    if (!this.zoneSpawnsNode) {
      this.zoneSpawnsNode = new TransformNode('zone-spawns', this.currentScene);
    }
    this.zoneSpawnsNode.setEnabled(true);
    this.zoneSpawnsNode.id = 'zone-spawns';
    if (!skipDispose) {
      this.zoneSpawnsNode.getChildren().forEach((c) => c.dispose());
    }

    const spawnList = {};
    let count = 0;
    for (const spawn of spawns) {
      if (
        spawn.id !== 10787 && // Guard Mezzt
        //  spawn.id !== 10811 && // Tubal Weaver
        // spawn.id !== 10783 // && // POD
        spawn.id !== 10847 // connie link
      ) {
        if (import.meta.env.VITE_LOCAL_DEV === 'true') {
          // continue;
        }
      }
      const firstSpawn = spawn.spawnentries?.[0]?.npc_type;
      const model = raceData.find((r) => r.id === firstSpawn?.race);
      const realModel = (
        model?.[firstSpawn?.gender] ||
        model?.['2'] ||
        'HUM'
      ).toLowerCase();
      if (!spawnList[realModel]) {
        spawnList[realModel] = [];
      }
      count++;
      spawnList[realModel].push({
        ...firstSpawn,
        ...spawn,
      });
    }

    this.actions.setLoading(true);
    this.actions.setLoadingTitle('Loading Spawns');
    let loadedCount = 0;
    this.actions.setLoadingText(`Loaded ${loadedCount} of ${count} spawns`);

    this.actions.setLoading(true);

    // Preprocess globalload
    this.actions.setLoadingTitle('Loading Global Dependencies');

    const existingMetadata = await getEQFile('data', 'global.json', 'json');

    if (existingMetadata?.version !== GLOBAL_VERSION) {
      await processGlobal(this.gc.settings, this.gc.rootFileSystemHandle);
    }

    await Promise.all(
      Object.entries(spawnList).map(([modelName, models]) =>
        this.addSpawn(modelName, models).then(() => {
          loadedCount += models.length;
          this.actions.setLoadingText(
            `Loaded ${loadedCount} of ${count} spawns`
          );
        })
      )
    );
    GlobalStore.actions.setLoading(false);
  }

  setSpawnLOD(value) {
    /**
     * @type {[BabylonSpawn]}
     */
    const allSpawns = Object.values(this.spawns);
    for (const spawn of allSpawns) {
      spawn.setLods(value);
    }
  }

  moveSpawn(infSpawn) {
    const spawn = this.spawns[infSpawn.id];
    if (spawn) {
      spawn.rootNode.position.set(infSpawn.y, infSpawn.z, infSpawn.x);
    }
  }
  /**
   *
   * @param {BabylonSpawn} spawn
   */
  enableSpawn(_spawn) {}

  /**
   *
   * @param {BabylonSpawn} spawn
   */
  disableSpawn(_spawn) {}

  updateSpawns(_position) {}
}

export const spawnController = new SpawnController();
