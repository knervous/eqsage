import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Autocomplete,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { gameController } from '../../viewer/controllers/GameController';
import { useMainContext } from '../main/main';
import * as keyval from 'idb-keyval';
import { useConfirm } from 'material-ui-confirm';
import { processGlobal } from '../zone/processZone';
import { useSettingsContext } from '../../context/settings';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width    : 250,
    },
  },
};

const expansions = [
  'Original',
  'The Ruins of Kunark',
  'The Scars of Velious',
  'The Shadows of Luclin',
  'The Planes of Power',
  'The Legacy of Ykesha',
  'Lost Dungeons of Norrath',
  'Gates of Discord',
  'Omens of War',
  'Dragons of Norrath',
  'Depths of Darkhollow',
  'Prophecy of Ro',
  'The Serpent\'s Spine',
  'The Buried Sea',
  'Secrets of Faydwer',
  'Seeds of Destruction',
  'Underfoot',
  'House of Thule',
  'Veil of Alaris',
  'Rain of Fear',
  'Call of the Forsaken',
  'The Darkened Sea',
  'The Broken Mirror',
  'Empires of Kunark',
  'Ring of Scale',
  'The Burning Lands',
  'Torment of Velious',
  'Claws of Veeshan',
  'Terror of Luclin',
  'Night of Shadows',
  'Laurion\'s Song',
];

export const ZoneChooserDialog = ({ open }) => {
  const [_type, setType] = useState('unknown');
  const { selectedZone, setSelectedZone, setZoneDialogOpen } = useMainContext();
  const [zoneList, setZoneList] = useState([]);
  const settings = useSettingsContext();
  const [expansionFilter, setExpansionFilter] = useState([]);
  const [zone, setZone] = useState(null);
  const [recentList, setRecentList] = useState(() =>
    localStorage.getItem('recent-zones')
      ? JSON.parse(localStorage.getItem('recent-zones'))
      : []
  );
  const autocompleteRef = useRef(null);
  const filteredZoneList = useMemo(() => {
    if (expansionFilter.length === 0) {
      return zoneList;
    }
    return zoneList.filter((z) => {
      return expansionFilter.includes(z.expansion);
    });
  }, [zoneList, expansionFilter]);

  const handleExpansionFilterChange = (event) => {
    const {
      target: { value },
    } = event;
    setExpansionFilter(
      // On autofill we get a stringified value.
      typeof value === 'string' ? value.split(',') : value
    );
  };

  const selectAndExit = useCallback(
    (zone) => {
      if (!recentList.some((a) => a.short_name === zone.short_name)) {
        recentList.push(zone);
        localStorage.setItem('recent-zones', JSON.stringify(recentList));
      }
      setSelectedZone(zone);
      setZoneDialogOpen(false);
    },
    [setZoneDialogOpen, setSelectedZone, recentList]
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        autocompleteRef.current?.querySelector('input')?.focus();
      }, 0);
      if (gameController.Spire) {
        gameController.Spire.Zones.getZones().then(setZoneList);
      } else {
        import('../../data/zoneData.json').then((zl) =>
          setZoneList(Array.from(zl))
        );
      }
    }
  }, [open]);
  const confirm = useConfirm();
  useEffect(() => {
    localStorage.setItem('recent-zones', JSON.stringify(recentList));
  }, [recentList]);

  const unlinkDir = () => {
    confirm({ description: 'Are you sure you want to unlink your EQ directory?', title: 'Unlink EQ Directory' })
      .then(() => {
        /* ... */
        keyval.clear().then(() => {
          window.location.reload();
        });
      })
      .catch(() => {
        /* ... */
      });
  
  };

  return (
    <Dialog
      className="ui-dialog"
      onKeyDown={(e) => e.stopPropagation()}
      maxWidth="md"
      open={open}
      onClose={() => (selectedZone ? setZoneDialogOpen(false) : null)}
      aria-labelledby="draggable-dialog-title"
    >
      <DialogTitle
        style={{ cursor: 'move', margin: '0 auto' }}
        id="draggable-dialog-title"
        className="ui-dialog-title"
      >
        Select a Zone
      </DialogTitle>
      <DialogContent
        onDropCapture={(e) => {
          console.log('ok', e);
        }}
        onDragOver={(e) => {
          console.log('odo', e);
        }}
      >
        <Stack direction={'column'}>
          <FormControl
            size="small"
            sx={{ m: 1, width: 300, margin: '5px auto' }}
          >
            <InputLabel id="zone-filter-label">Expansion Filter</InputLabel>
            <Select
              labelId="zone-filter-label"
              id="zone-filter"
              fullWidth={false}
              multiple
              value={expansionFilter}
              onChange={handleExpansionFilterChange}
              input={<OutlinedInput label="Expansion Filter" />}
              renderValue={(selected) =>
                selected.length === 0
                  ? 'None'
                  : selected.map((a) => expansions[a]).join(', ')
              }
              MenuProps={MenuProps}
            >
              {expansions.map((name, idx) => (
                <MenuItem key={name} value={idx}>
                  <Checkbox checked={expansionFilter.includes(idx)} />
                  <ListItemText primary={name} />
                </MenuItem>
              ))}
            </Select>

            <Autocomplete
              ref={autocompleteRef}
              size="small"
              sx={{ margin: '15px 0' }}
              id="combo-box-demo"
              isOptionEqualToValue={(option, value) => option.key === value.key}
              onChange={async (e, values) => {
                if (!values) {
                  return;
                }
                if (e.key === 'Enter') {
                  selectAndExit(filteredZoneList[values.id]);
                }
                setZone(filteredZoneList[values.id]);
              }}
              renderOption={(props, option) => {
                return (
                  <li {...props} key={option.key}>
                    {option.label}
                  </li>
                );
              }}
              options={filteredZoneList.map((zone, idx) => {
                return {
                  label: `${zone.long_name} - ${zone.short_name}`,
                  id   : idx,
                  key  : `${zone.id}-${zone.zoneidnumber}`,
                };
              })}
              //  sx={{ width: 300 }}
              renderInput={(params) => <TextField {...params} label="Zone" />}
            />
          </FormControl>
          <FormControl sx={{ maxWidth: '400px' }}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {recentList.map((zone) => (
                <Chip
                  key={`chip-${zone.id}`}
                  label={zone.long_name}
                  variant="outlined"
                  onClick={() => selectAndExit(zone)}
                  onDelete={() => {
                    setRecentList((l) => l.filter((z) => z.id !== zone.id));
                  }}
                />
              ))}
            </Stack>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        {!selectedZone && <Button
          onClick={unlinkDir}
          variant="outlined"
          sx={{ margin: '0 auto' }}
        >
          Unlink EQ Directory
        </Button>}
        
        <Button
          color='primary'
          onClick={() => selectAndExit(zone)}
          disabled={!zone}
          variant="outlined"
          sx={{ margin: '0 auto' }}
        >
            Select Zone
        </Button>

  
      </DialogActions>
      {/* <Button
        color='primary'
        onClick={() => processGlobal(settings)}
        variant="outlined"
        sx={{ margin: '0 auto' }}
      >
            Process Global Objects/Characters
      </Button>
         */}
    </Dialog>
  );
};
