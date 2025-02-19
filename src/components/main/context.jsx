import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { gameController } from '../../viewer/controllers/GameController';

const MainContext = React.createContext({});


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


/**
 * @typedef {Object} UseMainContextReturn
 * @property {any} selectedZone - The currently selected zone.
 * @property {React.Dispatch<React.SetStateAction<any>>} setSelectedZone - Function to set the selected zone.
 * @property {boolean} zoneDialogOpen - Whether the zone dialog is open.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setZoneDialogOpen - Function to set the zone dialog open state.
 * @property {boolean} statusDialogOpen - Whether the status dialog is open.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setStatusDialogOpen - Function to set the status dialog open state.
 * @property {boolean} modelExporter - Whether the model exporter is enabled.
 * @property {React.Dispatch<React.SetStateAction<boolean>>} setModelExporter - Function to set the model exporter state.
 * @property {any} rootFileSystemHandle - The file system handle for the root.
 * @property {any[]} zones - The list of zones.
 * @property {React.Dispatch<React.SetStateAction<any[]>>} setZones - Function to set the list of zones.
 * @property {Spire} Spire - Spire object containing APIs and utilities.
 * @property {any} onDrop - Handler for file drop operations.
 * @property {any} requestPermissions - Function to request permissions.
 * @property {PermissionStatusTypes} permissionStatus - The current permission status.
 * @property {any[]} recentList - List of recent zones.
 * @property {React.Dispatch<React.SetStateAction<any[]>>} setRecentList - Function to set the recent zones list.
 */

/**
 * 
 * @returns {UseMainContextReturn}
 */
export const useMainContext = () => React.useContext(MainContext);


/**
 * 
 * @param {*} param0 
 * @returns 
 */

export const MainProvider = ({ children }) => {
  const [permissionStatus, onDrop, requestPermissions, rootFileSystemHandle, onFolderSelected] =
    usePermissions();
  const { remoteUrl } = useSettingsContext();
  const [selectedZone, setSelectedZone] = useState(null);
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [zoneBuilderDialogOpen, setZoneBuilderDialogOpen] = useState(false);
  const [audioDialogOpen, setAudioDialogOpen] = useState(false);
  const [modelExporter, setModelExporter] = useState(false);
  const [quailWorkspace, setQuailWorkspace] = useState(false);
  const [zoneBuilder, setZoneBuilder] = useState(false);
  const [zones, setZones] = useState([]);
  const [spire, setSpire] = useState(null);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [canvasState, setCanvasState] = useState(false);
  const [recentList, setRecentList] = useState(() =>
    localStorage.getItem('recent-zones')
      ? JSON.parse(localStorage.getItem('recent-zones'))
      : []
  );
  const reset = useCallback(() => {
    setSelectedZone(null);
    setZoneDialogOpen(true);
    setStatusDialogOpen(false);
    setZoneBuilderDialogOpen(false);
    setAudioDialogOpen(false);
    setModelExporter(false);
    setZoneBuilder(false);
    setCanvasState(false);
    setRightDrawerOpen(false);
    setQuailWorkspace(false);
  }, []);

  useEffect(() => {
    setStatusDialogOpen(permissionStatus !== PermissionStatusTypes.Ready);
    if (permissionStatus === PermissionStatusTypes.Ready && !selectedZone) {
      setZoneDialogOpen(true);
    }
  }, [permissionStatus, selectedZone]);

  useEffect(() => {
    window.gameController.rootFileSystemHandle = rootFileSystemHandle;
  }, [rootFileSystemHandle]);

  useEffect(() => {
    window.gameController.modelExporter = true;
  }, [modelExporter]);

  useEffect(() => {
    let retries = 0;
    const int = setInterval(() => {
      if (window.Spire) {
        console.log(`Set Spire with ${retries} retries`);
        setSpire(window.Spire);
        clearInterval(int);
      } else {
        retries++;
      }
    }, 100);
  }, []);

  const Spire = useMemo(
    () =>
      spire ??
      (() => {
        window.Spire = {
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
        };
        return window.Spire;
      })() ??
      null,
    [spire]
  );

  useEffect(() => {
    SpireApi.remoteUrl = remoteUrl || 'http://spire.akkadius.com';
  }, [remoteUrl]);

  useEffect(() => {
    localStorage.setItem('recent-zones', JSON.stringify(recentList));
  }, [recentList]);

  useEffect(() => {
    gameController.Spire = Spire;
  }, [Spire]);
  
  return (
    <MainContext.Provider
      value={{
        canvasState,
        setCanvasState,
        selectedZone,
        setSelectedZone,
        zoneDialogOpen,
        setZoneDialogOpen,
        statusDialogOpen,
        setStatusDialogOpen,
        audioDialogOpen,
        setAudioDialogOpen,
        zoneBuilderDialogOpen,
        setZoneBuilderDialogOpen,
        modelExporter,
        setModelExporter,
        quailWorkspace, 
        setQuailWorkspace,
        zoneBuilder,
        setZoneBuilder,
        rightDrawerOpen, 
        setRightDrawerOpen,
        rootFileSystemHandle,
        zones,
        setZones,
        Spire,
        onDrop,
        requestPermissions,
        permissionStatus,
        onFolderSelected,
        recentList,
        setRecentList,
        reset,
        gameController
      }}
    >
      {children}
    </MainContext.Provider>
  );
};
