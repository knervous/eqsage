import { useEffect, useState } from 'react';
import { getEQDir, getFiles } from '../../../lib/util/fileHandler';

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
