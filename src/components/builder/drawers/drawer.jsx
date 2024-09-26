import React, { useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import classNames from 'classnames';
import { useOverlayContext } from '../provider';

import './drawer.scss';
import { RegionDrawer } from './regions';
import { ObjectsDrawer } from './objects';
import { useZoneBuilderContext } from '../context';


export const Drawer = () => {
  const { openDrawer } = useOverlayContext();
  const {
    zone: { modelFiles },
    setProject,
  } = useZoneBuilderContext();
  const content = useMemo(() => {
    switch (openDrawer) {
      case 'regions':
        return <RegionDrawer />;
      case 'objects':
        return <ObjectsDrawer modelFiles={modelFiles} setProject={setProject} />;
      default:
        return null;
    }
  }, [openDrawer, modelFiles, setProject]);

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
