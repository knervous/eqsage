import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Input,
  InputLabel,
  List,
  ListItemButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { useAlertContext } from '../../../context/alerts';

import './object-dialog.scss';
import { useProject } from '../hooks/metadata';
import { useMainContext } from '../../main/context';
import { useRegionContext } from '../providers/region-provider';

const ZonePointEditDialog = ({ open, setOpen, initialData, triggerRefresh }) => {
  const { openAlert } = useAlertContext();
  const { zones } = useMainContext();
  const { zonePointApi } = useRegionContext();
  const [zonePoint, setZonePoint] = useState(initialData.zp);
  const [selectedZone, setSelectedZone] = useState();

  const options = useMemo(
    () =>
      zones.map((zone, idx) => {
        return {
          label: `${zone.long_name} - ${zone.short_name} ${
            zone.version > 0 ? `[v${zone.version}]` : ''
          }`.trim(),
          id          : idx,
          zoneIdNumber: zone.zoneidnumber,
          key         : `${zone.id}-${zone.zoneidnumber}`,
        };
      }),
    [zones]
  );

  useEffect(() => {
    setZonePoint(initialData.zp);
    setSelectedZone(
      options.find((o) => o.zoneIdNumber === initialData.zp.target_zone_id)?.label
    );
  }, [initialData, options]);
  return (
    <Dialog
      fullWidth
      maxWidth="xs"
      open={open}
      onKeyDown={e => e.stopPropagation()}
      onClose={() => setOpen(false)}
      aria-labelledby="draggable-dialog-title"
    >
      <DialogTitle style={{ margin: '0 auto' }} id="draggable-dialog-title">
        {initialData.create ? 'Create New' : 'Edit'} Zone Point (
        {zonePoint.number})
      </DialogTitle>
      <DialogContent>
        <Stack direction="column" sx={{ '& > div': { marginBottom: '15px' } }}>
          <Autocomplete
            size="small"
            sx={{ margin: '15px 0' }}
            value={selectedZone}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            onChange={async (e, values) => {
              console.log('Vals', values);
              if (!values) {
                return;
              }
              setSelectedZone(values.label);
              setZonePoint((zp) => ({
                ...zp,
                target_zone_id: values.zoneIdNumber,
              }));
            }}
            renderOption={(props, option) => {
              return (
                <li {...props} key={option.key}>
                  {option.label}
                </li>
              );
            }}
            options={options}
            renderInput={(params) => <TextField {...params} label="Zone" />}
          />
          <Typography
            sx={{ fontSize: '14px', marginBottom: '10px' }}
            color="gold"
          >
            Tip: To preserve values across zonelines, use the value 999999
          </Typography>
          {['x', 'y', 'z', 'heading'].map(n => <FormControl variant="standard">
            <InputLabel>Target {n.toUpperCase()}</InputLabel>
            <Input
              value={zonePoint[`target_${n}`]}
              onChange={(e) => {
                const { value } = e.target;
                if (value === '' || value === '-' || !isNaN(Number(value))) {
                  setZonePoint((zp) => ({ ...zp, [`target_${n}`]: value }));
                }
              }}
              onBlur={(e) => {
                const { value } = e.target;
                if (value === '-' || value === '') {
                  setZonePoint((zp) => ({ ...zp, [`target_${n}`]: 0 }));
                } else {
                  setZonePoint((zp) => ({ ...zp, [`target_${n}`]: Number(value) }));
                }
              }}
            />
          </FormControl>)}
        </Stack>
      </DialogContent>
      <DialogActions disableSpacing sx={{ margin: '5px' }}>
        <Button
          variant="outlined"
          sx={{ color: 'white', padding: '8px', marginLeft: '10px' }}
          autoFocus
          onClick={async () => {
            let success = true;
            if (initialData.create) {
              await zonePointApi.createZonePoint({ zonePoint }).catch(() => {
                success = false;
                openAlert('Error creating zone point', 'warning');
              });
            } else {
              await zonePointApi
                .updateZonePoint({ zonePoint, id: zonePoint.id })
                .catch(() => {
                  success = false;
                  openAlert('Error updating zone point', 'warning');
                });
            }
            if (success) {
              triggerRefresh();
              openAlert(
                `Successfully ${
                  initialData.create ? 'Created' : 'Saved'
                } zone point. Don't forget to #reload zone_points!`
              );
            }
            setOpen(false);
          }}
        >
          {initialData.create ? 'Create' : 'Save'} Zone Point
        </Button>
        <Button
          variant="outlined"
          sx={{ color: 'white', padding: '8px', marginLeft: '10px' }}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const ZonePointChooserDialog = ({
  open,
  setOpen,
  zonePoints,
  zonesById,
  initialIdx,
  setZoneNumber,
  triggerRefresh,
}) => {
  const { name } = useProject();
  const [createEditOpen, setCreateEditOpen] = useState(false);
  const [selectedZp, setSelectedZp] = useState(-1);
  const [initialData, setInitialData] = useState({ create: true, zp: {} });
  useEffect(() => {
    if (open) {
      setSelectedZp(initialIdx * 10);
    }
  }, [open]); // eslint-disable-line
  const openZp = useMemo(
    () => zonePoints.find((z) => z.number === selectedZp),
    [zonePoints, selectedZp]
  );
  return (
    <Dialog
      fullWidth
      maxWidth="md"
      open={open}
      onClose={() => setOpen(false)}
      aria-labelledby="draggable-dialog-title"
    >
    
      <ZonePointEditDialog
        open={createEditOpen}
        setOpen={setCreateEditOpen}
        initialData={initialData}
        triggerRefresh={triggerRefresh}
      />
    
      <DialogTitle style={{ margin: '0 auto' }} id="draggable-dialog-title">
        Zone Point Selector
        <Button
          sx={{ marginLeft: '15px' }}
          variant="outlined"
          onClick={() => {
            const highestZoneNumber = zonePoints.reduce(
              (acc, val) => Math.max(acc, val.number),
              0
            );
            const newZonePoint = {
              zone               : name,
              x                  : 0,
              y                  : 0,
              z                  : 0,
              target_x           : 0,
              target_y           : 0,
              target_z           : 0,
              heading            : 0,
              target_heading     : 0,
              min_expansion      : -1,
              max_expansion      : -1,
              client_version_mask: 0xffffffff,
              buffer             : 0,
              number             : highestZoneNumber + 10,
              target_zone_id     : 1,
            };
            setInitialData({ create: true, zp: newZonePoint });
            setTimeout(() => {
              setCreateEditOpen(true);
            }, 0);
          }}
        >
          Create New Zone Point
        </Button>
      </DialogTitle>
      <DialogContent
        sx={{ maxHeight: '400px', overflowY: 'hidden' }}
        className="about-content"
      >
        <Stack direction="row">
          <List
            component="nav"
            sx={{
              border   : '1px solid rgba(255,255,255,0.1)',
              maxHeight: '400px',
              width    : '250px',
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {zonePoints.map((zp) => (
              <ListItemButton
                sx={{
                  background:
                    zp.number === selectedZp
                      ? 'rgba(0,0,0,0.8)'
                      : 'rgba(0,0,0,0.2)',
                }}
                onClick={() => {
                  setSelectedZp(zp.number);
                }}
              >
                <Typography
                  sx={{
                    display     : 'block',
                    whiteSpace  : 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow    : 'hidden',
                    width       : '200px',
                  }}
                  title={`${zp.number} : ${zp.zone} --> ${
                    zonesById[zp.target_zone_id]?.short_name ?? 'Unknown'
                  }`}
                >
                  {`${zp.number} : ${zp.zone} --> ${
                    zonesById[zp.target_zone_id]?.short_name ?? 'Unknown'
                  }`}
                </Typography>
              </ListItemButton>
            ))}
          </List>
          <List
            component="nav"
            sx={{
              border   : '1px solid rgba(255,255,255,0.1)',
              maxHeight: '400px',
              width    : 'calc(100% - 250px)',
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {openZp && (
              <Stack direction="column">
                <Stack
                  alignItems={'center'}
                  alignContent={'center'}
                  justifyContent={'center'}
                  direction="row"
                >
                  <Typography sx={{ textAlign: 'center' }} variant="h6">
                    Zone Point: {openZp.zone} - {openZp.number}
                  </Typography>
                  <Button
                    sx={{ marginLeft: '15px' }}
                    variant={'outlined'}
                    onClick={() => {
                      setInitialData({
                        create: false,
                        zp    : JSON.parse(JSON.stringify(openZp)),
                      });
                      setTimeout(() => {
                        setCreateEditOpen(true);
                      }, 0);
                    }}
                  >
                    Edit
                  </Button>
                </Stack>
                <Box
                  sx={{
                    padding: '10px',
                    '& > p': { fontSize: '18px', margin: '5px' },
                  }}
                >
                  <Typography>
                    Target Zone ID: {openZp.target_zone_id}
                  </Typography>
                  <Typography>
                    Target Zone Name:{' '}
                    {zonesById[openZp.target_zone_id]?.short_name ?? 'Unknown'}
                  </Typography>
                  <Typography>
                    Target Zone Long Name:{' '}
                    {zonesById[openZp.target_zone_id]?.long_name ?? 'Unknown'}
                  </Typography>
                  <Typography>Target Zone Version: {openZp.version}</Typography>
                  <Typography>Target X: {openZp.target_x}</Typography>
                  <Typography>Target Y: {openZp.target_y}</Typography>
                  <Typography>Target Z: {openZp.target_z}</Typography>
                </Box>
              </Stack>
            )}
          </List>
        </Stack>
      </DialogContent>
      <DialogActions disableSpacing sx={{ margin: '5px' }}>
        <Button
          variant="outlined"
          sx={{ color: 'white', padding: '8px', marginLeft: '10px' }}
          autoFocus
          onClick={() => {
            if (selectedZp % 10 === 0) {
              setZoneNumber(selectedZp / 10);
            }
            setOpen(false);
          }}
        >
          Select Zone Point
        </Button>
        <Button
          variant="outlined"
          sx={{ color: 'white', padding: '8px', marginLeft: '10px' }}
          autoFocus
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};
