import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Tools } from '@babylonjs/core/Misc/tools.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { GameControllerChild } from './GameControllerChild';
import { eqtoBabylonVector } from '../util/vector';

class CameraController extends GameControllerChild {
  /**
   * @type {import('@babylonjs/core/Cameras').UniversalCamera}
   */
  camera = null;
  isLocked = false;
  speedModified = false;
  VIEWS = {
    GOOD: {
      position: new Vector3(90, 20, 1),
      rotation: new Vector3(0.024, -1.5754, 0),
    },
    EVIL: {
      position: new Vector3(-90.024, 30.407, -313.65),
      rotation: new Vector3(0.15828, 7.87398, 0),
    },
  };

  dispose() {
    if (this.camera) {
      this.camera.dispose();
    }
    document.removeEventListener(
      'pointerlockchange',
      this.onChangePointerLock,
      false
    );
    document.removeEventListener(
      'mspointerlockchange',
      this.onChangePointerLock,
      false
    );
    document.removeEventListener(
      'mozpointerlockchange',
      this.onChangePointerLock,
      false
    );
    document.removeEventListener(
      'webkitpointerlockchange',
      this.onChangePointerLock,
      false
    );
    document.removeEventListener('keydown', this.keyDownHandler);
    document.exitPointerLock();
    if (this.canvas) {
      this.canvas.removeEventListener('wheel', this.scrollHandler);
    }
    this.isLocked = false;
    this.speedModified = false;
  }

  constructor() {
    super();
    this.onChangePointerLock = this.onChangePointerLock.bind(this);
    this.keyDownHandler = this.keyDownHandler.bind(this);
    this.keyUpHandler = this.keyUpHandler.bind(this);
    this.scrollHandler = this.scrollHandler.bind(this);
    this.sceneMouseDown = this.sceneMouseDown.bind(this);
    this.sceneMouseUp = this.sceneMouseUp.bind(this);
  }

  scrollHandler(event) {
    const delta = event.deltaY;
    const zoomSpeed = 50; // Adjust the speed of zooming
    const zoomDirection = delta > 0 ? -1 : 1; // Determine the direction to zoom

    // Calculate the new position
    const forward = this.camera
      .getTarget()
      .subtract(this.camera.position)
      .normalize();
    forward.scaleInPlace(zoomSpeed * zoomDirection);

    // Update the camera position
    this.camera.position.addInPlace(forward);

    // Prevent the page from scrolling
    event.preventDefault();
  }

  swapCharacterSelectView(view) {
    this.camera.position.set(view.position.x, view.position.y, view.position.z);
    this.camera.rotation.set(view.rotation.x, view.rotation.y, view.rotation.z);
  }

  onChangePointerLock = () => {
    const controlEnabled =
      document.mozPointerLockElement ||
      document.webkitPointerLockElement ||
      document.msPointerLockElement ||
      document.pointerLockElement ||
      null;
    if (!controlEnabled) {
      this.isLocked = false;
    } else {
      this.isLocked = true;
    }
  };

  keyDownHandler = (e) => {
    if (e.key === ' ') {
      this.camera.position.y += 5;
    }
    if (e.key === 'Shift' && !this.speedModified) {
      this.speedModified = true;
      this.camera.speed *= 3;
    }
  };

  keyUpHandler = (e) => {
    if (e.key === 'Shift' && this.speedModified) {
      this.speedModified = false;
      this.camera.speed /= 3;
    }
  };

  /**
   * @param {MouseEvent}e
   */
  sceneMouseDown(e) {
    if (
      (e.button === 2 && !this.isLocked && this.canvas.requestPointerLock) ||
      this.canvas.msRequestPointerLock ||
      this.canvas.mozRequestPointerLock ||
      this.canvas.webkitRequestPointerLock
    ) {
      try {
        this.canvas.requestPointerLock();
      } catch {}
    }
  }

  sceneMouseUp(e) {
    if (e.button === 2) {
      document.exitPointerLock();
    }
  }

  createModelCamera = () => {
    this.camera = new ArcRotateCamera(
      '__camera__',
      Tools.ToRadians(45),
      Tools.ToRadians(45),
      10,
      new Vector3(-15, 5, 0.6),
      this.currentScene
    );

    this.camera.attachControl(this.canvas);
    this.camera.panningSensibility = 1000;
    this.camera.wheelPrecision = 25;
  };

  /**
   *
   * @param {import('@babylonjs/core').Vector3} position
   * @returns
   */
  createCamera = (position) => {
    if (!position) {
      const { safe_x, safe_y, safe_z } = this.state.zoneInfo;
      position = eqtoBabylonVector(safe_x, safe_y, safe_z);
    }
    if (sessionStorage.getItem('cam-loc')) {
      const { x, y, z } = JSON.parse(sessionStorage.getItem('cam-loc'));
      position = new Vector3(x, y, z);
    }
    position.y += 2;
    this.camera = new UniversalCamera(
      '__camera__',
      position,
      this.currentScene
    );
    this.camera.setTarget(new Vector3(1, 10, 1));
    this.camera.touchAngularSensibility = 5000;
    this.camera.ellipsoid = new Vector3(4, 4.5, 2);
    this.camera.checkCollisions = false;
    this.camera.attachControl(this.canvas, true);
    this.camera.keysUp.push(87);
    this.camera.keysDown.push(83);
    this.camera.keysRight.push(68);
    this.camera.keysLeft.push(65);
    this.camera.keysUpward.push(32);
    this.camera.speed = 2;
    document.addEventListener('keydown', this.keyDownHandler.bind(this));
    document.addEventListener('keyup', this.keyUpHandler.bind(this));
    this.canvas.addEventListener('wheel', this.scrollHandler.bind(this));

    document.addEventListener(
      'pointerlockchange',
      this.onChangePointerLock,
      false
    );
    document.addEventListener(
      'mspointerlockchange',
      this.onChangePointerLock,
      false
    );
    document.addEventListener(
      'mozpointerlockchange',
      this.onChangePointerLock,
      false
    );
    document.addEventListener(
      'webkitpointerlockchange',
      this.onChangePointerLock,
      false
    );
  };
}

export const cameraController = new CameraController();
