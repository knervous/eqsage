import React, { createContext, useContext, useEffect, useRef } from 'react';

import { Box } from '@mui/material';
import { useSettingsContext } from '../../context/settings';
import { OverlayProvider } from './provider';
import { BuilderOverlay } from './overlay';
import { RegionProvider } from './providers/region-provider';
import { ZoneBuilderContext } from './context';

export const ZoneBuilder = ({
  zone,
  saveProject,
  updateProject,
  updateMetadata,
}) => {
  const canvasRef = useRef();
  const { webgpu } = useSettingsContext();

  useEffect(() => {
    (async () => {
      await new Promise((res) => setTimeout(res, 50));
      await window.gameController.loadEngine(canvasRef.current, webgpu);
      await window.gameController.ZoneBuilderController.loadModel(zone);
      window.addEventListener('resize', window.gameController.resize);
      window.addEventListener('keydown', window.gameController.keyDown);
    })();

    return () => {
      window.removeEventListener('resize', window.gameController.resize);
      window.removeEventListener('keydown', window.gameController.keyDown);
    };
  }, [zone, webgpu]);
  return (
    <ZoneBuilderContext.Provider
      value={{ zone, saveProject, updateMetadata, updateProject }}
    >
      <RegionProvider>
        <OverlayProvider>
          <Box
            as="canvas"
            sx={{ flexGrow: '1', position: 'fixed' }}
            ref={canvasRef}
            id="renderCanvas"
            width="100vw"
            height="100vh"
          />
          <BuilderOverlay />
        </OverlayProvider>
      </RegionProvider>
    </ZoneBuilderContext.Provider>
  );
};
