import React from 'react';
import {
  Box,
  FormControl,
  MenuItem,
  Select,
  Slider,
  Typography,
} from '@mui/material';
import { CommonDialog } from '../../../components/spire/dialogs/common';
import { useSettingsContext } from '../../../context/settings';
import { locations } from '../constants';
import { MuiColorInput } from 'mui-color-input';

const backgrounds = [
  {
    name : 'None',
    value: 'none',
  },
  {
    name : 'Default',
    value: 'default',
  },
  {
    name : 'Forest',
    value: 'forest',
  },
  {
    name : 'Full Moon',
    value: 'fullmoon',
  },
  {
    name : 'Halflife',
    value: 'halflife',
  },
  {
    name : 'Interstellar',
    value: 'interstellar',
  },
  {
    name : 'Meadow',
    value: 'meadow',
  },
  {
    name : 'Nebula',
    value: 'nebula',
  },
  {
    name : 'Sand',
    value: 'sand',
  },
  {
    name : 'Space',
    value: 'space',
  },
];

function rgbaToNumber(r, g, b, a) {
  return (
    ((a & 0xff) << 24) | ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
  );
}

function rgbaNumberToHex(rgbaNumber) {
  const r = (rgbaNumber >> 16) & 0xff;
  const g = (rgbaNumber >> 8) & 0xff;
  const b = rgbaNumber & 0xff;
  const a = (rgbaNumber >> 24) & 0xff;
  return `#${((1 << 8) + r).toString(16).slice(1)}${((1 << 8) + g)
    .toString(16)
    .slice(1)}${((1 << 8) + b).toString(16).slice(1)}${((1 << 8) + a)
      .toString(16)
      .slice(1)}`;
}
function hexToRgbaNumber(hex) {
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  if (hex.length !== 8) {
    throw new Error('Invalid hex color string. Expected format: #RRGGBBAA');
  }

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = parseInt(hex.slice(6, 8), 16);

  return (a << 24) | (r << 16) | (g << 8) | b;
}

export const SettingsDialog = ({ onClose }) => {
  const { background, setOption, bgColor, rotateSpeed, nameplateColor } = useSettingsContext();
  return (
    <CommonDialog onClose={onClose} title={'Settings'}>
      <Box sx={{ minWidth: '400px', minHeight: '100px' }}>
        <FormControl size="small" fullWidth>
          <Typography sx={{ margin: '3px 0' }}>Background</Typography>
          <Select
            size="small"
            fullWidth
            onChange={(e) => setOption('background', e.target.value)}
            value={background}
          >
            {backgrounds.map(({ name, value }) => (
              <MenuItem value={value}>{name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ marginTop: '10px' }} size="small" fullWidth>
          <Typography sx={{ margin: '3px 0' }}>
            Base Background Color
          </Typography>
          <MuiColorInput
            format={'hex8'}
            value={bgColor}
            onChange={(e) => {
              setOption('bgColor', e);
            }}
          />
        </FormControl>
        <FormControl sx={{ marginTop: '10px' }} size="small" fullWidth>
          <Typography sx={{ margin: '3px 0' }}>
            Nameplate Color
          </Typography>
          <MuiColorInput
            format={'hex8'}
            value={nameplateColor}
            onChange={(e) => {
              setOption('nameplateColor', e);
            }}
          />
        </FormControl>
        <FormControl sx={{}} fullWidth>
          <Typography
            sx={{ fontSize: 14, marginTop: 2, width: '80%' }}
            color="text.secondary"
            gutterBottom
          >
            Camera Rotate Speed: {rotateSpeed}
          </Typography>
          <Slider
            value={rotateSpeed}
            onChange={(e) => setOption('rotateSpeed', +e.target.value)}
            step={0.01}
            min={0.1}
            max={5}
          />
        </FormControl>
      </Box>
    </CommonDialog>
  );
};
