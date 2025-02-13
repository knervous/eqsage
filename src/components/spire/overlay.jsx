import { useEffect } from 'react';

import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import HomeIcon from '@mui/icons-material/Home';
import RefreshIcon from '@mui/icons-material/Refresh';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

import { ZoneIcon } from '../common/icons/zone';
import { SpawnIcon } from '../common/icons/spawn';
import { DoorIcon } from '../common/icons/door';
import { ItemIcon } from '../common/icons/item';
import { RegionIcon } from '../common/icons/region';
import { QuestIcon } from '../common/icons/quest';
import { useOverlayContext } from './provider';
import { OverlayDialogs } from './dialogs/dialogs';
import { useSettingsHook } from './hooks';
import SpawnNavBar from './nav-bar/spawn-nav/spawn-nav';
import { Compass } from '../common/compass/component';
import { NavLeft } from '../common/nav/nav-left';
import { DrawerButton } from '../common/nav/drawer-button';
import { NavHeader } from '../common/nav/nav-header';
import { useMainContext } from '../main/context';

import './overlay.scss';

export const SpireOverlay = ({ inZone }) => {
  const { toggleDialog, dialogState, closeDialogs } = useOverlayContext();
  const { selectedZone, setZoneDialogOpen, setSelectedZone, rightDrawerOpen } =
    useMainContext();

  useSettingsHook();
  useEffect(() => {
    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        closeDialogs();
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [closeDialogs]);

  const headerText = selectedZone?.long_name
    ? `${selectedZone.long_name} - ${selectedZone?.short_name}`
    : 'Select a Zone';
  return (
    <>
      <img
        alt="ModelViewer"
        src="/static/zone-editor.png"
        width="155"
        height="155"
        style={{
          left    : '1vw',
          // filter      : 'brightness(1) invert(0)',
          // mixBlendMode: 'multiply',
          top     : '-20px',
          position: 'fixed',
          zIndex  : 10000,
        }}
      />
      <Box
        className="spire-left-nav"
        sx={{
          height  : '100vh',
          width   : '100px',
          position: 'absolute',
          zIndex  : 1000,
        }}
      >
        {/** Compass */}
        {inZone && <Compass />}
        <NavHeader
          width={45}
          minWidth={'500px'}
          height={inZone ? 80 : 50}
          sx={{ padding: '5px 5vw', height: '100%' }}
        >
          <Stack
            sx={{
              height : inZone ? '70px' : '100%',
              padding: 0,
              margin : 0,
              width  : '100%'
            }}
            direction="column"
            alignContent={'center'}
            justifyContent={'space-evenly'}
            alignItems={'space-around'}
          >
            <Typography
              sx={{
                fontSize : '17px',
                textAlign: 'center',
                marginTop: !inZone ? '5px' : 0,
              }}
            >
              {headerText}
            </Typography>
            {inZone ? <Divider sx={{ background: 'rgba(180, 173, 134, 0.3)', margin: '5px 0' }} /> : null}
            {inZone ? (
              <Stack className="zone-buttons" justifyContent={'space-evenly'} direction="row">
                <Button
                  onClick={() => setZoneDialogOpen(true)}
                  size="small"
                >
                  <HomeIcon />
                  <Typography>Main Menu</Typography>
                </Button>
                <Button
                  onClick={() => {
                    setSelectedZone('');
                    setTimeout(() => {
                      setZoneDialogOpen(false);
                      setSelectedZone(selectedZone);
                    }, 1);
                  }}
                  size="small"
                >
                  <RefreshIcon />
                  <Typography>Reload</Typography>
                </Button>
                <Button
                  onClick={() => {
                    window.gameController.ZoneController.exportZone(
                      selectedZone.short_name
                    );
                  }}
                  size="small"
                >
                  <FileDownloadIcon />
                  <Typography>Export GLB</Typography>
                </Button>
                <Button
                  onClick={() => {
                    window.gameController.ZoneController.exportSTL(
                      selectedZone.short_name
                    );
                  }}
                  size="small"
                >
                  <FileDownloadIcon />
                  <Typography>Export STL</Typography>
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </NavHeader>
        <NavLeft>
          <DrawerButton
            drawerState={dialogState}
            drawer="settings"
            text={'Settings'}
            Icon={SettingsIcon}
            toggleDrawer={toggleDialog}
          />
          <DrawerButton
            drawerState={dialogState}
            drawer="zone"
            disabled={!inZone}
            text={'Zone'}
            Icon={ZoneIcon}
            toggleDrawer={toggleDialog}
          />
          <DrawerButton
            drawerState={dialogState}
            drawer="npc"
            disabled={!inZone}
            text={'Spawns'}
            Icon={SpawnIcon}
            toggleDrawer={toggleDialog}
          />
          <DrawerButton
            drawerState={dialogState}
            drawer="quests"
            disabled={!inZone}
            text={'Quests'}
            Icon={QuestIcon}
            toggleDrawer={toggleDialog}
          />
          <DrawerButton
            drawerState={dialogState}
            drawer="objects"
            disabled={!inZone}
            text={'Doors'}
            Icon={DoorIcon}
            toggleDrawer={toggleDialog}
          />
          <DrawerButton
            drawerState={dialogState}
            drawer="items"
            disabled={!inZone}
            text={'Items'}
            Icon={ItemIcon}
            toggleDrawer={toggleDialog}
          />

          <DrawerButton
            drawerState={dialogState}
            drawer="regions"
            disabled={!inZone}
            text={'Regions'}
            Icon={RegionIcon}
            toggleDrawer={toggleDialog}
          />
        </NavLeft>
      </Box>
      <OverlayDialogs />
      <SpawnNavBar />
    </>
  );
};
