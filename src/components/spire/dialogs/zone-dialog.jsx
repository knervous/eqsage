import React, { lazy, useCallback, useEffect, useState, Suspense } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Paper,
  Button,
} from '@mui/material';
import { CommonDialog } from './common';
import { useMainContext } from '../../main/context';
import { useAlertContext } from '../../../context/alerts';
import { ZoneApi } from 'spire-api/api/zone-api';

const LazyDuplicateZoneDialog = lazy(() =>
  import('./duplicate-zone-dialog')
);

export const ZoneDialog = ({ onClose }) => {
  const { openAlert } = useAlertContext();
  const [zoneInfo, setZoneInfo] = useState({});
  const [dzDialogOpen, setDzDialogOpen] = useState(false);
  const { selectedZone, Spire } = useMainContext();
  useEffect(() => {
    if (!Spire || !selectedZone) {
      return;
    }
    Spire.Zones.getZoneById(selectedZone.zoneidnumber).then((zone) => {
      setZoneInfo(zone);
    });
  }, [selectedZone, Spire]);
  const handleEdit = (key, value) => {
    setZoneInfo((prevData) => ({
      ...prevData,
      [key]: value,
    }));
  };
  const updateZone = useCallback(async () => {
    if (!Spire) {
      openAlert('Spire is not connected', 'warning');
      return;
    }
    const zoneApi = new ZoneApi(...Spire.SpireApi.cfg());

    try {
      await zoneApi.updateZone({ id: zoneInfo.id, zone: zoneInfo });
      openAlert('Successfully updated zone');
    } catch (e) {
      openAlert('Error updating zone', 'warning');
    }
  }, [zoneInfo, openAlert, Spire]);
  return (
    <CommonDialog
      additionalButtons={[
        <Button
          variant="outlined"
          disabled={!Spire}
          onClick={() => setDzDialogOpen(true)}
        >
          Duplicate Zone
        </Button>,
        <Button variant="outlined" disabled={!Spire} onClick={updateZone}>
          Update Zone
        </Button>,
      ]}
      onClose={onClose}
      title={'Zone'}
    >
      {dzDialogOpen && zoneInfo && Spire && (
        <Suspense fallback={null}><LazyDuplicateZoneDialog
          open={dzDialogOpen}
          setOpen={setDzDialogOpen}
          zone={zoneInfo}
          Spire={Spire}
        />
        </Suspense>
      )}
      <TableContainer
        onKeyDown={(e) => e.stopPropagation()}
        component={Paper}
        sx={{
          backgroundColor: 'transparent',
          boxShadow      : '0px 0px 5px 2px rgba(0, 0, 0, 0.3)',
          maxHeight      : '400px',
          margin         : '2px 0px',
          padding        : '1px',
        }}
      >
        <Table
          sx={{
            '& .MuiTableCell-root': {
              padding    : '3px',
              fontSize   : '0.9rem',
              paddingLeft: '10px',
              background : 'rgba(0,0,0,0.3)',
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Zone Property</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Value</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(zoneInfo).map(([key, value]) => (
              <TableRow key={key}>
                <TableCell>{key}</TableCell>
                <TableCell>
                  <TextField
                    disabled={['id'].includes(key)}
                    value={value ?? ''}
                    onChange={(e) => {
                      const newValue =
                        typeof value === 'number'
                          ? parseFloat(e.target.value) || 0
                          : e.target.value;
                      handleEdit(key, newValue);
                    }}
                    type={typeof value === 'number' ? 'number' : 'text'}
                    fullWidth
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(0,0,0, 0.4)',
                      borderRadius   : '4px',
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </CommonDialog>
  );
};
