import React from 'react';
import { Box, Stack } from '@mui/material';
import './nav.scss';

export const NavHeader = ({ children, offset = false, minWidth = '400px' }) => {
  const bgOptions = {
    minWidth: `calc(${minWidth} + 4px)`,
  };
  const options = { minWidth };
  if (offset) {
    bgOptions.left = 'calc(25vw - 252px) !important';
    options.left = 'calc(25vw - 250px) !important';
  }
  return (
    <>
      <Box className="builder-header-bg" sx={bgOptions} />
      <Box className="builder-header" sx={options}>
        <Box
          sx={{
            padding: '12px 8vw',
          }}
        >
          <Stack
            direction="row"
            justifyContent={'center'}
            alignContent={'center'}
            alignItems={'center'}
          >
            {children}
          </Stack>
        </Box>
      </Box>
    </>
  );
};
