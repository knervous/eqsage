import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Input,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  Stack,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  FormControlLabel,
} from '@mui/material';

import { ZoneApi } from 'spire-api/api/zone-api';
import { AdventureTemplateApi } from 'spire-api/api/adventure-template-api';
import { DoorApi } from 'spire-api/api/door-api';
import { GlobalLootApi } from 'spire-api/api/global-loot-api';
import { SpawnConditionApi } from 'spire-api/api/spawn-condition-api';
import { SpawnConditionValueApi } from 'spire-api/api/spawn-condition-value-api';
import { SpawnEventApi } from 'spire-api/api/spawn-event-api';
import { Spawn2Api } from 'spire-api/api/spawn2-api';
import { SpellsNewApi } from 'spire-api/api/spells-new-api';
import { TrapApi } from 'spire-api/api/trap-api';
import { ZonePointApi } from 'spire-api/api/zone-point-api';
import { BlockedSpellApi } from 'spire-api/api/blocked-spell-api';
import { CharCreateCombinationApi } from 'spire-api/api/char-create-combination-api';
import { CharacterExpModifierApi } from 'spire-api/api/character-exp-modifier-api';
import { FishingApi } from 'spire-api/api/fishing-api';
import { ForageApi } from 'spire-api/api/forage-api';
import { GraveyardApi } from 'spire-api/api/graveyard-api';
import { GridApi } from 'spire-api/api/grid-api';
import { GridEntryApi } from 'spire-api/api/grid-entry-api';
import { GroundSpawnApi } from 'spire-api/api/ground-spawn-api';
import { ObjectApi } from 'spire-api/api/object-api';
import { QuestGlobalApi } from 'spire-api/api/quest-global-api';
import { ZoneFlagApi } from 'spire-api/api/zone-flag-api';

import { useAlertContext } from '../../../context/alerts';

const DuplicateState = {
  NOT_RUN : 'Not Run',
  RUNNING : 'Running 🔄',
  FINISHED: 'Finished ✅',
  ERROR   : 'Error ❌',
};

