import React from 'react';
import Paper from '@mui/material/Paper';
import Draggable from 'react-draggable';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';

import './dialog.scss';

export function PaperComponent(props) {
  return (
    <Draggable
      handle="#draggable-dialog-title"
      cancel={'[class*="MuiDialogContent-root"]'}
    >
      <Paper sx={{ pointerEvents: 'auto' }} {...props} />
    </Draggable>
  );
}

export const CommonDialog = ({ onClose, children, title = '', fullWidth = false }) => {
  return (
    <Dialog
      onKeyDown={e => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
      open
      disableEnforceFocus
      fullWidth={fullWidth}
      maxWidth='md'
      className='ui-dialog'
      sx={{ pointerEvents: 'none' }}
      slotProps={{ backdrop: { sx: { pointerEvents: 'none' } } }}
      hideBackdrop
      PaperComponent={PaperComponent}
      aria-labelledby="draggable-dialog-title"
    >
      <DialogTitle
        className='ui-dialog-title'
        style={{ cursor: 'move' }}
        id="draggable-dialog-title"
      >
        {title}
      </DialogTitle>
      <DialogContent>
        {children}
      </DialogContent>
      <DialogActions>
        <Button className='ui-dialog-btn' autoFocus onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};
