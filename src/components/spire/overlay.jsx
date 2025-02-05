import { useCallback, useEffect } from 'react';

import { Box, Stack, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

import IconButton from '@mui/material/IconButton';
import { ZoneIcon } from '../common/icons/zone';
import { SpawnIcon } from '../common/icons/spawn';
import { DoorIcon } from '../common/icons/door';
import { ItemIcon } from '../common/icons/item';
import { RegionIcon } from '../common/icons/region';
import { QuestIcon } from '../common/icons/quest';
import { useOverlayContext } from './provider';
import { OverlayDialogs } from './dialogs/dialogs';
import classNames from 'classnames';
import { useSettingsHook } from './hooks';
import SpawnNavBar from './nav-bar/spawn-nav/spawn-nav';

import { useMainContext } from '../main/context';
import { useSettingsContext } from '../../context/settings';

import './overlay.scss';
import { Compass } from '../common/compass/component';


const NavButton = ({ text, Icon, toggleDialog, dialog, dialogState }) => {
  const doToggleDialog = useCallback(() => {
    toggleDialog(dialog, !dialogState[dialog]);
  }, [toggleDialog, dialog, dialogState]);

  return (
    <IconButton
      className={classNames('spire-left-nav-button', {
        'spire-left-nav-button-open': dialogState[dialog],
      })}
      onClick={doToggleDialog}
    >
      <Stack
        direction={'column'}
        justifyContent={'center'}
        alignItems={'center'}
      >
        <Icon
          width={30}
          height={30}
        />
        <Typography
          className="text-outline"
          sx={{ textAlign: 'center', fontSize: 13 }}
        >
          {text}
        </Typography>
      </Stack>
    </IconButton>
  );
};

export const SpireOverlay = ({ inZone }) => {
  const { toggleDialog, dialogState, closeDialogs } = useOverlayContext();
  const { modelExporter } = useMainContext();
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
  return modelExporter ? null : (
    <>
      {/**
       * Left Nav Bar
       */}
      <Box
        className="spire-left-nav"
        sx={{
          height  : '100vh',
          width   : '100px',
          position: 'absolute',
          top     : modelExporter ? '-15px' : 0,
          left    : modelExporter ? '300px' : 0,
          zIndex  : 1000,
        }}
      >
        {/** Compass */}
        <Compass />
        <Stack
          sx={{ height: inZone ? 'calc(65%)' : '100px' }}
          direction={'column'}
          justifyContent={'space-evenly'}
          alignItems={'center'}
        >
          <NavButton
            dialogState={dialogState}
            dialog="settings"
            text={'Settings'}
            Icon={SettingsIcon}
            toggleDialog={toggleDialog}
          />
          {inZone && (
            <>
              <NavButton
                dialogState={dialogState}
                dialog="zone"
                text={'Zone'}
                Icon={ZoneIcon}
                toggleDialog={toggleDialog}
              />
              <NavButton
                dialogState={dialogState}
                dialog="npc"
                text={'Spawns'}
                Icon={SpawnIcon}
                toggleDialog={toggleDialog}
              />
              <NavButton
                dialogState={dialogState}
                dialog="quests"
                text={'Quests'}
                Icon={QuestIcon}
                toggleDialog={toggleDialog}
              />
              <NavButton
                dialogState={dialogState}
                dialog="objects"
                text={'Objects'}
                Icon={DoorIcon}
                toggleDialog={toggleDialog}
              />
              <NavButton
                dialogState={dialogState}
                dialog="items"
                text={'Items'}
                Icon={ItemIcon}
                toggleDialog={toggleDialog}
              />

              <NavButton
                dialogState={dialogState}
                dialog="regions"
                text={'Regions'}
                Icon={RegionIcon}
                toggleDialog={toggleDialog}
              />
            </>
          )}
        </Stack>
      </Box>
      <OverlayDialogs />

      <SpawnNavBar />
    </>
  );
};
