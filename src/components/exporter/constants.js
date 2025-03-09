
import { modelDefinitions } from 'sage-core/model/constants';


export const locations = [
  { name: 'Default', file: '/static/clz.glb', x: 0, y: -0.75, z: 0 },
  { name: 'Warrior', file: '/static/load2.glb', x: -600, y: 184, z: -1475 },
  { name: 'Cleric', file: '/static/load2.glb', x: -603.5, y: 92.5, z: 328 },
  { name: 'Paladin', file: '/static/load2.glb', x: 847, y: 184.5, z: 250 },
  { name: 'Ranger', file: '/static/load2.glb', x: 45, y: 5.5, z: -1415 },
  { name: 'Shadowknight', file: '/static/load2.glb', x: 0, y: -129.5, z: -680 },
  { name: 'Druid', file: '/static/load2.glb', x: -60, y: -507.5, z: 950 },
  { name: 'Monk', file: '/static/load2.glb', x: 0, y: -382, z: 1120 },
  { name: 'Bard', file: '/static/load2.glb', x: -60, y: 876, z: 230 },
  { name: 'Rogue', file: '/static/load2.glb', x: 790, y: 27, z: -640 },
  { name: 'Shaman', file: '/static/load2.glb', x: -2, y: 985, z: -490 },
  { name: 'Necromancer', file: '/static/load2.glb', x: 850, y: 336, z: 1275 },
  { name: 'Wizard', file: '/static/load2.glb', x: -600, y: 31.5, z: -680 },
  { name: 'Mage', file: '/static/load2.glb', x: 840, y: 209.5, z: 1274 },
  { name: 'Enchanter', file: '/static/load2.glb', x: 885, y: -156.5, z: -685 },
  { name: 'Beastlord', file: '/static/load2.glb', x: 0, y: 728, z: 260 },
];

export const models = new Proxy(modelDefinitions, {
  get(target, prop, _receiver) {
    if (target[prop]) {
      return `[${prop}] ${target[prop]}`;
    }
    return !prop || prop === 'null' ? '' : `[${prop}] unknown`;
  },
});
  


export const animationDefinitions = {
  pos: 'None',
  c01: 'Kick',
  c02: '1h Pierce',
  c03: '2h Slash',
  c04: '2h Blunt',
  c05: '1h Slash',
  c06: '1h Slash Offhand',
  c07: 'Bash',
  c08: 'Hand to Hand Primary',
  c09: 'Archery',
  c10: 'Swimming 1',
  c11: 'Roundhouse Kick',
  d01: 'Minor Damage',
  d02: 'Heavy Damage',
  d04: 'Drowning',
  d05: 'Death',
  l01: 'Walking',
  l02: 'Running',
  l03: 'Running Jump',
  l04: 'Stationary Jump',
  l05: 'Falling',
  l06: 'Duck Walking',
  l07: 'Ladder Climbing',
  l08: 'Duck Down',
  l09: 'Swimming Stationary',
  o01: 'Idle 2',
  p01: 'Idle 1',
  p02: 'Sit Down',
  p03: 'Shuffle Rotate',
  p04: 'Shuffle Strafe',
  p05: 'Loot',
  p06: 'Swimming 2',
  s01: 'Cheer',
  s02: 'Disappointed',
  s03: 'Wave',
  s04: 'Rude',
  t02: 'Stringed Instrument',
  t03: 'Woodwind Instrument',
  t04: 'Cast 1',
  t05: 'Cast 2',
  t06: 'Cast 3',
  t07: 'Flying Kick',
  t08: 'Tiger Strike',
  t09: 'Dragon Punch',
};

export function wearsRobe(modelName) {
  return [
    'daf01',
    'dam01',
    'erf01',
    'erm01',
    'gnf01',
    'gnm01',
    'huf01',
    'hum01',
    'ikf01',
    'ikm01',
    'hif01',
    'him01',
  ].includes(modelName);
}

export const pcModels = [
  'bam',
  'baf',
  'erm',
  'erf',
  'elf',
  'elm',
  'gnf',
  'gnm',
  'trf',
  'trm',
  'hum',
  'huf',
  'daf',
  'dam',
  'dwf',
  'dwm',
  'haf',
  'ikf',
  'ikm',
  'ham',
  'hif',
  'him',
  'hof',
  'hom',
  'ogm',
  'ogf',
  'kef',
  'kem',
  // Robes
  'daf01',
  'dam01',
  'erf01',
  'erm01',
  'gnf01',
  'gnm01',
  'hif01',
  'him01',
  'huf01',
  'hum01',
  'ikf01',
  'ikm01',
];

export const optionType = {
  pc    : 'PC',
  npc   : 'NPC',
  object: 'Objects',
  item  : 'Items'
};