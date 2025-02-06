import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Divider,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import Joyride from 'react-joyride';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SettingsIcon from '@mui/icons-material/Settings';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import HomeIcon from '@mui/icons-material/Home';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ConstructionIcon from '@mui/icons-material/Construction';
import NotificationImportantIcon from '@mui/icons-material/NotificationImportant';

import { useOverlayContext } from '../spire/provider';
import { OverlayDialogs } from './dialogs/dialogs';
import { processEquip, processGlobal, processZone } from '../zone/processZone';
import { SettingsProvider, useSettingsContext } from '../../context/settings';
import { useMainContext } from '../main/context';
import { deleteEqFolder, getEQDir, getFiles } from '../../lib/util/fileHandler';
import { gameController } from '../../viewer/controllers/GameController';
import { ExporterOverlayRightNav } from './right-nav';
import { useExpansionList } from '../common/expansions';
import { useAlertContext } from '../../context/alerts';
import { ExporterHeader } from './overlay-header';
import { useConfirm } from 'material-ui-confirm';
import { items, locations, models } from './constants';
import { NavLeft } from '../common/nav/nav-left';
import { DrawerButton } from '../common/nav/drawer-button';
import { useOptions } from './use-options';
import { NavHeader } from '../common/nav/nav-header';
import { animateVignette, gaussianBlurTeleport } from '@bjs/util';


const cachedBlobUrls = {};
const ExporterOverlayComponent = () => {
  const {
    reset
  } = useMainContext();
  const { toggleDialog, dialogState } = useOverlayContext();
  const toggleDrawer = console.log;
  const [babylonModel, setBabylonModel] = useState(null);
  const { location, setOption } = useSettingsContext();
  const [modelOptions, refreshModelOptions, modelFiles] = useOptions(
    'models',
    models,
    true
  );
  const [objectOptions, refreshObjectOptions] = useOptions('objects');
  const [itemOptions, refreshItemOptions] = useOptions('items', items);
  const fileRef = useRef();
  const hasOptions = useMemo(
    () => modelOptions.length + objectOptions.length + itemOptions.length > 0,
    [modelOptions, objectOptions, itemOptions]
  );
  // console.log('options', modelOptions, objectOptions, itemOptions);
  console.log('mod', modelOptions);
  const area = useMemo(() => locations[location], [location]);
  useEffect(() => {
    if (!area?.file) {
      return;
    }
    if (fileRef.current === area.file) {
      const { x, y, z } = area;
      const node = gameController.currentScene.getMeshByName('__root__');
      if (node) {
        node.position.set(x, y, z);
      }
      animateVignette(gameController.CameraController.camera, gameController.currentScene);
      gaussianBlurTeleport(gameController.CameraController.camera, gameController.currentScene);


      return;
    }
    fileRef.current = area.file;
    if (cachedBlobUrls[area.file]) {
      gameController.SpawnController.addBackgroundMesh(
        cachedBlobUrls[area.file],
        area
      ).then(() => {
        animateVignette(gameController.CameraController.camera, gameController.currentScene);
        gaussianBlurTeleport(gameController.CameraController.camera, gameController.currentScene);

      });
    } else {
      fetch(area.file)
        .then((r) => r.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          cachedBlobUrls[area.file] = blobUrl;
          gameController.SpawnController.addBackgroundMesh(blobUrl, area).then(() => {
            animateVignette(gameController.CameraController.camera, gameController.currentScene);
            gaussianBlurTeleport(gameController.CameraController.camera, gameController.currentScene);
            
          });
        });
    }
  }, [area]);


  useEffect(() => {
    gameController.SpawnController.addExportModel('hum').then(setBabylonModel);
  }, []);

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
      <OverlayDialogs />
      {babylonModel ? (
        <ExporterOverlayRightNav
          itemOptions={itemOptions}
          babylonModel={babylonModel}
          modelFiles={modelFiles}
          setBabylonModel={setBabylonModel}
          type={0}
        />
      ) : null}

      <NavHeader>Sage Model Viewer</NavHeader>
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
          NotificationIcon={!hasOptions ? NotificationImportantIcon : null}
          toggleDrawer={toggleDrawer}
        />
        <DrawerButton
          drawerState={dialogState}
          drawer="export"
          text={'Export'}
          Icon={FileDownloadIcon}
          toggleDrawer={toggleDrawer}
        />

        <DrawerButton
          text={'Purge'}
          Icon={DeleteForeverIcon}
          toggleDrawer={toggleDrawer}
        />
      </NavLeft>
      <Box className="area-selection">
        <FormControl size='small' fullWidth>
          <Select
            size='small'
            fullWidth
            onChange={(e) => setOption('location', e.target.value)}
            value={location}
          >
            {locations.map((l, i) => (
              <MenuItem value={i}>{l.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </>
  );
};