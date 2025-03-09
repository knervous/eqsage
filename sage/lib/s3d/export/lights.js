const createLightsTemplate = () => ({
  FileName: 'lights.wld',
  WorldDef: {
    NewWorld  : 0,
    Zone      : 0,
    EqgVersion: {
      Int8 : 0,
      Valid: false,
    },
  },
  GlobalAmbientLightDef : null,
  Version               : 0,
  ActorDefs             : [],
  ActorInsts            : [],
  AmbientLights         : [],
  BlitSpriteDefs        : null,
  DMSpriteDef2s         : [],
  DMSpriteDefs          : [],
  DMTrackDef2s          : null,
  HierarchicalSpriteDefs: [],
  LightDefs             : [],
  MaterialDefs          : [],
  MaterialPalettes      : [],
  ParticleCloudDefs     : [],
  PointLights           : [],
  PolyhedronDefs        : [],
  Regions               : [],
  RGBTrackDefs          : [],
  SimpleSpriteDefs      : [],
  Sprite2DDefs          : [],
  Sprite3DDefs          : [],
  TrackDefs             : [],
  TrackInstances        : [],
  WorldTrees            : [],
  Zones                 : [],
  MdsDefs               : [],
  ModDefs               : [],
  TerDefs               : [],
  EQMaterialDefs        : [],
});

export const createLights = () => {
  const template = createLightsTemplate();
  // Todo impl
  return template;
};