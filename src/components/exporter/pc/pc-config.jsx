import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Select,
  Stack,
  Button,
} from '@mui/material';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getEQDir, getFiles } from '../../../lib/util/fileHandler';
import { InventorySlot } from './inv-slot';
import { MageloDialog } from '../dialogs/magelo-dialog';
import AsyncAutocomplete from '@/components/common/autocomplete';


/**
 * 
 * fetch('/static/magelo/', { headers: {
    ['x-remote-api']: 'https://eq.magelo.com', ['x-remote-path']: '/profile/4304412',
} }).then(r => r.text()).then(t => {
    let arr;
    const results = [];
    const regex = /Item\((\d+),'([^,]*)',(\d+)/gm;
    while((arr = regex.exec(t))) {
        results.push([arr.slice(1, arr.length)]);
    }
    console.log('Got res', results)
})
 */

export const PCConfig = ({ model, textures, itemOptions, config, setOption }) => {
  const [faces, setFaces] = useState([]);
  const [atlas, setAtlas] = useState(null);
  const filesCache = useRef(null);
  useEffect(() => {
    fetch('/static/eqassets/atlas.json')
      .then((r) => r.json())
      .then(setAtlas);
  }, []);

  const [mageloDialogOpen, setMageloDialogOpen] = useState(false);
  useEffect(() => {
    (async () => {
      const scrubbedModel = model.slice(0, 3);
      const textureDir = await getEQDir('textures');
      if (textureDir) {
        const files =
          filesCache.current ?? (await getFiles(textureDir, undefined, false));
        filesCache.current = files;

        const matchingFiles = files.filter(
          (f) =>
            f.name.startsWith(`${scrubbedModel}he`) && f.name.endsWith('1.png')
        );

        const facePromises = matchingFiles.map(async (f) => {
          const match = /(\d{1})1\.png/.exec(f.name);
          if (!match) {
            return null;
          }
          const idx = +match[1];
          const blob = await f.getFile();
          const url = URL.createObjectURL(blob);
          return [idx, url];
        });

        const faces = (await Promise.all(facePromises)).filter(Boolean);
        faces.sort((a, b) => a[0] - b[0]);
        setFaces(faces.map(([_, url]) => url));
      }
    })();
  }, [model]);

  const robedModel = useMemo(() => model.endsWith('01'), [model]);
  const setConfig = newConfig => {
    setOption('config', newConfig);
  };
  const getPieceConfig = (filter = () => true) => {
    const left = [];
    const right = [];
    Object.entries(config.pieces)
      .filter(filter)
      .forEach((entry, idx) => {
        if (idx % 2 === 0) {
          left.push(entry);
        } else {
          right.push(entry);
        }
      });
  
    return (
      <Stack direction="row" justifyContent={'center'} alignContent={'center'}>
        <Stack direction="column">
          {left.map(([piece, props]) => (
            <InventorySlot
              textures={textures}
              localConfig={config}
              setLocalConfig={setConfig}
              key={piece}
              piece={piece}
              props={props}
              side="left"
              atlas={atlas}
            />
          ))}
        </Stack>
        <Stack direction="column">
          {right.map(([piece, props]) => (
            <InventorySlot
              textures={textures}
              localConfig={config}
              setLocalConfig={setConfig}
              key={piece}
              piece={piece}
              props={props}
              side="right"
              atlas={atlas}
            />
          ))}
        </Stack>
      </Stack>
    );
  };

  return !atlas ? null : (
    <Stack
      sx={{
        margin: '5px',
        // height  : '60vh',
        // backgroundColor: 'rgba(127,0,0,0.5)',
      }}
      direction={'column'}
      justifyContent={'center'}
    >
      <MageloDialog
        open={mageloDialogOpen}
        onClose={() => setMageloDialogOpen(false)}
      />
      <Button sx={{ width: '120px', margin: '0 auto' }} onClick={() => setMageloDialogOpen(true)}>
        Import Magelo
      </Button>
      <FormControl
        size="small"
        sx={{ m: 1, width: '120px', margin: '5px auto', textAlign: 'center' }}
      >
        <Select
          autoWidth={false}
          IconComponent={null}
          sx={{
            border                              : 0,
            margin                              : '0 auto',
            cursor                              : 'initial',
            '& .MuiOutlinedInput-notchedOutline': {
              border: 'none',
            },
            '*': {
              padding     : 0,
              paddingRight: '0 !important',
            },
          }}
          MenuProps={{
            anchorOrigin: {
              vertical  : 'top',
              horizontal: 'left', // Align the menu to the left of the Select
            },
            transformOrigin: {
              vertical  : 'top',
              horizontal: 'right', // Position the menu to pop out to the left
            },
            sx: {
              padding: 0,
            },
            PaperProps: {
              sx: {
                padding        : 0,
                backgroundColor: 'rgba(0,0,0,0)',
              },
            },
          }}
          value={config.face}
          onChange={(e) => {
            setConfig({
              ...config,
              face: +e.target.value,
            });
          }}
        >
          {faces.map((ab, idx) => (
            <MenuItem
              sx={{
                backgroundColor: 'rgba(0,0,0,0.0)',
                '&:hover'      : {
                  backgroundColor: 'rgba(255, 255, 255, .5)',
                },
              }}
              value={idx}
              label={idx}
            >
              <Box
                sx={{
                  padding           : 0,
                  width             : '64px', // faceWidth[model] ?? '64px',
                  height            : '64px',
                  backgroundColor   : 'black',
                  backgroundImage   : `url(${ab})`,
                  backgroundPosition: 'center',
                  backgroundRepeat  : 'no-repeat',
                  backgroundSize    : 'undefined 64px',
                  margin            : '0 auto',
                  maskImage         : `
                    radial-gradient(
                      circle at center,
                      rgba(0, 0, 0, 1) 40%,
                      rgba(0, 0, 0, 0.4) 70%,
                      rgba(0, 0, 0, 0) 80%
                    )
                  `,
                  maskRepeat: 'no-repeat',
                }}
              />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {robedModel ? (
        <>
          <FormControl
            size="small"
            sx={{ m: 1, width: 250, margin: '5px auto' }}
          >
            <FormLabel>Robe</FormLabel>
            <Select
              value={config.robe}
              onChange={(e) => {
                setConfig({
                  ...config,
                  robe: +e.target.value,
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
        </>
      ) : (
        getPieceConfig()
      )}
      <Stack justifyContent={'center'} direction="row">
        <InventorySlot
          textures={textures}
          localConfig={config}
          setLocalConfig={setConfig}
          piece={'Primary'}
          props={{ }}
          side="left"
          atlas={atlas}
        />
        <InventorySlot
          textures={textures}
          localConfig={config}
          setLocalConfig={setConfig}
          piece={'Secondary'}
          props={{ }}
          side="right"
          atlas={atlas}
        />
      </Stack>
    
      <FormControl size="small" sx={{ m: 1, width: 300, margin: '0' }}>
        <AsyncAutocomplete
          label={config.primaryName ?? 'Primary'}
          value={null}
          onChange={async (e, values) => {
            if (!values) {
              return;
            }
            setConfig({
              ...config,
              primary    : values.model,
              primaryName: values.label,
            });
          }}
          options={itemOptions}
          isOptionEqualToValue={(option, value) => option.key === value.key}
          size="small"
          sx={{ margin: '5px 0', width: '130px !important' }}
        />
      </FormControl>
      <FormControl size="small" sx={{ m: 1, width: 300, margin: '0' }}>
        <AsyncAutocomplete
          label={config.secondaryName || 'Select Item'}
          value={null}
          onChange={async (e, values) => {
            if (!values) {
              return;
            }
            setConfig({
              ...config,
              secondary    : values.model,
              secondaryName: values.label,
            });
          }}
          options={itemOptions}
          isOptionEqualToValue={(option, value) => option.key === value.key}
          size="small"
          sx={{ margin: '5px 0', width: '130px !important' }}
        />

        <FormControlLabel
          control={
            <Checkbox
              value={config.shieldPoint}
              onChange={() => {
                setConfig({
                  ...config,
                  shieldPoint: !config.shieldPoint,
                });
              }}
            >
              Shield Point
            </Checkbox>
          }
          label="Shield Point"
        />
      </FormControl>
    </Stack>
  );
};

export default PCConfig;
