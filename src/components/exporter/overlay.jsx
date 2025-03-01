import { useEffect, useMemo, useRef } from 'react';

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

const cachedBlobUrls = {};

const ExporterOverlayComponent = () => {
  const { reset } = useMainContext();
  const { toggleDialog, dialogState } = useOverlayContext();
  const { location, selectedType, selectedModel, background, bgColor } = useSettingsContext();
  const { openAlert } = useAlertContext();
  const confirm = useConfirm();
  const {
    pcModelOptions,
    npcModelOptions,
    objectOptions,
    itemOptions,
    refresh,
    empty,
  } = useEqOptions();
  const fileRef = useRef();
  const area = useMemo(() => locations[location], [location]);

  useEffect(() => {
    gameController.ModelController.swapBackground(background);
  }, [background]);
  useEffect(() => {
    gameController.currentScene.clearColor = BABYLON.Color4.FromHexString(bgColor);
  }, [bgColor]);
  useEffect(() => {
    if (!area?.file) {
      const node = gameController.currentScene.getMeshByName('__root__');
      if (node) { 
        fileRef.current = null;
        node.dispose();
      }
      return;
    }

    (async () => {
      const node = gameController.currentScene.getMeshByName('__root__');
      if (node && fileRef.current === area.file) {
        const { x, y, z } = area;
        if (node) {
          node.position.set(x, y, z);
        }
        return;
      }
      fileRef.current = area.file;
      if (!cachedBlobUrls[area.file]) {
        await fetch(area.file)
          .then((r) => r.blob())
          .then((blob) => {
            const blobUrl = URL.createObjectURL(blob);
            cachedBlobUrls[area.file] = blobUrl;
          });
      }
      await gameController.SpawnController.addBackgroundMesh(
        cachedBlobUrls[area.file],
        area
      );
    })().then(() => {
      animateVignette(
        gameController.CameraController.camera,
        gameController.currentScene
      );
      gaussianBlurTeleport(
        gameController.CameraController.camera,
        gameController.currentScene
      );
    });
  }, [area]);

  return (
    <>
      <img
        alt="ModelViewer"
        src="/static/model-viewer.png"
        width="145"
        height="145"
        style={{
          left    : '15px',
          position: 'fixed',
          zIndex  : 10,
        }}
      />
      <OverlayDialogs
        empty={empty}
        refresh={refresh}
        confirm={confirm}
        openAlert={openAlert}
      />
      {selectedModel ? (
        <ModelOverlay
          selectedType={selectedType}
          selectedModel={selectedModel}
          itemOptions={itemOptions}
        />
      ) : null}
      {import.meta.env.VITE_LOCAL_DEV === 'true' ? <DevOverlay refresh={refresh} /> : null}
      <NavHeader minWidth={'800px'}>
        <ExporterNavHeader
          gameController={gameController}
          pcModelOptions={pcModelOptions}
          npcModelOptions={npcModelOptions}
          objectOptions={objectOptions}
          itemOptions={itemOptions}
          refresh={refresh}
        />
      </NavHeader>
      <NavLeft navHeight={70} height={'75%'}>
        <DrawerButton
          text={'Home'}
          Icon={HomeIcon}
          toggleDrawer={() => {
            gameController.dispose();
            reset();
          }}
        />
        <DrawerButton
          drawerState={dialogState}
          drawer="settings"
          text={'Settings'}
          Icon={SettingsIcon}
          toggleDrawer={toggleDialog}
        />
        <DrawerButton
          drawerState={{}}
          drawer="pip"
          text={'Picture in Picture'}
          Icon={PictureInPictureIcon}
          toggleDrawer={() => gameController.togglePip()}
        />
        <DrawerButton
          drawerState={dialogState}
          drawer="process"
          text={'Process'}
          Icon={ConstructionIcon}
          NotificationIcon={empty ? NotificationImportantIcon : null}
          toggleDrawer={toggleDialog}
        />
        <DrawerButton
          drawerState={dialogState}
          drawer="export"
          text={'Export'}
          Icon={FileDownloadIcon}
          toggleDrawer={toggleDialog}
        />
        <DrawerButton
          text={'Purge'}
          Icon={DeleteForeverIcon}
          toggleDrawer={() => {
            confirm({
              description:
                'Are you sure you want to purge EQ Sage data? This will delete the subfolders [data, items, models, object, zones] in the eqsage folder in your linked EverQuest directory.',
              title: 'Purge EQ Sage Folders',
            })
              .then(async () => {
                await deleteEqFolder('data');
                await deleteEqFolder('items');
                await deleteEqFolder('models');
                await deleteEqFolder('objects');
                await deleteEqFolder('zones');
                await deleteEqFolder('presets');
                openAlert('Successfully purged EQ Sage folder', 'success');
              })
              .catch(() => {});
          }}
        />
      </NavLeft>

    </>
  );
};

const version = 0.2;

const defaultModel = {
  version,
  face  : 1,
  pieces: {
    Helm     : null,
    Chest    : null,
    Arms     : null,
    Wrists   : null,
    Hands    : null,
    Legs     : null,
    Feet     : null,
    Primary  : null,
    Secondary: null
  },
};

export const defaultOptions = {
  location       : 0,
  selectedType   : optionType.pc,
  selectedModel  : '',
  selectedName   : '',
  background     : 'default',
  cycleAnimations: true,
  rotate         : true,
  config         : defaultModel,
  bgColor        : '#00DDDDFF',
  nameplateColor : '#F0F046FF',
  rotationSpeed  : 0.5,
};

export const stateCallback = (key, prevOptions, newOptions) => {
  let needsRender = true;
  if (['selectedType', 'selectedModel'].includes(key)) {
    needsRender = true;
    newOptions.config = localStorage.getItem(newOptions.selectedModel)
      ? JSON.parse(localStorage.getItem(newOptions.selectedModel))
      : defaultModel;
  } else if (key === 'config') {
    const prevConfig = prevOptions.config;
    const newConfig = newOptions.config;
    if (
      prevConfig?.pieces?.Primary?.model === newConfig.pieces?.Primary?.model &&
      prevConfig?.pieces?.Secondary?.model === newConfig.pieces?.Secondary?.model &&
      JSON.stringify(prevConfig?.pieces.Helm) ===
        JSON.stringify(newConfig?.pieces.Helm)
    ) {
      needsRender = false;
    }
    localStorage.setItem(
      newOptions.selectedModel,
      JSON.stringify(newConfig)
    );
  }
  newOptions.config.needsRender = needsRender;
  return newOptions;
};

export const ExporterOverlay = () => (
  <SettingsProvider
    stateCallback={stateCallback}
    storageKey={'exporter'}
    defaultOptions={defaultOptions}
  >
    <ExporterOverlayComponent />
  </SettingsProvider>
);
