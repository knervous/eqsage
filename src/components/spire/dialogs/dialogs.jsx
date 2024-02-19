import React, { useEffect, useState } from 'react';
import { useOverlayContext } from '../provider';
import { SettingsDialog } from './settings-dialog';
import { ZoneDialog } from './zone-dialog';
import { NpcDialog } from './npc-dialog';
import { useMainContext } from '../../main/main';
import { gameController } from '../../../viewer/controllers/GameController';

export const OverlayDialogs = () => {
  const { dialogState, closeDialogs } = useOverlayContext();
  const [spawns, setSpawns] = useState([]);
  const { selectedZone } = useMainContext();
  useEffect(() => {
    if (!gameController.Spire || !selectedZone) {
      return;
    }
    const loadCallback = async () => {
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
        );

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
    };
    gameController.ZoneController.addLoadCallback(loadCallback);
    return () => {
      gameController.ZoneController.removeLoadCallback(loadCallback);
    };
  }, [selectedZone]);

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
