import React, { useEffect } from 'react';
import { UiState, useSelector } from '../../../state';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { gameController } from '../../../viewer/controllers/GameController';

export const LoadingDialog = () => {
  const loading = useSelector(UiState.loading);
  const loadingText = useSelector(UiState.loadingText);
  const loadingTitle = useSelector(UiState.loadingTitle);

  useEffect(() => {
    gameController.loading = loading;
  }, [loading]);

  return loading ? (
    <>
      <Box className="main"></Box>
      <Dialog
        open={true}
        maxWidth="md"
        className="ui-dialog"
        sx={{ pointerEvents: 'none', zIndex: 1000000 }}
        slotProps={{ backdrop: { sx: { pointerEvents: 'none' } } }}
      >
        <DialogTitle className="ui-dialog-title">{loadingTitle}</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display       : 'flex',
              alignItems    : 'center',
              justifyContent: 'center',
              minWidth      : '100px',
              minHeight     : '50px',
            }}
          >
            <Typography
              sx={{ fontSize: 15, textAlign: 'center' }}
              color="#DDD"
              gutterBottom
            >
              {loadingText}
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  ) : null;
};
