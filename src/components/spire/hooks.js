import { useEffect } from 'react';
import { useSettingsContext } from '../../context/settings';
import { gameController } from '../../viewer/controllers/GameController';

export const useSettingsHook = () => {
  const settings = useSettingsContext();

  useEffect(() => {
    gameController.showRegions(settings.showRegions);
  }, [settings.showRegions]);

  useEffect(() => {
    gameController.setFlySpeed(settings.flySpeed);
  }, [settings.flySpeed]);
  
};