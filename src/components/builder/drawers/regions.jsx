import React from 'react';
import { useRegionContext } from '../providers/region-provider';
import { Box, Button } from '@mui/material';
import { UpgradeState } from '../constants';


export const RegionDrawer = () => {
  const { regionUpgradeState, upgrader } = useRegionContext();

  return <Box>
    {regionUpgradeState === UpgradeState.NEED_UPGRADE && <Box>
        Regions are out of sync. Click to Upgrade
      <Button onClick={upgrader} >Upgrade Regions</Button>
    </Box>}
        Regions
  </Box>;
};