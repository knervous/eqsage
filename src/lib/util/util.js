import { SkeletonHierarchy } from '../s3d/animation/skeleton';
import { TrackDefFragment, TrackFragment } from '../s3d/animation/track';
import { Material } from '../s3d/materials/material';
import { MaterialList } from '../s3d/materials/material-list';
import { Mesh } from '../s3d/mesh/mesh';

/**
 * @param {import('./typed-array-reader').TypedArrayReader} reader 
 * @return {string}
 */
export const decodeString = (reader, size) => {
  const decodedStringHash = new Uint8Array(size);
  const hashKey = [0x95, 0x3A, 0xC5, 0x2A, 0x95, 0x7A, 0x95, 0x6A];
  for (let i = 0; i < size; i++) {
    const char = reader.readUint8();
    const decodedChar = char ^ hashKey[i % 8];
    decodedStringHash[i] = decodedChar;
  }
  return new TextDecoder().decode(decodedStringHash.buffer);
};

/**
 * 
 * @param {import('../s3d/wld/wld-fragment').WldFragment} fragment 
 * @param {boolean} toLower 
 */
export const fragmentNameCleaner = (fragment, toLower = true) => {
  const typeMap = {
    [MaterialList]     : '_MP',
    [Material]         : '_MDF',
    [Mesh]             : '_DMSPRITEDEF',
    // [LegacyMesh] : '_DMSPRITEDEF'
    [SkeletonHierarchy]: '_HS_DEF',
    [TrackDefFragment] : '_TRACKDEF',
    [TrackFragment]    : '_TRACK',
    // [ParticleCloud] : '_PCD';
  };
  let cleanedName = fragment.name;
  if (typeMap[fragment.constructor]) {
    cleanedName = cleanedName.replace(typeMap[fragment.constructor], '');
  }

  if (toLower) {
    cleanedName = cleanedName.toLowerCase();
  }

  return cleanedName.trim();
};