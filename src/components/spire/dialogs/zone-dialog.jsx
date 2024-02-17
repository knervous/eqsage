import React, { useEffect, useState } from 'react';
import { CommonDialog } from './common';
import { useMainContext } from '../../main/main';
import { gameController } from '../../../viewer/controllers/GameController';

export const ZoneDialog = ({ onClose }) => {
  const [zoneInfo, setZoneInfo] = useState({});
  const { selectedZone } = useMainContext();
  useEffect(() => {
    if (!gameController.Spire || !selectedZone) {
      return;
    }
    gameController.Spire.Zones.getZoneById(selectedZone.zoneidnumber).then(zone => {
      setZoneInfo(zone);
    });
  }, [selectedZone]);

  return (
    <CommonDialog onClose={onClose} title={'Zone'}>
      <pre>
        {JSON.stringify(zoneInfo, null, 4)}
      </pre>
    </CommonDialog>
  );
};
