import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ConstructionIcon from '@mui/icons-material/Construction';
import PictureInPictureIcon from '@mui/icons-material/PictureInPicture';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import HomeIcon from '@mui/icons-material/Home';

import { SettingsProvider, useSettingsContext } from '../../context/settings';
import { useMainContext } from '../main/context';
import { gameController } from '../../viewer/controllers/GameController';
import { DrawerButton } from '../common/nav/drawer-button';
import { NavHeader } from '../common/nav/nav-header';
import { animateVignette, gaussianBlurTeleport } from '@bjs/util';
import { useAlertContext } from '@/context/alerts';
import BABYLON from '@bjs';
import { Box } from '@mui/material';
import { Allotment } from 'allotment';
import { FileExplorer } from './file-explorer';
import { usePermissions } from '@/hooks/permissions';
import { S3DDecoder } from 'sage-core/s3d/s3d-decoder';
import { quailProcessor } from '@/modules/quail';
import { NavRight } from '../common/nav/nav-right';
import { defaultOptions, stateCallback } from '../exporter/overlay';
import { ExporterNavHeader } from '../exporter/header';
import { locations } from '../exporter/constants';
import { useEqOptions } from '../exporter/use-options';
import { ModelOverlay } from '../exporter/model-overlay';
import { GlobalStore } from '@/state';
import { QuailDialog } from './quail-dialog';
import { EQGDecoder } from 'sage-core/eqg/eqg-decoder';

import './overlay.scss';
import 'allotment/dist/style.css';


const cachedBlobUrls = {};

