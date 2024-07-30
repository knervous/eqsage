
export class Animation {
  animModelBase = '';
  /**
   * @type {Object.<string, TrackFragment>}
   */
  tracks = {};
  /**
   * @type {Object.<string, TrackFragment>}
   */
  tracksCleaned = {};
  /**
   * @type {Object.<string, TrackFragment>}
   */
  tracksCleanedStripped = {};
  frameCount = 0;
  animationTimeMs = 0;

  static CleanBoneName(boneName) {
    if (boneName === '') {
      return boneName;
    }

    const cleanedName = Animation.CleanBoneNameDag(boneName);
    return cleanedName.length === 0 ? 'root' : cleanedName;
  }

  static CleanBoneAndStripBase(boneName, modelBase) {
    let cleanedName = Animation.CleanBoneNameDag(boneName);

    if (cleanedName.startsWith(modelBase)) {
      cleanedName = cleanedName.slice(modelBase.length, cleanedName.length);
    }

    return cleanedName.length === 0 ? 'root' : cleanedName;
  }

  static CleanBoneNameDag(boneName) {
    if (boneName === '') {
      return boneName;
    }

    return boneName.toLowerCase().replace('_dag', '');
  }

  addTrack(track, pieceName, cleanedName, cleanStrippedName) {
    // Prevent overwriting tracks
    // Drachnid edge case
    if (this.tracks.hasOwnProperty(pieceName)) {
      return;
    }

    this.tracks[pieceName] = track;
    this.tracksCleaned[cleanedName] = track;
    this.tracksCleanedStripped[cleanStrippedName] = track;

    if (this.animModelBase === '' &&
            track.modelName !== '') {
      this.animModelBase = track.modelName;
    }

    if (track.trackDefFragment.frames.length > this.frameCount) {
      this.frameCount = track.trackDefFragment.frames.length;
    }

    const totalTime = track.trackDefFragment.frames.length * track.frameMs;

    if (totalTime > this.animationTimeMs) {
      this.animationTimeMs = totalTime;
    }
  }
}