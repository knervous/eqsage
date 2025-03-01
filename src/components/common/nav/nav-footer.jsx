import React from 'react';
import { Box, Stack } from '@mui/material';
import './nav.scss';

export const NavFooter = ({ children, offset = false, minWidth = '400px', height = '80px' }) => {
  const bgOptions = {
    minWidth: `calc(${minWidth} + 4px)`,
    height  : `calc(${height} + 2px)`,
  };
  const options = { minWidth, height };
  if (offset) {
    bgOptions.left = 'calc(25% - 252px) !important';
    options.left = 'calc(25% - 250px) !important';
  }
  return (
    <>
      <Box className="builder-footer-bg" sx={bgOptions} />
      <Box className="builder-footer" sx={options}>
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
