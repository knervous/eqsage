import React, { useCallback, useState } from 'react';
import Joyride from 'react-joyride';

import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CommonDialog } from '../spire/dialogs/common';
import { useAlertContext } from '@/context/alerts';
import { quailProcessor } from '@/modules/quail';
import { GlobalStore } from '@/state';

export const QuailDialog = ({ onClose }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [overwrite, setOverWrite] = useState(false);
  const { openAlert } = useAlertContext();
  const selectFile = useCallback(async () => {
    const [file] = await window
      .showOpenFilePicker({
        types: [
          {
            description: 'EverQuest S3D File',
            accept     : {
              'application/octet-stream': ['.s3d'],
            },
          },
        ],
      })
      .catch(() => []);
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  const selectFolder = useCallback(async () => {
    const handle = await window.showDirectoryPicker().catch(() => null);
    if (handle?.kind === 'directory') {
      await handle.requestPermission({
        mode: 'readwrite',
      });
      setSelectedFolder(handle);
    } else {
      console.warn('Selected handle is not a directory.');
    }
  }, []);
  const process = useCallback(async () => {
    if (!selectedFile || !selectedFolder) {
      return;
    }
    const name = selectedFile.name
      .replace('.eqg', '.quail')
      .replace('.s3d', '.quail');
    const exists = await selectedFolder
      .getDirectoryHandle(name)
      .catch(() => null);
    if (exists && !overwrite) {
      openAlert(
        `Folder already exists in parent: ${name}. Choose another parent folder.`,
        'warning'
      );
      return;
    } else if (exists && overwrite) {
      await selectedFolder.removeEntry(name, { recursive: true });
    }
    GlobalStore.actions.setLoading(true);
    GlobalStore.actions.setLoadingTitle('Processing...');
    GlobalStore.actions.setLoadingText('Creating Quail folder');
    await quailProcessor.createQuail(selectedFile, selectedFolder, name);
    GlobalStore.actions.setLoading(false);
    openAlert(`Successfully created Quail folder: ${name}`);
  }, [selectedFile, selectedFolder, openAlert, overwrite]);
  const createDisabled = selectedFile === null || selectedFolder === null;
  return (
    <CommonDialog
      onClose={onClose}
      additionalButtons={[
        <Button
          disabled={createDisabled}
          variant="outlined"
          sx={createDisabled ? { color: 'gray !important' } : {}}
          onClick={process}
        >
          Create Quail Folder
        </Button>,
      ]}
      title={'Create Quail Folder'}
    >
      <Box sx={{ minWidth: '350px', minHeight: '100px' }}>
        <Typography
          sx={{ textAlign: 'center', fontSize: '16px', lineHeight: '40px' }}
        >
          Choose an S3D or EQG file to create a .quail folder with WCE files.{' '}
        </Typography>
        <Divider sx={{ margin: '15px', marginBottom: '25px' }} />
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'center' }}
        >
          <Typography
            sx={{ textAlign: 'center', fontSize: '16px', lineHeight: '40px' }}
          >
            Selected File: {selectedFile?.name ?? 'None'}
          </Typography>
          <Button variant="outlined" onClick={selectFile}>
            Select S3D/EQG
          </Button>
        </Stack>

        <Stack
          direction="row"
          sx={{
            justifyContent: 'space-between',
            alignItems    : 'center',
            margin        : '10px 0',
          }}
        >
          <Typography
            sx={{ textAlign: 'center', fontSize: '16px', lineHeight: '40px' }}
          >
            Parent Folder: {selectedFolder?.name ?? 'None'}
          </Typography>
          <Button variant="outlined" onClick={selectFolder}>
            Select Folder
          </Button>
        </Stack>
        <FormControlLabel
          control={
            <Checkbox
              disabled={createDisabled}
              checked={overwrite}
              onChange={({ target: { checked } }) => setOverWrite(checked)}
            />
          }
          label="Overwrite Existing Directory"
        />
      </Box>
    </CommonDialog>
  );
};
