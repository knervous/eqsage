import React, { useCallback, useEffect, useState } from 'react';
import { useMainContext } from '../main/context';
import { gameController } from '../../viewer/controllers/GameController';

const ZoneContext = React.createContext({});
export const useZoneContext = () => React.useContext(ZoneContext);

export const ZoneProvider = ({ children }) => {
  const { selectedZone, Spire } = useMainContext();
  const [spawns, setSpawns] = useState([]);

  const loadCallback = useCallback(
    async (
      { type, spawn } = {
        type : 'refresh',
        spawn: null,
      }
    ) => {
      if (type === 'create') {
        if (!spawn) {
          return;
        }
        gameController.SpawnController.addSpawns([spawn], true);
        setSpawns(s => [...s, spawn]);
      } else if (type === 'updateSpawn') {
        setSpawns(spawns => spawns.map(s => s.id === spawn.id ? spawn : s));
        gameController.SpawnController.updateSpawn(spawn);
      } else if (type === 'deleteSpawn') {
        setSpawns(spawns => spawns.filter(s => s.id !== spawn.id));
        gameController.SpawnController.deleteSpawn(spawn);
      } else if (type === 'refresh') {
        const spawnPoints = await Spire.Spawn.getByZone(
          selectedZone.short_name,
          selectedZone.version
        );
        const gridPoints = Spire.Grid
          ? await Spire.Grid.getById(selectedZone.zoneidnumber)
          : await fetch(
            `${Spire.SpireApi.getBaseV1Path()}/grid_entries?where=zoneid__${selectedZone.zoneidnumber
            }&orderBy=gridid.number&limit=100000`
          ).then((a) => a.json());

        for (const path of gridPoints) {
          for (const [idx, spawn] of Object.entries(spawnPoints)) {
            if (path.gridid === spawn.pathgrid && path.gridid !== 0) {
              if (!spawnPoints[idx].grid) {
                spawnPoints[idx].grid = [];
              }
              spawnPoints[idx].grid.push(path);
            }
          }
        }
        setSpawns(spawnPoints);
        gameController.SpawnController.addSpawns(spawnPoints);
      }
    },
    [selectedZone, Spire]
  );

  useEffect(() => {
    if (!Spire || !selectedZone) {
      return;
    }
    gameController.ZoneController.addLoadCallback(loadCallback);
    return () => {
      gameController.ZoneController.removeLoadCallback(loadCallback);
    };
  }, [loadCallback, selectedZone, Spire]);

  return (
    <ZoneContext.Provider
      value={{
        spawns,
        setSpawns,
        loadCallback,
      }}
    >
      {children}
    </ZoneContext.Provider>
  );
};
