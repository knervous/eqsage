import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  TextField,
  Select,
  Stack,
  Typography,
  Tooltip,
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DeleteIcon from '@mui/icons-material/Delete';
import { gameController } from '../../../../viewer/controllers/GameController';
import classNames from 'classnames';
import './spawn-nav.scss';
import { useMainContext } from '../../../main/context';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { AddEditSpawnDialog } from './add-edit-spawn-dialog';
import { useAlertContext } from '../../../../context/alerts';
import { useConfirm } from 'material-ui-confirm';
import { useZoneContext } from '../../../zone/zone-context';
import { GridEntryApi } from 'spire-api/api/grid-entry-api';
import { GridApi } from 'spire-api/api/grid-api';
import { SpawngroupApi } from 'spire-api/api/spawngroup-api';   // eslint-disable-line

function SpawnNavBar() {
  const [selectedSpawn, setSelectedSpawn] = useState(null);
  const [initialSpawn, setInitialSpawn] = useState(null);
  const [gridUpdater, setGridUpdater] = useState(0);
  // const [spawnGroup, setSpawnGroup] = useState(null);
  const [grid, setGrid] = useState(null);
  const [, forceRender] = useState({});
  const { openAlert } = useAlertContext();
  const { selectedZone, Spire } = useMainContext();
  const [open, setOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [gridLoading, setGridLoading] = useState(false);
  const [selectedGridIdx, setSelectedGridIdx] = useState(0);
  const [addEditDialogOpen, setAddEditDialogOpen] = useState(false);
  const confirm = useConfirm();

  const pickRaycast = useCallback(() => {
    gameController.ZoneController.pickRaycastForLoc((loc) => {
      if (!loc) {
        return;
      }
      setSelectedSpawn((s) => ({ ...s, x: loc.z, y: loc.x, z: loc.y }));
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
    if (
      initialSpawn.x === selectedSpawn.x &&
      initialSpawn.y === selectedSpawn.y &&
      initialSpawn.z === selectedSpawn.z
    ) {
      return;
    }
    gameController.SpawnController.moveSpawn(selectedSpawn);

    (async () => {
      const spawn2Api = new Spire.SpireApiTypes.Spawn2Api(
        ...Spire?.SpireApi.cfg()
      );
      try {
        await spawn2Api.updateSpawn2({
          id    : selectedSpawn.id,
          spawn2: selectedSpawn,
        });
        openAlert(`Updated ${selectedSpawn.name}`);
      } catch (e) {
        openAlert(`Failed to update ${selectedSpawn.name}`, 'warning');
      }
    })();
  }, [   // eslint-disable-line
    selectedSpawn?.x,
    selectedSpawn?.y,
    selectedSpawn?.z,
    Spire,
    initialSpawn,
  ]);

  useEffect(() => {
    setOpen(false);
    if (!selectedZone) {
      return;
    }
    const clickCallback = async (spawn) => {
      console.log('Spawn', spawn);
      if (spawn.gridIdx !== undefined) {
        setSelectedGridIdx(spawn.gridIdx);
        return;
      }

      gameController.SpawnController.npcLight(spawn);
      const s = JSON.parse(JSON.stringify(spawn));
      const gridApi = new GridEntryApi(...Spire?.SpireApi.cfg());
      const builder = new Spire.SpireQueryBuilder();
      builder.where('gridid', '=', s.pathgrid);
      builder.where('zoneid', '=', selectedZone.zoneidnumber);

      delete s.grid;

      if (s.pathgrid) {
        const gridApi = new GridApi(...Spire?.SpireApi.cfg());
        const entry = await gridApi.getGrid({ id: s.pathgrid });
        setGrid(entry.data);
      } else {
        setGrid(null);
      }

      // const spawnGroupApi = new SpawngroupApi(...Spire?.SpireApi.cfg());
      // spawnGroupApi.getSpawngroup({ id: s.spawngroup_id }).then(r => setSpawnGroup(r.data)).catch(() => {});
      setSelectedSpawn(s);
      setInitialSpawn(s);
      setAddEditDialogOpen(false);
      setSelectedIdx(0);
      setSelectedGridIdx(0);
      setOpen(true);

      const gridEntries = await gridApi.listGridEntries(builder.get());
      if (gridEntries.data?.length) {
        setSelectedSpawn((s) => ({ ...s, grid: gridEntries.data }));
      }
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
  }, [selectedZone, pickRaycast, Spire]);

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
  const { loadCallback } = useZoneContext();
  const doDelete = () => {
    confirm({
      description: 'Are you sure you want to delete this spawn?',
      title      : 'Delete Spawn',
    })
      .then(() => {
        const spawn2Api = new Spire.SpireApiTypes.Spawn2Api(
          ...Spire?.SpireApi.cfg()
        );
        spawn2Api
          .deleteSpawn2({ id: selectedSpawn?.id })
          .then(() => {
            openAlert(`Deleted ${selectedSpawn.name}`);
            setOpen(false);
            loadCallback({ type: 'deleteSpawn', spawn: selectedSpawn });
          })
          .catch(() => {
            openAlert(`Error deleting ${selectedSpawn.name}`, 'warning');
          });
      })
      .catch(() => {});
  };
  const selectedGridEntry = useMemo(
    () => selectedSpawn?.grid?.[selectedGridIdx],
    [selectedSpawn?.grid, selectedGridIdx]
  );
  const createGridEntry = useCallback(async () => {
    let updateSpawn = false;
    if (!selectedSpawn.grid) {
      const gridApi = new GridApi(...Spire?.SpireApi.cfg());
      const freeIdRes = await Spire?.SpireApi.v1().get(
        '/api/v1/query/free-id-ranges/grid/id'
      );
      const freeId = +freeIdRes.data.data[0].start_id;
      const newEntry = await gridApi.createGrid({
        grid: {
          zoneid: selectedZone.zoneidnumber,
          id    : freeId,
        },
      });
      selectedSpawn.pathgrid = newEntry.data.id;
      const spawn2Api = new Spire.SpireApiTypes.Spawn2Api(
        ...Spire?.SpireApi.cfg()
      );
      await spawn2Api.updateSpawn2({
        spawn2: selectedSpawn,
        id    : selectedSpawn.id,
      });
      selectedSpawn.grid = [];
      updateSpawn = true;
      setGrid(newEntry.data);
    }
    let existingLast = {
      number : 0,
      heading: -1,
      pause  : 0,
      x      : selectedSpawn.x,
      y      : selectedSpawn.y,
      z      : selectedSpawn.z,
    };
    if (
      Array.isArray(selectedSpawn?.grid) &&
      selectedSpawn.grid[selectedSpawn.grid.length - 1]
    ) {
      existingLast = selectedSpawn.grid[selectedSpawn.grid.length - 1];
    }
    const gridApi = new GridEntryApi(...Spire?.SpireApi.cfg());
    const newEntry = await gridApi.createGridEntry({
      gridEntry: {
        ...existingLast,
        zoneid: selectedZone.zoneidnumber,
        gridid: selectedSpawn.pathgrid,
        number: selectedSpawn.grid.length + 1,
        x     : existingLast.x + (updateSpawn ? 0 : 15),
      },
    });
    selectedSpawn.grid?.push?.(newEntry.data);
    setSelectedGridIdx(selectedSpawn.grid.length - 1);
    setGridUpdater((g) => g + 1);
    forceRender({});
    if (updateSpawn) {
      loadCallback({ type: 'updateSpawn', spawn: selectedSpawn });
      setSelectedSpawn(selectedSpawn);
    }
  }, [Spire?.SpireApi, selectedZone, selectedSpawn, loadCallback]); // eslint-disable-line

  const updateGridEntry = useCallback(
    async (gridEntry, number = gridEntry.number) => {
      const gridApi = new GridEntryApi(...Spire?.SpireApi.cfg());
      const builder = new Spire.SpireQueryBuilder();
      builder.where('number', '=', number);
      builder.where('zoneid', '=', gridEntry.zoneid);
      builder.where('gridid', '=', gridEntry.gridid);
      forceRender({});
      const clone = JSON.parse(JSON.stringify(gridEntry));
      await gridApi.updateGridEntry(
        {
          id       : gridEntry.gridid,
          gridEntry: clone,
        },
        { query: builder.get() }
      );
    },
    [Spire?.SpireApi, Spire?.SpireQueryBuilder]
  );

  const deleteGridEntry = useCallback(async () => {
    if (!selectedGridEntry || selectedSpawn.grid.length <= 1) {
      return;
    }
    setGridLoading(true);
    try {
      const gridApi = new GridEntryApi(...Spire?.SpireApi.cfg());
      const builder = new Spire.SpireQueryBuilder();
      builder.where('number', '=', selectedGridEntry.number);
      builder.where('zoneid', '=', selectedGridEntry.zoneid);
      builder.where('gridid', '=', selectedGridEntry.gridid);
      await gridApi.deleteGridEntry(
        { id: selectedGridEntry.gridid },
        { query: builder.get() }
      );
      const filteredGrid = selectedSpawn.grid.filter(
        (g) => g.number !== selectedGridEntry.number
      );
      for (const g of filteredGrid) {
        if (selectedGridEntry.number < g.number) {
          g.number--;
          await updateGridEntry(g, g.number + 1);
          setSelectedSpawn((s) => ({ ...s, grid: filteredGrid }));
          forceRender({});
        }
      }
      setSelectedSpawn((s) => ({ ...s, grid: filteredGrid }));
      setSelectedGridIdx(0);
    } catch {
      openAlert('Something went wrong deleting a grid entry', 'warning');
      setSelectedSpawn(null);
    } finally {
      setGridLoading(false);
    }
  }, [Spire, selectedGridEntry, selectedSpawn, updateGridEntry, openAlert]);

  const updateGrid = useCallback(
    async (gridEntry, newPosition) => {
      gridEntry.x = Math.round(newPosition.z);
      gridEntry.y = Math.round(newPosition.x);
      gridEntry.z = Math.round(newPosition.y);
      await updateGridEntry(gridEntry);
    },
    [updateGridEntry]
  );

  useEffect(() => {
    if (selectedSpawn?.grid) {
      gameController.SpawnController.showSpawnPath(
        selectedSpawn?.grid ?? [],
        selectedGridIdx,
        updateGrid
      );
    } else {
      gameController.SpawnController.showSpawnPath([]);
    }
  }, [selectedGridIdx, selectedSpawn?.grid, updateGrid, gridUpdater]);
  return open ? (
    <>
      {addEditDialogOpen && spawnEntries && (
        <AddEditSpawnDialog
          open={addEditDialogOpen}
          spawn={selectedSpawn}
          setSelectedSpawn={setSelectedSpawn}
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
            Spawn Group ID - {selectedSpawn?.id}
            <Typography variant="body2" color="textSecondary" component="p">
              {spawnSubtext}
            </Typography>
          </Typography>
          <IconButton
            sx={{ position: 'absolute', top: 15, right: 15 }}
            onClick={doDelete}
          >
            <DeleteIcon />
          </IconButton>
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
                    `${Spire?.SpireApi?.remoteUrl ?? ''}/npc/${
                      selectedSpawn?.spawnentries?.[selectedIdx]?.npc_id
                    }`,
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

          <Stack
            sx={{ margin: '25px 10px 10px 10px' }}
            direction="row"
            justifyContent={'center'}
            alignContent={'center'}
          >
            <Typography
              variant="h6"
              sx={{
                color     : 'primary.main',
                fontSize  : '18px',
                userSelect: 'none',
                lineHeight: '40px',
              }}
            >
              Grid Pathing
            </Typography>
            <Stack direction="row">
              <IconButton
                disabled={
                  gridLoading || !selectedSpawn.grid || selectedGridIdx < 1
                }
                onClick={() => {
                  setSelectedGridIdx((g) => g - 1);
                }}
              >
                <ArrowBackIcon />
              </IconButton>
              <IconButton
                disabled={
                  gridLoading ||
                  !selectedSpawn.grid ||
                  selectedGridIdx === (selectedSpawn.grid?.length ?? 0) - 1
                }
                onClick={() => {
                  setSelectedGridIdx((g) => g + 1);
                }}
              >
                <ArrowForwardIcon />
              </IconButton>
            </Stack>
          </Stack>
          <FormControl
            sx={{ margin: '0 auto', maxWidth: '100%', width: '100%' }}
          >
            <Stack direction="row" justifyContent="space-evenly">
              <InputLabel id="spawn-grid-label">Grid Entry</InputLabel>
              <Select
                fullWidth
                disabled={gridLoading}
                labelId="spawn-grid-label"
                id="spawn-select"
                value={selectedGridIdx}
                label="Age"
                onChange={(e) => setSelectedGridIdx(e.target.value)}
              >
                {selectedSpawn?.grid?.map?.((g, idx) => (
                  <MenuItem key={idx} value={idx}>
                    Grid Path {g.number}
                  </MenuItem>
                ))}
              </Select>
              <IconButton
                disabled={gridLoading}
                sx={{ width: '56px' }}
                onClick={createGridEntry}
              >
                <AddCircleIcon />
              </IconButton>
              <IconButton
                disabled={gridLoading || !selectedGridEntry}
                sx={{ width: '56px' }}
                onClick={deleteGridEntry}
              >
                <DeleteIcon />
              </IconButton>
            </Stack>
          </FormControl>
          {selectedGridEntry && (
            <FormControl sx={{ margin: '5px 0' }} disabled={gridLoading}>
              <Stack direction="row">
                <TextField
                  sx={{ margin: '10px 5px 10px 0px' }}
                  inputProps={{ type: 'number' }}
                  label="Heading"
                  value={selectedGridEntry.heading}
                  onChange={(e) => {
                    selectedGridEntry.heading = +e.target.value;
                    updateGridEntry(selectedGridEntry);
                  }}
                ></TextField>
                <TextField
                  sx={{ margin: '10px 0' }}
                  inputProps={{ type: 'number' }}
                  label="Pause (Seconds)"
                  value={selectedGridEntry.pause}
                  onChange={(e) => {
                    selectedGridEntry.pause = +e.target.value;
                    updateGridEntry(selectedGridEntry);
                  }}
                ></TextField>
              </Stack>
            </FormControl>
          )}
          {grid && (
            <>
              <Typography
                variant="h6"
                sx={{
                  fontSize  : '18px',
                  margin    : '10px 10px 10px 10px',
                  textAlign : 'center',
                  userSelect: 'none',
                  color     : 'primary.main',
                }}
              >
                Grid
              </Typography>

              <FormControl sx={{ margin: '5px 0' }} fullWidth>
                <InputLabel id="grid-wander-label">Wander Type</InputLabel>
                <Select
                  labelId="grid-wander-label"
                  sx={{ width: '100%' }}
                  size={'small'}
                  label="Wander Type"
                  value={grid.type}
                  onChange={(e) => {
                    const gridApi = new GridApi(...Spire?.SpireApi.cfg());
                    grid.type = +e.target.value;
                    gridApi
                      .updateGrid({ id: grid.id, grid })
                      .then(() => {
                        openAlert('Updated Grid Wander Type');
                      })
                      .catch(() => {
                        openAlert('Error Updating Grid Wander Type', 'warning');
                      })
                      .finally(() => {
                        forceRender({});
                      });
                  }}
                >
                  {[
                    [
                      0,
                      'Circular',
                      'NPC will cycle waypoints in order, then head back to the first waypoint.',
                    ],
                    [
                      1,
                      'Random 10',
                      'NPC will pick a random of the nearest 10 waypoints and go to it.',
                    ],
                    [
                      2,
                      'Random',
                      'NPC will pick a random waypoint in the grid and go to it.',
                    ],
                    [
                      3,
                      'Patrol',
                      'NPC will walk the waypoints to the end, then turn and backtrack.',
                    ],
                    [
                      4,
                      'One Way',
                      'NPC will walk the waypoints to the end, then repop.',
                    ],
                    [
                      5,
                      'Random 5 LoS',
                      'NPC will pick a random of the nearest 5 waypoints within line of sight.',
                    ],
                    [
                      6,
                      'One Way',
                      'NPC will walk the waypoints to the end, then Depop.',
                    ],
                    [
                      7,
                      'Center Point',
                      'NPC will treat wp0 as center and move between it and a random wp.',
                    ],
                    [
                      8,
                      'Random Center Point',
                      'NPC will alternate between a random waypoint and a random waypoint that is marked as center point.',
                    ],
                    [
                      9,
                      'Random Path',
                      'Pick random waypoints, but follow path instead of heading there directly.',
                    ],
                  ].map(([val, short, long], idx) => (
                    <Tooltip
                      key={idx}
                      value={val}
                      placement="left"
                      title={long}
                    >
                      <MenuItem>
                        [{val}] {short}
                      </MenuItem>
                    </Tooltip>
                  ))}
                </Select>
              </FormControl>

              <FormControl sx={{ margin: '5px 0' }} fullWidth>
                <InputLabel id="grid-pause-label">Pause Type</InputLabel>

                <Select
                  labelId="grid-pause-label"
                  sx={{ width: '100%' }}
                  size={'small'}
                  label="Pause Type"
                  value={grid.type_2}
                  onChange={(e) => {
                    const gridApi = new GridApi(...Spire?.SpireApi.cfg());
                    grid.type_2 = +e.target.value;
                    gridApi
                      .updateGrid({ id: grid.id, grid })
                      .then(() => {
                        openAlert('Updated Grid Pause Type');
                      })
                      .catch(() => {
                        openAlert('Error Updating Grid Pause Type', 'warning');
                      })
                      .finally(() => {
                        forceRender({});
                      });
                  }}
                >
                  {[
                    [
                      0,
                      'Random half',
                      'NPC pauses for half of its pause time + random of half its pause time.',
                    ],
                    [1, 'Full', 'NPC pauses for full pause time.'],
                    [2, 'Random', 'NPC pauses for random of its pause time.'],
                  ].map(([val, short, long], idx) => (
                    <Tooltip
                      key={idx}
                      value={val}
                      placement="left"
                      title={long}
                    >
                      <MenuItem>
                        [{val}] {short}
                      </MenuItem>
                    </Tooltip>
                  ))}
                </Select>
              </FormControl>
            </>
          )}
        </Box>
      </Box>
    </>
  ) : null;
}

export default SpawnNavBar;
