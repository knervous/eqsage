import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { useRegionContext } from '../providers/region-provider';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import { UpgradeState } from '../constants';
import { useProject } from '../hooks/metadata';
import { RegionType } from '../../../lib/s3d/bsp/bsp-tree';
import { useMainContext } from '../../main/context';
import { ZonePointChooserDialog } from './zp-chooser-dialog';

const getName = (type) =>
  Object.entries(RegionType).find(([_k, v]) => v === type)?.[0];

const RegionZoneInfo = ({
  updateProject,
  region,
  zb,
  regions,
  listZonePoints,
  zones,
}) => {
  const zoneLine = useMemo(() => region?.zoneLineInfo, [region]);
  const [zonePoints, setZonePoints] = useState([]);
  const [zoneNumber, setZoneNumber] = useState(zoneLine.index);
  const [zonePointChooserOpen, setZonePointChooserOpen] = useState(false);
  const [triggerZpRefresh, setTriggerZpRefresh] = useState(0);
  const zonesById = useMemo(() => {
    const zoneMap = {};
    for (const z of zones) {
      zoneMap[z.zoneidnumber] = z;
    }
    return zoneMap;
  }, [zones]);

  const zoneInfo = useMemo(() => {
    const zp = zonePoints.find((zp) => zp.number === zoneNumber * 10);
    console.log('Run');
    if (!zp) {
      return 'No matching server zone point';
    }
    const z = zonesById[zp.target_zone_id];
    if (!z) {
      return `Error in DB: Zone point found without matching zone: ${zp.target_zone_id} :: version ${zp.version}`;
    }
    return `Teleport: ${z.short_name} v${zp.version} (X: ${zp.target_x}, Y: ${zp.target_y}, Z: ${zp.target_z})`;
  }, [zonesById, zonePoints, zoneNumber]);

  useEffect(() => {
    zoneLine.index = zoneNumber;
    updateProject((state) => {
      return state;
    });
  }, [zoneNumber, updateProject, zoneLine]);

  useEffect(() => {
    listZonePoints()
      .then(setZonePoints)
      .catch((e) => {
        console.warn('Error in listZonePoints', e);
      });
  }, [listZonePoints, triggerZpRefresh]);

  return (
    <Stack sx={{ marginTop: '10px', paddingLeft: '0px' }} direction="column">
      {zonePointChooserOpen && (
        <ZonePointChooserDialog
          open={zonePointChooserOpen}
          setOpen={setZonePointChooserOpen}
          zonePoints={zonePoints}
          zonesById={zonesById}
          setZoneNumber={setZoneNumber}
          initialIdx={zoneNumber}
          triggerRefresh={setTriggerZpRefresh}
        />
      )}

      <Typography sx={{ fontSize: '15px', marginBottom: '10px' }}>
        {zoneInfo}
      </Typography>
      <Stack direction="row">
        <FormControl
          size="small"
          variant="standard"
          sx={{ width: '49%', marginRight: '2%' }}
        >
          <InputLabel>Zone Point ID</InputLabel>
          <Input
            disabled
            slotProps={{ input: { type: 'number' } }}
            value={zoneNumber}
            onChange={(e) => {
              setZoneNumber(+e.target.value);
            }}
          />
        </FormControl>
        <Button
          onClick={() => setZonePointChooserOpen(true)}
          sx={{ width: '49%' }}
          variant="outlined"
        >
          Select
        </Button>
      </Stack>
    </Stack>
  );
};

