/**
 * @param {import('./typed-array-reader').TypedArrayReader} reader
 * @return {string}
 */
export const decodeString = (reader, size) => {
  const decodedStringHash = new Uint8Array(size);
  const hashKey = [0x95, 0x3a, 0xc5, 0x2a, 0x95, 0x7a, 0x95, 0x6a];
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
    MaterialList     : '_MP',
    Material         : '_MDF',
    Mesh             : '_DMSPRITEDEF',
    // [LegacyMesh] : '_DMSPRITEDEF'
    SkeletonHierarchy: '_HS_DEF',
    TrackDefFragment : '_TRACKDEF',
    TrackFragment    : '_TRACK',
    // [ParticleCloud] : '_PCD';
  };
  let cleanedName = fragment.name;
  if (typeMap[fragment.ClassName]) {
    cleanedName = cleanedName
      .replace(typeMap[fragment.ClassName], '')
      .replace(typeMap[fragment.ClassName].toLowerCase(), '');
  } else {
    console.warn('Not mapped', fragment.ClassName);
  }

  if (toLower) {
    cleanedName = cleanedName.toLowerCase();
  }

  return cleanedName.trim();
};
