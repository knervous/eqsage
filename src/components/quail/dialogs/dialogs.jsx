import React, { useEffect } from 'react';
import { useOverlayContext } from '../../../components/spire/provider';
import { SettingsDialog } from './settings-dialog';
import { ProcessDialog } from './process-dialog';
import { ExportDialog } from './export-dialog';

export const OverlayDialogs = props => {
  const { toggleDialog, dialogState, closeDialogs } = useOverlayContext();
  useEffect(() => {
    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        closeDialogs();
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [closeDialogs]);
  return (
    <>
      {dialogState['settings'] && <SettingsDialog {...props } onClose={closeDialogs} />}
      {dialogState['process'] && <ProcessDialog {...props} onClose={closeDialogs} />}
      {dialogState['export'] && <ExportDialog {...props} onClose={closeDialogs} />}
    </>
  );
};
