import React, { useCallback, useEffect, useState } from 'react';
import { useOverlayContext } from '../provider';
import { SettingsDialog } from './settings-dialog';
import { ZoneDialog } from './zone-dialog';
import { NpcDialog } from './npc-dialog';
import { useMainContext } from '../../main/main';
import { gameController } from '../../../viewer/controllers/GameController';

export const loadCallbackContainer = { cb: null };

export const OverlayDialogs = () => {
  const { dialogState, closeDialogs } = useOverlayContext();
  const [spawns, setSpawns] = useState([]);
  const { selectedZone } = useMainContext();

  const loadCallback = useCallback(async () => {
    const spawnPoints = await gameController.Spire.Spawn.getByZone(
      selectedZone.short_name,
      selectedZone.version
    );

    const gridPoints = gameController.Spire.Grid
      ? await gameController.Spire.Grid.getById(selectedZone.zoneidnumber)
      : await fetch(
          `${gameController.Spire.SpireApi.getBaseV1Path()}/grid_entries?where=zoneid__${
            selectedZone.zoneidnumber
          }&orderBy=gridid.number&limit=100000`
      ).then(a => a.json());

    for (const path of gridPoints) {
      for (const [idx, spawn] of Object.entries(spawnPoints)) {
        if (path.gridid === spawn.pathgrid) {
          if (!spawnPoints[idx].grid) {
            spawnPoints[idx].grid = [];
          }
          spawnPoints[idx].grid.push(path);
        }
      }
    }
    console.log('spoints', spawnPoints);
    setSpawns(spawnPoints);
  }, [selectedZone]);

  // Oh how hacky, this can fit into an existing context much better, just proof of concept for now
  loadCallbackContainer.cb = loadCallback;
  useEffect(() => {
    if (!gameController.Spire || !selectedZone) {
      return;
    }
    gameController.ZoneController.addLoadCallback(loadCallback);
    return () => {
      gameController.ZoneController.removeLoadCallback(loadCallback);
    };
  }, [loadCallback, selectedZone]);

  useEffect(() => {
    gameController.ZoneController.loadZoneSpawns(spawns);
  }, [spawns]);

  return (
    <>
      {dialogState['settings'] && <SettingsDialog onClose={closeDialogs} />}
      {dialogState['zone'] && <ZoneDialog onClose={closeDialogs} />}
      {dialogState['npc'] && (
        <NpcDialog onClose={closeDialogs} spawns={spawns} />
      )}
    </>
  );
};
