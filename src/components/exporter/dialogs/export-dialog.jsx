import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { CommonDialog } from '../../../components/spire/dialogs/common';

export const ExportDialog = ({ onClose }) => {
  const [withAnimations, setWithAnimations] = useState(false);
  const [exportType, setExportType] = useState('glb');
  const [imgCompression, setImgCompression] = useState('png');
  const doExport = useCallback(() => {
    switch (exportType) {
      case 'glb': {
        window.gameController.SpawnController.exportModel(withAnimations, true, imgCompression);
        break;
      }
      case 'stl': {
        window.gameController.SpawnController.exportSTL();
        break;
      }
      case 'fbx': {
        window.gameController.SpawnController.exportFBX(imgCompression);

        break;
      }
      default:
        break;
    }
  }, [exportType, withAnimations, imgCompression]);

  useEffect(() => {
    if (exportType !== 'glb') {
      setWithAnimations(false);
    }
  }, [exportType]);
  return (
    <CommonDialog additionalButtons={[
      <Button onClick={doExport} variant='outlined'>
        Export
      </Button>
    ]} onClose={onClose} title={'Export'}>
      <Stack justifyContent="center" direction="column" sx={{ minWidth: '300px', minHeight: '100px' }}>
        <FormControl sx={{ margin: '10px 0px' }}>
          <Typography sx={{ margin: '3px 0' }}>Export Type</Typography>
          <Select
            value={exportType}
            fullWidth
            onChange={(e) => setExportType(e.target.value)}
            size={'small'}
          >
            <MenuItem value="glb">GLB (Binary GLTF)</MenuItem>
            <MenuItem value="stl">STL (3D Printing)</MenuItem>
            <MenuItem value="fbx">FBX (AutoDesk)</MenuItem>
          </Select>
        </FormControl>
        <FormGroup>
          <FormControlLabel
            disabled={exportType !== 'glb'}
            control={
              <Checkbox
                defaultChecked
                checked={withAnimations}
                onChange={(e) => setWithAnimations(e.target.checked)}
              />
            }
            label="With Animations"
          />
        </FormGroup>
        <FormControl size={'small'}>
          <Typography sx={{ margin: '3px 0' }}>Export Image Compression</Typography>
          <Select
            onChange={(e) => setImgCompression(e.target.value)}
            value={imgCompression}
          >
            <MenuItem value={'webp'}>webp</MenuItem>
            <MenuItem value={'png'}>png</MenuItem>
            <MenuItem value={'jpeg'}>jpeg</MenuItem>
            <MenuItem value={'avif'}>avif</MenuItem>
          </Select>
        </FormControl>

      </Stack>
    </CommonDialog>
  );
};
