import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Button,
  FormControl,
  Input,
  InputAdornment,
  InputLabel,
} from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import { gameController } from '../../viewer/controllers/GameController';

import { useOverlayContext } from './provider';
import { ExportDialog } from './export-dialog';
import { useAlertContext } from '../../context/alerts';
import { useProject } from './hooks/metadata';
import { ExportS3DDialog } from './export-s3d-dialog';
import { DebugDialog } from './debug-dialog';
import { NavHeader } from '../common/nav/nav-header';

export const BuilderHeader = () => {
  const { saveProject, project } = useProject();
  const { openDrawer, goHome, toggleDrawer } = useOverlayContext();
  const [exportOpen, setExportOpen] = useState(false);
  const [exportS3DOpen, setExportS3DOpen] = useState(false);
  const [name, setName] = useState(project.projectName);
  const { openAlert } = useAlertContext();

  const doExport = useCallback(() => {
    toggleDrawer('');
    setExportOpen(true);
  }, [toggleDrawer]);

  const doExportS3D = useCallback(() => {
    toggleDrawer('');
    setExportS3DOpen(true);
  }, [toggleDrawer]);

  useEffect(() => {
    gameController.ZoneBuilderController.name = `${name}.eqs`;
  }, [name, openAlert]);
  return (
    <>
      <ExportDialog open={exportOpen} setOpen={setExportOpen} />
      <ExportS3DDialog open={exportS3DOpen} setOpen={setExportS3DOpen} />
      {/* {import.meta.env.VITE_LOCAL_DEV === 'true' ? <DebugDialog /> : null} */}
      <NavHeader offset={openDrawer}>
        <FormControl
          size="small"
          variant="standard"
          sx={{ marginRight: '7.5vw' }}
        >
          <InputLabel>Project Name</InputLabel>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            startAdornment={
              <InputAdornment position="start">
                <ConstructionIcon />
              </InputAdornment>
            }
          />
        </FormControl>
        <Button
          size={'small'}
          sx={{ height: '40px', width: '150px', margin: '0 10px' }}
          variant="outlined"
          onClick={saveProject}
        >
              Save Project
        </Button>
        <Button
          size={'small'}
          sx={{ height: '40px', width: '150px', margin: '0 10px' }}
          variant="outlined"
          onClick={doExport}
        >
              Export EQG
        </Button>
        <Button
          size={'small'}
          sx={{ height: '40px', width: '150px' }}
          variant="outlined"
          onClick={doExportS3D}
        >
              Export S3D
        </Button>
        <Button
          size={'small'}
          sx={{ height: '40px', width: '50px', margin: '0 10px' }}
          variant="outlined"
          onClick={goHome}
        >
              Home
        </Button>

      </NavHeader>
    </>
  );
};
