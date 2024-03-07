import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { gameController } from '../../../../viewer/controllers/GameController';
import classNames from 'classnames';
import './spawn-nav.scss';
import { useMainContext } from '../../../main/main';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { AddEditSpawnDialog } from './add-edit-spawn-dialog';

function SpawnNavBar() {
  const [selectedSpawn, setSelectedSpawn] = useState(null);
  const { selectedZone } = useMainContext();
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [addEditDialogOpen, setAddEditDialogOpen] = useState(false);

  const pickRaycast = useCallback(() => {
    gameController.ZoneController.pickRaycastForLoc(loc => {
      if (!loc) {
        return;
      }
      setSelectedSpawn(s => ({ ...s, x: loc.z, y: loc.x, z: loc.y }));
    });
  }, []);

  useEffect(() => {
    if (!open) {
      gameController.SpawnController.showSpawnPath([]);
    }
  }, [open]);

  useEffect(() => {
    if (!selectedSpawn) {
      return;
    }
    gameController.ZoneController.moveSpawn(selectedSpawn);

    (async () => {
      const { Spire } = gameController;

      const spawn2Api = new Spire.SpireApiTypes.Spawn2Api(
        ...Spire.SpireApi.cfg()
      );
      await spawn2Api.updateSpawn2({ id: selectedSpawn.id, spawn2: selectedSpawn });
  
    })();


  }, [selectedSpawn?.x, selectedSpawn?.y, selectedSpawn?.z]); // eslint-disable-line

  useEffect(() => {
    setOpen(false);
    if (!selectedZone) {
      return;
    }
    const clickCallback = (spawn) => {
      console.log('Spawn', spawn);
      gameController.SpawnController.npcLight(spawn);
      gameController.SpawnController.showSpawnPath(spawn?.grid ?? []);
      const s = JSON.parse(JSON.stringify(spawn));
      setSelectedSpawn(s);
      setAddEditDialogOpen(false);
      setSelectedIdx(0);
      setOpen(true);
    };

    const keyHandle = (e) => {
      if (e.key === 'Escape') {
        gameController.SpawnController.npcLight(null);
        setOpen(false);
      }
      if (e.key.toLowerCase() === 'r') {
        pickRaycast();
      }
    };
    gameController.SpawnController.addClickCallback(clickCallback);
    window.addEventListener('keydown', keyHandle);
    return () => {
      gameController.SpawnController.removeClickCallback(clickCallback);
      window.removeEventListener('keydown', keyHandle);
    };
  }, [selectedZone, pickRaycast]);

  const spawnSubtext = useMemo(() => {
    if (!selectedSpawn) {
      return '';
    }
    if (!selectedSpawn.spawnentries?.length) {
      return 'No associated NPCS';
    }
    return `${selectedSpawn.spawnentries[0].npc_type?.name} and ${
      selectedSpawn.spawnentries?.length - 1
    } more`;
  }, [selectedSpawn]);

  const spawnEntries = useMemo(
    () => selectedSpawn?.spawnentries ?? [],
    [selectedSpawn?.spawnentries]
  );
  return open ? (
    <>
      {addEditDialogOpen && spawnEntries && (
        <AddEditSpawnDialog
          open={addEditDialogOpen}
          spawn={selectedSpawn}
          onClose={() => setAddEditDialogOpen(false)}
          entries={spawnEntries}
        />
      )}

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
            //  textAlign: 'center',
            overflowY: 'scroll',
            padding  : '10px !important',
          }}
        >
          <Typography
            variant="h6"
            sx={{ marginBottom: '15px', textAlign: 'center' }}
          >
            Spawn ID - {selectedSpawn?.id}
            <Typography variant="body2" color="textSecondary" component="p">
              {spawnSubtext}
            </Typography>
          </Typography>
          <Typography
            onClick={() => setAddEditDialogOpen(true)}
            variant="h6"
            sx={{
              fontSize  : '18px',
              margin    : '25px 10px 15px 10px',
              textAlign : 'center',
              userSelect: 'none',
              color     : 'primary.main',
              '&:hover' : {
                color: 'secondary.main',
              },
              '&:active': {
                color: 'info.main',
              },
            }}
          >
            Add/Edit Spawn Entries
          </Typography>
          <FormControl
            sx={{ margin: '0 auto', maxWidth: '100%', width: '100%' }}
          >
            <Stack direction="row" justifyContent="space-evenly">
              <InputLabel id="spawn-select-label">Spawn</InputLabel>
              <Select
                sx={{ width: 'calc(100% - 90px)' }}
                size="small"
                labelId="spawn-select-label"
                id="spawn-select"
                value={selectedIdx}
                label="Age"
                onChange={(e) => setSelectedIdx(e.target.value)}
              >
                {selectedSpawn?.spawnentries?.map?.((e, idx) => (
                  <MenuItem key={idx} value={idx}>
                    {e.npc_type?.name} - Level {e.npc_type?.level}
                  </MenuItem>
                ))}
              </Select>
              <IconButton
                sx={{ borderRadius: '5px', minWidth: '75px', width: '75px' }}
                disabled={selectedIdx === -1}
                onClick={() => {
                  window.open(
                    `/npc/${selectedSpawn?.spawnentries?.[selectedIdx]?.npc_id}`,
                    '_blank'
                  );
                }}
              >
                <Typography
                  variant="p"
                  sx={{ margin: '0 5px', fontSize: '14px' }}
                >
                  Edit
                </Typography>
                <OpenInNewIcon sx={{ width: '20px', height: '20px' }} />
              </IconButton>
            </Stack>
          </FormControl>
          <Typography
            onClick={pickRaycast}
            variant="h6"
            sx={{
              fontSize  : '18px',
              margin    : '25px 10px 10px 10px',
              textAlign : 'center',
              userSelect: 'none',
              color     : 'primary.main',
              '&:hover' : {
                color: 'secondary.main',
              },
              '&:active': {
                color: 'info.main',
              },
            }}
          >
            Choose Raycast Location [R]
          </Typography>
          <Stack direction="row" justifyContent={'space-around'}>
            <Typography sx={{ fontSize: 18 }}>X</Typography>
            <Typography sx={{ fontSize: 18 }}>Y</Typography> 
            <Typography sx={{ fontSize: 18 }}>Z</Typography>
          </Stack>
          <Stack direction="row">
            <TextField
              size="small"
              type="number"
              inputProps={{
                style: { textAlign: 'center' },
              }}
              sx={{ margin: 0, padding: 0 }}
              value={selectedSpawn?.x}
              onChange={(e) =>
                setSelectedSpawn((s) => ({ ...s, x: +e.target.value }))
              }
            ></TextField>
            <TextField
              size="small"
              type="number"
              inputProps={{
                style: { textAlign: 'center' },
              }}
              sx={{ margin: 0, padding: 0 }}
              value={selectedSpawn?.y}
              onChange={(e) =>
                setSelectedSpawn((s) => ({ ...s, y: +e.target.value }))
              }
            ></TextField>
            <TextField
              size="small"
              type="number"
              inputProps={{
                style: { textAlign: 'center' },
              }}
              sx={{ margin: 0, padding: 0 }}
              value={selectedSpawn?.z}
              onChange={(e) =>
                setSelectedSpawn((s) => ({ ...s, z: +e.target.value }))
              }
            ></TextField>
          </Stack>
          
        </Box>
      </Box>
    </>
  ) : null;
}

export default SpawnNavBar;
