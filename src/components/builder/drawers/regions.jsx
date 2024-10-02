import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useRegionContext } from '../providers/region-provider';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  MenuItem,
  Select,
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

  const {
    metadata: { regions },
    zb,
  } = useProject();

  const [regionType, setRegionType] = useState('Zoneline');
  console.log('r', regions);
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
    zb.overlayWireframe(selectedMesh, false, true);

    return () => zb.disposeOverlayWireframe(false);
  }, [selectedMesh, zb]);

  useEffect(() => {
    const selectedRegionValue = Object.entries(RegionType).find(
      ([k, _v]) => regionType === k
    )?.[1];
    const filteredRegions =
      regionType === 'all'
        ? regions
        : regions.filter((r) =>
          r.region.regionTypes.includes(selectedRegionValue)
        );
    zb.disposeOverlayWireframe(false);
    zb.filterRegions(filteredRegions);
  }, [regionType, regions, zb]);

  const region = useMemo(
    () => selectedMesh?.metadata?.region?.region,
    [selectedMesh]
  );

  const getName = type => Object.entries(RegionType).find(([k, v]) => v === type)?.[0];
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
              disabled={!regions.some((r) => r.region?.regionTypes.includes(v))}
              value={t}
            >
              {t} (
              {regions.filter((r) => r.region?.regionTypes.includes(v)).length})
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Typography sx={{}}>Selected Region</Typography>
      {region ? (
        <Stack direction="column">
          <Typography>Types: {region.regionTypes.map(getName).join(', ')}</Typography>
        </Stack>
      ) : null}
      {regionUpgradeState === UpgradeState.NEED_UPGRADE && (
        <Box sx={{ marginTop: '10px' }}>
          Regions are out of sync. Click to Upgrade
          <Button onClick={upgrader}>Upgrade Regions</Button>
        </Box>
      )}
      Regions
    </Box>
  );
};
