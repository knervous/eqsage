import React, { useEffect, useRef } from 'react';

import { gameController } from './controllers/GameController';
import { Box, Typography } from '@mui/material';

export const BabylonViewer = ({ zoneName = '' }) => {
  const canvasRef = useRef();

  useEffect(() => {
    (async () => {
      await new Promise(res => setTimeout(res, 50));
      console.log('Canvas ref?', canvasRef);
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
    <>
      <Typography
        sx={{
          color    : 'white',
          position : 'fixed',
          margin   : '0 auto',
          top      : '25px',
          width    : '100vw',
          textAlign: 'center',
        }}
        variant="h5"
      >
        {zoneName}
      </Typography>
      <Box as='canvas' sx={{ flexGrow: '1' }} ref={canvasRef} id="renderCanvas" width="100%" height="100%" /></>
  );
};