export const DuplicateZoneDialog = ({ open, setOpen, zone, Spire }) => {
  const { openAlert } = useAlertContext();
  const [shortName, setShortName] = useState(zone?.short_name ?? '');
  const [longName, setLongName] = useState(zone?.long_name ?? '');
  const [zoneId, setZoneId] = useState(-1);
  const [loading, setLoading] = useState(false);

  const api = useMemo(
    () => ({
      zoneApi               : new ZoneApi(...Spire.SpireApi.cfg()),
      adventureTemplateApi  : new AdventureTemplateApi(...Spire.SpireApi.cfg()),
      doorApi               : new DoorApi(...Spire.SpireApi.cfg()),
      globalLootApi         : new GlobalLootApi(...Spire.SpireApi.cfg()),
      spawnConditionApi     : new SpawnConditionApi(...Spire.SpireApi.cfg()),
      spawnConditionValueApi: new SpawnConditionValueApi(
        ...Spire.SpireApi.cfg()
      ),
      spawnEventApi           : new SpawnEventApi(...Spire.SpireApi.cfg()),
      spawn2Api               : new Spawn2Api(...Spire.SpireApi.cfg()),
      trapApi                 : new TrapApi(...Spire.SpireApi.cfg()),
      zonePointApi            : new ZonePointApi(...Spire.SpireApi.cfg()),
      blockedSpellApi         : new BlockedSpellApi(...Spire.SpireApi.cfg()),
      charCreateCombinationApi: new CharCreateCombinationApi(
        ...Spire.SpireApi.cfg()
      ),
      characterExpModifierApi: new CharacterExpModifierApi(
        ...Spire.SpireApi.cfg()
      ),
      fishingApi    : new FishingApi(...Spire.SpireApi.cfg()),
      forageApi     : new ForageApi(...Spire.SpireApi.cfg()),
      graveyardApi  : new GraveyardApi(...Spire.SpireApi.cfg()),
      gridApi       : new GridApi(...Spire.SpireApi.cfg()),
      gridEntryApi  : new GridEntryApi(...Spire.SpireApi.cfg()),
      groundSpawnApi: new GroundSpawnApi(...Spire.SpireApi.cfg()),
      objectApi     : new ObjectApi(...Spire.SpireApi.cfg()),
      questGlobalApi: new QuestGlobalApi(...Spire.SpireApi.cfg()),
      zoneFlagApi   : new ZoneFlagApi(...Spire.SpireApi.cfg()),
    }),
    [Spire]
  );

  const [options, setOptions] = useState(
    Object.values(api).reduce(
      (acc, api) => ({
        ...acc,
        [api.constructor.name.replace(/Api$/, '')]: {
          enabled: true,
          state  : DuplicateState.NOT_RUN,
          comment: ''
        },
      }),
      {}
    )
  );

  const updateState = useCallback(
    (key, state) => setOptions((o) => ({ ...o, [key]: { ...o[key], state } })),
    []
  );
  const updateComment = useCallback(
    (key, comment) => setOptions((o) => ({ ...o, [key]: { ...o[key], comment } })),
    []
  );


  const updateRecords = useCallback(
    async ({ name, query, keyClears = [] }) => {
      try {
        updateState(name, DuplicateState.RUNNING);
        const createName = name[0].toLowerCase() + name.slice(1, name.length);
        const baseApi = api[`${createName}Api`];
        const listMethod = Object.getOwnPropertyNames(baseApi.__proto__).find(
          (m) => m.startsWith('list')
        );
        const createMethod = Object.getOwnPropertyNames(baseApi.__proto__).find(
          (m) => m.startsWith('create')
        );
        const list = baseApi[listMethod].bind(baseApi);
        const create = baseApi[createMethod].bind(baseApi);
        const [{ data: newEntities }, { data: oldEntities }] =
          await Promise.all([
            list(
              new Spire.SpireQueryBuilder().where(query[0], '=', query[1]).limit(100000).get()
            ),
            list(
              new Spire.SpireQueryBuilder().where(query[0], '=', query[2]).limit(100000).get()
            ),
          ]);

        if (oldEntities.length === newEntities.length) {
          updateComment(name, `Old zone had equal values (${oldEntities.length})`);
          updateState(name, DuplicateState.FINISHED);
        } else {
          let highestId =
            oldEntities.reduce((acc, val) => Math.max(acc, val.id), 0) + 1;
          const promises = [];
          for (const oldEntity of oldEntities) {
            const copy = { ...oldEntity, id: undefined };
            if (
              !newEntities.some(
                (newEntity) =>
                  JSON.stringify({ ...newEntity, id: undefined }) ===
                  JSON.stringify(copy)
              )
            ) {
              const entity = { ...oldEntity, [query[0]]: query[1] };
              if (keyClears.includes('id')) {
                delete entity.id;
              } else {
                entity.id = highestId++;
              }
              const entry = {
                ...entity,
                ...keyClears.reduce(
                  (acc, val) => ({ ...acc, [val]: undefined }),
                  {}
                ),
              };
              promises.push(async () => {
                console.log(`${name} is creating new entry`, entry);
                await create({ [createName]: entry });
              });
            } else {
              console.log(`${name} already had entry`, oldEntity);
            }
          }
          await Promise.all(promises.map((fn) => fn().catch(() => {
            
          })));
          updateState(name, DuplicateState.FINISHED);
          updateComment(name, `Created (${promises.length}) entries`);
        }
      } catch (e) {
        console.warn(`Error updating ${name}`, e);
        updateState(name, DuplicateState.ERROR);
      }
    },
    [Spire, api, updateState, updateComment]
  );

  const startDuplication = useCallback(async () => {
    const newZone = {
      ...zone,
      short_name  : shortName,
      long_name   : longName,
      zoneidnumber: zoneId,
      id          : undefined,
    };
    setLoading(true);
    // Zone
    try {
      const { data: existingZones } = await api.zoneApi.listZones(
        new Spire.SpireQueryBuilder().where('zoneidnumber', '=', zoneId).get()
      );
      console.log('Ex zones', existingZones);
      if (existingZones.length) {
        updateState('Zone', DuplicateState.FINISHED);
        updateComment('Zone', 'Zone exists');
      } else {
        await api.zoneApi.createZone({ zone: newZone });
        updateState('Zone', DuplicateState.FINISHED);
        updateComment('Zone', 'Zone created');

      }
    } catch (e) {
      console.warn('Error updating zone', e);
      updateState('Zone', DuplicateState.ERROR);
    }

    await updateRecords({
      name : 'AdventureTemplate',
      query: ['zone', shortName, zone.short_name],
    });

    await updateRecords({
      name     : 'Door',
      query    : ['zone', shortName, zone.short_name],
      keyClears: ['id'],
    });

    await updateRecords({
      name : 'GlobalLoot',
      query: ['zone', shortName, zone.short_name],
    });

    await updateRecords({
      name : 'SpawnCondition',
      query: ['zone', shortName, zone.short_name],
    });

    await updateRecords({
      name : 'SpawnConditionValue',
      query: ['zone', shortName, zone.short_name],
    });

    await updateRecords({
      name     : 'SpawnEvent',
      query    : ['zone', shortName, zone.short_name],
      keyClears: ['id']
    });

    await updateRecords({
      name     : 'Spawn2',
      query    : ['zone', shortName, zone.short_name],
      keyClears: ['id'],
    });

    await updateRecords({
      name : 'Trap',
      query: ['zone', shortName, zone.short_name],
    });

    await updateRecords({
      name     : 'ZonePoint',
      query    : ['zone', shortName, zone.short_name],
      keyClears: ['id'],
    });

    await updateRecords({
      name : 'BlockedSpell',
      query: ['zoneid', zoneId, zone.zoneidnumber],
    });

    await updateRecords({
      name : 'CharCreateCombination',
      query: ['start_zone', zoneId, zone.zoneidnumber],
    });

    await updateRecords({
      name : 'CharacterExpModifier',
      query: ['zone_id', zoneId, zone.zoneidnumber],
    });

    await updateRecords({
      name : 'Fishing',
      query: ['zoneid', zoneId, zone.zoneidnumber],
    });

    await updateRecords({
      name     : 'Forage',
      query    : ['zoneid', zoneId, zone.zoneidnumber],
      keyClears: ['id']
    });

    await updateRecords({
      name : 'Graveyard',
      query: ['zone_id', zoneId, zone.zoneidnumber],
    });

    await updateRecords({
      name : 'Grid',
      query: ['zoneid', zoneId, zone.zoneidnumber],
    });

    await updateRecords({
      name : 'GridEntry',
      query: ['zoneid', zoneId, zone.zoneidnumber],
    });

    await updateRecords({
      name     : 'GroundSpawn',
      query    : ['zoneid', zoneId, zone.zoneidnumber],
      keyClears: ['id'],
    });

    await updateRecords({
      name     : 'Object',
      query    : ['zoneid', zoneId, zone.zoneidnumber],
      keyClears: ['id'],
    });

    await updateRecords({
      name : 'QuestGlobal',
      query: ['zoneid', zoneId, zone.zoneidnumber],
    });

    await updateRecords({
      name : 'ZoneFlag',
      query: ['zoneID', zoneId, zone.zoneidnumber],
    });

    openAlert(
      `Successfully duplicated records for: ${shortName} :: ${longName} :: ${zoneId}`
    );
    setLoading(false);
  }, [
    openAlert,
    zone,
    shortName,
    longName,
    zoneId,
    Spire,
    api,
    updateComment,
    updateState,
    updateRecords,
  ]);
  return (
    <Dialog
      fullWidth
      maxWidth="md"
      open={open}
      onKeyDown={e => e.stopPropagation()}
      onClose={() => setOpen(false)}
      aria-labelledby="draggable-dialog-title"
    >
      <DialogTitle style={{ margin: '0 auto' }} id="draggable-dialog-title">
        Duplicate Zone: {zone?.short_name} - {zone?.long_name}
      </DialogTitle>
      <DialogContent
        onKeyDown={(e) => e.stopPropagation()}
        sx={{ maxHeight: '400px', overflowY: 'hidden', overflowX: 'hidden' }}
        className="about-content"
      >
        <Stack direction="row">
          <Stack direction="column" sx={{ width: '33%' }}>
            <TextField
              sx={{ margin: '15px', width: '75%' }}
              size="small"
              value={longName}
              variant={'standard'}
              onChange={(e) => setLongName(e.target.value)}
              label="Long Name"
            />
            <TextField
              sx={{ margin: '15px', width: '75%' }}
              size="small"
              value={shortName}
              variant={'standard'}
              onChange={(e) => setShortName(e.target.value)}
              label="Short Name"
            />
            <TextField
              sx={{ margin: '15px', width: '75%' }}
              type="number"
              variant={'standard'}
              size="small"
              value={zoneId}
              onChange={(e) => setZoneId(+e.target.value)}
              label="Zone ID"
            />
          </Stack>
          <TableContainer
            onKeyDown={(e) => e.stopPropagation()}
            component={Paper}
            sx={{
              backgroundColor: 'transparent',
              boxShadow      : '0px 0px 5px 2px rgba(0, 0, 0, 0.3)',
              maxHeight      : '400px',
              margin         : '2px 0px',
              padding        : '1px',
            }}
          >
            <Table
              sx={{
                '& .MuiTableCell-root': {
                  padding    : '3px',
                  fontSize   : '0.9rem',
                  paddingLeft: '10px',
                  background : 'rgba(0,0,0,0.3)',
                },
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>
                    Table
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Enabled</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>
                    Comment
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(options).map(([name, option]) => (
                  <TableRow key={name}>
                    <TableCell>{name}</TableCell>
                    <TableCell>
                      <Checkbox
                        disabled={name === 'Zone'}
                        size="small"
                        checked={option.enabled}
                        onChange={(e) => {
                          setOptions((o) => ({
                            ...o,
                            [name]: { ...o[name], enabled: e.target.checked },
                          }));
                        }}
                      />
                    </TableCell>
                    <TableCell>{option.state}</TableCell>
                    <TableCell>{option.comment}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </DialogContent>
      <DialogActions disableSpacing sx={{ margin: '5px' }}>
        <Button
          disabled={loading}
          variant="outlined"
          sx={{ color: 'white', padding: '8px', marginLeft: '10px' }}
          autoFocus
          onClick={startDuplication}
        >
          Start Duplication
        </Button>
        <Button
          disabled={loading}
          variant="outlined"
          sx={{ color: 'white', padding: '8px', marginLeft: '10px' }}
          autoFocus
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DuplicateZoneDialog;
