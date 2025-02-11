import React from 'react';
import { Box, FormControl, MenuItem, Select, Typography } from '@mui/material';
import { CommonDialog } from '../../../components/spire/dialogs/common';
import { useSettingsContext } from '../../../context/settings';
import { locations } from '../constants';

const backgrounds = [
  {
    name : 'Default',
    value: 'default'
  },
  {
    name : 'Forest',
    value: 'forest'
  },
  {
    name : 'Full Moon',
    value: 'fullmoon'
  },
  {
    name : 'Halflife',
    value: 'halflife'
  },
  {
    name : 'Interstellar',
    value: 'interstellar'
  },
  {
    name : 'Meadow',
    value: 'meadow'
  },
  {
    name : 'Nebula',
    value: 'nebula'
  },
  {
    name : 'Sand',
    value: 'sand'
  },
  {
    name : 'Space',
    value: 'space'
  },
];

export const SettingsDialog = ({ onClose }) => {
  const { background, setOption } = useSettingsContext();
  return (
    <CommonDialog onClose={onClose} title={'Settings'}>
      <Box sx={{ minWidth: '400px', minHeight: '100px' }}>
        <FormControl size='small' fullWidth>
          <Typography sx={{ margin: '3px 0' }}>Background</Typography>
          <Select
            size='small'
            fullWidth
            onChange={(e) => setOption('background', e.target.value)}
            value={background}
          >
            {backgrounds.map(({ name, value }) => (
              <MenuItem value={value}>{name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

    </CommonDialog>
  );
};
