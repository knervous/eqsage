import React, { useEffect, useState } from 'react';
import { CommonDialog } from './common';
import { useMainContext } from '../../main/context';

export const ZoneDialog = ({ onClose }) => {
  const [zoneInfo, setZoneInfo] = useState({});
  const { selectedZone, Spire } = useMainContext();
  useEffect(() => {
    if (!Spire || !selectedZone) {
      return;
    }
    Spire.Zones.getZoneById(selectedZone.zoneidnumber).then(zone => {
      setZoneInfo(zone);
    });
  }, [selectedZone, Spire]);

  return (
    <CommonDialog onClose={onClose} title={'Zone'}>
      <pre>
        {JSON.stringify(zoneInfo, null, 4)}
      </pre>
    </CommonDialog>
  );
};
