import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Chip, FormControl, Stack } from '@mui/material';
import './overlay.scss';
import { useMainContext } from '../main/context';

export const DevOverlay = ({ doProcessZone }) => {
  const ref = useRef(null);
  const [, forceRender] = useState({});
  const { recentList, setRecentList } = useMainContext();
  useEffect(() => {
    const listener = () => forceRender({});
    window.addEventListener('resize', listener);
    return () => window.removeEventListener('resize', listener);
  }, []);

  const select = useCallback(zone => {
    doProcessZone(zone);
  }, [doProcessZone]);
  return (
    <Box
      ref={ref}
      sx={{
        position: 'fixed',
        top     : 5,
        left    : '320px',
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
