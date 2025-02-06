import React, { useEffect, useRef } from 'react';

import { Box } from '@mui/material';
import { useMainContext } from '../main/context';
import { processZone } from './processZone';
import { gameController } from '../../viewer/controllers/GameController';
import { SpireOverlay } from '../spire/overlay';
import { OverlayProvider } from '../spire/provider';
import { useSettingsContext } from '../../context/settings';
import { ExporterOverlay } from '../exporter/overlay';
import { GlobalStore } from '../../state';

export const BabylonZone = () => {
  const canvasRef = useRef();
  const { selectedZone, rootFileSystemHandle, modelExporter, modelExporterLoaded, setModelExporterLoaded, canvasState, setCanvasState } = useMainContext();
  const settings = useSettingsContext();
  useEffect(() => {
    (async () => {
      if (!selectedZone && !modelExporter) {
        return;
      }
      await new Promise((res) => setTimeout(res, 50));
      await gameController.loadEngine(canvasRef.current, settings.webgpu);
      if (!modelExporter) {
        await gameController.ZoneController.loadViewerScene();
      } else {
        await gameController.ModelController.initializeModelExporter();
        setModelExporterLoaded(true);
      }
      window.addEventListener('resize', gameController.resize);
      window.addEventListener('keydown', gameController.keyDown);
    })();

    return () => {
      window.removeEventListener('resize', gameController.resize);
      window.removeEventListener('keydown', gameController.keyDown);
    };
  }, [selectedZone, settings?.webgpu, modelExporter, setModelExporterLoaded]);

  useEffect(() => {
    if (!selectedZone && !modelExporter) {
      return;
    }
    let current = true;
    (async () => {
      if (!modelExporter) {
        await processZone(selectedZone.short_name, settings, rootFileSystemHandle);
        if (!current) {
          return;
        }
        gameController.ZoneController.loadModel(selectedZone.short_name).catch(e => {
          gameController.openAlert('Error loading zone. Check console output.', 'warning');
          console.log('Error loading zone', e);
          GlobalStore.actions.setLoading(false);
        });
      }
    })();
    return () => (current = false);
  }, [selectedZone, modelExporter]); // eslint-disable-line

  useEffect(() => {
    if (!canvasState) {
      setTimeout(() => {
        setCanvasState(true);
      }, 0);
    }
  }, [canvasState, setCanvasState]);
  return (
    <OverlayProvider>
      <SpireOverlay inZone={!!selectedZone} />
      {modelExporter && modelExporterLoaded && <ExporterOverlay />}
      {canvasState && <Box
        as="canvas"
        sx={{ flexGrow: '1', position: 'fixed' }}
        ref={canvasRef}
        id="renderCanvas"
        width="100vw"
        height="100vh"
      />}
      
    </OverlayProvider>
  );
};
