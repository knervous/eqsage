import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import './overlay.scss';
import { gameController } from '../../viewer/controllers/GameController';

export const ExporterHeader = ({ name }) => {
  const ref = useRef(null);
  const [, forceRender] = useState({});
  useEffect(() => {
    const listener = () => forceRender({});
    window.addEventListener('resize', listener);
    return () => window.removeEventListener('resize', listener);
  }, []);
  return name ? (
    <Box ref={ref} sx={{ position: 'fixed', zIndex: 10, width: 'auto', left: `calc(50vw - ${(ref.current?.clientWidth ?? 0) / 2}px)` }}>
      <Typography
        className='text-outline'
        sx={{
          color    : 'white',
          margin   : '10px auto',
          textAlign: 'center',
        }}
        variant="h5"
      >
        {name}
      </Typography>
      <Typography
        onClick={() => gameController.SpawnController.exportModel()}
        className='zone-overlay-text text-outline clickable'
        sx={{
          userSelect: 'none',
          margin    : '5px auto',
          textAlign : 'center',
        }}
        color="text.secondary"
        variant="h6"
      >
        Export GLB
      </Typography>
    </Box>
  ) : null;
};
