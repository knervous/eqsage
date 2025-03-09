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


export async function flipImageX(imageDataBuffer) {
  return new Promise((resolve) => {
    const img = new Image();
    const blob = new Blob([imageDataBuffer], { type: 'image/png' });
    img.src = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');

      // Flip image on the X-axis
      ctx.translate(0, canvas.height);
      ctx.scale(1, -1);

      ctx.drawImage(img, 0, 0);
      canvas.toBlob((flippedBlob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(new Uint8Array(reader.result));
        };
        reader.readAsArrayBuffer(flippedBlob);
      }, 'image/png');
    };
  });
}
