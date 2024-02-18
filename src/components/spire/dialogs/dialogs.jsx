import React, { useEffect, useState } from 'react';
import { useOverlayContext } from '../provider';
import { SettingsDialog } from './settings-dialog';
import { ZoneDialog } from './zone-dialog';
import { NpcDialog } from './npc-dialog';
import { useMainContext } from '../../main/main';
import { gameController } from '../../../viewer/controllers/GameController';

export const OverlayDialogs = () => {
  const { dialogState, closeDialogs } = useOverlayContext();
  const [npcs, setNpcs] = useState([]);
  const [spawns, setSpawns] = useState([]);
  const { selectedZone } = useMainContext();
  useEffect(() => {
    if (!gameController.Spire || !selectedZone) {
      return;
    }
    const loadCallback = async () => {
   
      const spawnPoints = await 
      gameController.Spire.Spawn.getByZone(selectedZone.short_name, selectedZone.version, {
        relations: [
        //  'all'
        ],
        uniqueEntries: true,
      });
      setSpawns(spawnPoints);
      
      const npcs = await gameController.Spire.Npcs.getNpcsByZone(selectedZone.short_name, selectedZone.version, {
        relations: [
        //  'all'
        ],
        uniqueEntries: true,
      });

      setNpcs(npcs);

    };
    gameController.ZoneController.addLoadCallback(loadCallback);
    return () => {
      gameController.ZoneController.removeLoadCallback(loadCallback);
    };
  }, [selectedZone]);

  useEffect(() => {
    console.log('spawns', spawns);
    gameController.ZoneController.loadZoneSpawns(spawns);
  }, [spawns]);
  return <>
    {dialogState['settings'] && <SettingsDialog onClose={closeDialogs} />}
    {dialogState['zone'] && <ZoneDialog onClose={closeDialogs} />}
    {dialogState['npc'] && <NpcDialog onClose={closeDialogs} npcs={npcs} />}
  </>;
};