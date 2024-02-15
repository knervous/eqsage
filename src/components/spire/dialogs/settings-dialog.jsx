import React from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Slider,
  Typography,
} from '@mui/material';
import { PaperComponent } from './common';
import { useSettingsContext } from '../../../context/settings';

export const SettingsDialog = ({ open, onClose }) => {
  const { setOption, showRegions, flySpeed } = useSettingsContext();
  return (
    <Dialog
      onKeyDown={e => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
      open={open}
      disableEnforceFocus
      fullWidth
      sx={{ pointerEvents: 'none' }}
      slotProps={{ backdrop: { sx: { pointerEvents: 'none' } } }}
      hideBackdrop
      PaperComponent={PaperComponent}
      aria-labelledby="draggable-dialog-title"
    >
      <DialogTitle
        style={{ cursor: 'move', margin: '0 auto' }}
        id="draggable-dialog-title"
      >
       Settings
      </DialogTitle>
      <DialogContent>
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
      </DialogContent>
      <DialogActions>
        <Button autoFocus onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};
