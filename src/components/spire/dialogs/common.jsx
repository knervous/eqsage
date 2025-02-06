import React, { useMemo } from 'react';
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
import classNames from 'classnames';

export function PaperComponent(props) {
  return (
    <Draggable
      handle="#draggable-dialog-title"
      onDrag={props.onDrag}
      onStop={props.onStop}
      cancel={'[class*="MuiDialogContent-root"]'}
    >
      <Paper sx={{ pointerEvents: 'auto' }} {...props} />
    </Draggable>
  );
}

export const CommonDialog = ({
  onClose,
  children,
  title = '',
  fullWidth = false,
  open = true,
  cancelButton = false,
  doneText = 'Done',
  doneDisabled = false,
  hideBackdrop = true,
  disableEnforceFocus = true,
  hideButtons = false,
  maxWidth = 'md',
  className = '',
  additionalButtons = null,
  sx = {},
  noEscClose = false,
  onDrag = undefined,
  onStop = undefined
}) => {
  const paperComponent = useMemo(() => props => <PaperComponent {...props} onDrag={onDrag} onStop={onStop} />, [onDrag, onStop]);
  return (
    <Dialog
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !noEscClose) {
          onClose();
        }
      }}
      open={open}
      disableEnforceFocus={disableEnforceFocus}
      fullWidth={fullWidth}
      maxWidth={maxWidth}
      className={'ui-dialog'}
      sx={{ pointerEvents: 'none', ...sx }}
      slotProps={{ backdrop: { sx: { pointerEvents: 'none' } } }}
      hideBackdrop={hideBackdrop}
      PaperComponent={paperComponent}
      aria-labelledby="draggable-dialog-title"
    >
      <DialogTitle
        className="ui-dialog-title"
        style={{ cursor: 'move' }}
        id="draggable-dialog-title"
      >
        {title}
      </DialogTitle>
      <DialogContent sx={{ overflowX: 'hidden' }} className={className}>{children}</DialogContent>
      {!hideButtons && (
        <DialogActions>
          {cancelButton && (
            <Button className="ui-dialog-btn" onClick={() => onClose(false)}>
              Cancel
            </Button>
          )}
          {additionalButtons}
          <Button
            variant='outlined'
            disabled={doneDisabled}
            className={classNames('ui-dialog-btn', {
              'ui-dialog-btn-disabled': doneDisabled,
            })}
            autoFocus
            onClick={() => onClose(true)}
          >
            {doneText}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};
