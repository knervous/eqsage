import { useState, useEffect, useMemo, useCallback } from 'react';
import { getEQDir, getFiles } from 'sage-core/util/fileHandler';
import { models, pcModels } from './constants';

export const useEqOptions = (useRawItems = false) => {
  const [filledItemOptions, setFilledItemOptions] = useState([]);
  const [modelOptions, refreshModelOptions] = useOptions('models', models);
  const [objectOptions, refreshObjectOptions] = useOptions('objects');
  const [itemOptions, refreshItemOptions] = useOptions('items');
  const [pcModelOptions, npcModelOptions] = useMemo(
    () =>
      modelOptions.reduce(
        (acc, val) => {
          if (pcModels.includes(val.model)) {
            acc[0].push(val);
          } else {
            acc[1].push(val);
          }
          return acc;
        },
        [[], []]
      ),
    [modelOptions]
  );
  const refresh = useCallback(async () => {
    await Promise.all([
      refreshModelOptions(),
      refreshObjectOptions(),
      refreshItemOptions(),
    ]);
  }, [refreshModelOptions, refreshObjectOptions, refreshItemOptions]);
  const empty = useMemo(
    () =>
      pcModelOptions.length +
        npcModelOptions.length +
        objectOptions.length +
        itemOptions.length ===
      0,
    [pcModelOptions, npcModelOptions, objectOptions, itemOptions]
  );

  useEffect(() => {
    if (useRawItems) {
      return;
    }
    fetch('/static/items.json')
      .then(r => r.json())
      .then(data => {
        const options = [];
        for (const io of itemOptions) {
          const entry = data[io.model.toUpperCase()];
          if (entry) {
            for (const [icon, names] of Object.entries(entry)) {
              if (io.model === 'it63') {
                continue;
              }
              for (const name of names) {
                options.push({
                  model: io.model,
                  label: name,
                  icon,
                  key  : `${io.model }-${ icon}`
                });
              }
            }

          } else {
            options.push(io);
          }
        }  
        setFilledItemOptions(options);
      })
      .catch(err => {
        console.log('Err', err);
        console.error('Error:', err);
      });
  }, [itemOptions, useRawItems]);
  
  return {
    empty,
    pcModelOptions,
    npcModelOptions,
    objectOptions,
    itemOptions: useRawItems ? itemOptions : filledItemOptions,
    refresh,
  };
};

export const useOptions = (name, modelProxy) => {
  const [files, setFiles] = useState([]);
  const refreshFiles = useCallback(async () => {
    const modelDir = await getEQDir(name);
    if (modelDir) {
      const files = await getFiles(modelDir);
      setFiles(files.filter((f) => f.name.endsWith('.glb')));
    }
  }, [name]);
  const options = useMemo(() => {
    const headCountMap = {};
    const opts = files
      .map((model, idx) => {
        const modelLabel = `${model.name.replace('.glb', '')}`;

        const isHead = /he\d{2}/.test(model.name);
        if (isHead) {
          if (!headCountMap[modelLabel]) {
            headCountMap[modelLabel] = 0;
          }
          headCountMap[modelLabel]++;
          return null;
        }
        const label = modelProxy?.[modelLabel] ?? modelLabel;
        return {
          model    : modelLabel,
          label,
          id       : idx,
          key      : idx,
          headCount: 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.label > b.label ? 1 : -1));
    for (const option of opts) {
      if (headCountMap[option.model]) {
        option.headCount = headCountMap[option.model];
      }
    }
    return opts;
  }, [files, modelProxy]);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  return [options, refreshFiles, files];
};
