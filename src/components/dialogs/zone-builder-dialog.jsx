import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

import * as msgpack from '@msgpack/msgpack';
import pako from 'pako';
import { useMainContext } from '../main/context';
import { VERSION } from '../../lib/model/constants';
import {
  deleteEqFileOrFolder,
  getEQDir,
  getEQFile,
  getEQFileExists,
  getEQRootDir,
  getFiles,
  writeEQFile,
} from '../../lib/util/fileHandler';
import { useAlertContext } from '../../context/alerts';
import { ZoneBuilder } from '../builder/zone-builder';
import { optimizeBoundingBoxes } from '../../lib/s3d/bsp/region-utils';
import { GlobalStore } from '../../state';
import { useConfirm } from 'material-ui-confirm';

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
  const [zone, setZone] = useState(null);
  const projectRef = useRef(null);
  const loadProjectRef = useRef(null);
  const confirm = useConfirm();
  const loadProject = useCallback(
    async (name) => {
      const file = await getEQFile('projects', name);
      if (!file) {
        openAlert(`File projects/${name} does not exist!`);
        return;
      }
      localStorage.setItem('eqs_project', name);
      const inflated = pako.inflate(file);
      const decoded = msgpack.decode(inflated);
      setZone(decoded);
    },
    [openAlert]
  );
  useEffect(() => {
    (async () => {
      const projectDir = await getEQDir('projects');
      if (projectDir) {
        const files = (
          await getFiles(projectDir, (name) => name.endsWith('.eqs'), true)
        ).sort((a, b) => (a < b ? -1 : 1));

        setProjects(files);
        if (files.length && localStorage.getItem('eqs_project')) {
          await new Promise((res) => setTimeout(res, 5));
          setSelectedProject(localStorage.getItem('eqs_project'));

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
    })();
  }, [zones]);

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }
    setProjectName(`${selectedTemplate.short_name}`);
  }, [selectedTemplate]);
  const createNewProject = useCallback(async () => {
    const name = `${projectName}.eqs`;
    const exists = await getEQFileExists('projects', name);
    if (exists) {
      openAlert(
        `Project ${name} already exists. Choose another name.`,
        'warning'
      );
      return;
    }

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
      const modelFile = await getEQFile('objects', `${key}.glb`);
      if (modelFile.byteLength) {
        modelFiles[key] = new Uint8Array(modelFile);
      } else {
        openAlert(`Model not found - try rerunning Model Import for ${key}`);
        // return;
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
    if (
      await getEQFileExists('root', `${selectedTemplate.short_name}_obj.s3d`)
    ) {
      project.metadata.characterFiles.push(
        `${selectedTemplate.short_name}_obj`
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
      GlobalStore.actions.setLoading(true);
      project.metadata.regions = await optimizeBoundingBoxes(
        project.metadata.unoptimizedRegions
      );
      GlobalStore.actions.setLoading(false);
      delete project.metadata.unoptimizedRegions;
      await writeEQFile(
        'zones',
        `${selectedTemplate.short_name}.json`,
        JSON.stringify(project.metadata)
      );
    }
    const encoded = msgpack.encode(project);
    const zipped = pako.deflate(encoded);
    await writeEQFile('projects', name, zipped);
    openAlert(`Project ${name} successfully created.`);
    setZone(project);
  }, [selectedTemplate, openAlert, projectName]);

  return zone ? (
    <ZoneBuilder zone={zone} goHome={() => setZone(null)} />
  ) : (
    <Dialog
      className="ui-dialog"
      onKeyDown={(e) => e.stopPropagation()}
      maxWidth="sm"
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
      <DialogContent>
        <Stack direction={'column'}>
          <Typography
            sx={{ fontSize: 18, marginBottom: 2, margin: '5px auto' }}
            color="text.primary"
            gutterBottom
          >
            Welcome to ZoneBuilder!
          </Typography>

          <Typography
            sx={{
              fontSize    : 15,
              marginBottom: '20px',
              marginTop   : '15px',
              maxWidth    : '100%',
            }}
            color="text.primary"
            gutterBottom
          >
            ZoneBuilder is a tool designed to edit/convert existing S3D/EQG
            zones into an EQG format with accompanying assets, or create a new
            zone from a template based on an existing zone. Please refer to the
            documentation for how-to guides and more detailed information on
            use. Projects are stored in [{getEQRootDir().name}/projects].
          </Typography>
        </Stack>
        <Typography
          sx={{
            fontSize    : 16,
            width       : '100%',
            marginBottom: '15px',
            textAlign   : 'center',
            userSelect  : 'none',
            fontWeight  : 0,
          }}
          color="text.primary"
          gutterBottom
        >
          Load Existing Project
        </Typography>
        <Stack direction="row" sx={{ marginBottom: '15px' }}>
          <Autocomplete
            size="small"
            sx={{ width: '50%', marginRight: '5px' }}
            value={
              selectedProject
                ? { label: selectedProject, key: selectedProject }
                : null
            }
            ref={projectRef}
            isOptionEqualToValue={(option, value) => option.key === value.key}
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
              <TextField {...params} label="Existing Project" />
            )}
          />
          <Stack
            direction="row"
            sx={{ width: '50%' }}
            justifyContent={'space-evenly'}
          >
            <Button
              sx={{
                width   : '70%',
                ':focus': {
                  outline   : '1px white solid',
                  background: 'rgba(125,125,125,0.1)'
                },
              }}
              disableTouchRipple={true}
              TouchRippleProps={{ sx: { display: 'none' } }}
              ref={loadProjectRef}
              onClick={() => loadProject(selectedProject)}
              disabled={!selectedProject}
              color="primary"
              variant="outlined"
            >
              Load Project
            </Button>
            <Button
              sx={{ marginLeft: '5px' }}
              onClick={() => {
                confirm({
                  description: 'Are you sure you want to delete this project?',
                  title      : 'Delete EQS Project',
                })
                  .then(() => {
                    deleteEqFileOrFolder('projects', selectedProject)
                      .then(() => {
                        const newFiles = projects.filter(
                          (n) => n !== selectedProject
                        );
                        setProjects(newFiles);
                        setSelectedProject(newFiles[0]);
                        openAlert(`Deleted project ${selectedProject}`);
                      })
                      .catch(() => {
                        openAlert('Error deleting project');
                      });
                  })
                  .catch(() => {
                    /* ... */
                  });
              }}
              disabled={!selectedProject}
              color="primary"
              variant="outlined"
            >
              <DeleteIcon />
            </Button>
          </Stack>
        </Stack>
        <Typography
          sx={{
            fontSize    : 16,
            width       : '100%',
            marginTop   : '25px',
            marginBottom: '15px',
            textAlign   : 'center',
            userSelect  : 'none',
            fontWeight  : 0,
          }}
          color="text.primary"
          gutterBottom
        >
          Create New Project
        </Typography>

        <Stack direction="row">
          <FormControl sx={{ width: '50%' }}>
            <Autocomplete
              size="small"
              isOptionEqualToValue={(option, value) => option.key === value.key}
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
                <TextField {...params} label="Create Project From Template" />
              )}
            />
          </FormControl>
          <Tooltip
            placement="right"
            componentsProps={{
              tooltip: {
                sx: {
                  minWidth  : '400px !important',
                  marginLeft: '-20px !important',
                  background: 'rgba(0,0,0,0.3)',
                },
              },
            }}
            title={
              <Box
                style={{
                  padding        : '10px',
                  backgroundColor: 'black',
                  margin         : '0px',
                  border         : '0px',
                }}
              >
                <Typography
                  sx={{
                    fontSize  : 15,
                    textAlign : 'center',
                    userSelect: 'none',
                  }}
                  color="text.secondary"
                  gutterBottom
                >
                  Templates are generated from loading zone files from the main
                  landing page. In order to create a ZoneBuilder template, you
                  need to have loaded the zone from Sage at least once.
                </Typography>
              </Box>
            }
          >
            <Typography
              sx={{
                fontSize  : 15,
                width     : '50%',
                lineHeight: '40px',
                fontStyle : 'italic',
                textAlign : 'center',
                userSelect: 'none',
              }}
              color="text.secondary"
              gutterBottom
            >
              How do I generate templates?
            </Typography>
          </Tooltip>
        </Stack>

        <Box style={{ margin: '15px 0' }} />

        <Stack direction="row">
          <FormControl sx={{ width: '50%' }}>
            <TextField
              size="small"
              label="Project Name"
              value={projectName}
              placeholder="New Project"
              onChange={(e) => {
                setProjectName(e.target.value);
              }}
            ></TextField>
          </FormControl>
          <Tooltip
            placement="right"
            componentsProps={{
              tooltip: {
                sx: {
                  minWidth  : '400px !important',
                  marginLeft: '-20px !important',
                  background: 'rgba(0,0,0,0.3)',
                },
              },
            }}
            title={
              <Box
                style={{
                  padding        : '10px',
                  backgroundColor: 'black',
                  margin         : '0px',
                  border         : '0px',
                }}
              >
                <Typography
                  sx={{
                    fontSize  : 15,
                    textAlign : 'center',
                    userSelect: 'none',
                  }}
                  color="text.secondary"
                  gutterBottom
                >
                  Your project name will create the zone's "short name". If you
                  are editing a zone e.g. North Qeynos (qeynos2), keep the same
                  name, qeynos2, to create "qeynos2.eqg". If you are creating a
                  brand new zone from a template, choose something unique that
                  fits the rules of a zone short name.
                </Typography>
              </Box>
            }
          >
            <Typography
              sx={{
                fontSize  : 15,
                width     : '50%',
                lineHeight: '40px',
                fontStyle : 'italic',
                textAlign : 'center',
                userSelect: 'none',
              }}
              color="text.secondary"
              gutterBottom
            >
              What should I name my project?
            </Typography>
          </Tooltip>
        </Stack>

        <Box style={{ margin: '15px 0' }} />
      </DialogContent>
      <DialogActions sx={{ marginTop: '20px' }}>
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
        <Button
          onClick={createNewProject}
          disabled={!projectName.length}
          color="primary"
          variant="outlined"
        >
          Create New Project
        </Button>
      </DialogActions>
    </Dialog>
  );
};
