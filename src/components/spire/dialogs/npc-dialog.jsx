import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CommonDialog } from './common';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { v4 } from 'uuid';

import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { Button, FormControl, Stack, TextField } from '@mui/material';
import { gameController } from '../../../viewer/controllers/GameController';
import BABYLON from '@bjs';
import { useMainContext } from '../../main/context';
import { useZoneContext } from '../../zone/zone-context';
import { useAlertContext } from '../../../context/alerts';
import { useOverlayContext } from '../provider';

const { Vector3 } = BABYLON;
export const NpcDialog = ({ onClose }) => {
  const [spawnFilter, setSpawnFilter] = useState('');
  const { selectedZone } = useMainContext();
  const { toggleDialog } = useOverlayContext();
  const { spawns, loadCallback } = useZoneContext();
  const { openAlert } = useAlertContext();
  const [hidden, setHidden] = useState(false);
  const filteredSpawns = useMemo(
    () =>
      spawns.filter((s) =>
        s.spawnentries?.some((e) =>
          e?.npc_type?.name?.toLowerCase()?.includes(spawnFilter?.toLowerCase())
        )
      ),
    [spawns, spawnFilter]
  );

  const addSpawn = useCallback(async () => {
    setHidden(true);
    gameController.ZoneController.pickRaycastForLoc(async (loc) => {
      setHidden(false);
      if (!loc) {
        return;
      }
      const { Spire } = gameController;

      const spawn2Api = new Spire.SpireApiTypes.Spawn2Api(
        ...Spire.SpireApi.cfg()
      );
      const spawnGroupApi = new Spire.SpireApiTypes.SpawngroupApi(
        ...Spire.SpireApi.cfg()
      );
      // First create spawn group
      const spawnGroup = await spawnGroupApi.createSpawngroup({
        spawngroup: { name: v4() },
      });
      const createResult = await spawn2Api.createSpawn2({
        spawn2: {
          zone         : selectedZone.short_name,
          x            : loc.z,
          y            : loc.x,
          z            : loc.y,
          spawngroup_id: spawnGroup.data.id,
          min_expansion: -1,
          max_expansion: -1,
        },
      });
      openAlert(`Created new spawn at location [${loc.z} ${loc.x} ${loc.y}]`);
      loadCallback({ type: 'create', spawn: createResult.data });
      toggleDialog('npc', false);
    });
  }, [selectedZone, loadCallback, openAlert, toggleDialog]);

  useEffect(() => {
    const meshes =
      gameController.ZoneController.scene
        .getNodeById('zone-spawns')
        ?.getChildMeshes() ?? [];
    for (const mesh of meshes.filter((m) => m.name.startsWith('zone-spawn-'))) {
      if (filteredSpawns.some((s) => mesh.id === `zone-spawn-${s.id}`)) {
        mesh.setEnabled(true);
      } else {
        mesh.setEnabled(false);
      }
    }
  }, [filteredSpawns]);
  return (
    <CommonDialog
      noEscClose={hidden}
      sx={
        hidden
          ? {
            width        : '400px',
            height       : '250px',
            position     : 'fixed !important',
            bottom       : '20px !important',
            right        : 'calc(50vw - 200px) !important',
            top          : 'unset',
            left         : 'unset',
            pointerEvents: 'none',
          }
          : {}
      }
      fullWidth
      onClose={onClose}
      title={'Spawns'}
    >
      <Stack alignItems={'center'} justifyContent={'center'} direction="row">
        <FormControl
          margin="dense"
          size="small"
          sx={{ m: 1, width: 300, top: 0, left: 0 }}
        >
          <TextField
            margin="dense"
            onKeyDown={(e) => {
              e.stopPropagation();
            }}
            label="Spawn Filter"
            defaultValue=""
            value={spawnFilter}
            helperText={`${filteredSpawns.length} filtered spawns`}
            onChange={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setSpawnFilter(e.target.value);
            }}
          />
        </FormControl>
        <Button
          startIcon={<AddCircleIcon />}
          sx={{ height: '40px', marginBottom: '20px' }}
          onClick={addSpawn}
        >
          Add Spawn
        </Button>
      </Stack>
      <CollapsibleTable spawns={filteredSpawns} />
    </CommonDialog>
  );
};

function Row(props) {
  const { spawn } = props;
  const [open, setOpen] = useState(false);
  const spawnName = useMemo(() => {
    if (!Array.isArray(spawn.spawnentries)) {
      return 'No associated spawns';
    }
    return spawn.spawnentries.length === 1
      ? spawn.spawnentries[0].npc_type.name
      : `${spawn.spawnentries[0].npc_type.name} + ${
          spawn.spawnentries.length - 1
        } more`;
  }, [spawn.spawnentries]);
  const hasMultipleEntries = useMemo(
    () => Array.isArray(spawn.spawnentries) && spawn.spawnentries.length > 1,
    [spawn.spawnentries]
  );
  return (
    <React.Fragment>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell component="th" scope="row">
          {spawnName}
          {hasMultipleEntries && (
            <IconButton
              aria-label="expand row"
              size="small"
              onClick={() => setOpen(!open)}
            >
              {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </IconButton>
          )}
        </TableCell>
        <TableCell align="left">
          X: {spawn.y}, Y: {spawn.x}, Z: {spawn.z}
        </TableCell>
        <TableCell align="left">{spawn.respawntime}</TableCell>
        <TableCell align="center">
          <Button
            className="ui-dialog-btn"
            onClick={() => {
              gameController.CameraController.camera.position = new Vector3(
                spawn.y,
                spawn.z + 20,
                spawn.x
              );
              gameController.CameraController.camera.rotation = new Vector3(
                1.57,
                1.548,
                0
              );
            }}
          >
            Teleport
          </Button>
        </TableCell>
      </TableRow>
      {hasMultipleEntries && (
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ margin: 1 }}>
                <Table aria-label="spawns">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Level</TableCell>
                      <TableCell>Spawn Chance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {spawn.spawnentries.map((entry) => (
                      <TableRow key={entry.npc_id}>
                        <TableCell component="th" scope="row">
                          {entry.npc_type?.name}
                        </TableCell>
                        <TableCell>{entry.npc_type?.level}</TableCell>
                        <TableCell>{entry.chance}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );
}

function CollapsibleTable({ spawns }) {
  return (
    <TableContainer
      sx={{
        background: 'transparent',
        overflowX : 'visible',
        height    : '400px',
        maxHeight : '400px',
      }}
      component={Paper}
    >
      <Table stickyHeader size="medium" aria-label="collapsible table">
        <TableHead>
          <TableRow>
            <TableCell sx={{ maxWidth: '250px', width: '250px' }}>
              Name
            </TableCell>
            <TableCell sx={{ maxWidth: '150px', width: '200px' }} align="left">
              Location
            </TableCell>
            <TableCell sx={{ maxWidth: '100px', width: '100px' }} align="left">
              Respawn
            </TableCell>
            <TableCell align="center">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {spawns.map((spawn) => (
            <Row key={spawn.id} spawn={spawn} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
