
import itemMap from './items.json';
import { modelDefinitions } from '../../lib/model/constants';

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