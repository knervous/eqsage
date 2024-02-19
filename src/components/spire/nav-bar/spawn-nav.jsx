import React, { useEffect, useState } from 'react';
import { Sidebar, Menu, MenuItem, SubMenu } from 'react-pro-sidebar';
import './spawn-nav.scss';
import { Box, Typography } from '@mui/material';
import { gameController } from '../../../viewer/controllers/GameController';

function SpawnNavBar() {
  const [selectedSpawn, setSelectedSpawn] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const clickCallback = (spawn) => {
      setSelectedSpawn(spawn);
      setOpen(true);
    };
    const keyHandle = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    gameController.ZoneController.addClickCallback(clickCallback);
    window.addEventListener('keydown', keyHandle);
    return () => {
      gameController.ZoneController.removeClickCallback(clickCallback);
      window.removeEventListener('keydown', keyHandle);
    };
  }, []);
  return !open ? null : (
    <Box className='nav-bg' sx={{ width: '300px', overflow: 'hidden', display: 'flex', height: 'calc(100% - 20px)', position: 'absolute', right: 0, top: 0 }}>
      <Sidebar className='nav-bg' width='300px' right style={{}}>
        <Box className='nav-bg' sx={{ flex: 1, height: 'calc(100% - 5px)', maxHeight: 'calc(100% - 5px', overflowY: 'scroll' }}>
          <Typography variant="h5" sx={{ margin: '5px' }}>Spawn Entry</Typography>
          <pre variant="h5" style={{ margin: '15px' }}>{JSON.stringify(selectedSpawn, null, 4)}</pre>
        </Box>
      </Sidebar>
   
    </Box>
  );
}
  
export default SpawnNavBar;
  