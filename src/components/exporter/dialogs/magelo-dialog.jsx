import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListSubheader,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useAlertContext } from '@/context/alerts';
import { ItemApi } from 'spire-api/api/item-api';
import { useSettingsContext } from '@/context/settings';

// 4304412

function hexToRgbaNumber(hex) {
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }

  if (hex.length !== 6) {
    throw new Error('Invalid hex color format. Expected format: "#rrggbb".');
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const a = 255;
  return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
}

export const MageloDialog = ({ open, onClose }) => {
  const [id, setId] = useState('123895');
  const { openAlert } = useAlertContext();
  const { config, setOption } = useSettingsContext();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setProfile(null);
  }, [open]);
  const fetchMageloProfile = useCallback(async () => {
    setProfile(null);
    setLoading(true);
    const mageloResult = await fetch('/api/magelo/', {
      headers: {
        'x-remote-api' : 'https://eq.magelo.com',
        'x-remote-path': `/profile/${id}`,
      },
    })
      .then((r) => r.text())
      .then(async (t) => {
        let arr;
        const results = [];
        const regex = /items\[(\d+)\] = new Item\((\d+),'([^,]*)',(\d+)/gm;
        while ((arr = regex.exec(t))) {
          if (!arr) {
            break;
          }
          const [slotId, itemId, itemName, itemIcon] = arr.slice(1, arr.length);
          results.push({
            slotId  : +slotId,
            itemId  : +itemId,
            itemName,
            itemIcon: +itemIcon,
          });
        }
        const domParser = new DOMParser();
        const dom = domParser.parseFromString(t, 'text/html');
        const pieces = {
          Helm     : null,
          Chest    : null,
          Arms     : null,
          Wrists   : null,
          Hands    : null,
          Legs     : null,
          Feet     : null,
          Primary  : null,
          Secondary: null,
        };
        const Spire = window.Spire;
        const itemApi = new ItemApi(...Spire.SpireApi.cfg());
        const pieceMap = {
          Helm     : 2,
          Chest    : 17,
          Arms     : 7,
          Wrists   : 9,
          Hands    : 12,
          Legs     : 18,
          Feet     : 19,
          Primary  : 13,
          Secondary: 14,
        };
        await Promise.all(
          Object.keys(pieces).map(async (piece) => {
            const associatedResult = results.find(
              (r) => r.slotId === pieceMap[piece]
            );
            if (!associatedResult) {
              return;
            }

            const queryBuilder = new Spire.SpireQueryBuilder();
            queryBuilder.where('id', '=', associatedResult.itemId);
            queryBuilder.limit(1);

            const result = await itemApi.listItems(queryBuilder.get());
            if (result?.data?.length) {
              const item = result.data[0];
              console.log('ITEM', piece, item);
              pieces[piece] = {
                name   : item.name,
                icon   : item.icon,
                idfile : item.idfile,
                texture: item.material ?? 0,
                model  : item.idfile.toLowerCase(),
                color:
                  item.color === 4278190080
                    ? hexToRgbaNumber('#FFFFFF')
                    : item.color,
                shieldPoint: item.itemtype === 8,
              };
            } else {
              pieces[piece] = -1;
            }
          })
        );
        return {
          pieces,
          title: dom.title,
        };
      })
      .catch(() => null)
      .finally(() => {
        setLoading(false);
      });
    if (!mageloResult) {
      openAlert(`Error fetching Magelo profile ${id}`, 'warning');
      return;
    }
    setProfile(mageloResult);
  }, [id, openAlert]);

  const doImport = async () => {
    setOption('config', {
      ...config,
      pieces: profile.pieces,
      name  : profile.title?.split(' -')?.[0] ?? '',
    });
    onClose();
  };
  return (
    <Dialog
      className="ui-dialog"
      maxWidth="md"
      open={open}
      onClose={onClose}
      aria-labelledby="draggable-dialog-title"
    >
      <DialogTitle
        className="ui-dialog-title"
        style={{ cursor: 'move', margin: '0 auto' }}
        id="draggable-dialog-title"
      >
        Magelo Profile Importer
      </DialogTitle>
      <DialogContent
        sx={{
          minWidth : '300px',
          minHeight: '100px',
        }}
      >
        <Stack
          sx={{ margin: '15px 0' }}
          justifyContent={'center'}
          alignContent={'center'}
          direction="row"
        >
          <TextField
            onChange={(e) => setId(e.target.value)}
            label="Enter Magelo ID"
            value={id}
          ></TextField>
          <Button
            disabled={!id.length || loading}
            sx={{ minWidth: '100px', marginLeft: '10px' }}
            onClick={fetchMageloProfile}
          >
            {loading ? <CircularProgress /> : 'Search'}
          </Button>
        </Stack>
        {profile ? (
          <Box>
            <Divider sx={{ margin: '10px 10px' }}></Divider>
            <Typography sx={{ margin: '5px', textAlign: 'center' }}>{profile.title}</Typography>

            <List
              dense
              subheader={
                <ListSubheader sx={{ background: 'transparent', marginTop: '15px' }} component='div'>
                </ListSubheader>
              }>
              {Object.entries(profile.pieces).map(([piece, item]) => (
                <ListItem dense sx={{ margin: '0px', fontSize: '14px', textAlign: 'justify' }}>
                  <ListItemText>
                    {piece}:{' '}
                    {item === null
                      ? 'None'
                      : item === -1
                        ? 'Unavailable'
                        : item.name}
                  </ListItemText>
            
                </ListItem>
              ))}  
            </List>

          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button disabled={!profile} onClick={doImport}>Import</Button>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};
