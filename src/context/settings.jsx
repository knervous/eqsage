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
}) => {
  const [options, setOptions] = useState(
    JSON.parse(localStorage.getItem(storageKey) ?? '{}')
  );
  const setOption = useCallback((itemKey, value) => {
    setOptions((options) => {
      const newOptions = { ...options, [itemKey]: value };
      localStorage.setItem(storageKey, JSON.stringify(newOptions));
      return newOptions;
    });
  }, [storageKey]);

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
