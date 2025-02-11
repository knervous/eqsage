import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMainContext } from '@/components/main/context';
import { useAlertContext } from '@/context/alerts';
import { useSettingsContext } from '@/context/settings';

export const ProfileDialog = ({ open, onClose }) => {
  const [id, setId] = useState('');
  const { Spire } = useMainContext();
  const { openAlert } = useAlertContext();
  const { config, setOption } = useSettingsContext();
  return (
    <Dialog
      className="ui-dialog"
      maxWidth="md"
      open={open}
      onClose={onClose}
      aria-labelledby="profile-dialog-title"
    >
      <DialogTitle
        className="ui-dialog-title"
        style={{ cursor: 'move', margin: '0 auto' }}
        id="profile-dialog-title"
      >
        Profile
      </DialogTitle>
      <DialogContent sx={{
        minWidth : '300px',
        minHeight: '200px'
      }}>
        <FormControl fullWidth>
          <TextField
            sx={{ margin: '15px', width: '75%' }}
            value={config.name}
            variant={'standard'}
            onChange={(e) => {
              setOption('config', { ...config, name: e.target.value });
            }}
            label="Player Name"
          />
        </FormControl>
        <Stack direction="column">
          <Button variant="outlined" sx={{ margin: '5px' }} onClick={() => {}}>
            Save Preset
          </Button>
          <Button variant="outlined" sx={{ margin: '5px' }} onClick={() => {}}>
            Load Preset
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
};
