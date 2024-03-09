import { useEffect } from 'react';
import { useSettingsContext } from '../../context/settings';
import { gameController } from '../../viewer/controllers/GameController';
import { SpireApi } from 'spire-api';

export const useSettingsHook = () => {
  const settings = useSettingsContext();

  useEffect(() => {
    gameController.ZoneController.showRegions(settings.showRegions);
  }, [settings.showRegions]);

  useEffect(() => {
    gameController.ZoneController.setFlySpeed(settings.flySpeed);
  }, [settings.flySpeed]);

  useEffect(() => {
    gameController.ZoneController.setClipPlane(settings.clipPlane);
  }, [settings.clipPlane]);

  useEffect(() => {
    gameController.SpawnController.setSpawnLOD(settings.spawnLOD);
  }, [settings.spawnLOD]);

  useEffect(() => {
    gameController.ZoneController.setGlow(settings.glow);
  }, [settings.glow]);

  useEffect(() => {
    SpireApi.remoteUrl = settings.remoteUrl;
  }, [settings.remoteUrl]);

  useEffect(() => {
    gameController.settings = settings;
  }, [settings]);

};