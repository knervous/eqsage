import React, { useCallback, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Divider,
  FormControl,
  IconButton,
  Stack,
  Checkbox,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material';
import Slider from '@mui/material/Slider';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Tools } from '@babylonjs/core/Misc/tools';
import { useZoneBuilderContext } from '../context';
import { gameController } from '../../../viewer/controllers/GameController';
import { ObjectDialog } from './object-dialog';

function getRandomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

export const ObjectsDrawer = () => {
  const {
    zone,
    zone: { modelFiles },
    updateProject,
  } = useZoneBuilderContext();
  const models = Object.keys(modelFiles);
  const [selectedModel, setSelectedModel] = useState('');
  const [doRandom, setDoRandom] = useState(false);
  const [rotateClamp, setRotateClamp] = useState([0, 360]);
  const [scaleClamp, setScaleClamp] = useState([1, 3]);
  const [importOpen, setImportOpen] = useState(false);
  const stamp = useCallback(() => {
    if (!selectedModel) {
      return;
    }
    window.gameController.ZoneBuilderController.pickRaycastForLoc({
      async commitCallback(loc, mesh) {
        if (!loc) {
          return;
        }
        console.log('commit', loc);
      },
      /**
       *
       * @param {{x: number, y: number, z: number} | null} loc
       * @param {import('@babylonjs/core/Meshes/mesh').Mesh} mesh
       * @returns
       */
      async stampCallback(loc, mesh) {
        if (!loc) {
          return;
        }
        const { x, y, z } = loc;
        const newEntry = {
          x,
          y,
          z,
          rotateX: 0,
          rotateY: doRandom
            ? getRandomNumber(rotateClamp[0], rotateClamp[1])
            : 0,
          rotateZ: 0,
          scale  : doRandom ? getRandomNumber(scaleClamp[0], scaleClamp[1]) : 1,
        };
        const newName = `${selectedModel}_${
          zone.metadata.objects[selectedModel].length + 1
        }`;
        const clone = mesh.clone(
          newName,
          gameController.ZoneBuilderController.objectContainer
        );
        clone.rotation.y = Tools.ToRadians(newEntry.rotateY);
        clone.scaling.setAll(newEntry.scale);
        const newZone = zone;
        newZone.metadata.objects[selectedModel].push(newEntry);
        updateProject(newZone);
        console.log('zone', zone);
        //  const clone = mesh.clone();
        console.log('stamp', loc);
      },
      modelName: selectedModel,
    });
  }, [selectedModel, zone, updateProject, doRandom, rotateClamp, scaleClamp]);
  const modelOptions = useMemo(() => {
    return models
      .map((model, idx) => {
        const modelLabel = `${model}`;
        const label = models[modelLabel] ?? modelLabel;
        return {
          model: modelLabel,
          label,
          id   : idx,
          key  : idx,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.label > b.label ? 1 : -1));
  }, [models]);

  const optionIdx = modelOptions.findIndex((m) => m.model === selectedModel);
  console.log('Option idx', optionIdx);
  return (
    <>
      <ObjectDialog open={importOpen} setOpen={setImportOpen} models={models} />

      <Box sx={{ padding: '10px' }}>
        <Stack direction="row" sx={{ marginBottom: '5px' }}>
          <Typography
            sx={{
              fontSize   : '17px',
              marginTop  : '15px',
              paddingLeft: '5px',
            }}
          >
            Available Objects ({modelOptions.length})
          </Typography>
          <Stack
            direction="row"
            sx={{ position: 'absolute', right: '20px', marginTop: '7px' }}
          >
            <IconButton
              disabled={optionIdx < 1}
              onClick={() => {
                const optionIdx = modelOptions.findIndex(
                  (m) => m.model === selectedModel
                );
                if (optionIdx >= 0) {
                  const option = modelOptions[optionIdx - 1];
                  setSelectedModel(option.model);
                }
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <IconButton
              disabled={optionIdx === modelOptions.length - 1}
              onClick={() => {
                const optionIdx = modelOptions.findIndex(
                  (m) => m.model === selectedModel
                );
                const option = modelOptions[optionIdx + 1];
                setSelectedModel(option.model);
              }}
            >
              <ArrowForwardIcon />
            </IconButton>
          </Stack>
        </Stack>

        <FormControl fullWidth>
          <Autocomplete
            value={selectedModel}
            size="small"
            sx={{ margin: '5px 0' }}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            onChange={async (e, values) => {
              if (!values) {
                return;
              }
              setSelectedModel(values.model);
            }}
            renderOption={(props, option) => {
              return (
                <li {...props} key={option.key}>
                  {option.label}
                </li>
              );
            }}
            options={modelOptions}
            renderInput={(params) => (
              <TextField {...params} model="Select Object" />
            )}
          />
        </FormControl>
        <Button
          fullWidth
          variant={'outlined'}
          sx={{ margin: '5px auto' }}
          disabled={!selectedModel}
          onClick={stamp}
        >
          <Typography
            variant="h6"
            sx={{
              textAlign : 'center',
              userSelect: 'none',
              fontSize  : '17px',
              color     : selectedModel ? 'text.primary' : 'text.secondary',
            }}
          >
            Add Object [{selectedModel || 'None'}]
          </Typography>
        </Button>

        <Button
          fullWidth
          variant={'outlined'}
          sx={{ margin: '5px auto' }}
          onClick={() => setImportOpen(true)}
        >
          <Typography
            variant="h6"
            sx={{
              textAlign : 'center',
              userSelect: 'none',
              fontSize  : '17px',
            }}
          >
            Import / Upload Model
          </Typography>
        </Button>

        <Box sx={{ padding: '5px' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={doRandom}
                onChange={({ target: { checked } }) => setDoRandom(checked)}
              />
            }
            label="Use Random Modifier"
          />
          <Box sx={{ padding: '5px' }}>
            <Typography
              sx={{
                color : doRandom ? 'text.primary' : 'text.secondary',
                margin: '5px 0',
              }}
            >
              Rotation: ({rotateClamp[0]}, {[rotateClamp[1]]})
            </Typography>
            <Slider
              disabled={!doRandom}
              min={0}
              max={360}
              value={rotateClamp}
              onChange={(event, newValue) => {
                if (!Array.isArray(newValue)) {
                  return;
                }
                setRotateClamp(newValue);
              }}
              disableSwap
            />
            <Typography
              sx={{
                color : doRandom ? 'text.primary' : 'text.secondary',
                margin: '5px 0',
              }}
            >
              Scale: ({scaleClamp[0]}, {[scaleClamp[1]]})
            </Typography>
            <Slider
              disabled={!doRandom}
              min={0.1}
              max={5}
              step={0.1}
              value={scaleClamp}
              onChange={(event, newValue) => {
                if (!Array.isArray(newValue)) {
                  return;
                }
                setScaleClamp(newValue);
              }}
              disableSwap
            />
          </Box>
        </Box>

        <Divider sx={{ margin: '5px' }} />
      </Box>
    </>
  );
};
