import React, { createContext, useState, useCallback, useContext } from 'react';

export const SettingsContext = createContext({});
export const useSettingsContext = () => useContext(SettingsContext);

export const globalSettings = {
  flySpeed      : 2,
  showRegions   : true,
  glow          : true,
  webgpu        : false,
  forceReload   : false,
  clipPlane     : 10000,
  spawnLOD      : 500,
  remoteUrl     : '',
  soundAutoPlay : false,
  soundRepeat   : false,
  soundShuffle  : false,
  importBoundary: false,
};

export const SettingsProvider = ({
  children,
  defaultOptions = globalSettings,
  storageKey = 'options',
  stateCallback = undefined,
}) => {
  const [options, setOptions] = useState(
    JSON.parse(localStorage.getItem(storageKey) ?? '{}')
  );
  const setOption = useCallback((itemKey, value) => {
    setOptions((options) => {
      let newOptions = { ...options, [itemKey]: value };
      if (stateCallback) {
        newOptions = stateCallback(itemKey, options, newOptions);
      }
      const serializedOptions = JSON.parse(JSON.stringify(newOptions));
      if (serializedOptions?.config) {
        delete serializedOptions.config.needsRender;
      }
      localStorage.setItem(storageKey, JSON.stringify(serializedOptions));
      return newOptions;
    });
  }, [storageKey, stateCallback]);
  return (
    <SettingsContext.Provider
      value={{
        ...defaultOptions,
        ...options,
        setOption,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
