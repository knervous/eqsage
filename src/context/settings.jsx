import React, { createContext, useState, useCallback, useContext } from 'react';

export const SettingsContext = createContext({});
export const useSettingsContext = () => useContext(SettingsContext);

const defaultOptions = {
  flySpeed      : 2,
  showRegions   : true,
  glow          : true,
  webgpu        : false,
  forceReload   : false,
  singleWorker  : false,
  imgCompression: 'png',
  clipPlane     : 10000,
  spawnLOD      : 500,
  remoteUrl     : '',
  showCompass   : true,
  preferEqg     : false,
  soundAutoPlay : false,
  soundRepeat   : false,
  soundShuffle  : false,
};
export const SettingsProvider = ({ children }) => {
  const [options, setOptions] = useState(
    JSON.parse(localStorage.getItem('options') ?? '{}'),
  );
  const setOption = useCallback((key, value) => {
    setOptions((options) => {
      const newOptions = { ...options, [key]: value };
      localStorage.setItem('options', JSON.stringify(newOptions));
      return newOptions;
    });
  }, []);

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
