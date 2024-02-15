import React from 'react';
import { useOverlayContext } from '../provider';
import { SettingsDialog } from './settings-dialog';

export const OverlayDialogs = () => {
  const { dialogState, closeDialogs } = useOverlayContext();

  return <>
    <SettingsDialog open={dialogState['settings']} onClose={closeDialogs} />
  </>;
};