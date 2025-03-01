import React, { useMemo } from 'react';
import { Box, Stack } from '@mui/material';
import './nav.scss';

export const NavRight = ({ children, height = '70%', navHeight = 80 }) => {
  const top = useMemo(() => (100 - navHeight) / 2, [navHeight]);
  return (
    <>
      <Box
        className="builder-right-nav-bg"
        sx={{
          top   : `calc(${top}vh - 3px)`,
          height: `calc(${navHeight}vh + 6px)`,
        }}
      />
      <Box
        sx={{
          top: `${top}vh`,

          height: `${navHeight}vh`,
        }}
        className="builder-right-nav"
      >
        <Stack
          sx={{ height, marginTop: '100%' }}
          direction={'column'}
          justifyContent={'space-evenly'}
          alignItems={'center'}
        >
          {children}
        </Stack>
      </Box>
    </>
  );
};
