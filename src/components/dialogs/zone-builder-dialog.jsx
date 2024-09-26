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
import pako from 'pako';
import { useMainContext } from '../main/context';
import { VERSION } from '../../lib/model/constants';
import {
  getEQDir,
  getEQFile,
  getEQFileExists,
  getFiles,
  writeEQFile,
} from '../../lib/util/fileHandler';
import { useAlertContext } from '../../context/alerts';
import { ZoneBuilder } from '../builder/zone-builder';
import { optimizeBoundingBoxes } from '../../lib/s3d/bsp/region-utils';

const defaultZoneMetadata = {
  version           : VERSION,
  objects           : {},
  lights            : [],
  sounds            : [],
  regions           : [],
  environmentEffects: [],
  materials         : [],
  characterFiles    : [],
  assets            : [],
  chr               : [],
};

export const ZoneBuilderDialog = ({ open }) => {
  const { selectedZone, setZoneDialogOpen, zones, setZoneBuilderDialogOpen } =
    useMainContext();
  const [templates, setTemplates] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const { openAlert } = useAlertContext();
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [radioValue, setRadioValue] = useState('template');
  const [loading, setLoading] = useState(false);
  const [glb, setGlb] = useState(null);
  const [zone, setZone] = useState(null);
  const loadProjectRef = useRef(null);
  const handleChange = (newValue) => {
    setGlb(newValue);
  };

  const loadProject = useCallback(
    async (name) => {
      const file = await getEQFile('projects', name);
      if (!file) {
        openAlert(`File projects/${name} does not exist!`);
        return;
      }
      const inflated = pako.inflate(file);
      const decoded = msgpack.decode(inflated);
      setZone(decoded);
    },
    [openAlert]
  );
  useEffect(() => {
    (async () => {
      setLoading(true);
      const projectDir = await getEQDir('projects');
      if (projectDir) {
        const files = await getFiles(
          projectDir,
          (name) => name.endsWith('.eqs'),
          true
        );

        setProjects(files);
        if (files.length) {
          await new Promise((res) => setTimeout(res, 5));
          setSelectedProject(files[0]);
          setTimeout(() => {
            loadProjectRef.current?.focus();
          }, 500);
        }
      }
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
    const exists = await getEQFileExists('projects', projectName);
    if (exists) {
      openAlert(
        `Project ${projectName} already exists. Choose another name.`,
        'warning'
      );
      return;
    }
    let glb;
    if (radioValue === 'scratch') {
      // todo new
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
      const modelFiles = {};
      for (const key of Object.keys(zoneMetadata.objects)) {
        const modelFile = await getEQFile(
          'objects',
          `${key}.glb`
        );
        if (modelFile.byteLength) {
          modelFiles[key] = new Uint8Array(modelFile);
        } else {
          openAlert(`Model not found - try rerunning Model Import for ${key}`);
          return;
        }
      }
   
      const project = {
        projectName,
        glb     : new Uint8Array(zoneFile),
        modelFiles,
        metadata: {
          ...defaultZoneMetadata,
          ...zoneMetadata,
        },
      };

      if (
        await getEQFileExists('root', `${selectedTemplate.short_name}_chr.s3d`)
      ) {
        project.metadata.characterFiles.push(
          `${selectedTemplate.short_name}_chr`
        );
      }
      // Existing assets like qeynos2_assets.txt
      const assetFile = await getEQFile(
        'root',
        `${selectedTemplate.short_name}_assets.txt`,
        'text'
      );
      if (assetFile) {
        project.metadata.assets = assetFile.split('\r\n').filter(Boolean);
      }
      // Existing char like qeynos2_chr.txt
      const chrFile = await getEQFile(
        'root',
        `${selectedTemplate.short_name}_chr.txt`,
        'text'
      );
      if (chrFile) {
        project.metadata.chr = chrFile.split('\r\n').filter(Boolean);
      }
      if (
        !project.metadata.regions?.length &&
        project.metadata.unoptimizedRegions?.length
      ) {
        project.metadata.regions = await optimizeBoundingBoxes(
          project.metadata.unoptimizedRegions
        );
        delete project.metadata.unoptimizedRegions;
        await writeEQFile(
          'zones',
          `${selectedTemplate.short_name}.json`,
          JSON.stringify(project.metadata)
        );
      }
      const encoded = msgpack.encode(project);
      const zipped = pako.deflate(encoded);
      await writeEQFile('projects', projectName, zipped);
      openAlert(`Project ${projectName} successfully created.`);
      setZone(project);
    }
  }, [radioValue, selectedTemplate, openAlert, projectName]);

  const saveZone = useCallback(async (project = zone, name, alert = true) => {
    const encoded = msgpack.encode(project);
    const zipped = pako.deflate(encoded);
    await writeEQFile('projects', name, zipped);
    if (alert) {
      openAlert(`Project ${name} successfully saved.`);
    }
  }, [zone, openAlert]);

  const updateMetadata = useCallback((metadata, name = zone.projectName, doSave = false) => {
    const newZone = { ...zone, metadata: { ...zone.metadata, ...metadata } };
    setZone(newZone);
    if (doSave) {
      saveZone(newZone, name, true);
    }
  }, [zone, saveZone]);

  return zone ? (
    <ZoneBuilder
      zone={zone}
      saveProject={saveZone}
      updateMetadata={updateMetadata}
      updateProject={setZone}
      projectName={projectName}
      setProjectName={setProjectName}
    />
  ) : (
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
            <FormControl sx={{ margin: '20px 0' }} fullWidth>
              <Stack direction="row">
                <Autocomplete
                  size="small"
                  sx={{
                    width      : '250px',
                    maxWidth   : '250px',
                    marginLeft : '40px',
                    marginRight: '10px',
                  }}
                  isOptionEqualToValue={(option, value) =>
                    option.key === value.key
                  }
                  onChange={async (e, values) => {
                    if (!values) {
                      return;
                    }
                    setSelectedProject(projects[values.id]);
                  }}
                  renderOption={(props, option) => {
                    return (
                      <li {...props} key={option.key}>
                        {option.label}
                      </li>
                    );
                  }}
                  options={projects.map((proj, idx) => {
                    return {
                      label: proj,
                      id   : idx,
                      key  : proj,
                    };
                  })}
                  renderInput={(params) => (
                    <TextField {...params} label="Load Existing Project" />
                  )}
                />
                <Button
                  ref={loadProjectRef}
                  onClick={() => loadProject(selectedProject)}
                  disabled={!selectedProject}
                  color="primary"
                  variant="outlined"
                >
                  Load Project
                </Button>
              </Stack>
            </FormControl>
            <FormControl fullWidth>
              <RadioGroup
                aria-labelledby="template-select-group-label"
                value={radioValue}
                onChange={(e) => setRadioValue(e.target.value)}
                name="radio-buttons-group"
              >
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
                <FormControlLabel
                  sx={{ margin: '10px 0px' }}
                  value="scratch"
                  control={<Radio />}
                  label="New Project (Bring your own .glb terrain)"
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
              </RadioGroup>
            </FormControl>
            <FormControl sx={{ margin: '15px 0px' }} fullWidth>
              <Stack
                direction={'row'}
                alignContent={'space-evenly'}
                sx={{ width: '100%' }}
              ></Stack>
            </FormControl>
            <Stack direction="row" sx={{ marginLeft: '40px' }}>
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
