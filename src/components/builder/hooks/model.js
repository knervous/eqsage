import { useEffect, useState } from 'react';
import { getEQDir, getEQFile, getFiles } from '../../../lib/util/fileHandler';

export const useModels = () => {
  const [models, setModels] = useState([]);
  const [key, setKey] = useState(0);

  useEffect(() => {
    (async () => {
      const objectDir = await getEQDir('objects');
      if (objectDir) {
        const files = await getFiles(objectDir);
        setModels(files.filter((f) => f.name.endsWith('.glb')));
      }
    })();
  }, [key]);

  return {
    models,
    refresh() {
      setKey((k) => k + 1);
    },
  };
};
function sortObjectKeysAlphabeticallyCaseInsensitive(obj) {
  const sortedKeys = Object.keys(obj).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const sortedObj = {};
  
  sortedKeys.forEach(key => {
    sortedObj[key] = obj[key];
  });
  
  return sortedObj;
}
export const useZoneModels = (filterNames) => {
  const [zoneModels, setModels] = useState([]);
  const [key, setKey] = useState(0);

  useEffect(() => {
    (async () => {
      const objectDir = await getEQDir('objects');
      const itemDir = await getEQDir('items');
      if (objectDir) {
        const objectPaths = await getEQFile('data', 'objectPaths.json', 'json');
        console.log('o', objectPaths);
        const objectMap = {};
        const files = await getFiles(objectDir, (f) => f.endsWith('.glb'));
        if (itemDir) {
          const itemFiles = await getFiles(itemDir, (f) => f.endsWith('.glb'));
          files.push(...itemFiles);
        }
        for (const f of files) {
          if (filterNames.some(n => f.name.replace('.glb', '') === n.name)) {
            continue;
          }
          const objectPath =
            Object.entries(objectPaths).find(
              ([key, _val]) => f.name.replace('.glb', '').toUpperCase() === key
            )?.[1] ?? 'Unknown';
          if (!objectMap[objectPath]) {
            objectMap[objectPath] = [];
          }
          objectMap[objectPath].push(f);
        }
        for (const [key, files] of Object.entries(objectMap)) {
          objectMap[key] = files.sort((a, b) => a.name > b.name ? 1 : -1);
        }
        setModels(sortObjectKeysAlphabeticallyCaseInsensitive(objectMap));
      }
    })();
  }, [key, filterNames]);

  return {
    zoneModels,
    doRefresh() {
      setKey((k) => k + 1);
    },
  };
};
