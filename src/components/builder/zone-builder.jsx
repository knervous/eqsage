import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Box } from '@mui/material';
import { useSettingsContext } from '../../context/settings';
import { OverlayProvider } from './provider';
import { BuilderOverlay } from './overlay';
import { RegionProvider } from './providers/region-provider';
import { gameController } from '../../viewer/controllers/GameController';

export const ZoneBuilder = ({ zone, goHome }) => {
  const canvasRef = useRef();
  const { webgpu } = useSettingsContext();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      while (!canvasRef.current) {
        console.log('WAit', canvasRef, zone);
        await new Promise((res) => setTimeout(res, 50));
      }
      await gameController.loadEngine(canvasRef.current, webgpu);
      await gameController.ZoneBuilderController.loadModel(zone);
      setLoaded(true);
      window.addEventListener('resize', window.gameController.resize);
      window.addEventListener('keydown', window.gameController.keyDown);
    })();

    return () => {
      window.removeEventListener('resize', window.gameController.resize);
      window.removeEventListener('keydown', window.gameController.keyDown);
    };
  }, [zone, webgpu]);
  return (
    <>
      <Box
        as="canvas"
        sx={{ flexGrow: '1', position: 'fixed' }}
        ref={canvasRef}
        id="renderCanvasZb"
        width="100vw"
        height="100vh"
      />
      {loaded && (
        <RegionProvider>
          <OverlayProvider goHome={goHome}>
            <BuilderOverlay />
          </OverlayProvider>
        </RegionProvider>
      )}
    </>
  );
};
