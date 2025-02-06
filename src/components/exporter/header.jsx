import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import {
  Autocomplete,
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  Select,
  Stack,
  TextField,
  MenuItem,
  Typography,
} from '@mui/material';
import { useSettingsContext } from '@/context/settings';
import { locations, models, optionType } from './constants';

export const ExporterNavHeader = ({
  pcModelOptions,
  npcModelOptions,
  objectOptions,
  itemOptions,
}) => {
  const { selectedType, selectedModel, location, setOption } = useSettingsContext();
  const selectedOptions = useMemo(() => {
    switch (selectedType) {
      default:
      case optionType.pc:
        return pcModelOptions;
      case optionType.npc:
        return npcModelOptions;
      case optionType.item:
        return itemOptions;
      case optionType.object:
        return objectOptions;
    }
  }, [
    selectedType,
    pcModelOptions,
    npcModelOptions,
    objectOptions,
    itemOptions,
  ]);

  const doSetModel = useCallback(
    (model) => {
      setOption('selectedModel', model);
    },
    [setOption]
  );

  useEffect(() => {
    if (!selectedModel && selectedOptions.length) {
      doSetModel(selectedOptions[0].model);
    }
  }, [setOption, selectedModel, selectedOptions, doSetModel]);
  return (
    <Stack
      direction="row"
      sx={{ width: '100%' }}
      justifyContent={'space-around'}
      alignItems={'center'}
    >
      <Grid
        sx={{ width: '200px', height: '68px', paddingTop: '5px' }}
        container
        spacing={2}
      >
        {Object.values(optionType).map((name) => (
          <Grid
            sx={{
              padding  : '0px !important',
              margin   : '0px !important',
              height   : '15px',
              maxHeight: '15px',
            }}
            item
            xs={6}
          >
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={selectedType === name}
                  onChange={(_e) => {
                    setOption('selectedType', name);
                  }}
                />
              }
              label={name}
            />
          </Grid>
        ))}
      </Grid>
  
      <Stack sx={{ margin: '0 15px' }} direction="row">
        <FormControl size="small" sx={{ m: 1, margin: '0', marginRight: '10px' }}>
          <Autocomplete
            className="area-selection"
            value={models[selectedModel]}
            size="small"
            sx={{ margin: '5px 0', width: '250px !important' }}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            onChange={async (e, values) => {
              if (!values) {
                return;
              }
              doSetModel(values.model);
            }}
            renderOption={(props, option) => {
              return (
                <li {...props} key={option.key}>
                  {option.label}
                </li>
              );
            }}
            options={selectedOptions}
            renderInput={(params) => (
              <TextField {...params} model="Select Model" />
            )}
          />
        </FormControl>
        <Stack direction="row" alignItems={'center'}>
          <IconButton
            sx={{ width: '40px', height: '40px' }}
            onClick={() => {
              const optionIdx = selectedOptions.findIndex(
                (m) => m.model === selectedModel
              );

              const option = selectedOptions.at(optionIdx - 1);
              doSetModel(option.model);
            }}
          >
            <ArrowBackIcon />
          </IconButton>

          <IconButton
            sx={{ width: '40px', height: '40px' }}
            onClick={() => {
              const optionIdx = selectedOptions.findIndex(
                (m) => m.model === selectedModel
              );
              const nextOption = optionIdx + 1;
              const option = selectedOptions.at(
                nextOption === selectedOptions.length ? 0 : nextOption
              );
              doSetModel(option.model);
            }}
          >
            <ArrowForwardIcon />
          </IconButton>
        </Stack>
      </Stack>
      <Box className="area-selection">
        <Select
          fullWidth
          //   IconComponent={() => <div>hi</div>}
            
          onChange={(e) => setOption('location', e.target.value)}
          value={location}
        >
          {locations.map((l, i) => (
            <MenuItem value={i}>{l.name}</MenuItem>
          ))}
        </Select>
      </Box>
    </Stack>
  );
};
