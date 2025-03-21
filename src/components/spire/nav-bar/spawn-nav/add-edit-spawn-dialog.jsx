import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { CommonDialog } from '../../dialogs/common';
import {
  Autocomplete,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { useDebouncedCallback } from 'use-debounce';
import { useZoneContext } from '../../../zone/zone-context';
import { useMainContext } from '../../../main/context';
import { useAlertContext } from '../../../../context/alerts';

export const AddEditSpawnDialog = ({
  onClose,
  open,
  entries = [],
  spawn,
  setSelectedSpawn,
}) => {
  const { Spire } = useMainContext();
  const { openAlert } = useAlertContext();
  const [npcList, setNpcList] = useState(entries);
  const [spawnList, setSpawnList] = useState([]);
  const { loadCallback } = useZoneContext();
  const dialogClosed = useCallback(
    async (forSave) => {
      if (forSave) {
        try {
          // First list all spawn entries, then diff
          const builder = new Spire.SpireQueryBuilder();
          builder.where('spawngroupID', '=', spawn.spawngroup_id);

          const spawnEntryApi = new Spire.SpireApiTypes.SpawnentryApi(
            ...Spire.SpireApi.cfg()
          );
          const existingSpawnEntries = await spawnEntryApi.listSpawnentries(
            builder.get()
          );
          const firstExisting = existingSpawnEntries.data[0];
          for (const existing of existingSpawnEntries.data) {
            // Existed before and doesn't now, we need to delete
            const matched = npcList.find(
              (entry) => entry.npc_id === existing.npc_id
            );
            if (!matched) {
              const builder = new Spire.SpireQueryBuilder();
              builder.where('npcID', '=', existing.npc_id);
              await spawnEntryApi.deleteSpawnentry(
                { id: spawn.spawngroup_id },
                { query: builder.get() }
              );
            } else {
              // Or see if there's a diff and update
              const cloneMatch = JSON.parse(JSON.stringify(matched));
              if (
                JSON.stringify({ ...cloneMatch, npc_type: 0 }) !==
                JSON.stringify({ ...existing, npc_type: 0 })
              ) {
                const builder = new Spire.SpireQueryBuilder();
                builder.where('npcID', '=', existing.npc_id);
                await spawnEntryApi.updateSpawnentry(
                  { id: spawn.spawngroup_id, spawnentry: cloneMatch },
                  { query: builder.get() }
                );
              }
            }
          }

          for (const existing of npcList) {
            // Existed now and didn't before, we need to create
            const matched = existingSpawnEntries.data.find(
              (entry) => entry.npc_id === existing.npc_id
            );
            if (!matched) {
              await spawnEntryApi.createSpawnentry({
                id        : spawn.spawngroup_id,
                spawnentry: existing,
              });
            }
          }
          const spawn2Builder = new Spire.SpireQueryBuilder();
          spawn2Builder.where('id', '=', spawn.id);
          spawn2Builder.includes(['Spawnentries.NpcType']);
          const spawn2Api = new Spire.SpireApiTypes.Spawn2Api(
            ...Spire.SpireApi.cfg()
          );

          const {
            data: [latestSpawn],
          } = await spawn2Api.listSpawn2s(spawn2Builder.get());

          openAlert('Updated spawn entries');
          console.log('spawn', spawn, 'latest', latestSpawn);
          loadCallback({
            type     : 'updateSpawn',
            spawn    : latestSpawn,
            prevSpawn: firstExisting,
          });
          setSelectedSpawn(latestSpawn);
        } catch (e) {
          openAlert('Failed to update spawn entries', 'warning');
        }
      }
      onClose();
    },
    [onClose, spawn, npcList, loadCallback, Spire, openAlert, setSelectedSpawn]
  );

  useEffect(() => {
    setNpcList(entries);
  }, [entries]);

  const totalChance = useMemo(
    () => npcList.map((c) => c.chance).reduce((acc, val) => acc + val, 0),
    [npcList]
  );

  const debouncedSearch = useDebouncedCallback(async (val) => {
    const npcs = await Spire.Npcs.listNpcsByName(val);
    setSpawnList(npcs);
  }, 500);

  return (
    <CommonDialog
      onClose={dialogClosed}
      title={'Add/Edit Spawn Entries'}
      open={open}
      doneText="Save"
      doneDisabled={totalChance !== 100}
      cancelButton
    >
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Level</TableCell>
            <TableCell>Chance %</TableCell>
            <TableCell>Remove</TableCell>
            <TableCell>Link</TableCell>
          </TableRow>
        </TableHead>
        <TableBody
          sx={{
            td: {
              padding: '5px !important',
            },
          }}
        >
          {npcList.map((entry, index) => (
            <TableRow key={index}>
              <TableCell>{entry?.npc_type?.name}</TableCell>
              <TableCell align="center">{entry?.npc_type?.level}</TableCell>
              <TableCell>
                <TextField
                  size="small"
                  type="number"
                  inputProps={{
                    min  : 0,
                    max  : 100,
                    step : 1,
                    style: { textAlign: 'center' },
                  }}
                  sx={{ margin: 0, padding: 0, width: '80px' }}
                  value={entry.chance}
                  onChange={(e) =>
                    setNpcList((c) => {
                      const newC = deepClone(c);
                      newC[index].chance = +e.target.value;
                      return newC;
                    })
                  }
                ></TextField>
              </TableCell>
              <TableCell align="center">
                <IconButton
                  onClick={() => {
                    setNpcList((c) => {
                      const newC = [...c];
                      newC[index] = null;
                      return newC.filter((a) => a !== null);
                    });
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </TableCell>
              <TableCell align="center">
                <IconButton
                  onClick={() => {
                    window.open(
                      `${Spire.SpireApi?.remoteUrl ?? ''}/npc/${entry.npc_id}`,
                      '_blank'
                    );
                  }}
                >
                  <OpenInNewIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Autocomplete
        size="small"
        onKeyDown={(e) => {
          // e.preventDefault();
          e.stopPropagation();
        }}
        sx={{ width: '100%', margin: '25px auto' }}
        id="add-new-spawn"
        onChange={async (_, { spawn: newSpawn }) => {
          const spawnEntry = {
            spawngroup_id         : spawn.spawngroup_id,
            chance                : 100,
            condition_value_filter: 1,
            content_flags         : null,
            content_flags_disabled: null,
            max_expansion         : -1,
            max_time              : 0,
            min_expansion         : -1,
            min_time              : 0,
            npc_id                : newSpawn.id,
            npc_type              : newSpawn,
          };
          setNpcList((list) => [...list, spawnEntry]);
        }}
        value=""
        options={spawnList.map((spawn, idx) => {
          return {
            label: `${spawn.name} - Level ${spawn.level}`,
            id   : idx,
            spawn,
          };
        })}
        isOptionEqualToValue={() => true}
        //  sx={{ width: 300 }}
        renderInput={(params) => (
          <TextField
            onChange={(e) => debouncedSearch(e.target.value)}
            {...params}
            label="Add New Spawn"
          />
        )}
      />
      {totalChance !== 100 && (
        <Typography color="error.main" variant="p">
          Chances must total 100 across all spawns. Total is {totalChance}
        </Typography>
      )}
    </CommonDialog>
  );
};
