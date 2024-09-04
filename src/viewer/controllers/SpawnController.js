import {
  Color3,
  Mesh,
  PBRMaterial,
  PointLight,
  PointerEventTypes,
  SceneLoader,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { WebIO } from '@gltf-transform/core';

import raceData from '../common/raceData.json';

import { GameControllerChild } from './GameControllerChild';
import { BabylonSpawn } from '../models/BabylonSpawn';
import { MeshBuilder } from '@babylonjs/core';
import { GlobalStore } from '../../state';
import { GLTF2Export } from '@babylonjs/serializers';
import { dedup, prune, textureCompress } from '@gltf-transform/functions';
import { getEQFile } from '../../lib/util/fileHandler';
import { GLOBAL_VERSION, processGlobal } from '../../components/zone/processZone';

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
  }

  npcLight(spawn) {
    const light =
      this.currentScene?.getLightById('spawn-light') ??
      new PointLight('spawn-light', this.currentScene);
    light.intensity = 500.0;
    light.diffuse = new Color3(1, 0.84, 0); // RGB for gold color
    light.range = 300;
    light.radius = 50;

    if (!spawn) {
      if (light) {
        light.dispose();
      }
      return;
    }
    const spawnMesh = this.spawns[spawn.id]?.rootNode;
    if (spawnMesh) {
      light.position = spawnMesh.position;
    } else {
      if (light) {
        light.dispose();
      }
    }
  }

  showSpawnPath(coords) {
    if (!this.currentScene) {
      return;
    }
    if (this.currentScene.getMeshById('spawn-path')) {
      this.currentScene.getMeshById('spawn-path').dispose();
    }
    if (coords.length === 0) {
      return;
    }
    const path = coords.map((a) => new Vector3(a.y, a.z, a.x));
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

    // Function to create an arrow
    const createDirectionalBox = (name, point, scene) => {
      // Create box with initial size, will scale later
      const box = MeshBuilder.CreateBox(
        name,
        { height: 2, width: 2, depth: 2 },
        scene
      );
      box.parent = tube;
      box.position = point;
      box.material = tubeMaterial;
      box.metadata = {
        emissiveColor: new Color3(0, 0.5, 1),
      };
      this.ZoneController.glowLayer.addIncludedOnlyMesh(box);
    };

    // Place directional boxes along the path with updated scaling
    for (let i = 0; i < path.length - 1; i++) {
      createDirectionalBox(`box${i}`, path[i], this.currentScene);
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

  async exportModel() {
    GlobalStore.actions.setLoading(true);
    GlobalStore.actions.setLoadingTitle(
      `Exporting model ${this.modelExport?.modelName}`
    );
    GlobalStore.actions.setLoadingText('LOADING, PLEASE WAIT...');
    GLTF2Export.GLBAsync(this.currentScene, this.modelExport?.modelName, {
      shouldExportNode(node) {
        while (node.parent) {
          node = node.parent;
        }
        return node.id === 'model_export';
      },
    })
      .then(async (glb) => {
        GlobalStore.actions.setLoadingTitle(
          `Optimizing model ${this.modelExport?.modelName}`
        );
        GlobalStore.actions.setLoadingText('Applying GLB optimizations');
        const blob = Object.values(glb.glTFFiles)[0];
        const arr = new Uint8Array(await blob.arrayBuffer());
        const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
        const doc = await io.readBinary(arr);
        console.log('set', this.gc.settings);
        await doc.transform(
          dedup(),
          prune(),
          textureCompress({
            targetFormat: this.gc.settings.imgCompression,
          })
        );
        const bin = await io.writeBinary(doc);
        const assetBlob = new Blob([bin]);
        const assetUrl = URL.createObjectURL(assetBlob);
        const link = document.createElement('a');
        link.href = assetUrl;
        link.download = `${this.modelExport?.modelName}.glb`;
        link.click();
      })
      .finally(() => {
        GlobalStore.actions.setLoading(false);
      });
  }

  async addObject(modelName, path) {
    GlobalStore.actions.setLoading(true);
    GlobalStore.actions.setLoadingTitle(`Loading ${modelName}`);
    GlobalStore.actions.setLoadingText('Loading, please wait...');
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
    }
    this.CameraController.camera.setTarget(rootNode.position);
    rootNode.scaling.z = -1;

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

  async addExportModel(
    modelName,
    headIdx = 0,
    texture = -1,
    primary = null,
    secondary = null,
    secondaryPoint = 0
  ) {
    const wearsRobe = this.wearsRobe(modelName);
    GlobalStore.actions.setLoading(true);
    GlobalStore.actions.setLoadingTitle(`Loading ${modelName}`);
    GlobalStore.actions.setLoadingText('Loading, please wait...');
    this.modelName = modelName;
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

    const assetContainer =
      await window.gameController.SpawnController.getAssetContainer(modelName);
    const instanceContainer = assetContainer?.instantiateModelsToScene();
    if (!instanceContainer) {
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
    rootNode.id = 'model_export';
    rootNode.name = modelName;
    rootNode.position.setAll(0);
    rootNode.scaling.set(1, 1, 1);
    rootNode.rotationQuaternion = null;
    rootNode.rotation.setAll(0);

    const instanceSkeleton = instanceContainer.skeletons[0];
    const skeletonRoot = rootNode.getChildren(undefined, true)[0];
    const newModel = rootNode.getChildTransformNodes()[0]?.metadata?.gltf?.extras?.newModel ?? false;
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
      rootNode.skeleton = skeletonRoot.skeleton;
      rootNode.id = 'model_export';
      rootNode.name = modelName;
    }

    /**
     * @type {MultiMaterial}
     */
    const multiMat = merged.material;
    if (wearsRobe) {
      texture += 10;
    }
    if (texture !== -1 && !this.skipTextureSwap(modelName)) {
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
        } else if (
          isHead &&
          this.secondaryHelm(modelName)
        ) {
          continue;
        }

        if (thisText !== textVer) {
          const existing = window.gameController.currentScene.materials
            .flat()
            .find((m) => m.name === newFullName);
          if (existing) {
            multiMat.subMaterials[idx] = existing;
          } else {
            const newMat = new PBRMaterial(newFullName);
            newMat.metallic = 0;
            newMat.roughness = 1;
            newMat._albedoTexture = new Texture(
              newFullName,
              window.gameController.currentScene,
              mat._albedoTexture.noMipMap,
              mat._albedoTexture.invertY,
              mat._albedoTexture.samplingMode
            );
            multiMat.subMaterials[idx] = newMat;
          }
        }
      }
    }

    this.CameraController.camera.setTarget(rootNode.position);
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
          primaryHeld.scaling.x = -1;
          primaryHeld.name = primary;
        } else {
          primaryHeld.dispose();
        }
      }
    }

    if (secondary) {
      const secondaryHeld = await this.createItem(secondary);
      if (secondaryHeld) {
    
        const secondaryBone = skeletonRoot.skeleton.bones.find((b) =>
          b.name === (secondaryPoint === 0 ? 'l_point' : 'shield_point')
        );
        const transformNode = rootNode
          .getChildTransformNodes()
          .find((a) =>
            a.name.includes(secondaryPoint === 0 ? 'l_point' : 'shield_point')
          );
        // Some item type check here for shield_point
        if (secondaryBone && transformNode) {
          secondaryHeld.attachToBone(secondaryBone);
          secondaryHeld.parent = transformNode;
          secondaryHeld.rotationQuaternion = null;
          secondaryHeld.rotation.setAll(0);

          secondaryHeld.scaling.setAll(1);
          secondaryHeld.scaling.x = -1;
          secondaryHeld.name = secondary;

        } else {
          secondaryHeld.dispose();
        }
      }
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

  async addSpawns(spawns) {
    if (!this.currentScene || spawns.length === 0) {
      return;
    }

    this.zoneSpawnsNode = this.currentScene?.getNodeById('zone-spawns');
    if (!this.zoneSpawnsNode) {
      this.zoneSpawnsNode = new TransformNode('zone-spawns', this.currentScene);
    }
    this.zoneSpawnsNode.setEnabled(true);
    this.zoneSpawnsNode.id = 'zone-spawns';
    this.zoneSpawnsNode.getChildren().forEach((c) => c.dispose());

    const spawnList = {};
    let count = 0;
    for (const spawn of spawns) {
      if (
        spawn.id !== 10787 && // Guard Mezzt
        // spawn.id !== 10706 && // Guard Rashik
        //  spawn.id !== 10811 && // Tubal Weaver
        // spawn.id !== 10783 // && // POD
        spawn.id !== 10847 // connie link
        //  spawn.id !== 10809 // Felodious Sworddancer
      ) {
        if (process.env.LOCAL_DEV === 'true') {
          continue;
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
