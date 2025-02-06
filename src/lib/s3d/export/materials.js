import { imageProcessor } from '../../util/image/image-processor';
import { Suffixes } from './constants';

async function compressPNG(inputBuffer, name) {
  const result = await imageProcessor.compressImage(inputBuffer, name);
  if (result === null) {
    console.log('Fallback for buffer', name);
  }
  const byteArray = new Uint8Array(result ?? inputBuffer);
  return byteArray;
}

export const createMaterials = async (
  name,
  scene,
  zoneMeshes,
  collisionMeshes,
) => {
  const texturePromises = [];
  const addTexture = async (name, extension, buffer) => {
    const fullName = `${name}${extension}`;
    if (!texturePromises.some((t) => t.name === fullName)) {
      // texturePromises.push({ name: fullName, buffer });

      //  const compressedBuffer = compressPNG(buffer, fullName);
      texturePromises.push({ name: fullName, buffer: buffer });
    }
  };
  const materialPalette = {
    Tag      : `${name}_MP`,
    Materials: [],
  };
  const zoneMaterials = zoneMeshes.flatMap((m) => m.material).filter(Boolean);
  const collisionMaterials = collisionMeshes
    .flatMap((m) => m.material)
    .filter(Boolean);
  for (const m of collisionMaterials) {
    m.EQ_COLLISION = true;
  }
  const materialMap = new Map();
  const materials = [
    ...zoneMaterials,
    ...collisionMaterials,
  ];
  const materialDefs = [];
  const simpleSpriteDefs = [];

  for (const material of materials) {
    const name = material.name.toLowerCase().replaceAll('_mdf', '');
    if (name.startsWith('m000')) {
      continue;
    }
    const animated = !!material.metadata?.gltf?.extras?.animationDelay;
    // const extension =
    //   animated || material.albedoTexture?.hasnpmAlpha ? '.png' : '.jpg';
    const extension = '.png';
    const tag = `${name.toUpperCase()}${Suffixes.MATERIAL}`;
    if (materialPalette.Materials.includes(tag)) {
      continue;
    }
    const spriteFrames = [];
    if (animated) {
      for (const frame of material.metadata.gltf.extras.frames) {
        spriteFrames.push({
          TextureFile: `${frame}${extension}`,
          TextureTag : frame,
        });
        for (const texture of scene.textures) {
          if (texture.name === frame) {
            await addTexture(
              texture.name,
              extension,
              new Uint8Array(texture._buffer)
            );
          }
        }
      }
    } else {
      spriteFrames.push({
        TextureFile: `${name}${extension}`,
        TextureTag : name,
      });
      if (material.albedoTexture) {
        await addTexture(name, extension, material.albedoTexture._buffer);
      }
    }
    materialPalette.Materials.push(tag);
    materialDefs.push({
      Tag               : tag,
      Variation         : 0,
      SpriteHexFiftyFlag: 1,
      RenderMethod      : name.startsWith('m0000') ? 'SOLIDFILLAMBIENTGOURAUD1' :
        material.EQ_COLLISION ? 'TRANSPARENT' : 'USERDEFINED_2',
      RGBPen         : [78, 78, 78, 0],
      Brightness     : 0,
      ScaledAmbient  : 0.75,
      SimpleSpriteTag: `${name.toUpperCase()}_SPRITE`,
      Pair1          : {
        Uint32: 0,
        Valid : true,
      },
      Pair2: {
        Float32: 0,
        Valid  : true,
      },
      DoubleSided: 0,
    });
    simpleSpriteDefs.push({
      Tag       : `${name.toUpperCase()}_SPRITE`,
      Variation : 0,
      SkipFrames: {
        Uint32: 0,
        Valid : false,
      },
      Sleep: {
        Uint32: material?.metadata?.gltf?.extras?.animationDelay ?? 0,
        Valid : animated,
      },
      CurrentFrame: {
        Int32: 0,
        Valid: false,
      },
      Animated: {
        Uint32: 0,
        Valid : animated,
      },
      SimpleSpriteFrames: spriteFrames,
    });
    materialMap.set(material, simpleSpriteDefs.length - 1);
  }

  return {
    texturePromises,
    materialDefs,
    simpleSpriteDefs,
    materialPalette,
    materialMap,
  };
};
