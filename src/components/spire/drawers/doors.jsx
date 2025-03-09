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
import BABYLON from '@bjs';
import { gameController } from '../../../viewer/controllers/GameController';
import { getEQDir, getEQFile } from 'sage-core/util/fileHandler';
import { useMainContext } from '@/components/main/context';
import { DoorApi } from 'spire-api/api/door-api';
import { useAlertContext } from '@/context/alerts';

const { Tools } = BABYLON;
function getRandomNumber(min, max) {
  return Math.random() * (max - min) + min;
}

const zb = gameController.ZoneBuilderController;

export const DoorsDrawer = ({ selectedObject }) => {
  const { openAlert } = useAlertContext();
  const { selectedZone, Spire } = useMainContext();
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
    });
  }, [selectedMesh]);

  const deleteMesh = useCallback(() => {
    if (!selectedMesh) {
      return;
    }

    selectedMesh.dataContainerReference =
      selectedMesh.dataContainerReference.filter(
        (v) => v !== selectedMesh.dataReference
      );
    selectedMesh.dispose();
    setSelectedMesh(null);
  }, [selectedMesh]);

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
    const Spire = window.Spire;
    if (!Spire || !selectedZone?.short_name) {
      return;
    }
    let current = true;
    (async () => {
      const doorsApi = new DoorApi(...Spire.SpireApi.cfg());

      try {
        const queryBuilder = new Spire.SpireQueryBuilder();
        queryBuilder.where('zone', '=', selectedZone.short_name);
        const { data: doors } = await doorsApi.listDoors(queryBuilder.get());
        if (!current) {
          return;
        }
        console.log('Got doors', doors);
        const { doorNode, instantiateObjects } =
          window.gameController.ZoneController;
        doorNode.getChildMeshes().forEach((m) => m.dispose());
        const doorMap = doors.reduce((acc, val) => {
          if (!acc[val.name]) {
            acc[val.name] = [];
          }
          acc[val.name].push({
            x      : val.pos_y,
            y      : val.pos_z,
            z      : val.pos_x,
            rotateX: 0,
            rotateY: (val.heading * 512) / 360,
            rotateZ: 0,
            scale  : val.size / 100,
          });
          return acc;
        }, {});

        for (const [key, value] of Object.entries(doorMap)) {
          for (const mesh of await instantiateObjects.apply(
            window.gameController.ZoneController,
            [key, value]
          )) {
            if (!mesh) {
              continue;
            }
            mesh.parent = doorNode;
          }
        }
        console.log('Door map', doorMap);
      } catch (e) {
        console.log('err', e);
        openAlert('Error updating zone', 'warning');
      }
    })();

    return () => {
      current = false;
      const { doorNode } = window.gameController.ZoneController;
      doorNode.getChildMeshes().forEach((m) => m.dispose());
    };
  }, [selectedZone?.short_name, openAlert]);

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
        const newName = `${selectedModel}_`;
        const clone = mesh.clone(newName, zb.objectContainer);
        clone.rotation.y = newEntry.rotateY;
        clone.scaling.setAll(newEntry.scale);
        clone.isPickable = true;
      },
      modelName: selectedModel,
      extraHtml: '<p>Left Mouse: Rotate and [Shift] Scale</p>',
    });
  }, [selectedModel, doRandom, rotateClamp, scaleClamp]);

  return (
    <Stack direction="column" sx={{ height: '90%' }}>
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
            Selected Door [{selectedMesh?.name ?? 'None'}]
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
                Remove Door [Delete]
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
                disabled={!selectedMesh?.dataReference}
                size="small"
                type="number"
                inputProps={{
                  style: { textAlign: 'center' },
                }}
                sx={{ margin: 0, padding: 0 }}
                value={selectedMesh?.dataReference?.z}
                onChange={(e) => {
                  selectedMesh.dataReference.z = selectedMesh.position.z =
                    +Math.round(e.target.value);
                  forceRender({});
                }}
              ></TextField>
              <TextField
                disabled={!selectedMesh?.dataReference}
                q
                size="small"
                type="number"
                inputProps={{
                  style: { textAlign: 'center' },
                }}
                sx={{ margin: 0, padding: 0 }}
                value={selectedMesh?.dataReference?.x}
                onChange={(e) => {
                  selectedMesh.dataReference.x = selectedMesh.position.x =
                    +Math.round(e.target.value);
                  forceRender({});
                }}
              ></TextField>
              <TextField
                disabled={!selectedMesh?.dataReference}
                size="small"
                type="number"
                inputProps={{
                  style: { textAlign: 'center' },
                }}
                sx={{ margin: 0, padding: 0 }}
                value={selectedMesh?.dataReference?.y}
                onChange={(e) => {
                  selectedMesh.dataReference.y = selectedMesh.position.y =
                    +Math.round(e.target.value);
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
            Placable Doors
          </Typography>
          <Stack
            direction="row"
            sx={{ position: 'absolute', right: '20px', marginTop: '7px' }}
          >
            <IconButton onClick={() => {}}>
              <ArrowBackIcon />
            </IconButton>
            <IconButton onClick={() => {}}>
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
            options={[]}
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
            Add Door [{selectedModel || 'None'}]
          </Typography>
        </Button>

        <Divider sx={{ margin: '5px' }} />
      </Box>
    </Stack>
  );
};
