
import { useCallback } from 'react';
import classNames from 'classnames';
import { Stack, Typography } from '@mui/material';
import IconButton from '@mui/material/IconButton';

import './nav.scss';

export const DrawerButton = ({
  text,
  Icon,
  toggleDrawer,
  drawer,
  drawerState,
  NotificationIcon,
}) => {
  const doToggleDrawer = useCallback(() => {
    toggleDrawer(drawer, !drawerState?.[drawer]);
  }, [toggleDrawer, drawer, drawerState]);
  return (
    <IconButton
      className={classNames('builder-left-nav-button', {
        'builder-left-nav-button-open': drawerState?.[drawer],
      })}
      onClick={doToggleDrawer}
    >
      <Stack
        direction={'column'}
        justifyContent={'center'}
        alignItems={'center'}
      >
        <Icon
          fill={'#ddd'}
          color="#000 !important"
          fillColor="#000"
          width={30}
          height={30}
          style={{
            fill : '#ddd !important',
            color: '#ddd !important'
          }}
        />
        <Typography
          className="text-outline"
          sx={{ textAlign: 'center', fontSize: 13 }}
        >
          {text}
        </Typography>
      </Stack>
      {NotificationIcon && (
        <NotificationIcon
          sx={{
            width   : '20px',
            height  : '20px',
            position: 'absolute',
            right   : '0px',
            top     : '0px',
            color   : 'gold !important',
            fill    : 'gold !important',
          }}
        />
      )}
    </IconButton>
  );
};
  