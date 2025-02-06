import { useState, useEffect, useMemo, useCallback } from 'react';
import { getEQDir, getFiles } from '../../lib/util/fileHandler';
import { items, models, pcModels } from './constants';

export const useEqOptions = () => {
  const [modelOptions, refreshModelOptions] = useOptions('models', models);
  const [objectOptions, refreshObjectOptions] = useOptions('objects');
  const [itemOptions, refreshItemOptions] = useOptions('items', items);
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
  return {
    empty,
    pcModelOptions,
    npcModelOptions,
    objectOptions,
    itemOptions,
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
