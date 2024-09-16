import { Engine } from '@babylonjs/core/Engines/engine';
import { Sound } from '@babylonjs/core/Audio/sound';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

import { Vector3 as ThreeVector3 } from 'three';
import { PointOctree } from 'sparse-octree';
import { GameControllerChild } from './GameControllerChild';

const musicUrl = 'https://eqrequiem.blob.core.windows.net/assets/music/';

class MusicController extends GameControllerChild {
  currentPlaying = null;

  /**
   * @type {import('@babylonjs/core/scene').Scene}
   */
  #scene = null;

  /**
   * @type {import('sparse-octree').PointOctree}
   */
  octree = null;

  /**
   * @type {number}
   */
  maxRadius = 0;

  /**
   * @type {Array<{ sound: import('@babylonjs/core/Audio').Sound, track: object }>}
   */
  zoneTracks = [];

  /**
   * @type {number}
   */
  currentTrack = -1;
  
  /**
   * @type {number}
   */
  currentTimeout = -1;

  /**
   * @type {boolean}
   */
  checkOutsideRadius = false;

  touchEventListener = null;
  playCallback = null;

  dispose() {
    this.zoneTracks.forEach(({ sound }) => {
      sound.dispose();
    });
    this.zoneTracks = [];
  }

  play(idx) {
    clearTimeout(this.currentTimeout);
    const { sound, track } = this.zoneTracks[idx];
    sound.play();
    sound.setVolume(1, 0.5);
    sound.onEndedObservable.addOnce(() => {
      this.currentTrack = -1;
    });
    this.checkOutsideRadius = false;
    this.currentTimeout = setTimeout(() => {
      this.checkOutsideRadius = true;
    }, track.fadeMs);
  }

  stopAll() {
    this.currentTrack = -1;
    this.checkOutsideRadius = false;
    this.zoneTracks.forEach(({ sound }) => {
      sound.setVolume(0, 2);
    });

    setTimeout(() => {
      if (this.currentTrack === -1) {
        this.zoneTracks.forEach(({ sound }) => {
          sound.stop();
        });
      }
    }, 2000);
  }

  hookUpZoneMusic(scene, zoneName, tracks, aabbTree) {
    // Disable the default audio unlock button
    Engine.audioEngine.useCustomUnlockedButton = true;

    // Global Volume 
    Engine.audioEngine.setGlobalVolume(0.5);
    
    // Unlock audio on first user interaction.
    window.addEventListener('click', () => {
      if (!Engine.audioEngine.unlocked) {
        Engine.audioEngine.unlock();
      }
    }, { once: true });

    window.addEventListener('touchend', () => {
      if (!Engine.audioEngine.unlocked) {
        Engine.audioEngine.unlock();
      }
      if (this.playCallback) {
        this.playCallback();
        this.playCallback = null;
      }
    });
    this.#scene = scene;
    this.zoneTracks = tracks.map((t, idx) => {
      return {
        track: t,
        sound: new Sound(`${zoneName}-${idx}`, `${musicUrl}${zoneName}.xmi(${t.dayId + 1}).mp3`, scene)
      };
    });

    this.maxRadius = tracks.reduce((acc, val) => acc > val.radius ? acc : val.radius, 0);
    const { min, max } = aabbTree;
    this.octree = new PointOctree(new ThreeVector3(min.x, min.y, min.z), new ThreeVector3(max.x, max.y, max.z));
    this.zoneTracks.forEach(({ track }, idx) => {
      const [x, z, y] = track.pos;
      this.octree.set(new ThreeVector3(x, y, z), idx);
    });
  }


  updateMusic(position) {
    if (!Engine.audioEngine.unlocked) {
      return;
    }
    if (this.currentTrack !== -1 && this.checkOutsideRadius) {
      const { track: currentTrack } = this.zoneTracks[this.currentTrack];
      if (Vector3.Distance(position, new Vector3(...currentTrack.pos)) > currentTrack.radius) {
        this.stopAll();
      }
    }

    const threePosition = new ThreeVector3(position.x, position.z, position.y);
    const trackIndex = this.octree.findPoints(threePosition, this.maxRadius, true).sort((a, b) => a.distance - b.distance).slice(0, 1)?.[0]?.data ?? null;
    if (trackIndex !== null && this.currentTrack !== trackIndex) {
      const { track } = this.zoneTracks[trackIndex];
      if (Vector3.Distance(position, new Vector3(...track.pos)) < track.radius) {
        this.playCallback = () => {
          this.stopAll();
          this.currentTrack = trackIndex;
          this.play(trackIndex);
        };
        this.playCallback();
      }
    }
  }
}
window.Vector3 = Vector3;
export const musicController = new MusicController();