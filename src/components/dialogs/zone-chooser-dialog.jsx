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
import { useMainContext } from '../main/context';
import * as keyval from 'idb-keyval';
import { useConfirm } from 'material-ui-confirm';
import { VERSION, expansions } from '../../lib/model/constants';
import { gameController } from '../../viewer/controllers/GameController';
import {
  deleteEqFolder,
  getEQFile,
  writeEQFile,
} from '../../lib/util/fileHandler';

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

export const ZoneChooserDialog = ({ open }) => {
  const [_type, _setType] = useState('unknown');
  const {
    selectedZone,
    setSelectedZone,
    setZoneDialogOpen,
    setZoneBuilderDialogOpen,
    audioDialogOpen,
    setAudioDialogOpen,
    Spire,
    setModelExporter,
    setZones,
    recentList,
    setRecentList,
    setZoneBuilder
  } = useMainContext();
  const [zoneList, setZoneList] = useState([]);
  const [expansionFilter, setExpansionFilter] = useState([]);
  const [zone, setZone] = useState(null);

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

  useEffect(() => {
    (async () => {
      const assetData = await getEQFile('data', 'version.json', 'json');
      if (assetData?.version === VERSION) {
        return;
      }
      console.log('Purging assets');
      await deleteEqFolder('data');
      await deleteEqFolder('items');
      await deleteEqFolder('models');
      await deleteEqFolder('objects');
      await deleteEqFolder('zones');
      await deleteEqFolder('textures');
      await writeEQFile(
        'data',
        'version.json',
        JSON.stringify({ version: VERSION })
      );
    })();
  }, []);

  const selectAndExit = useCallback(
    (zone) => {
      if (!recentList.some((a) => a.short_name === zone.short_name)) {
        recentList.push(zone);
        localStorage.setItem('recent-zones', JSON.stringify(recentList));
      }
      setSelectedZone(zone);
      setZoneDialogOpen(false);
      setAudioDialogOpen(false);
    },
    [setZoneDialogOpen, setSelectedZone, recentList, setAudioDialogOpen]
  );
  const enterModelExporter = useCallback(() => {
    gameController.dispose();
    setSelectedZone(null);
    setModelExporter(true);
    setAudioDialogOpen(false);
    setTimeout(() => {
      setZoneDialogOpen(false);
    }, 250);
  }, [setSelectedZone, setModelExporter, setZoneDialogOpen, setAudioDialogOpen]);

  const enterAudio = useCallback(() => {
    gameController.dispose();
    setSelectedZone(null);
    setZoneBuilder(false);
    setZoneBuilderDialogOpen(false);
    setZoneDialogOpen(false);
    setAudioDialogOpen(true);

  }, [setSelectedZone, setZoneBuilderDialogOpen, setZoneBuilder, setZoneDialogOpen, setAudioDialogOpen]);
  const enterZoneBuilder = useCallback(() => {
    gameController.dispose();
    setSelectedZone(null);
    setZoneBuilder(true);
    setZoneBuilderDialogOpen(true);
    setZoneDialogOpen(false);
    setAudioDialogOpen(false);
  }, [setSelectedZone, setZoneBuilderDialogOpen, setZoneBuilder, setZoneDialogOpen, setAudioDialogOpen]);


  useEffect(() => {
    if (open) {
      setTimeout(() => {
        autocompleteRef.current?.querySelector('input')?.focus();
      }, 0);
      if (Spire) {
        Spire.Zones.getZones()
          .then(zones => {
            if (!Array.isArray(zones)) {
              console.log('Error with spire zones', zones);
              throw new Error('Error with zones response');
            }
            setZoneList(zones);
          })
          .catch(() => {
            import('../../data/zoneData.json').then((zl) =>
              setZoneList(Array.from(zl.default))
            );
          });
      } else {
        import('../../data/zoneData.json').then((zl) => {
          setZoneList(Array.from(zl.default));
          // enterZoneBuilder();
        });
      }
    }
  }, [open, Spire]);

  useEffect(() => setZones(zoneList), [zoneList, setZones]);

  const confirm = useConfirm();

  const unlinkDir = () => {
    confirm({
      description: 'Are you sure you want to unlink your EQ directory?',
      title      : 'Unlink EQ Directory',
    })
      .then(() => {
        /* ... */
        keyval.del('eqdir').then(() => {
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
      <DialogContent>
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
                  label: `${zone.long_name} - ${zone.short_name} ${
                    zone.version > 0 ? `[v${zone.version}]` : ''
                  }`.trim(),
                  id : idx,
                  key: `${zone.id}-${zone.zoneidnumber}`,
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
                  label={`${zone.long_name} ${
                    zone.version > 0 ? `[v${zone.version}]` : ''
                  }`.trim()}
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

      <Stack direction={'column'}>
        <Button
          color="primary"
          onClick={() => selectAndExit(zone)}
          disabled={!zone}
          variant="outlined"
          sx={{ margin: '5px auto' }}
        >
          Enter Zone
        </Button>
        {/* <Button
          color="primary"
          onClick={enterZoneBuilder}
          variant="outlined"
          sx={{ margin: '5px auto' }}
        >
          Zone Builder
        </Button> */}
        <Button
          color="primary"
          onClick={enterAudio}
          variant="outlined"
          sx={{ margin: '5px auto' }}
        >
          Audio Explorer
        </Button>
        <Button
          color="primary"
          onClick={enterModelExporter}
          variant="outlined"
          sx={{ margin: '5px auto' }}
        >
          Model Exporter
        </Button>
        {!selectedZone && (
          <Button
            onClick={unlinkDir}
            variant="outlined"
            sx={{ margin: '15px auto' }}
          >
            Unlink EQ Directory
          </Button>
        )}
      </Stack>
    </Dialog>
  );
};
