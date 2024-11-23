import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useRegionContext } from '../providers/region-provider';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
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

export const RegionDrawer = () => {
  const { regionUpgradeState, upgrader } = useRegionContext();
  const [selectedMesh, setSelectedMesh] = useState(null);
  const editing = useRef(false);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [depth, setDepth] = useState(0);
  const {
    metadata: { regions },
    zb,
  } = useProject();
  const region = useMemo(() => selectedMesh?.metadata?.region, [selectedMesh]);

  const [regionType, setRegionType] = useState('Zoneline');
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
      if (e.key.toLowerCase() === 'r') {
        // editMesh();
      }
      if (e.key === 'Delete') {
        // deleteMesh();
      }
    };

    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      zb.removeClickCallback(clickCallback);
      zb.disposeOverlayWireframe(false);
    };
  }, [selectedMesh, zb]);

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

  console.log('r', region);
  const getName = (type) =>
    Object.entries(RegionType).find(([_k, v]) => v === type)?.[0];
  return (
    <Box>
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
      {regionUpgradeState === UpgradeState.NEED_UPGRADE && (
        <Box sx={{ marginTop: '10px' }}>
          Regions are out of sync. Click to Upgrade
          <Button onClick={upgrader}>Upgrade Regions</Button>
        </Box>
      )}
      <Stack sx={{ marginTop: '5px', paddingLeft: '5px' }} direction="column">
        <Typography sx={{ fontSize: '17px' }}>
          Selected Region:{' '}
          {region
            ? `${getName(region.regionType)} ${regions.findIndex(
              (r) => r === region
            )}`
            : 'None'}
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
                Width: {Math.abs(width)}
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
                Height: {Math.abs(height)}
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
                Depth: {Math.abs(depth)}
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
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
};
