import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { gameController } from '../../viewer/controllers/GameController';
import { PermissionStatusTypes } from '../../hooks/permissions';
import './status-dialog.scss';

export const StatusDialog = ({
  open,
  permissionStatus,
  requestPermissions,
  onDrop,
}) => {
  const [_type, setType] = useState('unknown');

  useEffect(() => {
    setTimeout(() => {
      if (gameController.Spire) {
        setType('spire');
      }
    }, 150);
  }, []);

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={open}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={onDrop}
      onClose={() => {}}
      aria-labelledby="draggable-dialog-title"
    >
      <DialogTitle
        style={{ cursor: 'move', margin: '0 auto' }}
        id="draggable-dialog-title"
      >
        Welcome to EQ Sage!
      </DialogTitle>
      <DialogContent
        onDropCapture={(e) => {
          console.log('ok', e);
        }}
        onDragOver={(e) => {
          console.log('odo', e);
        }}
      >
        <div>
          <Stack
            alignContent="center"
            justifyContent="space-between"
            direction="row"
            spacing={1}
          ></Stack>

          <Typography
            sx={{ fontSize: 17, marginBottom: 2 }}
            color="text.secondary"
            gutterBottom
          >
            EQ Sage is a multipurpose tool for converting EQ assets to render in
            the browser.
          </Typography>
          {permissionStatus === PermissionStatusTypes.ApiUnavailable && (
            <Typography
              sx={{ fontSize: 17, marginBottom: 2 }}
              color="text.secondary"
              gutterBottom
            >
              Unfortunately, your browser does not support the required
              permissions to the File System. Visit{' '}
              <Link target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission">
                this link
              </Link>{' '}
              to learn more about which browsers are supported.
            </Typography>
          )}
          {permissionStatus === PermissionStatusTypes.NeedRefresh && (
            <Stack alignContent={'center'}>
              <Typography
                sx={{ fontSize: 18, marginBottom: 2, textAlign: 'center' }}
                color="text.primary"
                gutterBottom
              >
                Linked EQ Directory: {gameController.rootFileSystemHandle?.name}
                .
              </Typography>
              <Typography
                sx={{ fontSize: 17, marginBottom: 2 }}
                color="text.secondary"
                gutterBottom
              >
                Your browser needs to request permission to access files for
                decoding. In addition, decoded files will be written under{' '}
                <b>{gameController.rootFileSystemHandle?.name}/eqsage</b> and
                can be safely deleted at any time.
              </Typography>
              <Button onClick={requestPermissions}>Request Permissions</Button>
              <Typography
                sx={{ fontSize: 17, marginBottom: 2 }}
                color="text.secondary"
                gutterBottom
              >
                If you want to grant persistent permissions and are using Chrome, you can enable
                the <b>#file-system-access-persistent-permission</b> flag under <b>chrome://flags</b>. Once enabled, you need to restart your browser for this to take effect.
              </Typography>
              <Box className="chrome-flags" sx={{ width: '100%' }} />
            </Stack>
          )}
          {permissionStatus === PermissionStatusTypes.NeedEQDir && (
            <Typography
              sx={{ fontSize: 17, marginBottom: 2 }}
              color="text.secondary"
              gutterBottom
            >
              Drag and drop an EQ directory on the page to get started. All
              Windows versions are compatible, but keep in mind availability and
              version of zones related to the database linked, e.g. old Freeport
              vs. new.
            </Typography>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
