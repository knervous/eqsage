export const createTemplate = (name) => ({
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
      Colors     : null,
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
