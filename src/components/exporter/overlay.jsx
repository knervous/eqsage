import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Divider,
  FormControl,
  TextField,
  Typography,
} from '@mui/material';
import Joyride from 'react-joyride';

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
import { modelDefinitions } from '../../lib/model/constants';
import { ExporterHeader } from './overlay-header';

import './overlay.scss';

const models = new Proxy(modelDefinitions, {
  get(target, prop, _receiver) {
    if (target[prop]) {
      return `[${prop}] ${target[prop]}`;
    }
    return !prop || prop === 'null' ? '' : `[unknown] ${prop}`;
  },
});
const steps = [
  {
    title  : 'Model Processing',
    content: 'Start here by processing global model files (global_chr.s3d) and equipment files (gequip.s3d) to populate lists for Models and Items',
    target : '#joyride-start',
  },
  {
    title  : 'Zone Processing',
    content: 'Additionally, zones may contain models and objects not included in global files. Experiment with different zones to populate additional models and objects, e.g. Mistmoore will contain models for Vampires.',
    target : '#joyride-1',
  },
];
export const ExporterOverlay = () => {
  const { closeDialogs } = useOverlayContext();
  const { rootFileSystemHandle, zones } = useMainContext();
  const [modelFiles, setModelFiles] = useState([]);
  const [objectFiles, setObjectFiles] = useState([]);
  const [itemFiles, setItemFiles] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [babylonModel, setBabylonModel] = useState('');
  const [selectedObject, setSelectedObject] = useState('');
  const [selectedItem, setSelectedItem] = useState('');
  const [run, setRun] = useState(true);
  const showBeaconAgain = () => {
    setRun(false);
    // setTimeout(() => {
    //   setRun(true);
    // }, 1);
  };
  const handleCallback = (state) => {
    if (state.action === 'reset') {
      showBeaconAgain();
    }
  };

  const settings = useSettingsContext();
  const { openAlert } = useAlertContext();
  const { ExpansionList, filteredZoneList } = useExpansionList({ zones });
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
        return {
          model: itemLabel,
          label: itemLabel,
          id   : idx,
          key  : idx,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.label > b.label ? 1 : -1));
  }, [itemFiles]);

  useEffect(() => {
    setRun(modelOptions.length === 0, objectOptions.length === 0 && itemOptions.length === 0);
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
  return (
    <>
      <Joyride steps={steps} run={run} callback={handleCallback} />
      <Box className="exporter-left-nav" onKeyDown={(e) => e.stopPropagation()}>
        <Typography variant="h6" sx={{ textAlign: 'center' }}>
          EQ Sage Model Exporter
        </Typography>
        <Divider sx={{ margin: '5px' }} />
        <Typography sx={{ fontSize: '17px', marginTop: '15px' }}>
          Models ({modelOptions.length})
        </Typography>
        <FormControl size="small" sx={{ m: 1, width: 300, margin: '0' }}>
          <Autocomplete
            value={models[selectedModel]}
            size="small"
            sx={{ margin: '15px 0', maxWidth: '270px' }}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            onChange={async (e, values) => {
              if (!values) {
                return;
              }
              setSelectedObject(null);
              setSelectedItem(null);
              setSelectedModel(values.model);
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
        <Typography sx={{ fontSize: '17px', marginTop: '15px' }}>
          Objects ({objectOptions.length})
        </Typography>
        <FormControl size="small" sx={{ m: 1, width: 300, margin: '0' }}>
          <Autocomplete
            value={selectedObject}
            size="small"
            sx={{ margin: '15px 0', maxWidth: '270px' }}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            onChange={async (e, values) => {
              if (!values) {
                return;
              }
              setSelectedModel(null);
              setSelectedItem(null);
              setSelectedObject(values.model);
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
        <Typography sx={{ fontSize: '17px', marginTop: '15px' }}>
          Items ({itemOptions.length})
        </Typography>
        <FormControl size="small" sx={{ m: 1, width: 300, margin: '0' }}>
          <Autocomplete
            value={selectedItem}
            size="small"
            sx={{ margin: '15px 0', maxWidth: '270px' }}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            onChange={async (e, values) => {
              if (!values) {
                return;
              }
              setSelectedModel(null);
              setSelectedObject(null);
              setSelectedItem(values.model);
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
        <Button color="primary" sx={{ margin: '0 auto', width: '100%' }} onClick={async () => {
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
          gameController.currentScene.getMeshById('model_export')?.dispose();
        }}>Purge All Data</Button>

        <Accordion defaultExpanded>
          <AccordionSummary id="joyride-start">
            <Typography>Global Processor</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Button
              sx={{ margin: '2.5px auto', width: '100%' }}
              color="primary"
              onClick={async () => {
                await deleteEqFolder('data');
                await processGlobal(settings, rootFileSystemHandle, true);
                refreshModelFiles();
              }}
              variant="outlined"
            >
              Process Models
            </Button>
            <Button
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
          <AccordionSummary id="joyride-1">
            <Typography>Zone Processor</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ExpansionList />
            <Button
              color="primary"
              onClick={async () => {
                for (const z of zones) {
                  if (
                    !filteredZoneList.some(
                      (fz) => fz.short_name === z.short_name
                    )
                  ) {
                    continue;
                  }
                  await processZone(
                    z.short_name,
                    settings,
                    rootFileSystemHandle,
                    true
                  );
                  await refreshModelFiles();
                }
                openAlert('Done processing zones');
              }}
              variant="outlined"
              sx={{ margin: '0 auto', width: '100%' }}
            >
              Process Zones ({filteredZoneList.length})
            </Button>
            <Autocomplete
              size="small"
              sx={{ margin: '15px 0', maxWidth: '270px' }}
              isOptionEqualToValue={(option, value) =>
                option?.key === value?.key
              }
              onChange={async (e, values) => {
                if (!values) {
                  return;
                }
                await processZone(
                  values.short_name,
                  settings,
                  rootFileSystemHandle,
                  true
                );
                await refreshModelFiles();
              }}
              renderOption={(props, option) => {
                return (
                  <li {...props} key={option.key}>
                    {option.label}
                  </li>
                );
              }}
              options={filteredZoneList.map((z) => ({
                label     : `[${z.short_name}] ${z.long_name}`,
                key       : z.short_name,
                short_name: z.short_name,
              }))}
              renderInput={(params) => (
                <TextField {...params} label="Individual Zone" />
              )}
            />
          </AccordionDetails>
        </Accordion>
      </Box>
      <ExporterHeader
        name={
          selectedModel
            ? models[selectedModel]
            : selectedObject
              ? selectedObject
              : selectedItem ?? ''
        }
      />
      <OverlayDialogs />
      {babylonModel && (
        <ExporterOverlayRightNav
          babylonModel={babylonModel}
          modelFiles={modelFiles}
          setBabylonModel={setBabylonModel}
          type={selectedModel ? 0 : selectedObject ? 1 : 2}
        />
      )}
    </>
  );
};
