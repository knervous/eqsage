import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Chip, FormControl, Stack } from '@mui/material';
import './overlay.scss';
import { useMainContext } from '../main/context';
import { processZone } from '../zone/processZone';

export const DevOverlay = ({ refresh }) => {
  const ref = useRef(null);
  const [, forceRender] = useState({});
  const { recentList, setRecentList, gameController, rootFileSystemHandle } = useMainContext();
  useEffect(() => {
    const listener = () => forceRender({});
    window.addEventListener('resize', listener);
    return () => window.removeEventListener('resize', listener);
  }, []);
  const doProcessZone = useCallback(
    async (zone) => {
      const didProcess = await processZone(
        zone.short_name,
        gameController.settings,
        rootFileSystemHandle,
        true
      );
      if (
        didProcess &&
        !recentList.some((a) => a.short_name === zone.short_name)
      ) {
        setRecentList((l) => [...l, zone]);
        // localStorage.setItem('recent-zones', JSON.stringify(recentList));
      }
      await refresh();
      gameController.SpawnController.clearAssetContainer();
    },
    [
      rootFileSystemHandle,
      recentList,
      setRecentList,
      refresh,
      gameController,
    ]
  );
  const select = useCallback(zone => {
    doProcessZone(zone);
  }, [doProcessZone]);
  return (
    <Box
      ref={ref}
      sx={{
        position: 'fixed',
        top     : 5,
        right   : '0px',
        zIndex  : 10,
        width   : 'auto',
      }}
    >
      <FormControl sx={{ maxWidth: '200px' }}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {recentList.map((zone) => (
            <Chip
              key={`chip-${zone.id}`}
              label={`${zone.short_name}`.trim()}
              variant="outlined"
              onClick={() => select(zone)}
              onDelete={() => {
                setRecentList((l) => l.filter((z) => z.id !== zone.id));
              }}
            />
          ))}
        </Stack>
      </FormControl>
    </Box>
  );
};
