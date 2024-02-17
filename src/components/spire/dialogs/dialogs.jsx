import React from 'react';
import { useOverlayContext } from '../provider';
import { SettingsDialog } from './settings-dialog';
import { ZoneDialog } from './zone-dialog';
import { NpcDialog } from './npc-dialog';

export const OverlayDialogs = () => {
  const { dialogState, closeDialogs } = useOverlayContext();

  return <>
    {dialogState['settings'] && <SettingsDialog onClose={closeDialogs} />}
    {dialogState['zone'] && <ZoneDialog onClose={closeDialogs} />}
    {dialogState['npc'] && <NpcDialog onClose={closeDialogs} />}
  </>;
};