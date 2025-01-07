import { quailProcessor } from '../../../modules/quail';
import { Suffixes } from './constants';
import { createBsp } from './export';

const createTemplate = (name) => ({
  FileName: `${name}.wld`,
  WorldDef: {
    NewWorld  : 0,
    Zone      : 1,
    EqgVersion: {
      Int8 : 0,
      Valid: false,
    },
  },
  GlobalAmbientLightDef: {
    Color: [0, 0, 0, 255],
  },
  Version  : 0,
  ActorDefs: [
    {
      Tag          : 'PLAYER_1',
      Callback     : 'FLYCAMCALLBACK',
      BoundsRef    : 0,
      CurrentAction: {
        Uint32: 0,
        Valid : false,
      },
      Location: {
        Float32Slice6: [0, 0, 0, 0, 0, 0],
        Valid        : false,
      },
      ActiveGeometry: {
        Uint32: 0,
        Valid : false,
      },
      Unk1   : 0,
      Actions: [
        {
          Unk1          : 0,
          LevelOfDetails: [
            {
              SpriteTag     : 'CAMERA_DUMMY',
              SpriteTagIndex: 0,
              SpriteFlags   : 0,
              MinDistance   : 1e30,
            },
          ],
        },
      ],
      Unk2         : 0,
      HasEightyFlag: 0,
    },
  ],
  ActorInsts: [
    {
      Tag          : '',
      DefinitionTag: 'PLAYER_1',
      CurrentAction: {
        Uint32: 0,
        Valid : false,
      },
      Location: {
        Float32Slice6: [1020.5916, 689.724, 53.47871, 0, 0, 0],
        Valid        : true,
      },
      BoundingRadius: {
        Float32: 0.5,
        Valid  : true,
      },
      Scale: {
        Float32: 0.5,
        Valid  : true,
      },
      SoundTag: {
        String: '',
        Valid : false,
      },
      Active: {
        Uint32: 0,
        Valid : true,
      },
      SpriteVolumeOnly: {
        Uint32: 0,
        Valid : false,
      },
      DMRGBTrackTag: {
        String: '',
        Valid : false,
      },
      SphereTag        : '',
      SphereRadius     : 0.1,
      HexTwoHundredFlag: 0,
      UserData         : '',
    },
  ],
  AmbientLights: [
    {
      Tag       : 'DEFAULT_AMBIENTLIGHT',
      LightTag  : 'DEFAULT_LIGHTDEF',
      LightFlags: 0,
      Regions   : [],
    },
  ],
  BlitSpriteDefs        : null,
  DMSpriteDef2s         : [],
  DMSpriteDefs          : [],
  DMTrackDef2s          : null,
  HierarchicalSpriteDefs: [],
  LightDefs             : [
    {
      Tag         : 'DEFAULT_LIGHTDEF',
      CurrentFrame: {
        Uint32: 0,
        Valid : false,
      },
      Sleep: {
        Uint32: 0,
        Valid : false,
      },
      SkipFrames : 0,
      LightLevels: [1],
      Colors     : [[1.1, 1.1, 1.1]],
    },
  ],
  MaterialDefs     : [],
  MaterialPalettes : [],
  ParticleCloudDefs: [],
  PointLights      : [],
  PolyhedronDefs   : [],
  Regions          : [],
  RGBTrackDefs     : [],
  SimpleSpriteDefs : [],
  Sprite2DDefs     : [],
  Sprite3DDefs     : [
    {
      Tag         : 'CAMERA_DUMMY',
      CenterOffset: {
        Float32Slice3: [0, 0, 0],
        Valid        : false,
      },
      BoundingRadius: {
        Float32: 0,
        Valid  : false,
      },
      SphereListTag: '',
      Vertices     : [
        [0, -1, 1],
        [0, 1, 1],
        [0, 1, -1],
        [0, -1, -1],
      ],
      BSPNodes: [
        {
          Vertices    : [0, 1, 2, 3],
          RenderMethod: 'TRANSPARENT',
          Pen         : {
            Uint32: 184549376,
            Valid : true,
          },
          Brightness: {
            Float32: 0,
            Valid  : false,
          },
          ScaledAmbient: {
            Float32: 0,
            Valid  : false,
          },
          SpriteTag: {
            String: '',
            Valid : false,
          },
          UvOrigin: {
            Float32Slice3: [0, 0, 0],
            Valid        : false,
          },
          UAxis: {
            Float32Slice3: [0, 0, 0],
            Valid        : false,
          },
          VAxis: {
            Float32Slice3: [0, 0, 0],
            Valid        : false,
          },
          Uvs      : null,
          TwoSided : 0,
          FrontTree: 0,
          BackTree : 0,
        },
      ],
    },
  ],
  TrackDefs     : [],
  TrackInstances: [],
  WorldTrees    : [],
  Zones         : [],
  MdsDefs       : [],
  ModDefs       : [],
  TerDefs       : [],
  EQMaterialDefs: [],
});

