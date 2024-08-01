import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Divider,
  FormControl,
  FormLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { useDebouncedCallback } from 'use-debounce';

import { OverlayDialogs } from './dialogs/dialogs';
import { gameController } from '../../viewer/controllers/GameController';
import { getEQDir, getFiles } from '../../lib/util/fileHandler';

import './overlay.scss';
import { items } from './constants';

const animationDefinitions = {
  pos: 'None',
  c01: 'Kick',
  c02: '1h Pierce',
  c03: '2h Slash',
  c04: '2h Blunt',
  c05: '1h Slash',
  c06: '1h Slash Offhand',
  c07: 'Bash',
  c08: 'Hand to Hand Primary',
  c09: 'Archery',
  c10: 'Swimming 1',
  c11: 'Roundhouse Kick',
  d01: 'Minor Damage',
  d02: 'Heavy Damage',
  d04: 'Drowning',
  d05: 'Death',
  l01: 'Walking',
  l02: 'Running',
  l03: 'Running Jump',
  l04: 'Stationary Jump',
  l05: 'Falling',
  l06: 'Duck Walking',
  l07: 'Ladder Climbing',
  l08: 'Duck Down',
  l09: 'Swimming Stationary',
  o01: 'Idle 2',
  p01: 'Idle 1',
  p02: 'Sit Down',
  p03: 'Shuffle Rotate',
  p04: 'Shuffle Strafe',
  p05: 'Loot',
  p06: 'Swimming 2',
  s01: 'Cheer',
  s02: 'Disappointed',
  s03: 'Wave',
  s04: 'Rude',
  t02: 'Stringed Instrument',
  t03: 'Woodwind Instrument',
  t04: 'Cast 1',
  t05: 'Cast 2',
  t06: 'Cast 3',
  t07: 'Flying Kick',
  t08: 'Tiger Strike',
  t09: 'Dragon Punch',
};
const animationNames = new Proxy(animationDefinitions, {
  get(target, prop, _receiver) {
    if (target[prop]) {
      return `[${prop}] ${target[prop]}`;
    }
    return prop;
  },
});

export const ExporterOverlayRightNav = ({
  babylonModel,
  modelFiles = [],
  setBabylonModel,
  type,
  itemOptions
}) => {
  const [animation, setAnimation] = useState(
    babylonModel.animationGroups?.[0]?.name
  );
  const [head, setHead] = useState(0);
  const [headCount, setHeadCount] = useState(0);
  const [texture, setTexture] = useState(0);
  const [textures, setTextures] = useState([]);
  const [primary, setPrimary] = useState(null);
  const [secondary, setSecondary] = useState(null);

  useEffect(() => {
    (async () => {
      setTexture(0);
      setHead(0);
      setAnimation('pos');
      setPrimary(null);
      setSecondary(null);
      let count = 0;
      const wearsRobe = gameController.SpawnController.wearsRobe(
        babylonModel.modelName
      );
      modelFiles.forEach((f) => {
        const name = wearsRobe
          ? babylonModel.modelName.slice(0, 3)
          : babylonModel.modelName;
        if (f.name.startsWith(`${name}he`)) {
          count++;
        }
      });
      setHeadCount(count);
      if (wearsRobe) {
        setTextures([0, 1, 2, 3, 4, 5, 6]);
      } else {
        const textureDir = await getEQDir('textures');
        if (textureDir) {
          const files = await getFiles(
            textureDir,
            (name) => name.startsWith(babylonModel.modelName),
            true
          );
          const variations = [];
          for (const f of files) {
            const chestRegex = /ch(\d{2})01/;
            if (chestRegex.test(f)) {
              const [, n] = chestRegex.exec(f); 
              variations.push(+n);
            }
          }
          setTextures(variations.sort((a, b) => a > b ? 1 : -1));
        }
      }
    })();
  }, [babylonModel.modelName, modelFiles]);

  useEffect(() => {
    if (animation) {
      const ag = babylonModel.animationGroups?.find(
        (ag) => ag.name === animation
      );
      if (ag) {
        babylonModel.animationGroups?.forEach((a) => a.stop());
        ag.play(true);
      } else {
        console.warn(`Animation not found ${animation}`);
      }
    } else {
      console.warn(`Animation not found ${animation}`);
    }
  }, [animation, babylonModel]);

  const debouncedAdd = useDebouncedCallback(() => {
    if (type === 0) {
      gameController.SpawnController.addExportModel(
        babylonModel.modelName,
        head,
        texture,
        primary,
        secondary
      ).then(setBabylonModel);
    } else if (type === 1) {
      gameController.SpawnController.addObject(babylonModel.modelName).then(
        setBabylonModel
      );
    } else {
      gameController.SpawnController.addObject(
        babylonModel.modelName,
        'items'
      ).then(setBabylonModel);
    }
  }, 100);
  useEffect(debouncedAdd, [
    head,
    babylonModel.modelName,
    texture,
    setBabylonModel,
    debouncedAdd,
    type,
    primary,
    secondary
  ]);

  const animations = useMemo(() => {
    if (!babylonModel?.animationGroups?.length) {
      return [];
    }
    const ag = babylonModel.animationGroups.slice(
      1,
      babylonModel.animationGroups.length
    );
    return [
      babylonModel.animationGroups[0],
      ...ag.sort((a, b) => (a.name > b.name ? 1 : -1)),
    ];
  }, [babylonModel?.animationGroups]);
  return (
    <>
      <Box className="exporter-right-nav">
        <Typography variant="h6" sx={{ textAlign: 'center' }}>
          Model
        </Typography>
        <Divider sx={{ margin: '5px' }} />
        <FormControl size="small" sx={{ m: 1, width: 250, margin: '5px auto' }}>
          <FormLabel id="head-group">Head</FormLabel>
          <Select
            aria-labelledby="head-group"
            name="head-group"
            value={head}
            onChange={(e) => setHead(e.target.value)}
          >
            {Array.from({ length: headCount }).map((_, idx) => (
              <MenuItem value={idx} label={idx}>
                Head {idx + 1}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ m: 1, width: 250, margin: '5px auto' }}>
          <FormLabel id="animation-group">Animation</FormLabel>
          <Select
            aria-labelledby="animation-group"
            name="animation-group"
            value={animation}
            onChange={(e) => setAnimation(e.target.value)}
          >
            {animations.map((ag) => (
              <MenuItem value={ag.name} label={ag.name}>
                {animationNames[ag.name]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ m: 1, width: 250, margin: '5px auto' }}>
          <FormLabel id="head-group">Texture</FormLabel>
          <Select
            aria-labelledby="head-group"
            name="head-group"
            value={texture}
            onChange={(e) => setTexture(e.target.value)}
          >
            {textures.map((idx) => (
              <MenuItem value={idx} label={idx}>
                Texture {idx + 1}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
       
        <FormControl size="small" sx={{ m: 1, width: 300, margin: '0' }}>
          <FormLabel id="primary-group">Primary</FormLabel>
          <Autocomplete
            value={primary ? items[primary] : ''}
            size="small"
            sx={{ margin: '5px 0', maxWidth: '270px' }}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            onChange={async (e, values) => {
              if (!values) {
                return;
              }
              setPrimary(values.model);
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
            value={secondary ? items[secondary] : ''}
            size="small"
            sx={{ margin: '5px 0', maxWidth: '270px' }}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            onChange={async (e, values) => {
              if (!values) {
                return;
              }
              setSecondary(values.model);
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
        </FormControl>
      </Box>
      <OverlayDialogs />
    </>
  );
};
