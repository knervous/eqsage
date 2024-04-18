import React, { useEffect, useMemo, useState } from 'react';
import { PermissionStatusTypes, usePermissions } from '../../hooks/permissions';
import { SpireApi, SpireQueryBuilder } from 'spire-api';
import { Spawn2Api } from 'spire-api/api/spawn2-api';
import { SpawngroupApi } from 'spire-api/api/spawngroup-api';
import { SpawnentryApi } from 'spire-api/api/spawnentry-api';
import { Zones } from 'spire-api/wrappers/zones';
import { Spawn } from 'spire-api/wrappers/spawn';
import { Grid } from 'spire-api/wrappers/grid';
import { Npcs } from 'spire-api/wrappers/npcs';
import { useSettingsContext } from '../../context/settings';

const MainContext = React.createContext({});

export const useMainContext = () => React.useContext(MainContext);

/**
 * @typedef Spire
 * @property {import ('../../../../spire/frontend/src/app/api/spire-api')} SpireApi
 * @property {import ('../../../../spire/frontend/src/app/api')} SpireApiTypes
 * @property {import ('../../../../spire/frontend/src/app/api/spire-query-builder').SpireQueryBuilder} SpireQueryBuilder
 * @property {import ('../../../../spire/frontend/src/app/zones').Zones} Zones
 * @property {import ('../../../../spire/frontend/src/app/spawn').Spawn} Spawn
 * @property {import ('../../../../spire/frontend/src/app/grid').Grid} Grid
 * @property {import ('../../../../spire/frontend/src/app/npcs').Npcs} Npcs
 */

export const MainProvider = ({ children }) => {
  const [permissionStatus, onDrop, requestPermissions, rootFileSystemHandle] =
    usePermissions();
  const { remoteUrl } = useSettingsContext();
  const [selectedZone, setSelectedZone] = useState(null);
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  useEffect(() => {
    setStatusDialogOpen(permissionStatus !== PermissionStatusTypes.Ready);
    if (permissionStatus === PermissionStatusTypes.Ready && !selectedZone) {
      setZoneDialogOpen(true);
    }
  }, [permissionStatus, selectedZone]);

  const Spire = useMemo(
    () =>
      window.Spire ??
      (() => {
        return !!remoteUrl
          ? {
            SpireApi,
            SpireQueryBuilder,
            SpireApiTypes: {
              Spawn2Api,
              SpawnentryApi,
              SpawngroupApi,
            },
            Zones,
            Spawn,
            Grid,
            Npcs,
          }
          : null;
      })() ??
      null,
    [remoteUrl]
  );

  useEffect(() => {
    SpireApi.remoteUrl = remoteUrl;
  }, [remoteUrl]);
  return (
    <MainContext.Provider
      value={{
        selectedZone,
        setSelectedZone,
        zoneDialogOpen,
        setZoneDialogOpen,
        statusDialogOpen,
        setStatusDialogOpen,
        rootFileSystemHandle,
        Spire,
        onDrop,
        requestPermissions,
        permissionStatus,
      }}
    >
      {children}
    </MainContext.Provider>
  );
};
