import {
  Box,
  FormControl,
  FormLabel,
  MenuItem,
  Select,
  Stack,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { MuiColorInput } from 'mui-color-input';
import { getEQDir, getFiles } from '../../lib/util/fileHandler';
import { useDebouncedCallback } from 'use-debounce';

const version = 0.1;

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
  face  : 1,
  pieces: {
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

export const PCConfig = ({ model, setConfig, textures }) => {
  const [localConfig, setLocalConfig] = useState(defaultModel);
  const [faces, setFaces] = useState([]);
  useEffect(() => {
    setLocalConfig(getStoredModel(model));
    (async () => {
      const textureDir = await getEQDir('textures');
      if (textureDir) {
        const files = await getFiles(
          textureDir,
          (name) => name.startsWith(model),
          true
        );
        const faces = [];
        let i = 0;
        for (const f of files) {
          if (f.startsWith(`${model}he`) && f.endsWith('1.png')) {
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
      {Object.entries(localConfig.pieces).map(([piece, props]) => (
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
      ))}
    </Box>
  );
};

export default PCConfig;
