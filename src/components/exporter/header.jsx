import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import {
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
import AsyncAutocomplete from '../common/autocomplete';

export const ExporterNavHeader = ({
  pcModelOptions,
  npcModelOptions,
  objectOptions,
  itemOptions,
}) => {
  const { selectedType, selectedModel, selectedName, location, setOption } =
    useSettingsContext();
  const getSelectedOptions = useCallback(
    (type) => {
      switch (type) {
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
    },
    [pcModelOptions, npcModelOptions, objectOptions, itemOptions]
  );
  const selectedOptions = useMemo(() => {
    return getSelectedOptions(selectedType);
  }, [selectedType, getSelectedOptions]);

  const doSetModel = useCallback(
    ({ model, label }) => {
      setOption('selectedModel', model);
      setOption('selectedName', label);
    },
    [setOption]
  );

  useEffect(() => {
    if (!selectedModel && selectedOptions.length) {
      doSetModel(selectedOptions[0]);
    }
  }, [setOption, selectedModel, selectedOptions, doSetModel]);

  useEffect(() => {}, []);

  return (
    <Stack
      direction="row"
      sx={{ width: '100%' }}
      justifyContent={'space-around'}
      alignItems={'center'}
    >
      <Grid
        sx={{ width: '200px', height: '68px', paddingTop: '5px', minWidth: '170px' }}
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
                    setOption(
                      'selectedModel',
                      getSelectedOptions(name)?.[0]?.model ?? ''
                    );
                    setOption(
                      'selectedName',
                      getSelectedOptions(name)?.[0]?.label ?? ''
                    );
                  }}
                />
              }
              label={name}
            />
          </Grid>
        ))}
      </Grid>

      <Stack sx={{ margin: '0 15px' }} direction="row">
        <FormControl
          size="small"
          sx={{ m: 1, margin: '0', marginTop: '-5px', marginRight: '10px' }}
        >
          <AsyncAutocomplete
            className="gold-border"
            label={selectedName || 'Select Model'}
            value={null}
            onChange={(_e, option) => {
              if (option) {
                doSetModel(option);
              }
            }}
            options={selectedOptions}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            size="small"
            sx={{ margin: '5px 0', minWidth: '250px !important' }}
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
              doSetModel(option);
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
              doSetModel(option);
            }}
          >
            <ArrowForwardIcon />
          </IconButton>
        </Stack>
      </Stack>
      <Box sx={{ marginTop: '-5px' }}className="area-selection">
        <TextField
          fullWidth
          select
          label="Class Area"
          onChange={(e) => setOption('location', e.target.value)}
          value={location}
        >
          <MenuItem value={-1}>None</MenuItem>
          {locations.map((l, i) => (
            <MenuItem value={i}>{l.name}</MenuItem>
          ))}
        </TextField>
      </Box>
    </Stack>
  );
};
