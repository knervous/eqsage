import React from 'react';
import { Stack, ThemeProvider, createTheme } from '@mui/material';
import { ConfirmProvider } from 'material-ui-confirm';
import { StatusDialog } from '../dialogs/status-dialog';
import { ZoneChooserDialog } from '../dialogs/zone-chooser-dialog';
import { BabylonZoneOverlay } from '../zone/overlay';
import { BabylonZone } from '../zone/zone';
import { ZoneProvider } from '../zone/zone-context';
import { LoadingDialog } from '../spire/dialogs/loading-dialog';
import { useMainContext } from './context';
import { ZoneBuilderDialog } from '../dialogs/zone-builder-dialog';
import { AudioDialog } from '../dialogs/audio-dialog';

import './main.scss';

const CONSTANTS = {
  BONE         : '#ccc',
  CONTRAST_TEXT: '#777',
  LIGHT_GRAY   : 'rgba(0,0,0,0.1)',
};

export const Main = () => {
  const {
    zoneDialogOpen,
    statusDialogOpen,
    rootFileSystemHandle,
    onDrop,
    requestPermissions,
    permissionStatus,
    zoneBuilderDialogOpen,
    audioDialogOpen,
  } = useMainContext();

  return (
    <>
      <LoadingDialog />
      <ThemeProvider
        theme={createTheme({
          palette: {
            mode   : 'dark',
            primary: {
              main        : CONSTANTS.BONE,
              contrastText: CONSTANTS.CONTRAST_TEXT,
            },
          },
          typography: {
            fontFamily: 'Montaga',
            button    : {
              textTransform: 'none',
              color        : '#eee !important',
              borderColor  : '#eee',
              fontSize     : '16px',
            },
          },
          overrides: {
            MuiButton: {
              contained: {
                color          : CONSTANTS.BONE,
                backgroundColor: CONSTANTS.CONTRAST_TEXT,
                '&:hover'      : {
                  backgroundColor       : CONSTANTS.LIGHT_GRAY,
                  // Reset on touch devices, it doesn't add specificity
                  '@media (hover: none)': {
                    backgroundColor: CONSTANTS.CONTRAST_TEXT,
                  },
                },
              },
            },
          },
        })}
      >
        <ConfirmProvider>
          {statusDialogOpen && (
            <StatusDialog
              fsHandle={rootFileSystemHandle}
              onDrop={onDrop}
              permissionStatus={permissionStatus}
              open={true}
              requestPermissions={requestPermissions}
            />
          )}
          {zoneDialogOpen && <ZoneChooserDialog open={true} />}
          {zoneBuilderDialogOpen && <ZoneBuilderDialog open={true} />}
          {audioDialogOpen && <AudioDialog open={true} />}
          {!zoneBuilderDialogOpen && (
            <ZoneProvider>
              <BabylonZoneOverlay />
              <BabylonZone />
            </ZoneProvider>
          )}

          <Stack
            onDragOver={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            direction={'row'}
            onDrop={onDrop}
            className="sage-main"
          ></Stack>
        </ConfirmProvider>
      </ThemeProvider>
    </>
  );
};
