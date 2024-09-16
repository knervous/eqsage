import { Sound } from '@babylonjs/core/Audio/sound';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { GameControllerChild } from './GameControllerChild';
const musicUrl = 'https://eqrequiem.blob.core.windows.net/assets/sounds/';

class SoundController extends GameControllerChild {
  zoneSounds = [];
  dispose() {
    this.zoneSounds.forEach(sound => {
      sound.dispose();
    });
    this.zoneSounds = [];
  }

  hookUpZoneSounds(scene, _sound2, sound3d) {
    sound3d.forEach((sound, idx) => {
      const spatialSound = new Sound(`${sound.sound}_${idx}`, `${musicUrl}${sound.sound}.wav`, scene, null, {
        loop        : true,
        autoplay    : true,
        spatialSound: true,
        panningModel: 'HRTF',
        maxDistance : sound.radius,
        volume      : sound.volume
      });
      const [x, y, z] = sound.pos;
      spatialSound.setPosition(new Vector3(x, y, z));
      this.zoneSounds.push(spatialSound);

    });
  }
}

export const soundController = new SoundController();