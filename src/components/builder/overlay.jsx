import { useCallback, useEffect } from 'react';
import classNames from 'classnames';
import { Box, Stack, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import IconButton from '@mui/material/IconButton';
import NotificationImportantIcon from '@mui/icons-material/NotificationImportant';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import ForestIcon from '@mui/icons-material/Forest';
import { useSettingsContext } from '../../context/settings';
import { ZoneIcon } from '../common/icons/zone';
import { RegionIcon } from '../common/icons/region';
import { useOverlayContext } from './provider';
import { OverlayDrawers } from './drawers';
import { useSettingsHook } from './hooks';
import { Compass } from '../common/compass/component';
import { BuilderHeader } from './overlay-header';
import { useRegionContext } from './providers/region-provider';
import { UpgradeState } from './constants';
import { gameController } from '../../viewer/controllers/GameController';

import './overlay.scss';

const DrawerButton = ({
  text,
  Icon,
  toggleDrawer,
  drawer,
  drawerState,
  NotificationIcon,
}) => {
  const doToggleDrawer = useCallback(() => {
    toggleDrawer(drawer, !drawerState[drawer]);
  }, [toggleDrawer, drawer, drawerState]);
  return (
    <IconButton
      className={classNames('builder-left-nav-button', {
        'builder-left-nav-button-open': drawerState?.[drawer],
      })}
      onClick={doToggleDrawer}
    >
      <Stack
        direction={'column'}
        justifyContent={'center'}
        alignItems={'center'}
      >
        <Icon
          fill={'#ddd'}
          color="#000 !important"
          fillColor="#000"
          width={30}
          height={30}
          style={{
            fill : '#ddd !important',
            color: '#ddd !important'
          }}
        />
        <Typography
          className="text-outline"
          sx={{ textAlign: 'center', fontSize: 13 }}
        >
          {text}
        </Typography>
      </Stack>
      {NotificationIcon && (
        <NotificationIcon
          sx={{
            width   : '20px',
            height  : '20px',
            position: 'absolute',
            right   : '0px',
            top     : '0px',
            color   : 'gold !important',
            fill    : 'gold !important',
          }}
        />
      )}
    </IconButton>
  );
};

export const BuilderOverlay = () => {
  const { regionUpgradeState } = useRegionContext();
  const { toggleDrawer, drawerState, closeDrawers, openDrawer } =
    useOverlayContext();
  useSettingsHook();
  const { showCompass } = useSettingsContext();
  useEffect(() => {
    const keyHandler = (e) => {
      if (e.key === 'Escape' && !gameController.ZoneBuilderController.pickingRaycast) {
        closeDrawers();
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [closeDrawers]);
  return (
    <>
      {showCompass && !openDrawer && <Compass />}
      <OverlayDrawers />
      <BuilderHeader />

      {/**
       * Left Nav Bar
       */}
      <Box className="builder-left-nav-bg" />
      <Box className="builder-left-nav">
        {/** Compass */}
        <Stack
          sx={{ height: '70%', marginTop: '100%' }}
          direction={'column'}
          justifyContent={'space-evenly'}
          alignItems={'center'}
        >
          <DrawerButton
            drawerState={drawerState}
            drawer="settings"
            text={'Settings'}
            Icon={SettingsIcon}
            toggleDrawer={toggleDrawer}
          />
          <>
            <DrawerButton
              drawerState={drawerState}
              drawer="zone"
              text={'Zone'}
              Icon={ZoneIcon}
              toggleDrawer={toggleDrawer}
            />
            <DrawerButton
              drawerState={drawerState}
              drawer="objects"
              text={'Objects'}
              Icon={ForestIcon}
              toggleDrawer={toggleDrawer}
            />

            <DrawerButton
              drawerState={drawerState}
              drawer="regions"
              text={'Regions'}
              NotificationIcon={
                regionUpgradeState === UpgradeState.NEED_UPGRADE
                  ? NotificationImportantIcon
                  : null
              }
              Icon={RegionIcon}
              toggleDrawer={toggleDrawer}
            />
            <DrawerButton
              drawerState={drawerState}
              drawer="lights"
              text={'Lights'}
              Icon={LightbulbIcon}
              toggleDrawer={toggleDrawer}
            />
            <DrawerButton
              drawerState={drawerState}
              drawer="sounds"
              text={'Sounds'}
              Icon={AudiotrackIcon}
              toggleDrawer={toggleDrawer}
            />
          </>
        </Stack>
      </Box>
    </>
  );
};
