import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import React from 'react';

import './flyout.scss';

const CustomTooltip = styled(({ className, ...props }) => (
  <Tooltip {...props} componentsProps={{ tooltip: { className: className } }} />
))(`
      font-size: 16px;
      padding: 10px 15px;
      margin-left: 5px !important;
      background: #222;
  `);
export const Flyout = ({ children }) => {
  return (
    <Stack
      direction="column"
      className="flyout-container"
      alignContent={'space-between'}
      justifyContent={'space-between'}
    >
      {children}
    </Stack>
  );
};

export const FlyoutButton = ({
  Icon,
  title,
  ...rest
}) => (
  <IconButton {...rest} className="flyout-button">
    <Icon />
    {title && (
      <Box className="flyout-new">
        <Typography
          sx={{
            fontSize  : '17px !important',
            padding   : '10px',
            width     : '250px',
            marginLeft: '50px',
          }}
        >
          {title}
        </Typography>
      </Box>
    )}
  </IconButton>
);
