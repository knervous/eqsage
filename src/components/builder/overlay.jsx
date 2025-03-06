import { useEffect } from 'react';
import { Box, Stack } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationImportantIcon from '@mui/icons-material/NotificationImportant';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
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
import { NavLeft } from '../common/nav/nav-left';
import { DrawerButton } from '../common/nav/drawer-button';

export const BuilderOverlay = () => {
  const { regionUpgradeState } = useRegionContext();
  const { toggleDrawer, drawerState, closeDrawers, openDrawer } =
    useOverlayContext();
  useSettingsHook();
  useEffect(() => {
    const keyHandler = (e) => {
      if (e.key === 'Escape' && !gameController.ZoneBuilderController.pickingRaycast) {
        closeDrawers();
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [closeDrawers]);
  const prefix = window.electronAPI ? './' : '/';

  return (
    <>
      <img
        alt="ModelViewer"
        src={`${prefix}static/zone-builder.png`}
        width="155"
        height="155"
        style={{
          // filter      : 'brightness(1) invert(0)',
          // mixBlendMode: 'multiply',
          left    : '3vw',
          top     : '-25px',
          position: 'fixed',
          zIndex  : 10,
        }}
      />
      {!openDrawer && <Compass />}
      <OverlayDrawers />
      <BuilderHeader />
      <NavLeft>
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
          <DrawerButton
            drawerState={drawerState}
            drawer="navigation"
            text={'Navigation'}
            Icon={DirectionsRunIcon}
            toggleDrawer={toggleDrawer}
          />
        </>
        
      </NavLeft>
    </>
  );
};
