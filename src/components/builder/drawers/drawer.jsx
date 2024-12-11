import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import classNames from 'classnames';
import { useOverlayContext } from '../provider';

import './drawer.scss';
import { RegionDrawer } from './regions';
import { ObjectsDrawer } from './objects';
import { gameController } from '../../../viewer/controllers/GameController';
import { ZoneDrawer } from './zone';
import { NavigationDrawer } from './navigation';
const zb = gameController.ZoneBuilderController;

export const Drawer = () => {
  const { openDrawer, toggleDrawer } = useOverlayContext();
  const [selectedObject, setSelectedObject] = useState(null);

  useEffect(() => {
    if (openDrawer) {
      return;
    }
    const clickCallback = (mesh) => {
      if (mesh.parent === zb.objectContainer) {
        setSelectedObject(mesh);
        toggleDrawer('objects', true, true);
      }
    };
    zb.addClickCallback(clickCallback);

    return () => zb.removeClickCallback(clickCallback);
  }, [openDrawer, toggleDrawer]);
  const content = useMemo(() => {
    switch (openDrawer) {
      case 'regions':
        return <RegionDrawer />;
      case 'zone':
        return <ZoneDrawer />;
      case 'objects':
        return <ObjectsDrawer selectedObject={selectedObject} />;
      case 'navigation':
        return <NavigationDrawer />;
      default:
        return null;
    }
  }, [openDrawer, selectedObject]);

  return (
    <>
      <Box
        className={classNames('drawer-bg', {
          'drawer-bg-open'  : openDrawer,
          'drawer-bg-closed': !openDrawer,
        })}
        sx={{
          width   : '300px',
          overflow: 'hidden',
          display : 'flex',
          height  : 'calc(100% - 40px)',
          position: 'fixed',
          padding : '15px',
          zIndex  : 1000,
          top     : 0,
        }}
      >
        <Box
          sx={{
            width    : '100%',
            height   : 'calc(100% - 5px)',
            maxHeight: 'calc(100% - 5px',
            overflowY: 'scroll',
            padding  : '10px !important',
          }}
        >
          <Typography
            variant="h6"
            sx={{
              marginBottom  : '15px',
              textAlign     : 'center',
              fontWeight    : 300,
              textDecoration: 'underline',
            }}
          >
            {openDrawer?.toUpperCase()}
          </Typography>
          {content}
        </Box>
      </Box>
    </>
  );
};

export default Drawer;
