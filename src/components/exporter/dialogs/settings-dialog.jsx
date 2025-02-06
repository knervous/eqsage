import React from 'react';
import { Box, FormControl, MenuItem, Select, Typography } from '@mui/material';
import { CommonDialog } from '../../../components/spire/dialogs/common';
import { useSettingsContext } from '../../../context/settings';
import { locations } from '../constants';

export const SettingsDialog = ({ onClose }) => {
  const { location, setOption } = useSettingsContext();
  console.log('set');
  return (
    <CommonDialog onClose={onClose} title={'Settings'}>
      <Box sx={{ minWidth: '400px', minHeight: '100px' }}>
        <FormControl size='small' fullWidth>
          <Typography sx={{ margin: '3px 0' }}>Background</Typography>
          <Select
            size='small'
            fullWidth
            onChange={(e) => setOption('location', e.target.value)}
            value={location}
          >
            {locations.map((l, i) => (
              <MenuItem value={i}>{l.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

    </CommonDialog>
  );
};
