import { Box, Stack } from '@mui/material';


export const SpireOverlay = () => {
    
  return <>
    {/**
     * Left Nav Bar
     */}
    <Box sx={{ height: '100vh', width: '200px', background: 'red', position: 'absolute', top: 0, left: 0, zIndex: 1000 }}>
      <Stack direction={'column'} justifyItems={'center'} alignContent={'space-evenly'}>
        {/**
         * Zone
         */}
        <Box>
            Zone Info here ok asd qqq qqqq
        </Box>
      </Stack>
    </Box>
  </>;
};