/**
 * @typedef ZoneObject
 * @property {string} name
 */

/**
 * @typedef ZoneLight
 */

/**
 * @typedef ZoneRegion
 */

/**
 *
 * @param {string} name
 * @param {import('@babylonjs/core/scene').Scene} scene
 * @param {[import('@babylonjs/core/Meshes/mesh').Mesh]} meshes
 * @param {[import('@babylonjs/core/Materials/material').Material]} materials
 * @param {[ZoneLight]} lights
 * @param {[ZoneObject]} objects
 * @param {[ZoneRegion]} regions
 * @returns
 */
export const createS3DZone = async (
  name,
  scene,
  meshes,
  materials,
  lights,
  objects,
  regions
) => {
  const template = createTemplate(name);

  // Mat defs
  const textures = [];
  const addTexture = (name, extension, buffer) => {
    const fullName = `${name}${extension}`;
    if (!textures.some((t) => t.name === fullName)) {
      textures.push({ name: fullName, buffer });
    }
  };
  const materialPalette = {
    Tag      : `${name}_MP`,
    Materials: [],
  };
  template.MaterialPalettes.push(materialPalette);
  for (const material of materials) {
    const name = material.name.toLowerCase().replaceAll('_mdf', '');
    const extension = material.albedoTexture.hasAlpha ? '.png' : '.jpg';
    const tag = `${name.toUpperCase()}${Suffixes.MATERIAL}`;
    const animated = !!material.metadata?.gltf?.extras?.animationDelay;
    const spriteFrames = [];
    if (animated) {
      for (const frame of material.metadata.gltf.extras.frames) {
        spriteFrames.push({
          TextureFile: `${frame}${extension}`,
          TextureTag : frame,
        });
        for (const texture of scene.textures) {
          if (texture.name === frame) {
            addTexture(texture.name, extension, texture._buffer);
          }
        }
      }
    } else {
      spriteFrames.push({
        TextureFile: `${name}${extension}`,
        TextureTag : name,
      });
      addTexture(name, extension, material.albedoTexture._buffer);
    }
    materialPalette.Materials.push(tag);
    template.MaterialDefs.push({
      Tag               : tag,
      Variation         : 0,
      SpriteHexFiftyFlag: 1,
      RenderMethod      : 'USERDEFINED_2',
      RGBPen            : [1, 1, 1, 0],
      Brightness        : 0,
      ScaledAmbient     : 1,
      SimpleSpriteTag   : `${material.name}_SPRITE`,
      Pair1             : {
        Uint32: 0,
        Valid : true,
      },
      Pair2: {
        Float32: 0,
        Valid  : true,
      },
      DoubleSided: 0,
    });
    template.SimpleSpriteDefs.push({
      Tag       : `${name}_SPRITE`,
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
  }

  // Mesh defs
  const meshDefinitions = [];
  for (const mesh of meshes) {
  }

  const lightDefinitions = [];
  for (const light of lights) {
  }

  const objectDefinitions = [];
  for (const obj of objects) {
  }

  // Define WorldTree
  const { WorldTrees, Regions, Zones } = createBsp(meshes, regions);
  template.WorldTrees = WorldTrees;
  template.Regions = Regions;
  template.Zones = Zones;

  // Return s3d
  // return await quailProcessor.convertS3D(template);

  console.log('Template', template);
  console.log('Textures', textures);
};

export const createS3DObj = async () => {};
export const createS3DChr = async () => {};
