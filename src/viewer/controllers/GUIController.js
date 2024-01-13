import { GameControllerChild } from './GameControllerChild';

class GUIController extends GameControllerChild {
  /**
     * @type {GUI3DManager}
     */
  manager = null;
  dispose() {
    
  }

  setupGuiController (_scene) {
    // this.manager = AdvancedDynamicTexture.CreateFullscreenUI('UI');
  }
}

export const guiController = new GUIController();