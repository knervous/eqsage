import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { MuiFileInput } from 'mui-file-input';
import * as msgpack from '@msgpack/msgpack';

import { useMainContext } from '../main/context';
import { useConfirm } from 'material-ui-confirm';
import { VERSION } from '../../lib/model/constants';
import {
  deleteEqFolder,
  getEQDir,
  getEQFile,
  getEQFileExists,
  getEQRootDir,
  getFiles,
  writeEQFile,
} from '../../lib/util/fileHandler';
import { audioController } from '../sound/AudioController';

const zoneMetadata = {
  version           : VERSION,
  objects           : {},
  lights            : [],
  sounds            : [],
  regions           : [],
  environmentEffects: [],
  materials         : [],
};

export const ZoneBuilderDialog = ({ open }) => {
  const { selectedZone, setZoneDialogOpen, zones, setZoneBuilderDialogOpen } = useMainContext();
  const [templates, setTemplates] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [radioValue, setRadioValue] = useState('scratch');
  const [loading, setLoading] = useState(false);
  const [glb, setGlb] = useState(null);
  const handleChange = (newValue) => {
    setGlb(newValue);
  };
  useEffect(() => {
    (async () => {
      setLoading(true);
      const zoneDir = await getEQDir('zones');
      if (zoneDir) {
        const files = await getFiles(zoneDir, undefined, true);
        setTemplates(
          files
            .filter((f) => f.endsWith('.glb'))
            .map((f) =>
              zones.find((z) => z.short_name === f.replace('.glb', ''))
            )
            .filter(Boolean)
        );
      }
      setLoading(false);
    })();
  }, [zones]);

  useEffect(() => {
    if (radioValue === 'scratch' || !selectedTemplate) {
      return;
    }

    setProjectName(`${selectedTemplate.short_name}.eqs`);
  }, [selectedTemplate, radioValue]);

  const createNewProject = useCallback(async () => {
    let glb;
    if (radioValue === 'scratch') {
    } else {
      const zoneFile = await getEQFile(
        'zones',
        `${selectedTemplate.short_name}.glb`
      );
      const zoneMetadata = await getEQFile(
        'zones',
        `${selectedTemplate.short_name}.json`,
        'json'
      );

      console.log('zf zm', zoneFile, zoneMetadata);
    }
  }, [radioValue, selectedTemplate]);
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
        Zone Builder Projects
      </DialogTitle>
      <DialogContent
        sx={{
          div: {
            // 'textAlign': 'center !important'
          },
        }}
      >
        <Stack direction={'column'}>
          <Typography
            sx={{ fontSize: 18, marginBottom: 2, margin: '15px auto' }}
            color="text.primary"
            gutterBottom
          >
            Welcome to ZoneBuilder!
          </Typography>
          <Typography
            sx={{ fontSize: 16, marginBottom: 2, maxWidth: '100%' }}
            color="text.primary"
            gutterBottom
          >
            ZoneBuilder is a tool designed to edit/convert existing S3D/EQG
            zones into an EQG format with accompanying assets. To get started,
            select a processed zone to use as a starting template or create a
            new project from scratch. To populate the zone list, convert zones
            from the landing page or through the Model Exporter.
          </Typography>

          <Typography
            sx={{ fontSize: 16, marginBottom: 2, maxWidth: '100%' }}
            color="text.primary"
            gutterBottom
          >
            Click here for more information about building zones.
          </Typography>
        </Stack>
        {loading ? (
          <Stack
            direction="row"
            justifyContent={'center'}
            alignContent={'center'}
          >
            <CircularProgress size={20} sx={{ margin: '7px' }} />
            <Typography
              sx={{
                fontSize  : 18,
                lineHeight: '25px',
                margin    : '5px',
                width     : '70%',
              }}
            >
              Loading EQ Assets
            </Typography>
          </Stack>
        ) : (
          <>
            <FormControl fullWidth>
              <RadioGroup
                aria-labelledby="template-select-group-label"
                value={radioValue}
                onChange={(e) => setRadioValue(e.target.value)}
                name="radio-buttons-group"
              >
                <FormControlLabel
                  sx={{ margin: '10px 0px' }}
                  value="scratch"
                  control={<Radio />}
                  label="Blank Project (Bring your own .glb terrain)"
                />
                <MuiFileInput
                  disabled={radioValue !== 'scratch'}
                  size="small"
                  fullWidth
                  sx={{ width: '250px', maxWidth: '250px', marginLeft: '40px' }}
                  label="Select .glb file"
                  inputProps={{
                    accept: ['.glb'],
                  }}
                  value={glb}
                  onChange={handleChange}
                />
                <FormControlLabel
                  sx={{ margin: '10px 0px' }}
                  value="template"
                  control={<Radio />}
                  label={'Project From Zone Template'}
                />
                <Autocomplete
                  disabled={radioValue === 'scratch'}
                  size="small"
                  sx={{ width: '250px', maxWidth: '250px', marginLeft: '40px' }}
                  id="combo-box-demo"
                  isOptionEqualToValue={(option, value) =>
                    option.key === value.key
                  }
                  onChange={async (e, values) => {
                    if (!values) {
                      return;
                    }
                    setSelectedTemplate(templates[values.id]);
                  }}
                  renderOption={(props, option) => {
                    return (
                      <li {...props} key={option.key}>
                        {option.label}
                      </li>
                    );
                  }}
                  options={templates.map((zone, idx) => {
                    return {
                      label: `${zone.long_name} - ${zone.short_name} ${
                        zone.version > 0 ? `[v${zone.version}]` : ''
                      }`.trim(),
                      id : idx,
                      key: `${zone.id}-${zone.zoneidnumber}`,
                    };
                  })}
                  renderInput={(params) => (
                    <TextField {...params} label="Project From Zone Template" />
                  )}
                />
              </RadioGroup>
            </FormControl>
            <FormControl sx={{ margin: '15px 0px' }} fullWidth>
              <Stack
                direction={'row'}
                alignContent={'space-evenly'}
                sx={{ width: '100%' }}
              ></Stack>
            </FormControl>
            <Stack
         
              direction="row"
              sx={{ marginLeft: '10px' }}
            >
              <TextField
                size="small"
                sx={{ marginRight: '10px' }}
                label="New Project Name"
                value={projectName}
                placeholder="New Project"
                onChange={(e) => {
                  setProjectName(e.target.value);
                }}
              ></TextField>
              <Button
                onClick={createNewProject}
                disabled={!projectName.length}
                color="primary"
                variant="outlined"
              >
                Create New Project
              </Button>
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            setZoneBuilderDialogOpen(false);
            setZoneDialogOpen(true);
          }}
          color="primary"
          variant="outlined"
        >
                Back to Home
        </Button>
      </DialogActions>
    </Dialog>
  );
};