export const RegionDrawer = () => {
  const { regionUpgradeState, upgrader, listZonePoints } = useRegionContext();
  const [selectedMesh, setSelectedMesh] = useState(null);
  const editing = useRef(false);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [depth, setDepth] = useState(0);
  const [regionType, setRegionType] = useState('Zoneline');
  const [newRegionType, setNewRegionType] = useState(RegionType.Zoneline);
  const { Spire, zones } = useMainContext();

  const {
    metadata: { regions },
    zb,
    updateProject,
  } = useProject();
  const region = useMemo(() => selectedMesh?.metadata?.region, [selectedMesh]);

  const createNew = useCallback(() => {
    zb.pickRaycastForLoc({
      /**
       *
       * @param {{x: number, y: number, z: number} | null} loc
       * @param {import('@babylonjs/core/Meshes/mesh').Mesh} mesh
       * @returns
       */
      async commitCallback(loc) {
        if (!loc) {
          return;
        }
        const { x, y, z } = loc;

        updateProject((newZone) => {
          newZone.metadata.regions.push({
            center    : [x, y, z],
            minVertex : [x - 5, y - 5, z - 5],
            maxVertex : [x + 5, y + 5, z + 5],
            regionType: newRegionType,
            ...(newRegionType === RegionType.Zoneline
              ? {
                zoneLineInfo: {
                  type : 0,
                  index: 0,
                },
              }
              : {}),
          });
          zb.instantiateRegions(newZone.metadata.regions);
          newZone.metadata.regions = [...newZone.metadata.regions];
          return newZone;
        });
      },
    });
  }, [updateProject, zb, newRegionType]);
  const deleteMesh = useCallback(() => {
    updateProject((newZone) => {
      newZone.metadata.regions = [
        ...newZone.metadata.regions.filter((r) => r !== region),
      ];
      zb.instantiateRegions(newZone.metadata.regions);
      return newZone;
    });
  }, [region, updateProject, zb]);
  useEffect(() => {
    const clickCallback = (mesh) => {
      if (editing.current) {
        return;
      }
      if (mesh.parent === zb.regionContainer) {
        setSelectedMesh(mesh);
      }
    };

    zb.addClickCallback(clickCallback);
    const keydown = (e) => {
      if (e.key === 'Delete') {
        deleteMesh();
      }
    };

    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      zb.removeClickCallback(clickCallback);
      zb.disposeOverlayWireframe(false);
    };
  }, [selectedMesh, zb, deleteMesh]);

  useEffect(() => {
    if (!selectedMesh) {
      return;
    }
    const region = selectedMesh.metadata.region;
    zb.make3DMover(selectedMesh, (position) => {
      const reg = selectedMesh.metadata.region;
      reg.center[0] = position.x;
      reg.center[1] = position.y;
      reg.center[2] = position.z;
    });
    zb.overlayWireframe(selectedMesh, false, true);
    // Calculate the dimensions of the box
    const width = region.maxVertex[0] - region.minVertex[0];
    const height = region.maxVertex[1] - region.minVertex[1];
    const depth = region.maxVertex[2] - region.minVertex[2];
    setWidth(width);
    setHeight(height);
    setDepth(depth);
    return () => {
      zb.disposeOverlayWireframe(false);
      zb.destroy3DMover();
      setWidth(0);
      setHeight(0);
      setDepth(0);
    };
  }, [selectedMesh, zb]);

  useEffect(() => {
    const selectedRegionValue = Object.entries(RegionType).find(
      ([k, _v]) => regionType === k
    )?.[1];
    const filteredRegions =
      regionType === 'all'
        ? regions
        : regions.filter((r) => r.regionType === selectedRegionValue);
    zb.disposeOverlayWireframe(false);
    zb.filterRegions(filteredRegions);
  }, [regionType, regions, zb]);

  useEffect(() => {
    if (!selectedMesh) {
      return;
    }
    const region = selectedMesh.metadata.region;
    const [centerX, centerY, centerZ] = region.center;

    region.maxVertex[0] = centerX - width / 2;
    region.minVertex[0] = centerX + width / 2;
    region.maxVertex[1] = centerY - height / 2;
    region.minVertex[1] = centerY + height / 2;
    region.maxVertex[2] = centerZ - depth / 2;
    region.minVertex[2] = centerZ + depth / 2;

    zb.updateRegionBounds(selectedMesh, width, height, depth);
    zb.make3DMover(selectedMesh, (position) => {
      const reg = selectedMesh.metadata.region;
      reg.center[0] = position.x;
      reg.center[1] = position.y;
      reg.center[2] = position.z;
    });
    zb.overlayWireframe(selectedMesh, false, true);
  }, [zb, selectedMesh, width, height, depth, region?.regionType]); // eslint-disable-line

  return (
    <Box>
      {regionUpgradeState === UpgradeState.NEED_UPGRADE && (
        <Box sx={{ marginTop: '10px' }}>
          Regions are out of sync!
          <Button onClick={upgrader}>Upgrade Regions</Button>
        </Box>
      )}
      <FormControl size="small" sx={{ m: 1, width: 250, margin: '5px auto' }}>
        <FormLabel id="region-type">Filter Region Type</FormLabel>
        <Select
          name="region-type"
          aria-labelledby="region-type"
          sx={{ margin: '10px 0px' }}
          fullWidth
          onChange={(e) => setRegionType(e.target.value)}
          size={'small'}
          value={regionType}
        >
          <MenuItem value="all">All ({regions.length})</MenuItem>
          {Object.entries(RegionType).map(([t, v]) => (
            <MenuItem
              disabled={!regions.some((r) => r.regionType === v)}
              value={t}
            >
              {t} ({regions.filter((r) => r.regionType === v).length})
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl
        size="small"
        sx={{ m: 1, width: '100%', margin: '5px auto' }}
      >
        <FormLabel id="region-type">Create New Region</FormLabel>
        <Stack direction="row" sx={{ margin: '10px 0' }}>
          <Select
            name="region-type"
            aria-labelledby="region-type"
            sx={{ width: '49%' }}
            onChange={(e) => {
              setNewRegionType(e.target.value);
              setRegionType(getName(e.target.value));
            }}
            size={'small'}
            value={newRegionType}
          >
            {Object.entries(RegionType).map(([t, v]) => (
              <MenuItem value={v}>{t}</MenuItem>
            ))}
          </Select>
          <Button
            variant={'outlined'}
            sx={{ marginLeft: '2%', width: '49%' }}
            onClick={createNew}
          >
            Create
          </Button>
        </Stack>
      </FormControl>

      <Stack sx={{ marginTop: '5px', paddingLeft: '5px' }} direction="column">
        <Typography sx={{ fontSize: '17px' }}>
          Selected Region:{' '}
          {region
            ? `${getName(region.regionType)} ${regions.findIndex(
              (r) => r === region
            )}`
            : '[None]'}
        </Typography>
        {region ? (
          <Box sx={{ marginTop: '15px' }}>
            <FormControl fullWidth>
              <InputLabel id="change-region-label">Region Type</InputLabel>
              <Select
                labelId="change-region-label"
                aria-labelledby="change-region-label"
                sx={{ margin: '10px 0px' }}
                fullWidth
                onChange={(e) => {
                  region.regionType = e.target.value;

                  setRegionType(getName(e.target.value));
                  if (
                    region.regionType === RegionType.Zoneline &&
                    !region.zoneLineInfo
                  ) {
                    region.zoneLineInfo = {
                      type : 0,
                      index: 0,
                    };
                    updateProject((state) => {
                      state.metadata.regions = [...state.metadata.regions];
                      return state;
                    });
                  }
                }}
                size={'small'}
                value={region.regionType}
              >
                {Object.entries(RegionType).map(([t, v]) => (
                  <MenuItem value={v}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl sx={{}} fullWidth>
              <Typography
                sx={{ fontSize: 14, marginTop: 2, width: '80%' }}
                color="text.secondary"
                gutterBottom
              >
                Width: {Math.abs(width).toFixed(2)}
              </Typography>
              <Slider
                value={Math.abs(width)}
                onChange={(e) => {
                  setWidth(+e.target.value);
                }}
                step={0.1}
                min={1}
                max={Math.abs(width) + 50}
              />
            </FormControl>
            <FormControl sx={{}} fullWidth>
              <Typography
                sx={{ fontSize: 14, marginTop: 2, width: '80%' }}
                color="text.secondary"
                gutterBottom
              >
                Height: {Math.abs(height).toFixed(2)}
              </Typography>
              <Slider
                value={Math.abs(height)}
                onChange={(e) => {
                  setHeight(+e.target.value);
                }}
                step={0.1}
                min={1}
                max={Math.abs(height) + 50}
              />
            </FormControl>
            <FormControl sx={{}} fullWidth>
              <Typography
                sx={{ fontSize: 14, marginTop: 2, width: '80%' }}
                color="text.secondary"
                gutterBottom
              >
                Depth: {Math.abs(depth).toFixed(2)}
              </Typography>
              <Slider
                value={Math.abs(depth)}
                onChange={(e) => {
                  setDepth(+e.target.value);
                }}
                step={0.1}
                min={1}
                max={Math.abs(depth) + 50}
              />
            </FormControl>
            {Spire &&
            region?.zoneLineInfo &&
            region?.regionType === RegionType.Zoneline ? (
                <RegionZoneInfo
                  zb={zb}
                  updateProject={updateProject}
                  region={region}
                  regions={regions}
                  listZonePoints={listZonePoints}
                  zones={zones}
                />
              ) : null}
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
};
