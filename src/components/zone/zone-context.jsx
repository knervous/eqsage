import React, { useCallback, useEffect, useState } from 'react';
import { useMainContext } from '../main/main';
import { gameController } from '../../viewer/controllers/GameController';


const ZoneContext = React.createContext({});
export const useZoneContext = () => React.useContext(ZoneContext);

export const ZoneProvider = ({ children }) => {
  const { selectedZone } = useMainContext();
  const [spawns, setSpawns] = useState([]);

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
    setSpawns(spawnPoints);
  }, [selectedZone]);


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
