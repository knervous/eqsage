import React from 'react';
import { Box, Stack } from '@mui/material';
import './nav.scss';

export const NavHeader = ({ children, offset = false, minWidth = '400px', height = 75, width = 60, sx }) => {
  const bgOptions = {
    minWidth: `calc(${minWidth} + 4px)`,
    height  : `${height + 2}px`,
    width   : `calc(${width}vw + 4px)`,
    left    : `calc(${(100 - width) / 2}vw - 2px)`,
  };
  const options = { 
    minWidth,
    height   : `${height}px`,
    maxHeight: `${height}px`,
    width    : `${width}vw`,
    left     : `${(100 - width) / 2}vw`,

  };
  if (offset) {
    bgOptions.left = 'calc(25vw - 252px) !important';
    options.left = 'calc(25vw - 250px) !important';
  }
  return (
    <>
      <Box className="builder-header-bg" sx={bgOptions} />
      <Box className="builder-header" sx={options}>
        <Box
         
        >
          <Stack
            sx={{
              padding: '12px 8vw',
              ...sx
            }}
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
