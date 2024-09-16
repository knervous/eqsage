import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';

import { GameControllerChild } from './GameControllerChild';

const itemsUrl = 'https://eqrequiem.blob.core.windows.net/assets/items/';

/**
 * @typedef {import('@babylonjs/core').AssetContainer} AssetContainer
 */

class ItemController extends GameControllerChild {
  /**
   * @type {import('@babylonjs/core/scene').Scene} scene
   */
  #scene = null;

  /**
   * @type {Object.<string, Promise<AssetContainer>}
   */
  assetContainers = {};

  dispose() {
    this.assetContainers = {};
  }

  setupItemController (scene) {
    this.#scene = scene;
  } 

  /**
   * 
   * @param {string} item 
   * @returns {Promise<AssetContainer>}
   */
  getAssetContainer(item) {
    if (!this.assetContainers[item]) {
      this.assetContainers[item] = SceneLoader.LoadAssetContainerAsync(itemsUrl, `it${item}.glb.gz`, this.#scene, undefined, '.glb');
    }
    return this.assetContainers[item];
  }
  /**
   * 
   * @param {string} item 
   * @returns {Promise<import('@babylonjs/core').AbstractMesh>}
   */
  async createItem(item) {
    while (!this.#scene) {
      await new Promise(res => setTimeout(res, 10));
    }
    try {
      const container = await this.getAssetContainer(item);
  
      if (!container) { 
        console.log('Did not load item model', item);
        return;
      }
  
      const instanceContainer = container.instantiateModelsToScene();
      instanceContainer.animationGroups?.forEach(ag => this.#scene.removeAnimationGroup(ag));
      let rootNode = instanceContainer.rootNodes[0];
      const merged = Mesh.MergeMeshes(rootNode.getChildMeshes(false), false, true, undefined, true, true);
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
}

export const itemController = new ItemController();