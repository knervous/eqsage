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
  Typography,
} from '@mui/material';

import InfoIcon from '@mui/icons-material/Info';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import AccessibilityIcon from '@mui/icons-material/Accessibility';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import TerrainIcon from '@mui/icons-material/Terrain';

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
import { Flyout, FlyoutButton } from '../common/flyout';
import { AboutDialog } from './about-dialog';

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
    setAudioDialogOpen,
    Spire,
    setModelExporter,
    setZones,
    recentList,
    setRecentList,
    setZoneBuilder,
  } = useMainContext();
  const [zoneList, setZoneList] = useState([]);
  const [expansionFilter, setExpansionFilter] = useState([]);
  const [zone, setZone] = useState(null);
  const [aboutOpen, setAboutOpen] = useState(false);

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
    (zone, save = true) => {
      if (save && !recentList.some((a) => a.short_name === zone.short_name)) {
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
  }, [
    setSelectedZone,
    setModelExporter,
    setZoneDialogOpen,
    setAudioDialogOpen,
  ]);

  const enterAudio = useCallback(() => {
    gameController.dispose();
    setSelectedZone(null);
    setZoneBuilder(false);
    setZoneBuilderDialogOpen(false);
    setZoneDialogOpen(false);
    setAudioDialogOpen(true);
  }, [
    setSelectedZone,
    setZoneBuilderDialogOpen,
    setZoneBuilder,
    setZoneDialogOpen,
    setAudioDialogOpen,
  ]);

  const enterZoneBuilder = useCallback(() => {
    gameController.dispose();
    setSelectedZone(null);
    setZoneBuilder(true);
    setZoneBuilderDialogOpen(true);
    setZoneDialogOpen(false);
    setAudioDialogOpen(false);
  }, [
    setSelectedZone,
    setZoneBuilderDialogOpen,
    setZoneBuilder,
    setZoneDialogOpen,
    setAudioDialogOpen,
  ]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        autocompleteRef.current?.querySelector('input')?.focus();
      }, 0);
      let z = [];
      const zonePromise = new Promise(async (res) => {
        if (Spire) {
          await Spire.Zones.getZones()
            .then((zones) => {
              if (!Array.isArray(zones)) {
                console.log('Error with spire zones', zones);
                throw new Error('Error with zones response');
              }
              z = zones;
              setZoneList(zones);
            })
            .catch(() => {
              import('../../data/zoneData.json').then((zl) => {
                z = Array.from(zl.default);
                setZoneList(Array.from(zl.default));
              });
            });
        } else {
          await import('../../data/zoneData.json').then((zl) => {
            z = Array.from(zl.default);
            setZoneList(Array.from(zl.default));
          });
        }
        res();
      });
      const urlParams = new URLSearchParams(window.location.search);
      const zb = urlParams.get('zb');
      if (zb === 'true') {
        zonePromise.then(() => {
          setZones(z);
          enterZoneBuilder();
        });
      }
      if (urlParams.get('md') === 'true') {
        enterModelExporter();
      }
    }
  }, [open, Spire, enterZoneBuilder, setZones, enterModelExporter]);

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
      <Flyout>
        <FlyoutButton
          onClick={() => setAboutOpen(true)}
          Icon={InfoIcon}
          title="About / Contact"
        />
        <FlyoutButton
          onClick={enterModelExporter}
          Icon={AccessibilityIcon}
          isNew
          newText="New! (3D Printing)"
          title="Model Exporter"
        />
        <FlyoutButton
          onClick={enterAudio}
          Icon={MusicNoteIcon}
          title="Audio Explorer"
        />
        <FlyoutButton
          onClick={enterZoneBuilder}
          Icon={TerrainIcon}
          isNew
          newText="New! (BETA)"
          title="Zone Builder (NEW)"
        />
        <FlyoutButton
          disabled={selectedZone}
          onClick={unlinkDir}
          Icon={LinkOffIcon}
          title="Unlink EQ Directory"
        />
      </Flyout>
      <DialogContent sx={{ minHeight: '200px' }}>
        <AboutDialog open={aboutOpen} setOpen={setAboutOpen} />
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
              noOptionsText={'Enter Custom File and Press Return'}

              onKeyDown={async e => {
                if (e.key === 'Enter') {
                  console.log('ent', e.target.value);
                  console.log('ref', autocompleteRef.current);
                  selectAndExit({
                    short_name: e.target.value,
                    id        : -1,
                    long_name : e.target.value
                  });
                }
              }}
              onChange={async (e, values) => {
                if (!values) {
                  return;
                }
                if (e.key === 'Enter') {
                  const selected = filteredZoneList[values.id];
                  selectAndExit(selected, false);
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
              {!recentList.length && (
                <Typography
                  sx={{ fontSize: '15px', margin: '5px auto' }}
                  color="text.secondary"
                  gutterBottom
                >
                  No recent zones. Select a zone to get started!
                </Typography>
              )}
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

      </Stack>
    </Dialog>
  );
};
