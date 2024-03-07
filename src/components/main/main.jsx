import React, { useEffect, useState } from 'react';
import { Stack, ThemeProvider, createTheme } from '@mui/material';
import { ConfirmProvider } from 'material-ui-confirm';
import { PermissionStatusTypes, usePermissions } from '../../hooks/permissions';
import { StatusDialog } from '../dialogs/status-dialog';
import './main.scss';
import { ZoneChooserDialog } from '../dialogs/zone-chooser-dialog';
import { BabylonZoneOverlay } from '../zone/overlay';
import { BabylonZone } from '../zone/zone';
import { ZoneProvider } from '../zone/zone-context';
import { SettingsProvider } from '../../context/settings';
import { LoadingDialog } from '../spire/dialogs/loading-dialog';

const CONSTANTS = {
  BONE         : '#ccc',
  CONTRAST_TEXT: '#777',
  LIGHT_GRAY   : 'rgba(0,0,0,0.1)',
};
const MainContext = React.createContext({});
export const useMainContext = () => React.useContext(MainContext);

export const Main = () => {
  const [permissionStatus, onDrop, requestPermissions] = usePermissions();
  const [selectedZone, setSelectedZone] = useState(null);
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  useEffect(() => {
    setStatusDialogOpen(permissionStatus !== PermissionStatusTypes.Ready);
    if (permissionStatus === PermissionStatusTypes.Ready && !selectedZone) {
      setZoneDialogOpen(true);
    }
  }, [permissionStatus, selectedZone]);

  return (
    <MainContext.Provider
      value={{
        selectedZone,
        setSelectedZone,
        zoneDialogOpen,
        setZoneDialogOpen,
        statusDialogOpen,
        setStatusDialogOpen,
      }}
    >
      <LoadingDialog />
      <SettingsProvider>
        <ThemeProvider
          theme={createTheme({
            palette: {
              mode   : 'dark',
              primary: {
                // light: will be calculated from palette.primary.main,
                main        : CONSTANTS.BONE,
                // dark: will be calculated from palette.primary.main,
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
                onDrop={onDrop}
                permissionStatus={permissionStatus}
                open={true}
                requestPermissions={requestPermissions}
              />
            )}
            {zoneDialogOpen && <ZoneChooserDialog open={true} />}
            <ZoneProvider>
              <BabylonZoneOverlay />
              <BabylonZone />
            </ZoneProvider>
            <Stack
              onDragOver={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              direction={'row'}
              onDrop={onDrop}
              className="main"
            ></Stack>
          </ConfirmProvider>
        </ThemeProvider>
      </SettingsProvider>
    </MainContext.Provider>
  );
};
