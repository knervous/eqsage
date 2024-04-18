import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useMainContext } from '../main/context';
import './overlay.scss';

export const BabylonZoneOverlay = () => {
  const { selectedZone, setZoneDialogOpen, setSelectedZone } = useMainContext();
  const ref = useRef(null);
  const [, forceRender] = useState({});
  useEffect(() => {
    const listener = () => forceRender({});
    window.addEventListener('resize', listener);
    return () => window.removeEventListener('resize', listener);
  }, []);
  return selectedZone ? (
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
        {selectedZone.long_name}
      </Typography>
      <Typography

        onClick={() => setZoneDialogOpen(true)}
        className='zone-overlay-text text-outline clickable'
        sx={{
          userSelect: 'none',
          margin    : '5px auto',
          textAlign : 'center',
        }}
        color="text.secondary"
        variant="h6"
      >
        Change Zone
      </Typography>
      <Typography
        onClick={() => {
          setSelectedZone('');
          setTimeout(() => {
            setZoneDialogOpen(false);
            setSelectedZone(selectedZone);
          }, 1);
            
        } }
        className='zone-overlay-text text-outline clickable'
        sx={{
          userSelect: 'none',
          margin    : '5px auto',
          textAlign : 'center',
        }}
        color="text.secondary"
        variant="h6"
      >
        Reload
      </Typography>
    </Box>
  ) : null;
};
