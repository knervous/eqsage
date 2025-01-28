const createObjectsTemplate = () => ({
  FileName: 'objects.wld',
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

const createActorInst = (
  name,
  idx,
  { x, y, z, rotateX, rotateY, rotateZ, scale }
) => ({
  Tag          : '',
  DefinitionTag: `${name}_ACTORDEF`.toUpperCase(),
  CurrentAction: {
    Uint32: 0,
    Valid : false,
  },
  Location: {
    Float32Slice6: [x, z, y, rotateY * (512 / 360), rotateX * (512 / 360), rotateZ * (512 / 360)],
    Valid        : true,
  },
  BoundingRadius: {
    Float32: 1,
    Valid  : true,
  },
  Scale: {
    Float32: scale,
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
    String: `ENT${idx}_DMT`,
    Valid : true,
  },
  SphereTag        : '',
  SphereRadius     : 0,
  HexTwoHundredFlag: 1,
  UserData         : '',
});

const createRgbTrackDef = (idx) => ({
  Tag  : `ENT${idx}_DMT`,
  Data1: 1,
  Data2: 1,
  Data4: 0,
  Sleep: 200,
  RGBAs: [],
});

export const createZoneObjectInstances = (objects) => {
  const template = createObjectsTemplate();
  let idx = 0;
  for (const [key, obj] of Object.entries(objects)) {
    for (const entry of obj) {
      template.RGBTrackDefs.push(createRgbTrackDef(idx));
      template.ActorInsts.push(createActorInst(key, idx++, entry));
    }
  }
  // Todo impl
  return template;
};
