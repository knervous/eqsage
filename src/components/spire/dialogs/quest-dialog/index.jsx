import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Link,
  Stack,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import * as keyval from 'idb-keyval';
import { useConfirm } from 'material-ui-confirm';

import { PaperComponent } from '../common';
import {
  PermissionStatusTypes,
  usePermissions,
} from 'sage-core/hooks/permissions';
import classNames from 'classnames';
import { QuestEditor } from './quest-editor';

import './quest-dialog.scss';

// Module scope only load on the first show
let shown = false;

export const QuestDialog = ({ onClose, open }) => {
  const [permissionStatus, onDrop, requestPermissions, fsHandle] =
    usePermissions('dotnet_quests');
  const [demo, setDemo] = useState(false);
  const [, forceRender] = useState({});
  const confirm = useConfirm();
  const ready = useMemo(
    () => permissionStatus === PermissionStatusTypes.Ready,
    [permissionStatus]
  );
  useEffect(() => {
    if (open && !shown) {
      shown = true;
      forceRender({});
    }
  }, [open]);
  return (
    <Dialog
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
      open
      className={open ? 'ui-dialog quest-editor-open' : 'ui-dialog quest-editor-closed'}
      disableEnforceFocus
      fullWidth
      maxWidth={ready || demo ? 'lg' : 'sm'}
      sx={{ pointerEvents: 'none' }}
      slotProps={{ backdrop: { sx: { pointerEvents: 'none' } } }}
      hideBackdrop
      PaperComponent={PaperComponent}
      aria-labelledby="draggable-dialog-title"
    >
      <DialogTitle
        className="ui-dialog-title"
        style={{ cursor: 'move' }}
        id="draggable-dialog-title"
      >
        DotNet Quests
      </DialogTitle>
      <DialogContent className="quest-dialog">
        <div
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Stack
            alignContent="center"
            justifyContent="space-between"
            direction="row"
            spacing={1}
          ></Stack>
          {/** Has permissions */}
          {shown && <QuestEditor demo={demo} fsHandle={fsHandle} ready={ready} />}
          {!demo && permissionStatus === PermissionStatusTypes.ApiUnavailable && (
            <Typography
              sx={{ fontSize: 17, marginBottom: 2 }}
              color="text.secondary"
              gutterBottom
            >
              Unfortunately, your browser does not support the required
              permissions to the File System. Visit{' '}
              <Link
                target="_blank"
                href="https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission"
              >
                this link
              </Link>{' '}
              to learn more about which browsers are supported.
            </Typography>
          )}
          {!demo && permissionStatus === PermissionStatusTypes.NeedRefresh && (
            <Stack alignContent={'center'}>
              <Typography
                sx={{ fontSize: 18, marginBottom: 2, textAlign: 'center' }}
                color="text.primary"
                gutterBottom
              >
                Linked DotNet Quests Directory: {fsHandle?.name}.
              </Typography>
              <Typography
                sx={{ fontSize: 17, marginBottom: 2 }}
                color="text.secondary"
                gutterBottom
              >
                Your browser needs to request permission to access files for
                decoding. This will grant the ability to view and edit files
                from
                <b>{fsHandle?.name}/eqsage</b>.
              </Typography>
              <Button
                variant="outlined"
                sx={{ margin: '25px' }}
                onClick={requestPermissions}
              >
                Request Permissions
              </Button>
              <Typography
                sx={{ fontSize: 17, marginBottom: 2 }}
                color="text.secondary"
                gutterBottom
              >
                If you want to grant persistent permissions and are using
                Chrome, you can enable the{' '}
                <b>#file-system-access-persistent-permission</b> flag under{' '}
                <b>chrome://flags</b>. Once enabled, you need to restart your
                browser for this to take effect.
              </Typography>
              <Box className="chrome-flags" sx={{ width: '100%' }} />
            </Stack>
          )}
          {!demo && permissionStatus === PermissionStatusTypes.NeedEQDir && (
            <Stack
              direction={'column'}
              sx={{
                justifyContent: 'center !important',
                alignItems    : 'center',
                alignContent  : 'center',
              }}
            >
              <Typography
                sx={{ fontSize: 17, marginBottom: 2 }}
                color="text.secondary"
                gutterBottom
              >
                Drag and drop a dotnet_quests directory on the page to get
                started. The directory must be mounted to your local file
                system. To achieve this on a remote system, e.g. Linux, you will
                need to install Samba on the machine and mount through accessing
                smb://your-ip, then dragging or selecting the directory to this page.
              </Typography>
              <Button
                onClick={async () => {
                  try {
                    const dirHandle = await window.showDirectoryPicker();
                    onDrop(dirHandle);
                  } catch (e) {
                    console.warn(e);
                  }
                }}
         
                sx={{ margin: '0 auto' }}
              >
                Choose Directory
              </Button>
              <Button
                onClick={async () => {
                  setDemo(true);
                }}
           
                sx={{ margin: '5px auto' }}
              >
                Try Demo
              </Button>
            </Stack>
          )}
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          className={classNames('ui-dialog-btn')}
          autoFocus
          onClick={() => {
            confirm({ description: 'Are you sure you want to unlink your Quests directory?', title: 'Unlink Quests Directory' })
              .then(() => {
                if (window.electronAPI) {
                  localStorage.removeItem('dotnet_quests');
                  window.location.reload();
                } else {
                  keyval.del('dotnet_quests').then(() => {
                    window.location.reload();
                  });
                }
              })
              .catch(() => {
              /* ... */
              });
          }}
        >
          Unlink Quests Directory
        </Button>
        <Button
          className={classNames('ui-dialog-btn')}
          autoFocus
          onClick={() => onClose(true)}
        >
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};
