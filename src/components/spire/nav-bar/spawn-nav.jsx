import React, { useEffect, useState } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { gameController } from '../../../viewer/controllers/GameController';
import classNames from 'classnames';
import './spawn-nav.scss';
import { useMainContext } from '../../main/main';

function SpawnNavBar() {
  const [selectedSpawn, setSelectedSpawn] = useState(null);
  const { selectedZone } = useMainContext();
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  useEffect(() => {
    if (!open) {
      gameController.ZoneController.showSpawnPath([]);
    }
  }, [open]);
  useEffect(() => {
    if (!selectedZone) {
      return;
    }
    const clickCallback = (spawn) => {
      console.log('Spawn', spawn);
      if (gameController.Spire.Grid) {
        gameController.Spire.Grid.getById(
          selectedZone.zoneidnumber,
          spawn.pathgrid
        ).then((res) => {
          gameController.ZoneController.showSpawnPath(res);
        });
      } else if (gameController.Spire.SpireApi) {
        window.top
          .fetch(
            `${gameController.Spire.SpireApi.getBaseV1Path()}/grid_entries?where=zoneid__${
              selectedZone.zoneidnumber
            }.gridid__${spawn.pathgrid}&orderBy=gridid.number`
          )
          .then((r) => r.json())
          .then((res) => {
            gameController.ZoneController.showSpawnPath(res);
          });
      }

      setSelectedSpawn(JSON.parse(JSON.stringify(spawn)));
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
  }, [selectedZone]);
  return (
    <Box
      className={classNames('nav-bg', {
        'nav-bg-open'  : open,
        'nav-bg-closed': !open,
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
        <Typography variant="h6" sx={{ marginBottom: '15px' }}>
          Spawn Entry :: ID {selectedSpawn?.id}
        </Typography>
        <FormControl fullWidth sx={{ margin: '0 auto' }}>
          <InputLabel id="spawn-select-label">Spawn</InputLabel>
          <Select
            labelId="spawn-select-label"
            id="spawn-select"
            value={selectedIdx}
            label="Age"
            onChange={(e) => setSelectedIdx(e.target.value)}
          >
            {selectedSpawn?.spawnentries?.map?.((e, idx) => (
              <MenuItem value={idx}>
                {e.npc_type?.name} :: Level {e.npc_type?.level}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Box>
  );
}

export default SpawnNavBar;
