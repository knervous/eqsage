
import itemMap from './items.json';
import { modelDefinitions } from '../../lib/model/constants';

export const locations = [
  { name: 'Open', file: '/static/clz.glb.gz', x: 0, y: -1, z: 0 },
  { name: 'Area 1', file: '/static/load2.glb.gz', x: 47, y: -506.5, z: 1123 },
  { name: 'Area 2', file: '/static/load2.glb.gz', x: 846, y: 184.5, z: 275 },
  { name: 'Area 3', file: '/static/load2.glb.gz', x: 834, y: -126.5, z: -682 },
  { name: 'Area 4', file: '/static/load2.glb.gz', x: 688, y: 51, z: -644 },
  { name: 'Area 5', file: '/static/load2.glb.gz', x: 3, y: -382, z: 1114 },
  { name: 'Area 6', file: '/static/load2.glb.gz', x: -598, y: 31.5, z: -679 },
  { name: 'Area 7', file: '/static/load2.glb.gz', x: -601, y: 184, z: -1402 },
  { name: 'Area 8', file: '/static/load2.glb.gz', x: 22, y: 5.5, z: -1396 },
  { name: 'Area 9', file: '/static/load2.glb.gz', x: -2, y: 985, z: -490 },
  { name: 'Area 10', file: '/static/load2.glb.gz', x: 0, y: -129.5, z: -680 },
  { name: 'Area 11', file: '/static/load2.glb.gz', x: -2, y: 728, z: 258 },
  { name: 'Area 12', file: '/static/load2.glb.gz', x: 839, y: 209.5, z: 1274 },
  { name: 'Area 13', file: '/static/load2.glb.gz', x: 840, y: 336, z: 1284 },
];

export const models = new Proxy(modelDefinitions, {
  get(target, prop, _receiver) {
    if (target[prop]) {
      return `[${prop}] ${target[prop]}`;
    }
    return !prop || prop === 'null' ? '' : `[${prop}] unknown`;
  },
});
  
export const items = new Proxy(itemMap, {
  get(target, prop, _receiver) {
    const t = target[prop.slice(2, prop.length)];
    if (t) {
      return `[${prop}] ${t}`;
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