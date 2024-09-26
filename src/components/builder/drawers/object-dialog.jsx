import React, { useEffect } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  Stack,
  Typography,
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import YouTubeIcon from '@mui/icons-material/YouTube';
import CodeIcon from '@mui/icons-material/Code';
import { useModels } from '../hooks/model';
import './object-dialog.scss';
import { useZoneBuilderContext } from '../context';
import { useAlertContext } from '../../../context/alerts';

const Link = ({ Icon, text, link }) => (
  <Stack className="hover-link" direction="row">
    <Icon />
    <Typography
      onClick={() => window.open(link, '_blank')}
      sx={{ marginLeft: '10px', userSelect: 'none', fontSize: '15px' }}
      gutterBottom
    >
      {text}
    </Typography>
  </Stack>
);

export const ObjectDialog = ({ open, setOpen, models: modelNames }) => {
  const { models, refresh } = useModels();
  const {
    zone,
    updateProject,
  } = useZoneBuilderContext();
  const { openAlert } = useAlertContext();
  console.log('models', models);

  useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open]); // eslint-disable-line
  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={open}
      onClose={() => setOpen(false)}
      aria-labelledby="draggable-dialog-title"
    >
      <DialogTitle style={{ margin: '0 auto' }} id="draggable-dialog-title">
        Import / Upload Model File
      </DialogTitle>
      <DialogContent className="about-content">
        <List sx={{ maxHeight: '300px' }}>
          {models.map((m) =>
            modelNames.includes(m.name.replace('.glb', '')) ? null : (
              <ListItemButton onClick={async () => {
                const arrayBuffer = await m.getFile().then(f => f.arrayBuffer());
                const name = m.name.replace('.glb', '');
                const newZone = zone;
                newZone.modelFiles[name] = new Uint8Array(arrayBuffer);
                newZone.metadata.objects[name] = [];
                openAlert(`Successfully imported ${name}!`);
                updateProject(newZone);
              }}>{m.name}</ListItemButton>
            )
          )}
        </List>
      </DialogContent>
      <DialogActions disableSpacing sx={{ margin: '0 auto' }}>
        <Button
          sx={{ color: 'white' }}
          autoFocus
          onClick={() => setOpen(false)}
        >
          Finished
        </Button>
      </DialogActions>
    </Dialog>
  );
};
