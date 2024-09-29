import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';

import { useZoneModels } from '../hooks/model';
import { useZoneBuilderContext } from '../context';
import { useAlertContext } from '../../../context/alerts';

import './object-dialog.scss';

export const ObjectDialog = ({ open, setOpen, models: modelNames }) => {
  const { zoneModels, doRefresh } = useZoneModels(modelNames);
  const [selectedZone, setSelectedZone] = useState(zoneModels);
  const { zone, updateProject } = useZoneBuilderContext();
  const { openAlert } = useAlertContext();
  const handleItemClick = (name) => {
    setSelectedZone(name);
  };
  useEffect(() => {
    if (open) {
      doRefresh();
    }
  }, [open]); // eslint-disable-line
  return (
    <Dialog
      fullWidth
      maxWidth="md"
      open={open}
      onClose={() => setOpen(false)}
      aria-labelledby="draggable-dialog-title"
    >
      <DialogTitle style={{ margin: '0 auto' }} id="draggable-dialog-title">
        Import New Model
      </DialogTitle>
      <DialogContent
        sx={{ maxHeight: '400px', overflowY: 'hidden' }}
        className="about-content"
      >
        <Stack direction="row">
          <List
            component="nav"
            sx={{
              border   : '1px solid rgba(255,255,255,0.1)',
              maxHeight: '400px',
              width    : '250px',
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {Object.entries(zoneModels).map(([key, models]) => (
              <ListItemButton
                sx={{
                  background:
                    key === selectedZone
                      ? 'rgba(0,0,0,0.3)'
                      : 'rgba(0,0,0,0.2)',
                }}
                onClick={() => handleItemClick(key)}
              >
                <Typography
                  sx={{
                    display     : 'block',
                    whiteSpace  : 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow    : 'hidden',
                    width       : '200px',
                  }}
                  title={`${key} (${models.length})`}
                >
                  {`${key} (${models.length})`}
                </Typography>
              </ListItemButton>
            ))}
          </List>
          <List
            component="nav"
            sx={{
              border   : '1px solid rgba(255,255,255,0.1)',
              maxHeight: '400px',
              width    : 'calc(100% - 250px)',
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {zoneModels[selectedZone]
              ?.filter((m) => !modelNames.includes(m.name.replace('.glb', '')))
              .map((m) => (
                <ListItemButton
                  onClick={async () => {
                    const arrayBuffer = await m
                      .getFile()
                      .then((f) => f.arrayBuffer());
                    const name = m.name.replace('.glb', '');
                    const newZone = zone;
                    newZone.modelFiles[name] = new Uint8Array(arrayBuffer);
                    newZone.metadata.objects[name] = [];
                    openAlert(`Successfully imported ${name}!`);
                    updateProject(newZone);
                  }}
                >
                  <ListItemText>{m.name}</ListItemText>
                </ListItemButton>
              ))}
          </List>
        </Stack>
      </DialogContent>
      <DialogActions disableSpacing sx={{ margin: '5px' }}>
        <Button
          variant="outlined"
          sx={{ color: 'white', padding: '8px' }}
          autoFocus
          onClick={async () => {
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
              let name = file.name.replace('.glb', '');
              const newZone = zone;

              if (newZone.modelFiles[name]) {
                name = `${name}1`;
                openAlert(
                  `Already have a model defined ${name}. Renaming to ${name}`,
                  'warning'
                );
              }
              const arrayBuffer = await file.arrayBuffer();
              newZone.modelFiles[name] = new Uint8Array(arrayBuffer);
              newZone.metadata.objects[name] = [];
              openAlert(`Successfully imported ${name}!`);
              updateProject(newZone);
            } catch (error) {}
          }}
        >
          Import from Disk
        </Button>
        <Button
          variant="outlined"
          sx={{ color: 'white', padding: '8px', marginLeft: '10px' }}
          autoFocus
          onClick={() => setOpen(false)}
        >
          Finished
        </Button>
      </DialogActions>
    </Dialog>
  );
};
