import { TypedArrayReader } from '../../util/typed-array-reader';


class Music {

}

class Sound2D {

}

class Sound3D {

}

const EntryLengthInBytes = 84;

class EmissionType {
  static None = 0;
    
  /**
   * @summary Emitted sounds - things like bird noises
   */
  static Emit = 1;

  /**
   * @summary Looped sounds - things like the ocean or a lake
   */
  static Loop = 2;

  /**
   * @summary Sounds that are internal to the client
   */
  static Internal = 3;

  /**
   * @summary mp3 from mp3index.txt
   */
  static Mp3 = 4;
}

const clientSounds = {
  39 : 'death_me',
  143: 'thunder1',
  144: 'thunder2',
  158: 'wind_lp1',
  159: 'rainloop',
  160: 'torch_lp',
  161: 'watundlp',
};

export class SoundInstance {
  type = 0;
  soundFile = '';
  reserved = 0;
  whenActive = 0;
  volume = 1;
  fadeInMs = 500;
  fadeOutMs = 1000;
  wavLoopType = 0;
  x = 0;
  y = 0;
  z = 0;
  wavFullVolRadius = 50;
  wavMaxAudibleDistance = 50;
  randomizeLocation = 0;
  activationRange = 50;
  minRepeatDelay = 0;
  maxRepeatDelay = 0;
  xmiIndex = 0;
  echoLevel = 0;
  isEnvSound = 1;

  /**
   * 
   * @returns {SoundInstance}
   */
  clone() {
    return Object.assign(new SoundInstance(), JSON.parse(JSON.stringify(this)));
  }

  /**
   * 
   * @returns {SoundInstance}
   */
  static fromObject(obj) {
    return Object.assign(new SoundInstance(), obj);
  }

  getEmtString() {
    return [
      this.type,
      this.soundFile,
      this.reserved,
      this.whenActive,
      this.volume,
      this.fadeInMs,
      this.fadeOutMs,
      this.wavLoopType,
      this.x,
      this.y,
      this.z,
      this.wavFullVolRadius,
      this.wavMaxAudibleDistance,
      this.randomizeLocation,
      this.activationRange,
      this.minRepeatDelay,
      this.maxRepeatDelay,
      this.xmiIndex,
      this.echoLevel,
      this.isEnvSound
    ].join(',');
  }
}
export class Sound {
  /**
     * @type {import('../../util/typed-array-reader').TypedArrayReader}
     */
  reader = null;

  sounds = [];

  loop = [];
  emit = [];
  mp3List = [];
  zoneName = '';
  constructor(buffer, bank, mp3List, zoneName) {
    this.zoneName = zoneName;
    this.reader = new TypedArrayReader(buffer);
    this.mp3List = mp3List.split('\r\n');
    const contents = bank.split('\r\n');
    let loopType = null;
    for (const line of contents) {
      const trimmed = line.trim();
      if (trimmed === 'LOOP') {
        loopType = 0;
        continue;
      } else if (trimmed === 'EMIT') {
        loopType = 1;
        continue;
      }

      switch (loopType) {
        case 0:
          this.loop.push(trimmed);
          break;
        case 1:
          this.emit.push(trimmed);
          break;
        default:break;
      }
    }
    this.init();
  }

  getEmissionType(soundId) {
    if (soundId < 0) {
      return EmissionType.Mp3;
    }
    if (soundId <= 0) {
      return EmissionType.None;
    }

    if (soundId < 32) {
      return EmissionType.Emit;
    }

    return soundId < 162 ? EmissionType.Internal : EmissionType.Loop;
  }

  getSoundName(id) {
    const emissionType = this.getEmissionType(id);
    switch (emissionType) {
      case EmissionType.None:
        return '';
      case EmissionType.Emit:
        return this.emit[id - 1];
      case EmissionType.Loop:
        return this.loop[id - 162];
      case EmissionType.Internal:
        return clientSounds[id];
      case EmissionType.Mp3:
        return this.mp3List[-id];
      default:
        return '';
    }
  }

