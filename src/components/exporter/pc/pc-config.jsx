import {
  Box,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Button,
  TextField,
} from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { getEQDir, getFiles } from 'sage-core/util/fileHandler';
import { InventorySlot } from './inv-slot';
import { MageloDialog } from '../dialogs/magelo-dialog';
import { ProfileDialog } from '../dialogs/profile-dialog';

import './inventory.scss';

export const PCConfig = ({
  model,
  textures,
  itemOptions,
  config,
  setOption,
}) => {
  const [faces, setFaces] = useState([]);
  const [atlas, setAtlas] = useState(null);
  const filesCache = useRef(null);
  useEffect(() => {
    fetch('/static/eqassets/atlas.json')
      .then((r) => r.json())
      .then(setAtlas);
  }, []);

  const [mageloDialogOpen, setMageloDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
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
          let blob = await f.getFile();
          if (window.electronAPI) {
            const ab = await blob.arrayBuffer();
            blob = new Blob([ab], { type: 'img/png' });
          }
          const url = URL.createObjectURL(blob);
          return [idx, url];
        });

        const faces = (await Promise.all(facePromises)).filter(Boolean);
        faces.sort((a, b) => a[0] - b[0]);
        setFaces(faces.map(([_, url]) => url));
      }
    })();
  }, [model]);

  const setConfig = (newConfig) => {
    setOption('config', newConfig);
  };
  return !atlas ? null : (
    <Stack
      sx={{
        margin: '5px',
      }}
      direction={'column'}
      justifyContent={'center'}
    >
      <MageloDialog
        open={mageloDialogOpen}
        onClose={() => setMageloDialogOpen(false)}
      />
      <ProfileDialog
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
      />
      <Button
        variant="outlined"
        size="small"
        sx={{
          width    : '120px',
          color    : 'white',
          margin   : '5px auto',
          marginTop: '15px !important',
        }}
        onClick={() => setMageloDialogOpen(true)}
      >
        Import Magelo
      </Button>
      <Button
        variant="outlined"
        size="small"
        sx={{ width: '100px', margin: '5px auto', color: 'white' }}
        onClick={() => setProfileDialogOpen(true)}
      >
        Profiles
      </Button>
      <FormControl size="small">
        <TextField
          margin="dense"
          size="small"
          sx={{
            margin                 : '18px 7.5% 3px 7.5%',
            width                  : '85%',
            '& .MuiInputBase-input': {
              paddingTop   : '4px',
              paddingBottom: '4px',
              textAlign    : 'center',
            },
          }}
          InputLabelProps={{
            sx: {
              marginTop: '-2px',
              textAlign: 'center',
              fontSize : '0.75rem',
            },
          }}
          value={config.name ?? ''}
          variant={'outlined'}
          onChange={(e) => {
            setOption('config', { ...config, name: e.target.value });
          }}
          label="Name"
        />
      </FormControl>
      <FormControl
        size="small"
        sx={{
          m           : 1,
          margin      : '15px auto',
          textAlign   : 'center',
          border      : '1px solid rgb(180, 173, 134)',
          borderRadius: '50px',
        }}
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

      <Stack
        className="inventory-stack"
        direction="column"
        justifyContent={'center'}
        alignContent={'center'}
      >
        <Stack direction="row">
          <InventorySlot textures={textures} piece={'Helm'} atlas={atlas} />
          <InventorySlot textures={textures} piece={'Chest'} atlas={atlas} />
        </Stack>
        <Stack direction="row">
          <InventorySlot textures={textures} piece={'Arms'} atlas={atlas} />
          <InventorySlot textures={textures} piece={'Wrists'} atlas={atlas} />
        </Stack>
        <Stack direction="row">
          <InventorySlot textures={textures} piece={'Hands'} atlas={atlas} />
          <InventorySlot textures={textures} piece={'Legs'} atlas={atlas} />
        </Stack>
        <Stack direction="row">
          <InventorySlot textures={textures} piece={'Feet'} atlas={atlas} />
        </Stack>
      </Stack>

      <Stack
        className="inventory-stack"
        justifyContent={'center'}
        direction="row"
      >
        <InventorySlot
          noTint
          piece={'Primary'}
          atlas={atlas}
          options={itemOptions}
        />
        <InventorySlot
          noTint
          textures={textures}
          piece={'Secondary'}
          atlas={atlas}
          options={itemOptions}
        />
      </Stack>

      {/* <FormControl size="small" sx={{ m: 1, width: 300, margin: '0' }}>
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
      </FormControl> */}
    </Stack>
  );
};

export default PCConfig;
