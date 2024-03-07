import {
  Color3,
  Mesh,
  PointLight,
  PointerEventTypes,
  SceneLoader,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import raceData from '../common/raceData.json';

import { GameControllerChild } from './GameControllerChild';
import { BabylonSpawn } from '../models/BabylonSpawn';
import { MeshBuilder } from 'babylonjs';
import { GlobalStore } from '../../state';

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
        SceneLoader.LoadAssetContainerAsync(
          '/eq/models/',
          secondary ? 'humhe00.glb' : 'hum.glb',
          this.currentScene,
          undefined,
          '.glb'
        )
      );
    }
    return this.assetContainers[modelName];
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
        spawn.id !== 10787 // && // Guard Mezzt
        // spawn.id !== 10706 && // Guard Rashik
        //  spawn.id !== 10811 && // Tubal Weaver
        // spawn.id !== 10783 // && // POD
        //  spawn.id !== 10847 // connie link
        //  spawn.id !== 10809 // Felodious Sworddancer
      ) {
        // continue;
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
        spawnentries: spawn.spawnentries ?? [],
        grid        : spawn.grid,
        x           : spawn.x,
        y           : spawn.y,
        z           : spawn.z,
        spawn_id    : spawn.id,
        heading     : spawn.heading,
      });
    }

    this.actions.setLoading(true);
    this.actions.setLoadingTitle('Loading Spawns');
    let loadedCount = 0;
    this.actions.setLoadingText(`Loaded ${loadedCount} of ${count} spawns`);

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
  /**
   *
   * @param {BabylonSpawn} spawn
   */
  enableSpawn(spawn) {}

  /**
   *
   * @param {BabylonSpawn} spawn
   */
  disableSpawn(spawn) {}

  updateSpawns(position) {}
}

export const spawnController = new SpawnController();
