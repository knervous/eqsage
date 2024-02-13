import React, { useEffect, useRef, useState } from 'react';

import { Box } from '@mui/material';
import { useMainContext } from '../main/main';
import { processZone } from './processZone';
import { gameController } from '../../viewer/controllers/GameController';
import { SpireOverlay } from '../spire/overlay';

export const BabylonZone = () => {
  const canvasRef = useRef();
  const { selectedZone } = useMainContext();
  const [zoneProcessed, setZoneProcessed] = useState(false);
  useEffect(() => {
    (async () => {
      await gameController.loadEngine(canvasRef.current);
      await gameController.loadViewerScene();
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
      gameController.loadModel(selectedZone.short_name);
    })();
    return () => current = false;
  }, [selectedZone]);

  return selectedZone ? (
    <>
      {/* {gameController.Spire && <SpireOverlay />} */}
      <Box as='canvas' sx={{ flexGrow: '1', position: 'fixed' }} ref={canvasRef} id="renderCanvas" width="100vw" height="100vh" />

    </>
  ) : null;
};
