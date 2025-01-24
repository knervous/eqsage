import {
  Autocomplete,
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { MuiColorInput } from 'mui-color-input';
import { getEQDir, getFiles } from '../../lib/util/fileHandler';
import { useDebouncedCallback } from 'use-debounce';

const version = 0.4;

function rgbaNumberToHex(rgbaNumber) {
  const r = (rgbaNumber >> 16) & 0xff;
  const g = (rgbaNumber >> 8) & 0xff;
  const b = rgbaNumber & 0xff;
  const a = (rgbaNumber >> 24) & 0xff;
  return `#${((1 << 8) + r).toString(16).slice(1)}${((1 << 8) + g)
    .toString(16)
    .slice(1)}${((1 << 8) + b).toString(16).slice(1)}${((1 << 8) + a)
      .toString(16)
      .slice(1)}`;
}
function hexToRgbaNumber(hex) {
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  if (hex.length !== 8) {
    throw new Error('Invalid hex color string. Expected format: #RRGGBBAA');
  }

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = 255; // parseInt(hex.slice(6, 8), 16);

  return (a << 24) | (r << 16) | (g << 8) | b;
}

const defaultPiece = {
  texture: 0,
  color  : -1,
};
const defaultModel = {
  version,
  face       : 1,
  robe       : 4,
  primary    : '',
  secondary  : '',
  shieldPoint: false,
  pieces     : {
    Helm  : defaultPiece,
    Chest : defaultPiece,
    Arms  : defaultPiece,
    Wrists: defaultPiece,
    Hands : defaultPiece,
    Legs  : defaultPiece,
    Feet  : defaultPiece,
  },
};

const textureNameMap = {
  1 : 'Cloth',
  2 : 'Leather',
  3 : 'Chain',
  4 : 'Plate',
  5 : 'Special 1',
  6 : 'Special 2',
  18: 'Velious 1',
  19: 'Velious 2',
  20: 'Velious 3',
  21: 'Velious 4',
  22: 'Velious 5',
  23: 'Velious 6',
  24: 'Velious 7',
};

const getStoredModel = (name) => {
  if (localStorage.getItem(name)) {
    const deser = JSON.parse(localStorage.getItem(name));
    if (deser.version === version) {
      return deser;
    }
  }
  return defaultModel;
};

export const PCConfig = ({ model, setConfig, textures, itemOptions }) => {
  const [localConfig, setLocalConfig] = useState(defaultModel);
  const [faces, setFaces] = useState([]);
  useEffect(() => {
    setLocalConfig(getStoredModel(model));
    (async () => {
      const scrubbedModel = model.slice(0, 3);
      const textureDir = await getEQDir('textures');
      if (textureDir) {
        const files = await getFiles(
          textureDir,
          (name) => name.startsWith(scrubbedModel),
          true
        );
        const faces = [];
        let i = 0;
        for (const f of files) {
          if (f.startsWith(`${scrubbedModel}he`) && f.endsWith('1.png')) {
            faces.push(i++);
          }
        }
        setFaces(faces);
      }
    })();
  }, [model]);
  const debouncedSet = useDebouncedCallback(() => {
    // serialize local config and call main update
    localStorage.setItem(model, JSON.stringify(localConfig));
    setConfig(localConfig);
  }, 200);

  useEffect(debouncedSet, [model, localConfig, setConfig, debouncedSet]);
  const robedModel = useMemo(() => model.endsWith('01'), [model]);

  const getPieceConfig = (filter = () => true) => Object.entries(localConfig.pieces).filter(filter).map(([piece, props]) => (
    <Box key={piece}>
      <FormControl
        size="small"
        sx={{ m: 1, width: 250, margin: '5px auto' }}
      >
        <FormLabel>{piece}</FormLabel>
        <Stack direction="row" spacing={1}>
          {piece !== 'Helm' ? (
            <Select
              sx={{ width: '40%', maxWidth: '40%', minWidth: '40%' }}
              value={props.texture}
              onChange={(e) => {
                setLocalConfig({
                  ...localConfig,
                  pieces: {
                    ...localConfig.pieces,
                    [piece]: {
                      ...localConfig.pieces[piece],
                      texture: +e.target.value,
                    },
                  },
                });
              }}
            >
              {textures.map((idx) => (
                <MenuItem value={idx} label={idx}>
                  {textureNameMap[idx + 1] ?? `Texture ${idx + 1}`}
                </MenuItem>
              ))}
            </Select>
          ) : null}
          <MuiColorInput
            size="small"
            isAlphaHidden
            format={'hex8'}
            value={rgbaNumberToHex(props.color)}
            onChange={(e) => {
              setLocalConfig({
                ...localConfig,
                pieces: {
                  ...localConfig.pieces,
                  [piece]: {
                    ...localConfig.pieces[piece],
                    color: hexToRgbaNumber(e),
                  },
                },
              });
            }}
          />
        </Stack>
      </FormControl>
    </Box>
  ));
  return (
    <Box sx={{ margin: '5px' }}>
      <FormControl
        size="small"
        sx={{ m: 1, width: 250, margin: '5px auto' }}
      >
        <FormLabel>Face</FormLabel>
        <Select
          value={localConfig.face}
          onChange={(e) => {
            setLocalConfig({
              ...localConfig,
              face: +e.target.value
            });
          }}
        >
          {faces.map((idx) => (
            <MenuItem value={idx} label={idx}>
              {`Face ${idx}`}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {robedModel ? <><FormControl
        size="small"
        sx={{ m: 1, width: 250, margin: '5px auto' }}
      >
        <FormLabel>Robe</FormLabel>
        <Select
          value={localConfig.robe}
          onChange={(e) => {
            setLocalConfig({
              ...localConfig,
              robe: +e.target.value
            });
          }}
        >
          {[4, 5, 6, 7, 8, 9, 10].map((idx) => (
            <MenuItem value={idx} label={idx}>
              {`Robe ${idx - 3}`}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {getPieceConfig(([key]) => ['Hands', 'Feet'].includes(key))}
      </> :
        getPieceConfig()}

      <FormControl size="small" sx={{ m: 1, width: 300, margin: '0' }}>
        <FormLabel id="primary-group">Primary</FormLabel>
        <Autocomplete
          value={localConfig.primary}
          size="small"
          sx={{ margin: '5px 0', maxWidth: '270px' }}
          isOptionEqualToValue={(option, value) => option.key === value.key}
          onChange={async (e, values) => {
            if (!values) {
              return;
            }
            setLocalConfig({
              ...localConfig,
              primary: values.model
            });
          }}
          renderOption={(props, option) => {
            return (
              <li {...props} key={option.key}>
                {option.label}
              </li>
            );
          }}
          options={itemOptions}
          renderInput={(params) => (
            <TextField {...params} model="Select Primary" />
          )}
        />
      </FormControl>
      <FormControl size="small" sx={{ m: 1, width: 300, margin: '0' }}>
        <FormLabel id="secondary-group">Secondary</FormLabel>
        <Autocomplete
          value={localConfig.secondary}
          size="small"
          sx={{ margin: '5px 0', maxWidth: '270px' }}
          isOptionEqualToValue={(option, value) => option.key === value.key}
          onChange={async (e, values) => {
            if (!values) {
              return;
            }
            setLocalConfig({
              ...localConfig,
              secondary: values.model
            });
          }}
          renderOption={(props, option) => {
            return (
              <li {...props} key={option.key}>
                {option.label}
              </li>
            );
          }}
          options={itemOptions}
          renderInput={(params) => (
            <TextField {...params} model="Select Secondary" />
          )}
        />
        <FormControlLabel
          control={
            <Checkbox
              value={localConfig.shieldPoint}
              onChange={() => {
                setLocalConfig({
                  ...localConfig,
                  shieldPoint: !localConfig.shieldPoint
                });
              }}
            >
                Shield Point
            </Checkbox>
          }
          label="Shield Point"
        />
      </FormControl>
    </Box>
  );
};

export default PCConfig;
