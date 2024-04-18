import React, { useCallback, useEffect, useState } from 'react';
import { useMainContext } from '../main/context';
import { gameController } from '../../viewer/controllers/GameController';


const ZoneContext = React.createContext({});
export const useZoneContext = () => React.useContext(ZoneContext);

export const ZoneProvider = ({ children }) => {
  const { selectedZone, Spire } = useMainContext();
  const [spawns, setSpawns] = useState([]);

  const loadCallback = useCallback(async () => {
    const spawnPoints = await Spire.Spawn.getByZone(
      selectedZone.short_name,
      selectedZone.version
    );

    const gridPoints = Spire.Grid
      ? await Spire.Grid.getById(selectedZone.zoneidnumber)
      : await fetch(
          `${Spire.SpireApi.getBaseV1Path()}/grid_entries?where=zoneid__${
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
    setSpawns(spawnPoints);
  }, [selectedZone, Spire]);


  useEffect(() => {
    if (!Spire || !selectedZone) {
      return;
    }
    gameController.ZoneController.addLoadCallback(loadCallback);
    return () => {
      gameController.ZoneController.removeLoadCallback(loadCallback);
    };
  }, [loadCallback, selectedZone, Spire]);


  useEffect(() => {
    gameController.SpawnController.addSpawns(spawns);
  }, [spawns]);
  return (
    <ZoneContext.Provider
      value={{
        spawns,
        setSpawns,
        loadCallback
      }}
    >
      {children}
    </ZoneContext.Provider>
  );
};
