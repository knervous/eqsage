export class GameControllerChild {
  /** @type {import('./GameController').GameController} */
  #gc = null;

  setGameController(gameController) {
    this.#gc = gameController;
  }

  get gc() {
    return this.#gc;
  }

  get canvas() {
    return this.#gc.canvas;
  }

  get engine() {
    return this.#gc.engine;
  }

  get actions() {
    return this.#gc.actions;
  }

  get currentScene() {
    return this.#gc.currentScene;
  }

  get state() {
    return this.#gc.state;
  }

  get loading() {
    return this.#gc.loading;
  }

  get exploreMode() {
    return this.#gc.exploreMode;
  }

  zone(zoneName, location) {
    return this.#gc.loadModel(zoneName, false, location);
  }
  setLoading(val) {
    this.#gc.setLoading(val);
  }

  get zoneLoaded() {
    return this.#gc.ZoneController.zoneLoaded;
  }

  get ZoneController() {
    return this.#gc.ZoneController;
  }

  get ZoneBuilderController() {
    return this.#gc.ZoneBuilderController;
  }

  get CameraController () {
    return this.#gc.CameraController;
  }
  get LightController () {
    return this.#gc.LightController;
  }
  get SkyController () {
    return this.#gc.SkyController;
  }
  get MusicController () {
    return this.#gc.MusicController;
  }
  get SoundController () {
    return this.#gc.SoundController;
  }
  get SpawnController () {
    return this.#gc.SpawnController;
  }
  get GuiController () {
    return this.#gc.GuiController;
  }
  get ItemController () {
    return this.#gc.ItemController;
  }
  get NetLoginController () {
    return this.#gc.NetLoginController;
  }
  get NetWorldController () {
    return this.#gc.NetWorldController;
  }
  get NetZoneController () {
    return this.#gc.NetZoneController;
  }
}