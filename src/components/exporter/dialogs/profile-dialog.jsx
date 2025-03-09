import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Link,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMainContext } from '@/components/main/context';
import { useAlertContext } from '@/context/alerts';
import { useSettingsContext } from '@/context/settings';
import { writeEQFile } from 'sage-core/util/fileHandler';
import { getEQDir, getFiles, deleteEqFileOrFolder } from 'sage-core/util/fileHandler';
import DeleteForever from '@mui/icons-material/DeleteForever';
import { useConfirm } from 'material-ui-confirm';

export const ProfileDialog = ({ open, onClose }) => {
  const [id, setId] = useState('');
  const { Spire } = useMainContext();
  const { openAlert } = useAlertContext();
  const { config, selectedModel, selectedType, setOption, location, selectedName } =
    useSettingsContext();
  const confirm = useConfirm();
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(-1);

  const refresh = useCallback(async () => {
    const profileDir = await getEQDir('profiles');
    if (profileDir) {
      const files = await getFiles(profileDir, (f) => f.endsWith('.json'));
      setProfiles(files.sort((a, b) => a.name > b.name ? 1 : -1));
    }
  }, []);

  const save = useCallback(async () => {
    const profile = {
      config,
      selectedModel,
      selectedType,
      location,
      selectedName,
    };
    const name = config.name ?? 'Untitled';
    await writeEQFile('profiles', `${name}.json`, JSON.stringify(profile));
    await refresh();
    openAlert(`Saved profile ${name}`);
  }, [config, selectedModel, selectedType, refresh, openAlert, location, selectedName]);

  const load = useCallback(async () => {
    try {
      const file = await profiles[selectedProfile]
        .getFile()
        .then((b) => b.text());
      const profile = JSON.parse(file);
      localStorage.setItem(
        profile.selectedModel,
        JSON.stringify(profile.config)
      );
      for (const [key, value] of Object.entries(profile)) {
        setOption(key, value);
      }
    } catch (e) {
      console.log('Error loading profile', e);
      openAlert('Error loading selected profile', 'warning');
    }
  }, [selectedProfile, profiles, openAlert, setOption]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Dialog
      className="ui-dialog"
      maxWidth="lg"
      open={open}
      onClose={onClose}
      aria-labelledby="profile-dialog-title"
    >
      <DialogTitle
        className="ui-dialog-title"
        style={{ cursor: 'move', margin: '0 auto' }}
        id="profile-dialog-title"
      >
        Profiles
      </DialogTitle>
      <DialogContent
        sx={{
          minWidth : '400px',
          minHeight: '200px',
        }}
      >
        <List
          component="nav"
          sx={{
            border   : '1px solid rgba(255,255,255,0.1)',
            maxHeight: '400px',
            width    : '100%',
            minHeight: '200px',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding  : 0,
          }}
          subheader={
            !profiles.length ? (
              <ListSubheader sx={{ background: 'transparent' }} component="div">
                No Saved Profiles
              </ListSubheader>
            ) : null
          }
        >
          {profiles.map((profile, idx) => (
            <Stack justifyContent={'space-around'} direction="row">
              <ListItemButton
                sx={{
                  margin: '5px',
                  background:
                    idx === selectedProfile
                      ? 'rgba(0,0,0,0.4)'
                      : 'rgba(0,0,0,0.0)',
                }}
                onClick={() => {
                  setSelectedProfile(idx);
                }}
              >
                <Typography
                  sx={{
                    display     : 'block',
                    whiteSpace  : 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow    : 'hidden',
                    width       : '200px',
                  }}
                  title={`${profile.name.replace('.json', '')}`}
                >
                  {profile.name.replace('.json', '')}
                </Typography>
              </ListItemButton>
              <ListItemButton
                onClick={() => {
                  confirm({
                    description: 'Are you sure you want to delete this profile?',
                    title      : 'Delete Profile',
                  }).then(async () => {
                    await deleteEqFileOrFolder('profiles', profile.name);
                    await refresh();
                  }).catch(() => {});
                }}
                sx={{
                  maxWidth   : '50px',
                  width      : '30px',
                  padding    : 0,
                  margin     : 0,
                  marginRight: '5px',
                }}
              >
                <DeleteForever sx={{ margin: '0 auto' }}></DeleteForever>
              </ListItemButton>
            </Stack>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={save}>
          Save Current ({config?.name ?? 'Untitled'})
        </Button>
        <Button disabled={selectedProfile === -1} onClick={load}>
          Load
        </Button>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
};
