import React, { useCallback, useState } from 'react';
import Joyride from 'react-joyride';

import {
  Autocomplete,
  Box,
  Button,
  FormControl,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CommonDialog } from '../../../components/spire/dialogs/common';
import { useMainContext } from '@/components/main/context';
import { processEquip, processGlobal } from '@/components/zone/processZone';
import { processZone } from '@/components/zone/processZone';
import { useExpansionList } from '@/components/common/expansions';
import { useDebouncedCallback } from 'use-debounce';

const steps = [
  {
    title: 'Model Processing',
    content:
      'Start here by processing global model files (global_chr.s3d and its counterparts) to populate lists for PC and NPC models',
    target   : '#joyride-models',
    placement: 'left',
  },
  {
    title: 'Equipment Processing',
    content:
      'Processing equipment will load items and additional armor packs (e.g. Velious armor).',
    target   : '#joyride-equipment',
    placement: 'left',
  },
  {
    title: 'Zone Processing',
    content:
      'Additionally, zones may contain models and objects not included in global files. Experiment with different zones to populate additional models and objects, e.g. Mistmoore will contain models for Vampires.',
    target   : '#joyride-zone',
    placement: 'left',
  },
  {
    title: 'Bulk Zone Processing',
    content:
      'You may want to process multiple zones at once. This is possible, however not optimized, so get ready to kick back and watch the magic happen while you process all zones based on the expansion filter.',
    target   : '#joyride-expac',
    placement: 'left',
  },
];

export const ProcessDialog = ({ onClose, refresh, confirm, openAlert }) => {
  const {
    rootFileSystemHandle,
    gameController,
    zones,
    recentList,
    setRecentList,
  } = useMainContext();
  const { ExpansionList, filteredZoneList } = useExpansionList({ zones });
  const [joyrideKey, setJoyrideKey] = useState(0);
  const [run, setRun] = useState(true);
  const showBeaconAgain = () => {
    setRun(false);
  };
  const handleCallback = (state) => {
    console.log('State', state);
    if (state.action === 'reset') {
      showBeaconAgain();
    }
    if (state.action === 'stop') {
      setRun(false);
    }
  };
  const handleDrag = useDebouncedCallback(() => {
    setJoyrideKey((k) => k + 1);
  }, 50);
  const doProcessZone = useCallback(
    async (zone) => {
      const didProcess = await processZone(
        zone.short_name,
        gameController.settings,
        rootFileSystemHandle,
        true
      );
      if (
        didProcess &&
        !recentList.some((a) => a.short_name === zone.short_name)
      ) {
        setRecentList((l) => [...l, zone]);
        localStorage.setItem('recent-zones', JSON.stringify(recentList));
      }
      await refresh();
    },
    [
      rootFileSystemHandle,
      recentList,
      setRecentList,
      refresh,
      gameController.settings,
    ]
  );
  return (
    <CommonDialog
      onDrag={handleDrag}
      onClose={onClose}
      additionalButtons={[
        <Button disabled={run} variant='outlined' onClick={() => setRun(true)}>{'Show Tips'}</Button>,
      ]}
      title={'Process Global Files'}
    >
      <Joyride
        showSkipButton
        styles={{ options: { zIndex: 10000, background: 'green' } }}
        key={joyrideKey}
        steps={steps}
        run={run}
        callback={handleCallback}
      />

      <Box sx={{ minWidth: '400px', minHeight: '100px' }}>
        <Typography
          sx={{ textAlign: 'center', fontSize: '17px', marginBottom: '8px' }}
        >
          Global Model Processor
        </Typography>
        <Stack direction="column" justifyContent={'space-around'}>
          <Button
            id="joyride-models"
            sx={{ margin: '2.5px auto', width: '75%' }}
            color="primary"
            onClick={async () => {
              // await deleteEqFolder('data');
              await processGlobal(
                gameController.settings,
                rootFileSystemHandle,
                true
              );
              refresh();
            }}
            variant="outlined"
          >
            Process Global PC/NPC Models
          </Button>
          <Button
            id="joyride-equipment"
            sx={{ margin: '2.5px auto', width: '75%' }}
            color="primary"
            onClick={async () => {
              await processEquip(
                gameController.settings,
                rootFileSystemHandle,
                true
              );
              await refresh();
            }}
            variant="outlined"
          >
            Process Global Equipment
          </Button>
        </Stack>
        <Typography
          sx={{
            textAlign   : 'center',
            fontSize    : '17px',
            marginTop   : '20px',
            marginBottom: '8px',
          }}
        >
          Zone Processor
        </Typography>
        <Stack
          direction="column"
          sx={{ width: '100%' }}
          alignItems={'center'}
          justifyContent={'center'}
        >
          <Autocomplete
            id="joyride-zone"
            size="small"
            sx={{ width: '270px', marginBottom: '10px' }}
            isOptionEqualToValue={(option, value) => option?.key === value?.key}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                await doProcessZone({ short_name: e.target.value });
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            onChange={async (e, values) => {
              if (!values) {
                return;
              }
              await doProcessZone(values);
            }}
            renderOption={(props, option) => {
              return (
                <li {...props} key={option.key}>
                  {option.label}
                </li>
              );
            }}
            noOptionsText={'Enter Custom File and Press Return'}
            options={filteredZoneList.map((z) => ({
              label     : `[${z.short_name}] ${z.long_name}`,
              key       : `${z.id}-${z.zoneidnumber}`,
              short_name: z.short_name,
              ...z,
            }))}
            renderInput={(params) => (
              <TextField {...params} label="Individual Zone" />
            )}
          />

          <ExpansionList />

          <Button
            id="joyride-expac"
            sx={{ width: '270px !important', maxWidth: '270px' }}
            color="primary"
            onClick={() => {
              confirm({
                description: `You're about to process ${filteredZoneList.length} zones. This may take awhile. Be sure to keep this browser tab open and visible. To stop processing, simply refresh the page.`,
                title      : 'Process Zones',
              })
                .then(async () => {
                  for (const z of zones) {
                    if (
                      !filteredZoneList.some(
                        (fz) => fz.short_name === z.short_name
                      ) ||
                      z.short_name.includes('tutorial')
                    ) {
                      continue;
                    }
                    await doProcessZone(z);
                    openAlert(`Exported ${z.short_name} - ${z.long_name}`);
                  }
                  openAlert('Done processing zones');
                })
                .catch(() => {});
            }}
            variant="outlined"
          >
            Process Filtered Zones ({filteredZoneList.length})
          </Button>
        </Stack>
      </Box>
    </CommonDialog>
  );
};
