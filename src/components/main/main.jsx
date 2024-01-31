import React, { useEffect, useState } from 'react';
import { Stack, ThemeProvider, createTheme } from '@mui/material';

import { PermissionStatusTypes, usePermissions } from '../../hooks/permissions';
import { StatusDialog } from '../dialogs/status-dialog';
import './main.scss';
import { ZoneChooserDialog } from '../dialogs/zone-chooser-dialog';
import { BabylonZoneOverlay } from '../zone/overlay';
import { BabylonZone } from '../zone/zone';


const MainContext = React.createContext({ });
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
        selectedZone, setSelectedZone,
        zoneDialogOpen, setZoneDialogOpen,
        statusDialogOpen, setStatusDialogOpen,
      }}>
      <ThemeProvider
        theme={createTheme({
          palette   : { mode: 'dark' },
          typography: { fontFamily: 'Montaga' },
        })}
      >
        {statusDialogOpen && (
          <StatusDialog
            onDrop={onDrop}
            permissionStatus={permissionStatus}
            open={true}
            requestPermissions={requestPermissions}
          />
        )}
        {zoneDialogOpen && (
          <ZoneChooserDialog
            open={true}
          />
        )}
        <BabylonZoneOverlay />
        <BabylonZone />
        <Stack
          onDragOver={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          direction={'row'}
          onDrop={onDrop}
          className="main"
        ></Stack>
      </ThemeProvider>
    </MainContext.Provider>
  );
};
