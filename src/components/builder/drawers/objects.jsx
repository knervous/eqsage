import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
  Slider,
} from '@mui/material';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Tools } from '@babylonjs/core/Misc/tools';
import { useZoneBuilderContext } from '../context';
import { gameController } from '../../../viewer/controllers/GameController';
import { ObjectDialog } from './object-dialog';
import { getEQDir, getEQFile } from '../../../lib/util/fileHandler';

function getRandomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

const zb = gameController.ZoneBuilderController;

export const ObjectsDrawer = ({ selectedObject }) => {
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
  const [, forceRender] = useState({});
  const [objectMap, setObjectMap] = useState({});
  const [selectedMesh, setSelectedMesh] = useState(selectedObject);
  const editing = useRef(false);
  const editMesh = useCallback(() => {
    editing.current = true;

    zb.editMesh(selectedMesh, (commit) => {
      editing.current = false;
      if (!commit) {
        return;
      }
      selectedMesh.dataReference.x = selectedMesh.position.x;
      selectedMesh.dataReference.y = selectedMesh.position.y;
      selectedMesh.dataReference.z = selectedMesh.position.z;

      selectedMesh.dataReference.rotateX = Tools.ToDegrees(
        selectedMesh.rotation.x
      );
      selectedMesh.dataReference.rotateY = Tools.ToDegrees(
        selectedMesh.rotation.y
      );
      selectedMesh.dataReference.rotateZ = Tools.ToDegrees(
        selectedMesh.rotation.z
      );

      selectedMesh.dataReference.scale = selectedMesh.scaling.y;
      updateProject(zone);
    });
  }, [selectedMesh, updateProject, zone]);

  const deleteMesh = useCallback(() => {
    if (!selectedMesh) {
      return;
    }

    selectedMesh.dataContainerReference =
      selectedMesh.dataContainerReference.filter(
        (v) => v !== selectedMesh.dataReference
      );
    updateProject(zone);
    selectedMesh.dispose();
    setSelectedMesh(null);
  }, [selectedMesh, updateProject, zone]);

  useEffect(() => {
    const clickCallback = (mesh) => {
      if (editing.current) {
        return;
      }
      if (mesh.parent === zb.objectContainer) {
        setSelectedMesh(mesh);
      }
    };

    zb.addClickCallback(clickCallback);
    const keydown = (e) => {
      if (e.key.toLowerCase() === 'r') {
        editMesh();
      }
      if (e.key === 'Delete') {
        deleteMesh();
      }
    };

    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      zb.removeClickCallback(clickCallback);
      zb.unassignGlow(selectedMesh);
    };
  }, [editMesh, selectedMesh, deleteMesh]);

  useEffect(() => {
    zb.assignGlow(selectedMesh);

    return () => zb.unassignGlow(selectedMesh);
  }, [selectedMesh]);

  useEffect(() => {
    (async () => {
      const objectDir = await getEQDir('objects');
      if (objectDir) {
        const objectPaths = await getEQFile('data', 'objectPaths.json', 'json');
        setObjectMap(objectPaths || {});
      }
    })();
  }, []);

  const stamp = useCallback(() => {
    if (!selectedModel) {
      return;
    }
    zb.pickRaycastForLoc({
      /**
       *
       * @param {{x: number, y: number, z: number} | null} loc
       * @param {import('@babylonjs/core/Meshes/mesh').Mesh} mesh
       * @returns
       */
      async commitCallback(loc, mesh) {
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
            ? Tools.ToRadians(getRandomNumber(rotateClamp[0], rotateClamp[1]))
            : mesh.rotation.y,
          rotateZ: 0,
          scale  : doRandom
            ? getRandomNumber(scaleClamp[0], scaleClamp[1])
            : mesh.scaling.y,
        };
        const newName = `${selectedModel}_${zone.metadata.objects[selectedModel].length}`;
        const clone = mesh.clone(newName, zb.objectContainer);
        clone.rotation.y = newEntry.rotateY;
        clone.scaling.setAll(newEntry.scale);
        clone.isPickable = true;
        const newZone = zone;
        newZone.metadata.objects[selectedModel].push(newEntry);
        clone.dataContainerReference = newZone.metadata.objects[selectedModel];
        clone.dataReference = newEntry;
        updateProject(newZone);
      },
      modelName: selectedModel,
      extraHtml: '<p>Left Mouse: Rotate and [Shift] Scale</p>',
    });
  }, [selectedModel, zone, updateProject, doRandom, rotateClamp, scaleClamp]);
  const modelOptions = useMemo(() => {
    return models
      .map((model, idx) => {
        const modelLabel = `${model}`;
        let label = models[modelLabel] ?? modelLabel;
        if (objectMap[label.toUpperCase()]) {
          label = `[${objectMap[label.toUpperCase()]}] ${label}`;
        }
        return {
          model: modelLabel,
          label,
          id   : idx,
          key  : idx,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.label > b.label ? 1 : -1));
  }, [models, objectMap]);

  const optionIdx = modelOptions.findIndex((m) => m.model === selectedModel);
  return (
    <Stack direction="column" justifyContent={'space-around'} sx={{ height: '90%' }}>
      <ObjectDialog open={importOpen} setOpen={setImportOpen} models={models} />
      <Button
        fullWidth
        variant={'outlined'}
        sx={{ margin: '10px auto' }}
        onClick={() => setImportOpen(true)}
      >
        <Typography
          variant="h6"
          sx={{
            color     : 'text.primary',
            textAlign : 'center',
            userSelect: 'none',
            fontSize  : '17px',
          }}
        >
          Import New Model
        </Typography>
      </Button>
      <Divider sx={{ margin: '5px' }} />
      <Box sx={{ padding: '10px' }}>
        <Stack direction="column" sx={{ marginBottom: '5px' }}>
          <Typography
            sx={{
              fontSize   : '17px',
              marginTop  : '5px',
              paddingLeft: '5px',
            }}
          >
            Selected Object [{selectedMesh?.name ?? 'None'}]
          </Typography>
          <>
            <Button
              fullWidth
              variant={'outlined'}
              sx={{ margin: '5px auto' }}
              disabled={!selectedMesh}
              onClick={editMesh}
            >
              <Typography
                variant="h6"
                sx={{
                  textAlign : 'center',
                  userSelect: 'none',
                  fontSize  : '17px',
                  color     : selectedMesh ? 'text.primary' : 'text.secondary',
                }}
              >
                Move/Rotate/Scale [R]
              </Typography>
            </Button>
            <Button
              fullWidth
              variant={'outlined'}
              sx={{ margin: '5px auto' }}
              disabled={!selectedMesh}
              onClick={deleteMesh}
            >
              <Typography
                variant="h6"
                sx={{
                  textAlign : 'center',
                  userSelect: 'none',
                  fontSize  : '17px',
                  color     : selectedMesh ? 'text.primary' : 'text.secondary',
                }}
              >
                Remove Mesh [Delete]
              </Typography>
            </Button>
            <Stack
              sx={{ margin: '10px' }}
              direction="row"
              justifyContent={'space-around'}
            >
              <Typography sx={{ fontSize: 18 }}>X</Typography>
              <Typography sx={{ fontSize: 18 }}>Y</Typography>
              <Typography sx={{ fontSize: 18 }}>Z</Typography>
            </Stack>
            <Stack direction="row">
              <TextField
                disabled = {!selectedMesh?.dataReference}
                size="small"
                type="number"
                inputProps={{
                  style: { textAlign: 'center' },
                }}
                sx={{ margin: 0, padding: 0 }}
                value={selectedMesh?.dataReference?.z}
                onChange={(e) => {
                  selectedMesh.dataReference.z = selectedMesh.position.z = +Math.round(e.target.value);
                  updateProject(zone);
                  forceRender({});

                }}
              ></TextField>
              <TextField
                disabled = {!selectedMesh?.dataReference}
                size="small"
                type="number"
                inputProps={{
                  style: { textAlign: 'center' },
                }}
                sx={{ margin: 0, padding: 0 }}
                value={selectedMesh?.dataReference?.x}
                onChange={(e) => {
                  selectedMesh.dataReference.x = selectedMesh.position.x = +Math.round(e.target.value);
                  updateProject(zone);
                  forceRender({});
                }}
              ></TextField>
              <TextField
                disabled = {!selectedMesh?.dataReference}

                size="small"
                type="number"
                inputProps={{
                  style: { textAlign: 'center' },
                }}
                sx={{ margin: 0, padding: 0 }}
                value={selectedMesh?.dataReference?.y}
                onChange={(e) => {
                  selectedMesh.dataReference.y = selectedMesh.position.y = +Math.round(e.target.value);
                  updateProject(zone);
                  forceRender({});

                }}
              ></TextField>

            </Stack>
          </>
        </Stack>
      </Box>
      <Divider sx={{ margin: '5px' }} />

      <Box sx={{ padding: '10px' }}>
        <Stack direction="row" sx={{ marginBottom: '5px' }}>
          <Typography
            sx={{
              fontSize   : '17px',
              marginTop  : '15px',
              paddingLeft: '5px',
            }}
          >
            Placable Objects ({modelOptions.length})
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
              <TextField
                onKeyDown={(e) => e.stopPropagation()}
                {...params}
                model="Select Object"
              />
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
    </Stack>
  );
};
