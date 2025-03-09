import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import classNames from 'classnames';
import { DoorsDrawer } from './drawers/doors';
import { useOverlayContext } from './provider';

import './drawer.scss';

const zb = window.gameController.ZoneController;

export const Drawer = () => {
  const { dialogState, toggleDialog } = useOverlayContext();
  const [selectedObject, setSelectedObject] = useState(null);
  const openDrawer = useMemo(() => Object.entries(dialogState).find(([_key, value]) => !!value)?.[0], [dialogState]);
  const content = useMemo(() => {
    switch (openDrawer) {
      case 'doors':
        console.log('drawers case');
        return <DoorsDrawer />;
      default:
        console.log('null case');
        return null;
    }
  }, [openDrawer]);

  return content ? (
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
  ) : null;
};

export default Drawer;
