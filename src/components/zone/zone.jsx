import React, { useEffect, useRef, useState } from 'react';

import { Box } from '@mui/material';
import { useMainContext } from '../main/context';
import { processZone } from './processZone';
import { gameController } from '../../viewer/controllers/GameController';
import { SpireOverlay } from '../spire/overlay';
import { OverlayProvider } from '../spire/provider';
import { useSettingsContext } from '../../context/settings';
import { ExporterOverlay } from '../exporter/overlay';
import { GlobalStore } from '../../state';
import { QuailOverlay } from '../quail/overlay';
import { sleep } from '@/viewer/util/util';

export const BabylonZone = () => {
  const canvasRef = useRef();
  const {
    selectedZone,
    quailWorkspace,
    rootFileSystemHandle,
    modelExporter,
    canvasState,
    setCanvasState,
  } = useMainContext();

  const settings = useSettingsContext();
  const [modelExporterLoaded, setModelExporterLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      if (!selectedZone && !modelExporter && !quailWorkspace) {
        return;
      }
      while (!canvasRef.current) {
        await sleep(50);
      }
      console.log('Ref', canvasRef.current);
      await gameController.loadEngine(canvasRef.current, settings.webgpu);
      if (!modelExporter && !quailWorkspace) {
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
  }, [
    selectedZone,
    settings?.webgpu,
    modelExporter,
    setModelExporterLoaded,
    quailWorkspace,
  ]);

  useEffect(() => {
    if (!selectedZone && !modelExporter) {
      return;
    }
    let current = true;
    (async () => {
      if (!modelExporter) {
        await processZone(
          selectedZone.short_name,
          settings,
          rootFileSystemHandle
        );
        if (!current) {
          return;
        }
        gameController.ZoneController.loadModel(selectedZone.short_name).catch(
          (e) => {
            gameController.openAlert(
              'Error loading zone. Check console output.',
              'warning'
            );
            console.log('Error loading zone', e);
            GlobalStore.actions.setLoading(false);
          }
        );
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
      {!modelExporter && !quailWorkspace && (
        <SpireOverlay inZone={!!selectedZone} />
      )}
      {modelExporter && modelExporterLoaded && <ExporterOverlay />}
      {quailWorkspace && (
        <QuailOverlay
          canvas={
            <Box
              as="canvas"
              sx={{ flexGrow: '1', position: 'fixed' }}
              ref={canvasRef}
              id="renderCanvas"
              width="100%"
              height="100vh"
            />
          }
        />
      )}
      {canvasState && !quailWorkspace && (
        <Box
          as="canvas"
          sx={{ flexGrow: '1', position: 'fixed' }}
          ref={canvasRef}
          id="renderCanvas"
          width="100vw"
          height="100vh"
        />
      )}
    </OverlayProvider>
  );
};
