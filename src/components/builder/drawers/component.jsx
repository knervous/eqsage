import React from 'react';
import { useOverlayContext } from '../provider';
import { SettingsDialog } from '../../spire/dialogs/settings-dialog';
import { Drawer } from './drawer';

export const OverlayDrawers = () => {
  const { drawerState, closeDrawers } = useOverlayContext();
  return (
    <>
      {drawerState['settings'] && <SettingsDialog onClose={closeDrawers} />}
      <Drawer />
    </>
  );
};
