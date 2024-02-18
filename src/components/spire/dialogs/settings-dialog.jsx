import React from 'react';
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  Slider,
  Typography,
} from '@mui/material';
import { CommonDialog } from './common';
import { useSettingsContext } from '../../../context/settings';

export const SettingsDialog = ({ onClose }) => {
  const { setOption, showRegions, flySpeed, glow } = useSettingsContext();
  return (
    <CommonDialog onClose={onClose} title={'Settings'}>
      <FormControl sx={{ marginTop: 1, marginBottom: 2 }} fullWidth>
        <Typography
          sx={{ fontSize: 14, marginTop: 2, width: '80%' }}
          color="text.secondary"
          gutterBottom
        >
              Camera Fly Speed: {flySpeed}
        </Typography>
        <Slider

          value={flySpeed}
          onChange={(e) => setOption('flySpeed', +e.target.value)}
          step={0.01}
          min={0.01}
          max={20}
        />
      </FormControl>
      <FormControlLabel
        control={
          <Checkbox
            checked={showRegions}
            onChange={({ target: { checked } }) =>
              setOption('showRegions', checked)
            }
          />
        }
        label="Show Regions"
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={glow}
            onChange={({ target: { checked } }) =>
              setOption('glow', checked)
            }
          />
        }
        label="NPC Glow"
      />
   
    </CommonDialog>
  );
};
