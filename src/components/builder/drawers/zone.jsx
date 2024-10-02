import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Stack,
  Box,
  Button,
  Divider,
  FormControlLabel,
  Checkbox,
  Typography,
} from '@mui/material';
import { gameController } from '../../../viewer/controllers/GameController';
import { MaterialDialog } from './material-dialog';
import { useAlertContext } from '../../../context/alerts';
import { useProject } from '../hooks/metadata';

export const ZoneDrawer = ({ selectedObject }) => {
  const { project, updateProject, zb } = useProject();
  const [importOpen, setImportOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [selectedMesh, setSelectedMesh] = useState(selectedObject);
  const [, forceRender] = useState({});
  const editing = useRef(false);
  const { openAlert } = useAlertContext();

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
  }, [zb]);

  useEffect(() => {
    if (!selectedMesh) {
      return;
    }
    zb.overlayWireframe(selectedMesh);

    return () => zb.disposeOverlayWireframe();
  }, [selectedMesh, zb]);

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

  const onSave = (presetName, shaderName, properties) => {
    console.log('s', shaderName, properties);
    updateProject(newZone => {
      if (!newZone.materialMetadata) {
        newZone.materialMetadata = {};
      }
  
      if (!selectedMesh.metadata) {
        selectedMesh.metadata = {};
      }
      if (!selectedMesh.metadata.gltf) {
        selectedMesh.metadata.gltf = { extras: {} };
      }
      const shader = {
        presetName,
        name: shaderName,
        properties,
      };
  
  
      newZone.materialMetadata[selectedMesh.name] = shader;
      selectedMesh.metadata.gltf.extras.shaders = [shader];
      return newZone;
    });
    openAlert('Updated Material');
  };

  const materialMetadata = project?.materialMetadata?.[selectedMesh?.name];
  console.log('Material mat', materialMetadata);

  const importZone = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.glb';
      document.body.appendChild(input);

      const fileSelected = new Promise((resolve) => {
        input.onchange = () => {
          const file = input.files[0];
          resolve(file);
        };
      });

      input.click();
      const file = await fileSelected;
      document.body.removeChild(input);
      if (!file) {
        return;
      }
      const name = file.name.replace('.glb', '');

      const arrayBuffer = await file.arrayBuffer();
      await zb.importZone(arrayBuffer);
      openAlert(`Successfully imported ${name}!`);
      updateProject(p => {
        p.glb = new Uint8Array(arrayBuffer);
        return p;
      });

    } catch (error) {}
  };

  return (
    <Stack direction="column" sx={{ height: '90%' }}>
      {materialOpen && (
        <MaterialDialog
          initialShader={materialMetadata?.presetName}
          initialProperties={materialMetadata?.properties}
          onSave={onSave}
          open={materialOpen}
          setOpen={setMaterialOpen}
          material={selectedMesh?.material}
        />
      )}

      <Box>
        <Button
          fullWidth
          variant={'outlined'}
          sx={{ margin: '10px auto' }}
          onClick={() => importZone()}
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
          onClick={() => zb.exportZone(true)}
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
            sx={{ margin: '10px 0' }}
            disabled={!selectedMesh}
            control={
              <Checkbox
                checked={Boolean(meshMetadata?.passThrough)}
                onChange={handleCheckboxChange}
              />
            }
            label="Player Passthrough"
          />
          <Button
            onClick={() => setMaterialOpen(true)}
            sx={{ color: 'text.primary' }}
            variant="outlined"
          >
            Material Shaders [{materialMetadata?.presetName ?? 'Basic'}]
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
};
