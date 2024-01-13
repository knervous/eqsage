import React, { useEffect, useRef, useState } from 'react';

import { gameController } from './controllers/GameController';
import { Box } from '@mui/material';

const params = new Proxy(new URLSearchParams(window.location.search), {
  get: (searchParams, prop) => searchParams.get(prop),
});

export const BabylonViewer = () => {
  const [, forceRender] = useState({});
  const canvasRef = useRef();

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
  }, []);

  return (
    <Box as='canvas' sx={{ flexGrow: '1' }} ref={canvasRef} id="renderCanvas" width="100%" height="100%" />
  );
};
