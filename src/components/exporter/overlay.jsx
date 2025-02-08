import { useEffect, useMemo, useRef, useState } from 'react';

import FileDownloadIcon from '@mui/icons-material/FileDownload';
import HomeIcon from '@mui/icons-material/Home';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ConstructionIcon from '@mui/icons-material/Construction';
import NotificationImportantIcon from '@mui/icons-material/NotificationImportant';

import { useOverlayContext } from '../spire/provider';
import { OverlayDialogs } from './dialogs/dialogs';
import { SettingsProvider, useSettingsContext } from '../../context/settings';
import { useMainContext } from '../main/context';
import { gameController } from '../../viewer/controllers/GameController';
import { ExporterOverlayRightNav } from './right-nav';
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

const cachedBlobUrls = {};
const ExporterOverlayComponent = () => {
  const { reset } = useMainContext();
  const { toggleDialog, dialogState } = useOverlayContext();
  const { location, selectedType, selectedModel } = useSettingsContext();
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
    if (!area?.file) {
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
      <OverlayDialogs empty={empty} refresh={refresh} confirm={confirm} openAlert={openAlert} />
      {selectedModel ? (
        <ExporterOverlayRightNav
          selectedType={selectedType}
          selectedModel={selectedModel}
          itemOptions={itemOptions}
        />
      ) : null}

      <NavHeader minWidth={'850px'}>
        <ExporterNavHeader
          gameController={gameController}
          pcModelOptions={pcModelOptions}
          npcModelOptions={npcModelOptions}
          objectOptions={objectOptions}
          itemOptions={itemOptions}
          refresh={refresh}
        />
      </NavHeader>
      <NavLeft navHeight={60} height={'70%'}>
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
                openAlert('Successfully purged EQ Sage folder', 'success');
              })
              .catch(() => {});
          }}
        />
      </NavLeft>
    </>
  );
};

const defaultOptions = {
  location     : locations[0],
  selectedType : optionType.pc,
  selectedModel: '',
  selectedName : '',
};

export const ExporterOverlay = () => (
  <SettingsProvider storageKey={'exporter'} defaultOptions={defaultOptions}>
    <ExporterOverlayComponent />
  </SettingsProvider>
);