  init() {
    const entryCount = this.reader.buffer.byteLength / EntryLengthInBytes;
    for (let i = 0; i < entryCount; i++) {
      const [_reserved, _sequence] = this.reader.readManyInt32(2);
      this.reader.addCursor(8);
      const [x, y, z, radius] = this.reader.readManyFloat32(4);
      const [cooldown1, cooldown2, randomDelay, _unk, soundId1, soundId2] = this.reader.readManyInt32(6);
      const type = this.reader.readUint8(); // 0 = Sound2d, 1 = Music, 2 = Sound2d, 3 = Sound3d
      this.reader.addCursor(3);
      const [asDistance, _unk1, fadeOutMs, _unk2, fullVolRange, _unk3] = this.reader.readManyInt32(6);
      const name = this.getSoundName(soundId1);
      let name2 = this.getSoundName(soundId2);
      const entry = new SoundInstance();
      entry.type = type;
      entry.soundFile = name.includes('.') ? name : `${name}.wav`;
   
      switch (type) {
        case 0: { // Day/night sound effect, constant volume
          entry.whenActive = 1;
          break;
        }
        case 1: { // Background music
          entry.soundFile = soundId1 < 0 ? name : soundId1 === 0 ? '' : `${this.zoneName}.xmi`;
          name2 = soundId2 < 0 ? name2 : soundId2 === 0 ? '' : `${this.zoneName}.xmi`;
          entry.whenActive = soundId1 === soundId2 ? 0 : 1;
          entry.xmiIndex = soundId1 > 0 && soundId1 < 32 ? soundId1 : 0;
          break;
        }
        case 2: { // Static sound effect
          entry.volume = asDistance < 0 ? 0 : asDistance > 3000 ? 0 : (3000 - asDistance);
          break;
        }
        case 3: { // 3d sound effect
          entry.volume = asDistance < 0 ? 0 : asDistance > 3000 ? 0 : (3000 - asDistance);
          entry.whenActive = 1;
          break;
        }
        default:
          break;
      }

      entry.fadeOutMs = fadeOutMs < 0 ? 0 : fadeOutMs < 100 ? 100 : fadeOutMs;
      entry.fadeInMs = Math.min(fadeOutMs / 2, 5000);
      entry.x = x;
      entry.y = y;
      entry.z = z;
      if (type !== 1) {
        entry.wavLoopType = cooldown1 <= 0 && randomDelay <= 0 ? 0 : 1;
        entry.minRepeatDelay = entry.wavLoopType === 0 ? 0 : Math.max(cooldown1, 0);
        entry.maxRepeatDelay = entry.wavLoopType === 0 ? 0 : Math.max(cooldown1, 0) + Math.max(randomDelay, 0);
      }
      entry.wavFullVolRadius = type === 0 ? radius : Math.max(fullVolRange, 0);
      entry.activationRange = radius;
      entry.wavMaxAudibleDistance = entry.activationRange;
      entry.isEnvSound = type !== 1 ? 1 : 0;
      this.sounds.push(entry);
      if (name2) {
        const entry2 = entry.clone();
        entry2.soundFile = name2;
        entry2.soundFile = name2.includes('.') ? name2 : `${name2}.wav`;
        if (type !== 1) {
          entry2.wavLoopType = cooldown2 <= 0 && randomDelay <= 0 ? 0 : 1;
          entry2.minRepeatDelay = entry2.wavLoopType === 0 ? 0 : Math.max(cooldown2, 0);
          entry2.maxRepeatDelay = entry2.wavLoopType === 0 ? 0 : Math.max(cooldown2, 0) + Math.max(randomDelay, 0);
        }
        switch (type) {
          case 0: { // Day/night sound effect, constant volume
            entry2.whenActive = 2;
            break;
          }
          case 1: { // Background music
            entry2.whenActive = 2;
            break;
          }
          case 3: { // 3d sound effect
            entry2.whenActive = 2;
            break;
          }
          case 2:
          default:
            break;
        }
        this.sounds.push(entry2);
      }
    }
  }
}