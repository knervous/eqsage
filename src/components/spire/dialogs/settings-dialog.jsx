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
  const { setOption, showRegions, flySpeed, glow, webgpu = false, forceReload = false, clipPlane = 10000 } = useSettingsContext();
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
      <FormControl sx={{ marginTop: 1, marginBottom: 2 }} fullWidth>
        <Typography
          sx={{ fontSize: 14, marginTop: 2, width: '80%' }}
          color="text.secondary"
          gutterBottom
        >
              Clip Plane: {clipPlane}
        </Typography>
        <Slider

          value={clipPlane}
          onChange={(e) => setOption('clipPlane', +e.target.value)}
          step={1}
          min={5}
          max={30000}
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
      <br/>
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
      <br/>
      <FormControlLabel
        control={
          <Checkbox
            checked={webgpu}
            onChange={({ target: { checked } }) =>
              setOption('webgpu', checked)
            }
          />
        }
        label="Use WebGPU Engine"
      />
      <br/>
      <FormControlLabel
        control={
          <Checkbox
            checked={forceReload}
            onChange={({ target: { checked } }) =>
              setOption('forceReload', checked)
            }
          />
        }
        label="Force zone reload"
      />
   
    </CommonDialog>
  );
};
