import { useEffect } from 'react';
import { useSettingsContext } from '../../context/settings';
import { gameController } from '../../viewer/controllers/GameController';

export const useSettingsHook = () => {
  const settings = useSettingsContext();

  useEffect(() => {
    gameController.ZoneController.showRegions(settings.showRegions);
  }, [settings.showRegions]);

  useEffect(() => {
    gameController.ZoneController.setFlySpeed(settings.flySpeed);
  }, [settings.flySpeed]);

  useEffect(() => {
    gameController.ZoneController.setGlow(settings.glow);
  }, [settings.glow]);

};