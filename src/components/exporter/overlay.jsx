import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Divider,
  FormControl,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Joyride from 'react-joyride';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import { useOverlayContext } from '../spire/provider';
import { OverlayDialogs } from './dialogs/dialogs';
import { processEquip, processGlobal, processZone } from '../zone/processZone';
import { useSettingsContext } from '../../context/settings';
import { useMainContext } from '../main/context';
import { deleteEqFolder, getEQDir, getFiles } from '../../lib/util/fileHandler';
import { gameController } from '../../viewer/controllers/GameController';
import { ExporterOverlayRightNav } from './right-nav';
import { useExpansionList } from '../common/expansions';
import { useAlertContext } from '../../context/alerts';
import { ExporterHeader } from './overlay-header';
import { useConfirm } from 'material-ui-confirm';
import { items, models } from './constants';

import './overlay.scss';
import { DevOverlay } from './dev-overlay';

const steps = [
  {
    title: 'Model Processing',
    content:
      'Start here by processing global model files (global_chr.s3d) to populate lists for PC and NPC models',
    target: '#joyride-models',
  },
  {
    title: 'Equipment Processing',
    content:
      'Processing equipment will load items and additional armor packs (e.g. Velious armor).',
    target: '#joyride-equipment',
  },
  {
    title: 'Zone Processing',
    content:
      'Additionally, zones may contain models and objects not included in global files. Experiment with different zones to populate additional models and objects, e.g. Mistmoore will contain models for Vampires.',
    target: '#joyride-zone',
  },
];
export const ExporterOverlay = () => {
  const { closeDialogs } = useOverlayContext();
  const {
    rootFileSystemHandle,
    zones,
    setModelExporter,
    setZoneDialogOpen,
    recentList,
    setRecentList,
  } = useMainContext();
  const settings = useSettingsContext();
  const { openAlert } = useAlertContext();
  const { ExpansionList, filteredZoneList } = useExpansionList({ zones });

  const [modelFiles, setModelFiles] = useState([]);
  const [objectFiles, setObjectFiles] = useState([]);
  const [itemFiles, setItemFiles] = useState([]);
  const [babylonModel, setBabylonModel] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedModelIdx, setSelectedModelIdx] = useState(-1);
  const [selectedObject, setSelectedObject] = useState('');
  const [selectedObjectIdx, setSelectedObjectIdx] = useState(-1);
  const [selectedItem, setSelectedItem] = useState('');
  const [selectedItemIdx, setSelectedItemIdx] = useState(-1);
  const [run, setRun] = useState(true);
  const showBeaconAgain = () => {
    setRun(false);
  };
  const handleCallback = (state) => {
    if (state.action === 'reset') {
      showBeaconAgain();
    }
  };

  const modelOptions = useMemo(() => {
    return modelFiles
      .map((model, idx) => {
        const isHead = /he\d{2}/.test(model.name);
        if (isHead) {
          return null;
        }
        const modelLabel = `${model.name.replace('.glb', '')}`;
        const label = models[modelLabel] ?? modelLabel;
        return {
          model: modelLabel,
          label,
          id   : idx,
          key  : idx,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.label > b.label ? 1 : -1));
  }, [modelFiles]);
  const objectOptions = useMemo(() => {
    return objectFiles
      .map((obj, idx) => {
        const objectLabel = `${obj.name.replace('.glb', '')}`;
        return {
          model: objectLabel,
          label: objectLabel,
          id   : idx,
          key  : idx,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.label > b.label ? 1 : -1));
  }, [objectFiles]);
  const itemOptions = useMemo(() => {
    return itemFiles
      .map((obj, idx) => {
        const itemLabel = `${obj.name.replace('.glb', '')}`;
        const label = items[itemLabel];
        return {
          model: itemLabel,
          label,
          id   : idx,
          key  : idx,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.label > b.label ? 1 : -1));
  }, [itemFiles]);

  const confirm = useConfirm();

  const doProcessZone = useCallback(
    async (zone) => {
      const didProcess = await processZone(
        zone.short_name,
        settings,
        rootFileSystemHandle,
        true
      );
      if (
        didProcess &&
        !recentList.some((a) => a.short_name === zone.short_name)
      ) {
        setRecentList((l) => [...l, zone]);
        localStorage.setItem('recent-zones', JSON.stringify(recentList));
      }
      await refreshModelFiles();
    },
    [rootFileSystemHandle, settings, recentList, setRecentList]
  );

  useEffect(() => {
    setRun(
      modelOptions.length === 0,
      objectOptions.length === 0 && itemOptions.length === 0
    );
  }, [modelOptions, objectOptions, itemOptions]);
  const refreshModelFiles = async () => {
    const modelDir = await getEQDir('models');
    if (modelDir) {
      const files = await getFiles(modelDir);
      setModelFiles(files.filter((f) => f.name.endsWith('.glb')));
    }
    const objectDir = await getEQDir('objects');
    if (objectDir) {
      const files = await getFiles(objectDir);
      setObjectFiles(files.filter((f) => f.name.endsWith('.glb')));
    }
    const itemDir = await getEQDir('items');
    if (itemDir) {
      const files = await getFiles(itemDir);
      setItemFiles(files.filter((f) => f.name.endsWith('.glb')));
    }
  };

  useEffect(() => {
    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        closeDialogs();
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [closeDialogs]);

  useEffect(() => {
    refreshModelFiles();
  }, []);

  useEffect(() => {
    if (!selectedModel) {
      return;
    }
    setBabylonModel(null);
    gameController.SpawnController.addExportModel(selectedModel).then(
      setBabylonModel
    );
  }, [selectedModel]);

  useEffect(() => {
    if (
      !selectedModel &&
      modelOptions.length &&
      !selectedObject &&
      !selectedItem
    ) {
      setSelectedModel(modelOptions[0].model);
    }
    if (!selectedModel) {
      setSelectedModelIdx(-1);
    }
    if (!selectedItem) {
      setSelectedItemIdx(-1);
    }
    if (!selectedObject) {
      setSelectedObjectIdx(-1);
    }
  }, [modelOptions, selectedModel, selectedObject, selectedItem]);

  useEffect(() => {
    if (!selectedObject) {
      return;
    }
    gameController.SpawnController.addObject(selectedObject).then(
      setBabylonModel
    );
  }, [selectedObject]);

  useEffect(() => {
    if (!selectedItem) {
      return;
    }
    gameController.SpawnController.addObject(selectedItem, 'items').then(
      setBabylonModel
    );
  }, [selectedItem]);

  const setModel = async (name) => {
    setSelectedObject(null);
    setSelectedItem(null);
    setSelectedModel(name);
    setSelectedModelIdx(modelOptions.findIndex((m) => m.model === name));
  };

  const setObject = async (name) => {
    setSelectedObject(name);
    setSelectedItem(null);
    setSelectedModel(null);
    setSelectedObjectIdx(objectOptions.findIndex((m) => m.model === name));
  };

  const setItem = async (name) => {
    setSelectedObject(null);
    setSelectedItem(name);
    setSelectedModel(null);
    setSelectedItemIdx(itemOptions.findIndex((m) => m.model === name));
  };
  return (
    <>
      <Joyride steps={steps} run={run} callback={handleCallback} />
      <Box className="exporter-left-nav" onKeyDown={(e) => e.stopPropagation()}>
        <Typography variant="h6" sx={{ textAlign: 'center' }}>
          EQ Sage Model Exporter
        </Typography>
        <Button
          color="primary"
          sx={{ margin: '0px auto', width: '100%' }}
          onClick={async () => {
            gameController.dispose();
            setModelExporter(false);
            setZoneDialogOpen(true);
          }}
        >
          Back to Home
        </Button>
        <Divider sx={{ margin: '5px' }} />
        <Accordion defaultExpanded>
          <AccordionSummary id="joyride-models">
            <Typography>Global Processor</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Button
              sx={{ margin: '2.5px auto', width: '100%' }}
              color="primary"
              onClick={async () => {
                // await deleteEqFolder('data');
                await processGlobal(settings, rootFileSystemHandle, true);
                refreshModelFiles();
              }}
              variant="outlined"
            >
              Process Models
            </Button>
            <Button
              id="joyride-equipment"
              sx={{ margin: '2.5px auto', width: '100%' }}
              color="primary"
              onClick={async () => {
                await processEquip(settings, rootFileSystemHandle, true);
                await refreshModelFiles();
              }}
              variant="outlined"
            >
              Process Equipment
            </Button>
          </AccordionDetails>
        </Accordion>
        <Accordion defaultExpanded>
          <AccordionSummary id="joyride-zone">
            <Typography>Zone Processor</Typography>
          </AccordionSummary>
          <Autocomplete
            size="small"
            sx={{ margin: '0px 0', maxWidth: '270px' }}
            isOptionEqualToValue={(option, value) => option?.key === value?.key}
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                await doProcessZone({ short_name: e.target.value });
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            onChange={async (e, values) => {
              if (!values) {
                return;
              }
              await doProcessZone(values);
            }}
            renderOption={(props, option) => {
              return (
                <li {...props} key={option.key}>
                  {option.label}
                </li>
              );
            }}
            noOptionsText={'Enter Custom File and Press Return'}
            options={filteredZoneList.map((z) => ({
              label     : `[${z.short_name}] ${z.long_name}`,
              key       : `${z.id}-${z.zoneidnumber}`,
              short_name: z.short_name,
              ...z,
            }))}
            renderInput={(params) => (
              <TextField {...params} label="Individual Zone" />
            )}
          />
          <AccordionDetails>
            <ExpansionList />
            <Button
              color="primary"
              onClick={() => {
                confirm({
                  description: `You're about to process ${filteredZoneList.length} zones. This may take awhile. Be sure to keep this browser tab open and visible. To stop processing, simply refresh the page.`,
                  title      : 'Process Zones',
                })
                  .then(async () => {
                    for (const z of zones) {
                      if (
                        !filteredZoneList.some(
                          (fz) => fz.short_name === z.short_name
                        ) ||
                        z.short_name.includes('tutorial')
                      ) {
                        continue;
                      }
                      await doProcessZone(z);
                      openAlert(`Exported ${z.short_name} - ${z.long_name}`);
                    }
                    openAlert('Done processing zones');
                  })
                  .catch(() => {});
              }}
              variant="outlined"
              sx={{ margin: '0 auto', width: '100%' }}
            >
              Process Filtered Zones ({filteredZoneList.length})
            </Button>
          </AccordionDetails>
        </Accordion>
        <Divider sx={{ margin: '5px' }} />
        <Stack direction="row">
          <Typography sx={{ fontSize: '17px', marginTop: '15px' }}>
            Models ({modelOptions.length})
          </Typography>
          <Stack direction="row" sx={{ position: 'absolute', right: '5px' }}>
            <IconButton
              disabled={selectedModelIdx < 1}
              onClick={() => {
                const optionIdx = modelOptions.findIndex(
                  (m) => m.model === selectedModel
                );
                if (optionIdx >= 0) {
                  const option = modelOptions[optionIdx - 1];
                  setModel(option.model);
                }
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <IconButton
              disabled={selectedModelIdx === modelOptions.length - 1}
              onClick={() => {
                const optionIdx = modelOptions.findIndex(
                  (m) => m.model === selectedModel
                );

                const option = modelOptions[optionIdx + 1];
                setModel(option.model);
              }}
            >
              <ArrowForwardIcon />
            </IconButton>
          </Stack>
        </Stack>

        <FormControl size="small" sx={{ m: 1, width: 300, margin: '0' }}>
          <Autocomplete
            value={models[selectedModel]}
            size="small"
            sx={{ margin: '5px 0', maxWidth: '270px' }}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            onChange={async (e, values) => {
              if (!values) {
                return;
              }
              setModel(values.model);
            }}
            renderOption={(props, option) => {
              return (
                <li {...props} key={option.key}>
                  {option.label}
                </li>
              );
            }}
            options={modelOptions}
            renderInput={(params) => (
              <TextField {...params} model="Select Model" />
            )}
          />
        </FormControl>
        <Divider sx={{ margin: '5px' }} />

        <Stack direction="row">
          <Typography sx={{ fontSize: '17px', marginTop: '15px' }}>
            Objects ({objectOptions.length})
          </Typography>
          <Stack direction="row" sx={{ position: 'absolute', right: '5px' }}>
            <IconButton
              disabled={selectedObjectIdx < 1}
              onClick={() => {
                const optionIdx = objectOptions.findIndex(
                  (m) => m.model === selectedObject
                );
                if (optionIdx >= 0) {
                  const option = objectOptions[optionIdx - 1];
                  setObject(option.model);
                }
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <IconButton
              disabled={selectedObjectIdx === objectOptions.length - 1}
              onClick={() => {
                const optionIdx = objectOptions.findIndex(
                  (m) => m.model === selectedObject
                );

                const option = objectOptions[optionIdx + 1];
                setObject(option.model);
              }}
            >
              <ArrowForwardIcon />
            </IconButton>
          </Stack>
        </Stack>

        <FormControl size="small" sx={{ m: 1, width: 300, margin: '0' }}>
          <Autocomplete
            value={selectedObject}
            size="small"
            sx={{ margin: '5px 0', maxWidth: '270px' }}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            onChange={async (e, values) => {
              if (!values) {
                return;
              }
              setObject(values.model);
            }}
            renderOption={(props, option) => {
              return (
                <li {...props} key={option.key}>
                  {option.label}
                </li>
              );
            }}
            options={objectOptions}
            renderInput={(params) => (
              <TextField {...params} model="Select Object" />
            )}
          />
        </FormControl>
        <Divider sx={{ margin: '5px' }} />

        <Stack direction="row">
          <Typography sx={{ fontSize: '17px', marginTop: '15px' }}>
            Items ({itemOptions.length})
          </Typography>
          <Stack direction="row" sx={{ position: 'absolute', right: '5px' }}>
            <IconButton
              disabled={selectedItemIdx < 1}
              onClick={() => {
                const optionIdx = itemOptions.findIndex(
                  (m) => m.model === selectedItem
                );
                if (optionIdx >= 0) {
                  const option = itemOptions[optionIdx - 1];
                  setItem(option.model);
                }
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <IconButton
              disabled={selectedItemIdx === itemOptions.length - 1}
              onClick={() => {
                const optionIdx = itemOptions.findIndex(
                  (m) => m.model === selectedItem
                );

                const option = itemOptions[optionIdx + 1];
                setItem(option.model);
              }}
            >
              <ArrowForwardIcon />
            </IconButton>
          </Stack>
        </Stack>
        <FormControl size="small" sx={{ m: 1, width: 300, margin: '0' }}>
          <Autocomplete
            value={items[selectedItem]}
            size="small"
            sx={{ margin: '5px 0', maxWidth: '270px' }}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            onChange={async (e, values) => {
              if (!values) {
                return;
              }
              setItem(values.model);
            }}
            renderOption={(props, option) => {
              return (
                <li {...props} key={option.key}>
                  {option.label}
                </li>
              );
            }}
            options={itemOptions}
            renderInput={(params) => (
              <TextField {...params} model="Select Item" />
            )}
          />
        </FormControl>
        <Divider sx={{ margin: '5px' }} />
        <Button
          color="primary"
          sx={{ margin: '0 auto', width: '100%' }}
          onClick={() => {
            confirm({
              description: 'Are you sure you want to purge eqsage data?',
              title      : 'Purge EQ Sage Folders',
            })
              .then(async () => {
                await deleteEqFolder('data');
                await deleteEqFolder('items');
                await deleteEqFolder('models');
                await deleteEqFolder('objects');
                await deleteEqFolder('zones');
                setSelectedItem(null);
                setSelectedModel(null);
                setSelectedObject(null);
                setBabylonModel(null);
                refreshModelFiles();
                gameController.SpawnController.assetContainers = {};
                gameController.currentScene
                  .getMeshById('model_export')
                  ?.dispose();
              })
              .catch(() => {});
          }}
        >
          Purge All Data
        </Button>
      </Box>
      <ExporterHeader
        name={
          selectedModel
            ? models[selectedModel]
            : selectedObject
              ? selectedObject
              : items[selectedItem] ?? ''
        }
      />
      <OverlayDialogs />
      {import.meta.env.VITE_LOCAL_DEV === 'true' && (
        <DevOverlay doProcessZone={doProcessZone} />
      )}
      {babylonModel && (
        <ExporterOverlayRightNav
          itemOptions={itemOptions}
          babylonModel={babylonModel}
          modelFiles={modelFiles}
          setBabylonModel={setBabylonModel}
          type={selectedModel ? 0 : selectedObject ? 1 : 2}
        />
      )}
    </>
  );
};
