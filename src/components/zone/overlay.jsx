import React from 'react';
import { Box, Typography } from '@mui/material';
import { useMainContext } from '../main/main';
import './overlay.scss';

export const BabylonZoneOverlay = () => {
  const { selectedZone, setZoneDialogOpen, setSelectedZone } = useMainContext();
  return selectedZone ? (
    <Box sx={{ position: 'fixed', zIndex: 10, width: '100vw' }}>
      <Typography
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
        className='zone-overlay-text'
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
        className='zone-overlay-text'
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
