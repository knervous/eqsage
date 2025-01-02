import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Checkbox,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import './overlay.scss';
import { gameController } from '../../viewer/controllers/GameController';
import { CheckBox } from '@mui/icons-material';

export const ExporterHeader = ({ name }) => {
  const ref = useRef(null);
  const [, forceRender] = useState({});
  const [withAnimations, setWithAnimations] = useState(true);
  useEffect(() => {
    const listener = () => forceRender({});
    window.addEventListener('resize', listener);
    return () => window.removeEventListener('resize', listener);
  }, []);
  return name ? (
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
        justifyContent={'center'}
        alignContent={'center'}
        sx={{
          userSelect: 'none',
          margin    : '5px auto',
          textAlign : 'center',
        }}
        direction="row"
      >
        <Typography
          className="text-outline"
          sx={{
            color    : 'white',
            margin   : '10px auto',
            textAlign: 'center',
          }}
          variant="h5"
        >
          {name}
        </Typography>

        <FormControlLabel
          sx={{ marginTop: '-5px', marginLeft: '10px', color: 'white' }}
          control={
            <Checkbox
              checked={withAnimations}
              onChange={({ target: { checked } }) => setWithAnimations(checked)}
            />
          }
          label="Export With Animations"
        />
      </Stack>
      <Stack
        direction="row"
        sx={{ width: '100%' }}
        justifyContent={'center'}
        alignItems={'space-evenly'}
      >
        <Typography
          onClick={() =>
            gameController.SpawnController.exportModel(withAnimations)
          }
          className="zone-overlay-text text-outline clickable"
          color="text.secondary"
          variant="h6"
        >
          Export GLB
        </Typography>
        <Typography
          color="text.secondary"
          variant="h6"
          sx={{ margin: '0 10px' }}
        >
          -
        </Typography>
        <Typography
          onClick={() => gameController.SpawnController.exportSTL()}
          className="zone-overlay-text text-outline clickable"
          color="text.secondary"
          variant="h6"
        >
          Export STL (3D Printing)
        </Typography>
        <Typography
          color="text.secondary"
          variant="h6"
          sx={{ margin: '0 10px' }}
        >
          -
        </Typography>
        <Typography
          onClick={() => gameController.SpawnController.exportFBX(withAnimations)}
          className="zone-overlay-text text-outline clickable"
          color="text.secondary"
          variant="h6"
        >
          Export FBX (Autodesk)
        </Typography>
      </Stack>
    </Box>
  ) : null;
};
