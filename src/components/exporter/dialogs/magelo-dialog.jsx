import React, { useCallback, useEffect, useState } from 'react';
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
import { useMainContext } from '@/components/main/context';
import { useAlertContext } from '@/context/alerts';

export const MageloDialog = ({ open, onClose }) => {
  const [id, setId] = useState('');
  const { Spire } = useMainContext();
  const { openAlert } = useAlertContext();

  const fetchMageloProfile = useCallback(async () => {
    const mageloResult = await fetch('/static/magelo/', {
      headers: {
        'x-remote-api': `https://eq.magelo.com', ['x-remote-path']: '/profile/${id}`,
      },
    })
      .then((r) => r.text())
      .then((t) => {
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
        return {
          results,
          title: dom.title,
        };
      }).catch(() => null);
    if (!mageloResult) {
      openAlert(`Error fetching Magelo profile ${id}`, 'warning');
      return;
    }

    const r = 123;
  }, [Spire, id, openAlert]);
  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={open}
      onClose={onClose}
      aria-labelledby="draggable-dialog-title"
    >
      <DialogTitle
        style={{ cursor: 'move', margin: '0 auto' }}
        id="draggable-dialog-title"
      >
        Magelo Profile Importer
      </DialogTitle>
      <DialogContent>
        <div>Hello</div>
      </DialogContent>
    </Dialog>
  );
};
