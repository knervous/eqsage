import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Stack, Box, Button, Divider, FormControlLabel, Checkbox, Typography } from '@mui/material';
import { useZoneBuilderContext } from '../context';
import { gameController } from '../../../viewer/controllers/GameController';

const zb = gameController.ZoneBuilderController;

export const ZoneDrawer = ({ selectedObject }) => {
  const {
    zone,
    updateProject,
  } = useZoneBuilderContext();
  const [importOpen, setImportOpen] = useState(false);
  const [selectedMesh, setSelectedMesh] = useState(selectedObject);
  const [, forceRender] = useState({});
  const editing = useRef(false);

  const meshMetadata = useMemo(() => {
    return selectedMesh?.metadata?.gltf?.extras;
  }, [selectedMesh]);

  useEffect(() => {
    const clickCallback = (mesh) => {
      if (editing.current) {
        return;
      }
      if (mesh.parent === zb.zoneContainer) {
        setSelectedMesh(mesh); // Create a new reference to trigger re-render
      }
    };

    zb.addClickCallback(clickCallback);

    return () => {
      zb.removeClickCallback(clickCallback);
      zb.disposeOverlayWireframe();
    };
  }, []);

  useEffect(() => {
    if (!selectedMesh) {
      return;
    }
    zb.overlayWireframe(selectedMesh);

    return () => zb.disposeOverlayWireframe();
  }, [selectedMesh]);

  const handleCheckboxChange = ({ target: { checked } }) => {
    // Update metadata to ensure the checkbox reflects the new state
    if (!selectedMesh.metadata) {
      selectedMesh.metadata = {};
    }
    if (!selectedMesh.metadata.gltf) {
      selectedMesh.metadata.gltf = { extras: {} };
    }

    selectedMesh.metadata.gltf.extras.passThrough = checked;
    const m = selectedMesh;
    setSelectedMesh(null);
    forceRender({});
    setTimeout(() => {
      setSelectedMesh(m);
    }, 0);
  };

  return (
    <Stack direction="column" sx={{ height: '90%' }}>
      <Box>
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
            Import New GLB
          </Typography>
        </Button>
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
            Export Terrain
          </Typography>
        </Button>
      </Box>
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
            Selected: [ {selectedMesh?.name ?? 'None'} ]
          </Typography>
          <FormControlLabel
            disabled={!selectedMesh}
            control={
              <Checkbox
                checked={Boolean(meshMetadata?.passThrough)}
                onChange={handleCheckboxChange}
              />
            }
            label="Player Passthrough"
          />
        </Stack>
      </Box>
    </Stack>
  );
};
