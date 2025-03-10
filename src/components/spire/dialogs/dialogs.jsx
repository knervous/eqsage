import React from 'react';
import { useOverlayContext } from '../provider';
import { SettingsDialog } from './settings-dialog';
import { ZoneDialog } from './zone-dialog';
import { NpcDialog } from './npc-dialog';
import { QuestDialog } from './quest-dialog';
import Drawer from '../drawer';

export const OverlayDialogs = () => {
  const { dialogState, closeDialogs } = useOverlayContext();
  return (
    <>
      {dialogState['settings'] && <SettingsDialog onClose={closeDialogs} />}
      {dialogState['zone'] && <ZoneDialog onClose={closeDialogs} />}
      <QuestDialog onClose={closeDialogs} open={dialogState['quests']} />
      {dialogState['npc'] && (
        <NpcDialog onClose={closeDialogs} />
      )}
      <Drawer />
    </>
  );
};
