import React, { useEffect, useRef, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { useMainContext } from '../main/context';
import { gameController } from '../../viewer/controllers/GameController';
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

  useEffect(() => {
    const interval = setInterval(() => forceRender({}), 500);
    return () => clearInterval(interval);
  }, []);
  return selectedZone ? (
    <Box
      ref={ref}
      sx={{
        position: 'fixed',
        zIndex  : 10,
        width   : 'auto',
        left    : `calc(50vw - ${(ref.current?.clientWidth ?? 0) / 2}px)`,
      }}
    >
      <Stack
        sx={{ height: '45px' }}
        direction="row"
        justifyContent={'center'}
        alignItems="center"
      >
        <Typography
          className="text-outline"
          sx={{
            color     : 'white',
            margin    : '10px auto',
            textAlign : 'center',
            lineHeight: '1.6',
          }}
          variant="h5"
        >
          {selectedZone.long_name}
        </Typography>
        <Typography
          onClick={() => {
            gameController.ZoneController.exportZone(selectedZone.short_name);
          }}
          className="zone-overlay-text text-outline clickable"
          sx={{
            userSelect: 'none',
            margin    : '10px 5px',
            paddingTop: '2px',
            textAlign : 'center',
          }}
          color="text.secondary"
          variant="h6"
        >
          [Export GLB]
        </Typography>
        <Typography
          onClick={() => {
            gameController.ZoneController.exportSTL(selectedZone.short_name);
          }}
          className="zone-overlay-text text-outline clickable"
          sx={{
            userSelect: 'none',
            margin    : '10px 5px',
            paddingTop: '2px',
            textAlign : 'center',
          }}
          color="text.secondary"
          variant="h6"
        >
          [Export STL]
        </Typography>
      </Stack>

      <Typography
        onClick={() => setZoneDialogOpen(true)}
        className="zone-overlay-text text-outline clickable"
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
        }}
        className="zone-overlay-text text-outline clickable"
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
