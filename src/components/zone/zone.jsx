import React, { useEffect, useRef, useState } from 'react';

import { Box } from '@mui/material';
import { useMainContext } from '../main/main';
import { processZone } from './processZone';
import { gameController } from '../../viewer/controllers/GameController';
import { SpireOverlay } from '../spire/overlay';
import { OverlayProvider } from '../spire/provider';
import { SettingsProvider, useSettingsContext } from '../../context/settings';

export const BabylonZone = () => {
  const canvasRef = useRef();
  const { selectedZone } = useMainContext();
  const { webgpu } = useSettingsContext();
  useEffect(() => {
    (async () => {
      if (!selectedZone) {
        return;
      }
      await new Promise(res => setTimeout(res, 50));
      console.log('Canvas ref', canvasRef);
      await gameController.loadEngine(canvasRef.current, webgpu);
      await gameController.ZoneController.loadViewerScene();
      window.addEventListener('resize', gameController.resize);
      window.addEventListener('keydown', gameController.keyDown);
    })();

    return () => {
      window.removeEventListener('resize', gameController.resize);
      window.removeEventListener('keydown', gameController.keyDown);
    };
  }, [selectedZone]);

  useEffect(() => {
    if (!selectedZone) {
      return;
    }
    let current = true;
    (async () => {
      const zones = await processZone(selectedZone.short_name);
      if (!current) {
        return;
      }
      gameController.ZoneController.loadModel(selectedZone.short_name);
    })();
    return () => (current = false);
  }, [selectedZone]);

  return selectedZone ? (
    <OverlayProvider>

      <SpireOverlay />
      <Box
        as="canvas"
        sx={{ flexGrow: '1', position: 'fixed' }}
        ref={canvasRef}
        id="renderCanvas"
        width="100vw"
        height="100vh"
      />

    </OverlayProvider>
  ) : null;
};
