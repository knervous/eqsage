import React from 'react';
import Paper from '@mui/material/Paper';
import Draggable from 'react-draggable';

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