import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  FormControl,
  Input,
  InputAdornment,
  InputLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import { gameController } from '../../viewer/controllers/GameController';

import './overlay.scss';
import { useOverlayContext } from './provider';
import { ExportDialog } from './export-dialog';
import { useAlertContext } from '../../context/alerts';

export const BuilderHeader = () => {
  const ref = useRef(null);
  const { openDrawer, zone } = useOverlayContext();
  const [exportOpen, setExportOpen] = useState(false);
  const [name, setName] = useState(zone.projectName);
  const { openAlert } = useAlertContext();

  const doSave = useCallback(() => {
    console.log('do save');
  }, []);

  const doExport = useCallback(() => {
    console.log('do export');
    setExportOpen(true);
  }, []);

  useEffect(() => {
    if (!name.endsWith('.eqs')) {
      openAlert('Project needs to end in .eqs', 'warning');
      setName(n => n.replace(/\..*/, '.eqs'));
      return;
    }
    gameController.ZoneBuilderController.name = name;

  }, [name, openAlert]);
  return (
    <>
      <ExportDialog open={exportOpen} setOpen={setExportOpen} />
      <Box
        className="builder-header-bg"
        sx={
          openDrawer
            ? {
              left: 'calc(25vw - 252px) !important',
            }
            : {}
        }
      />
      <Box
        className="builder-header"
        ref={ref}
        sx={
          openDrawer
            ? {
              left: 'calc(25vw - 250px) !important',
            }
            : {}
        }
      >
        <Box
          sx={{
            padding: '12px 8vw',
          }}
        >
          <Stack
            direction="row"
            justifyContent={'center'}
            alignContent={'center'}
            alignItems={'center'}
          >
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
              onClick={doSave}
            >
              Save Project
            </Button>
            <Button
              size={'small'}
              sx={{ height: '40px', width: '150px' }}
              variant="outlined"
              onClick={doExport}
            >
              Export to EQG
            </Button>
          </Stack>
        </Box>
      </Box>
    </>
  );
};
