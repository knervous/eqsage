import { useEffect, useMemo, useRef, useState } from 'react';

import FileDownloadIcon from '@mui/icons-material/FileDownload';
import HomeIcon from '@mui/icons-material/Home';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ConstructionIcon from '@mui/icons-material/Construction';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationImportantIcon from '@mui/icons-material/NotificationImportant';
import PictureInPictureIcon from '@mui/icons-material/PictureInPicture';

import { useOverlayContext } from '../spire/provider';
import { OverlayDialogs } from './dialogs/dialogs';
import { SettingsProvider, useSettingsContext } from '../../context/settings';
import { useMainContext } from '../main/context';
import { gameController } from '../../viewer/controllers/GameController';
import { ModelOverlay } from './model-overlay';
import { locations, optionType } from './constants';
import { NavLeft } from '../common/nav/nav-left';
import { DrawerButton } from '../common/nav/drawer-button';
import { useEqOptions } from './use-options';
import { NavHeader } from '../common/nav/nav-header';
import { animateVignette, gaussianBlurTeleport } from '@bjs/util';
import { ExporterNavHeader } from './header';
import { useAlertContext } from '@/context/alerts';
import { useConfirm } from 'material-ui-confirm';
import { deleteEqFolder } from '@/lib/util/fileHandler';
import BABYLON from '@bjs';
import { DevOverlay } from './dev-overlay';
import { Box } from '@mui/material';
import { Allotment } from 'allotment';

import 'allotment/dist/style.css';
import { FileExplorer } from './file-explorer';
import { NavFooter } from '../common/nav/nav-footer';

const QuailOverlayComponent = ({ canvas }) => {
  const [maxSize, setMaxSize] = useState(300);
  useEffect(() => {
    if (window.gameController.currentScene) {

    }
  }, []);
  const onDragEnd = () => {
    window.gameController.resize();
  };
  return (
    <Box sx={{ position: 'fixed', width: '100vw', height: '100vh', top: 0, left: 0 }}>
      <Allotment onDragEnd={onDragEnd} defaultSizes={[100, 200]}>
        <Allotment.Pane minSize={100} maxSize={maxSize}>
          <FileExplorer setMaxSize={setMaxSize} />
        </Allotment.Pane>
        <Allotment.Pane snap>

          {canvas}
        </Allotment.Pane>
      </Allotment>
    </Box>
    
  );
};

const version = 0.1;

const defaultOptions = {
  
};

export const QuailOverlay = ({ canvas }) => (
  <SettingsProvider
    storageKey={'quail'}
    defaultOptions={defaultOptions}
  >
    <QuailOverlayComponent canvas={canvas} />
  </SettingsProvider>
);
