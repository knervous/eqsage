import { useEffect } from 'react';
import { useSettingsContext } from '../../context/settings';
import { gameController } from '../../viewer/controllers/GameController';
import { useOverlayContext } from './provider';

export const useSettingsHook = () => {
  const settings = useSettingsContext();
  const { openDrawer } = useOverlayContext();

  useEffect(() => {
    gameController.ZoneBuilderController.toggleOpen(openDrawer);
  }, [openDrawer]);
  useEffect(() => {
    gameController.ZoneBuilderController.showRegions(settings.showRegions);
  }, [settings.showRegions]);

  useEffect(() => {
    gameController.ZoneBuilderController.setFlySpeed(settings.flySpeed);
  }, [settings.flySpeed]);

  useEffect(() => {
    gameController.ZoneBuilderController.setClipPlane(settings.clipPlane);
  }, [settings.clipPlane]);

  useEffect(() => {
    gameController.ZoneBuilderController.setSpawnLOD(settings.spawnLOD);
  }, [settings.spawnLOD]);

  useEffect(() => {
    gameController.ZoneBuilderController.setGlow(settings.glow);
  }, [settings.glow]);

  useEffect(() => {
    gameController.settings = settings;
  }, [settings]);

};