const QuailOverlayComponent = ({ canvas }) => {
  const { reset, modelExporterLoaded } = useMainContext();
  const {
    location,
    selectedType,
    selectedModel,
    background,
    bgColor,
    setOption,
  } = useSettingsContext();
  const {
    pcModelOptions,
    npcModelOptions,
    objectOptions,
    itemOptions,
    refresh,
    empty,
  } = useEqOptions(true);
  const [
    _apiSupported,
    onDrop,
    _checkHandlePermissions,
    fsHandle,
    onFolderSelected,
    unlink,
    setFsHandle
  ] = usePermissions('quail-workspace');

  const [maxSize, setMaxSize] = useState(300);
  const [hideProfile, setHideProfile] = useState(true);
  const [watchFsHandle, setWatchFsHandle] = useState(null);
  const [quailDialogOpen, setQuailDialogOpen] = useState(false);
  const watchLastModified = useRef(0);
  const watchInterval = useRef(-1);
  const overlayRef = useRef({});
  const selectedModelRef = useRef(selectedModel);
  const { openAlert } = useAlertContext();
  const parseWCE = useCallback(
    async (handle, isS3d = false, isEqg = false) => {
      GlobalStore.actions.setLoading(true);
      GlobalStore.actions.setLoadingTitle('Processing...');
      GlobalStore.actions.setLoadingText('Loading, please wait...');
      const animation = overlayRef.current.animation;
      const buffer = isS3d || isEqg
        ? await handle.getFile().then((f) => f.arrayBuffer())
        : await quailProcessor.parseWce(handle);

      if (!buffer) {
        openAlert('Error processing EQ File. Check dev console output', 'warning');
        GlobalStore.actions.setLoading(false);

        return;
      }
      const eqg = handle?.name?.endsWith('.eqg') || isEqg;
      const fhWrapper = {
        arrayBuffer() {
          return buffer;
        },
        name: handle.name,
      };
      if (!eqg) {
        const s3dDecoder = new S3DDecoder(undefined, { forceWrite: true });
        await s3dDecoder.processS3D(fhWrapper);
        await s3dDecoder.export();
      } else {
        const eqgDecoder = new EQGDecoder(fhWrapper, { forceWrite: true });
        await eqgDecoder.processEQG(fhWrapper);
        await eqgDecoder.export();
      }
   
      GlobalStore.actions.setLoading(false);

      gameController.SpawnController.clearAssetContainer();
      gameController.SpawnController.disposeModel();

      if (gameController.SpawnController?.modelExport?.rootNode) {
        gameController.SpawnController.modelExport.rootNode.material.getActiveTextures().forEach(t => t.dispose());
      }
      gameController.engine.resetTextureCache();
      openAlert('Finished processing');
      await refresh();
      const model = selectedModelRef.current;
      // This lets us swap back and rehydrate based on effects just one render cycle
      setOption('selectedModel', '');
      setTimeout(() => {
        setOption('selectedModel', model);
        if (animation) {
          overlayRef.current.setAnimation(animation);
        }
      }, 50);
    },
    [openAlert, refresh, setOption]
  );

  const fileRef = useRef();
  const area = useMemo(() => locations[location], [location]);


  const selectFsWatch = useCallback(async () => {
    if (watchFsHandle) {
      setWatchFsHandle(null);
      watchLastModified.current = 0;
      clearInterval(watchInterval.current);
      return;
    }
    const [file] = await window
      .showOpenFilePicker({
        types: [
          {
            description: 'EverQuest S3D/EQG File',
            accept     : {
              'application/octet-stream': ['.s3d', '.eqg'],
            },
          },
        ],
      })
      .catch(() => []);
    if (file) {
      setWatchFsHandle(file);
      let processing = false;
      watchInterval.current = setInterval(async () => {
        if (processing) {
          return;
        }
        const lastModified = await file
          .getFile()
          .then((f) => f.lastModified)
          .catch(() => -1);
        // Something bad happened like the file disappeared or we lost privileges
        if (lastModified === -1) {
          clearInterval(watchInterval.current);
          watchLastModified.current = 0;
          return;
        }
        // The file has been updated, process
        if (lastModified > watchLastModified.current) {
          const eqg = file.name.endsWith('.eqg');
          processing = true;
          try {
            await parseWCE(file, !eqg, eqg);
            watchLastModified.current = lastModified;
          } catch (e) {
            console.warn('Error in watch processing file', e);
          }
          processing = false;
        }
      }, 250);
    }
  }, [watchFsHandle, parseWCE]);

  useEffect(() => {
    if (!modelExporterLoaded) {
      return;
    }
    gameController.ModelController.swapBackground(background);
  }, [background, modelExporterLoaded]);

  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  useEffect(() => {
    if (!modelExporterLoaded) {
      return;
    }
    gameController.currentScene.clearColor =
      BABYLON.Color4.FromHexString(bgColor);
  }, [bgColor, modelExporterLoaded]);
  useEffect(() => {
    if (!modelExporterLoaded) {
      return;
    }
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
  }, [area, modelExporterLoaded]);

  const onDragEnd = () => {
    window.gameController.resize();
  };
  return (
    <Box
      className="quail-overlay"
      sx={{
        position: 'fixed',
        width   : '100vw',
        height  : '100vh',
        top     : 0,
        left    : 0,
      }}
    >
      <QuailDialog setFsHandle={setFsHandle} open={quailDialogOpen} onClose={() => setQuailDialogOpen(false)} />
      <Allotment onDragEnd={onDragEnd} defaultSizes={[100, 200]}>
        <Allotment.Pane minSize={100} maxSize={maxSize}>
          <FileExplorer
            onDrop={onDrop}
            fsHandle={fsHandle}
            onFolderSelected={onFolderSelected}
            unlink={unlink}
            setMaxSize={setMaxSize}
          />
        </Allotment.Pane>
        <Allotment.Pane>
          {selectedModel && modelExporterLoaded ? (
            <ModelOverlay
              hideProfile={hideProfile}
              selectedType={selectedType}
              selectedModel={selectedModel}
              itemOptions={itemOptions}
              refHandler={overlayRef.current}
            />
          ) : null}
          <NavHeader width="80">
            <ExporterNavHeader
              gameController={gameController}
              pcModelOptions={pcModelOptions}
              npcModelOptions={npcModelOptions}
              objectOptions={objectOptions}
              itemOptions={itemOptions}
              refresh={refresh}
            />
          </NavHeader>
          <NavRight>
            <DrawerButton
              text={'Home'}
              Icon={HomeIcon}
              toggleDrawer={() => {
                gameController.dispose();
                reset();
              }}
            />
            <DrawerButton
              drawerState={{}}
              drawer="process"
              disabled={!fsHandle}
              text={'Process WCE'}
              Icon={ConstructionIcon}
              toggleDrawer={() => parseWCE(fsHandle)}
            />
            <DrawerButton
              drawerState={{}}
              drawer="createQuail"
              text={'Create Quail'}
              Icon={CreateNewFolderIcon}
              toggleDrawer={() => setQuailDialogOpen(true)}
            />
            <DrawerButton
              drawerState={{}}
              drawer="process"
              className={!!watchFsHandle ? 'pulse' : ''}
              text={'Watch S3D/EQG'}
              Icon={VisibilityIcon}
              toggleDrawer={selectFsWatch}
            />
            <DrawerButton
              drawerState={{}}
              drawer="pip"
              text={'Picture in Picture'}
              Icon={PictureInPictureIcon}
              toggleDrawer={() => gameController.togglePip()}
            />
          </NavRight>
          {/* <NavFooter>Footer</NavFooter> */}
          {canvas}
        </Allotment.Pane>
      </Allotment>
    </Box>
  );
};

export const QuailOverlay = ({ canvas }) => (
  <SettingsProvider
    stateCallback={stateCallback}
    storageKey={'exporter'}
    defaultOptions={defaultOptions}
  >
    <QuailOverlayComponent canvas={canvas} />
  </SettingsProvider>
);
