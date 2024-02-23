import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { clear, get, set } from 'idb-keyval';
import {
  Autocomplete,
  Box,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
  createTheme,
} from '@mui/material';

import './App.scss';
import { EQFileHandle } from './lib/model/file-handle';
import { knownZoneShortNames } from './lib/model/constants';
import { BabylonViewer } from './viewer';
import { gameController } from './viewer/controllers/GameController';

async function* getFilesRecursively(entry, path = '') {
  if (entry.kind === 'file') {
    const file = await entry;
    if (file !== null) {
      file.relativePath = path;
      yield file;
    }
  } else if (entry.kind === 'directory') {
    for await (const handle of entry.values()) {
      yield* getFilesRecursively(handle, `${path}/${handle.name}`);
    }
  }
}
function App() {
  const [fileHandles, setFileHandles] = useState([]);
  const [zoneName, setZoneName] = useState('Select zone');
  const [rootFileSystemHandle, setRootFileSystemHandle] = useState(null);
  const [zoneNames, setZoneNames] = useState(knownZoneShortNames);

  useEffect(() => {
    // Give this a second to inject
    setTimeout(() => {
      console.log('Spire', gameController.Spire, window.Spire);
      if (gameController.Spire) {
        console.log('Fetching');
        gameController.Spire.Zones.getZones().then((zones) => {
          console.log('Zones', zones);
        });
      }
    }, 100);
  }, []);

  const eqFiles = useMemo(() => {
    const usedZones = [...knownZoneShortNames];
    return fileHandles.reduce(
      (acc, val) => {
        const idx = usedZones.findIndex((z) =>
          new RegExp(`^${z}[_\\.].*`).test(val.name)
        );
        if (
          idx !== -1 &&
          (val.name.includes('qeynos') ||
            val.name.includes('freport') ||
            val.name.includes('kith') ||
            val.name.includes('oceangreen') ||
            val.name.includes('broodlands') ||
            val.name.includes('bloodfields') ||
            val.name.includes('pow') ||
            val.name.includes('potime') ||
            val.name.includes('stillmoon'))
        ) {
          const zoneName = usedZones[idx];
          // usedZones.splice(idx, 1);
          if (acc.zones[zoneName]) {
            acc.zones[zoneName].push(val);
          } else {
            acc.zones[zoneName] = [val];
          }
        } else if (val.name.endsWith('s3d') || val.name.endsWith('eqg')) {
          acc.rest.push(val);
        }

        return acc;
      },
      {
        zones: {},
        rest : [],
      }
    );
  }, [fileHandles]);

  const refresh = useCallback(async (infHandle) => {
    const eqdir = infHandle ?? (await get('eqdir'));
    console.log(await eqdir.queryPermission({ mode: 'readwrite' }));
    if (!(await eqdir.requestPermission({ mode: 'readwrite' })) === 'granted') {
      console.warn('Permissions not granted');
      return;
    }
    if (!eqdir) {
      console.warn('No EQ Directory Linked!');
      return;
    }
    setRootFileSystemHandle(eqdir);
    const handles = [];
    try {
      for await (const fileHandle of getFilesRecursively(eqdir)) {
        handles.push(fileHandle);
      }
    } catch (e) {
      console.warn('Error', e, handles);
    }

    setFileHandles(handles);
  }, []);

  const onDrop = useCallback(
    (e) => {
      if (e.dataTransfer.items?.length) {
        const first = e.dataTransfer.items[0];
        if (first.getAsFileSystemHandle) {
          first
            .getAsFileSystemHandle()
            .then(async (handle) => {
              console.log('Handle', handle);
              if (handle.kind === 'file') {
              } else if (handle.kind === 'directory') {
                await clear();
                await set('eqdir', handle);
                await refresh(handle);
                console.log('Done set');
              }
            })
            .catch((e) => {
              console.warn('Could not get handle', e);
            });
        }
      }
      e.preventDefault();
      e.stopPropagation();
    },
    [refresh]
  );

  useEffect(() => {
    gameController.rootFileSystemHandle = rootFileSystemHandle;
  }, [rootFileSystemHandle]);

  const getFiles = useCallback(async (fileHandles) => {
    /**
     * @type {FileSystemHandle}
     */
    const eqdir = await get('eqdir');
    if (!eqdir) {
      console.log('No eq dir');
      return;
    }
    const permissionLevel = await eqdir.requestPermission({
      mode: 'readwrite',
    });
    if (permissionLevel !== 'granted') {
      console.warn('Permissions not granted');
      return;
    }
    setRootFileSystemHandle(eqdir);

    return Promise.all(fileHandles.map((f) => f.getFile()));
  }, []);
  return (
    <ThemeProvider
      theme={createTheme({
        palette   : { mode: 'dark' },
        typography: {
          fontFamily: 'Montaga',
          button    : {
            textTransform: 'none',
          },
        },
      })}
    >
      <Stack
        onDragOver={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        direction={'row'}
        onDrop={onDrop}
        className="App"
      >
        <Paper
          sx={{
            height        : '100%',
            width         : '15%',
            minWidth      : '220px',
            justifyContent: 'center',
            alignContent  : 'center',
          }}
          elevation={3}
        >
          <Stack
            sx={{ height: '100%', width: '100%' }}
            justifyContent="center"
            alignContent="center"
          >
            <Typography
              sx={{
                margin   : '10px auto',
                textAlign: 'center',
              }}
              variant="h5"
            >
              Zones
            </Typography>
            <List
              sx={{
                // maxHeight: '200px',a
                // height  : '200px',
                overflow: 'auto',
                padding : '5px',
                margin  : '5px',
              }}
              dense
            >
              {Object.entries(eqFiles.zones)
                .sort((a, b) => (a[0] > b[0] ? 1 : -1))
                .map(([name, fileHandles]) => (
                  <ListItemButton
                    sx={{ userSelect: 'none', cursor: 'pointer' }}
                    onClick={async () => {
                      setZoneName(name);
                      const files = await getFiles(fileHandles);
                      const obj = new EQFileHandle(
                        name,
                        files,
                        rootFileSystemHandle
                      );
                      await obj.initialize();
                      await obj.process();
                    }}
                  >
                    <ListItemText primary={name} />
                  </ListItemButton>
                ))}
            </List>
            <Autocomplete
              disablePortal
              sx={{ width: '80%', margin: '5px auto' }}
              id="combo-box-demo"
              onChange={async (e, values) => {
                if (!values) {
                  return;
                }
                const files = await getFiles([eqFiles.rest[values.id]]);
                const obj = new EQFileHandle(
                  values.label,
                  files,
                  rootFileSystemHandle
                );
                await obj.initialize();
                await obj.process(false);
              }}
              options={eqFiles.rest.map((fh, idx) => {
                return {
                  label: fh.name,
                  id   : idx,
                };
              })}
              //  sx={{ width: 300 }}
              renderInput={(params) => (
                <TextField {...params} label="S3D / EQG Files" />
              )}
            />
            {/**
             * Refresh needs user interaction
             */}
            <Button
              sx={{ width: '80%', margin: '5px auto' }}
              onClick={() => refresh()}
              variant="outlined"
            >
              Refresh EQ Directory Link
            </Button>
          </Stack>
        </Paper>
        <Paper
          id="model-container"
          sx={{
            height        : '100%',
            width         : '85%',
            justifyContent: 'center',
            alignContent  : 'center',
            display       : 'flex',
            flexGrow      : '1',
          }}
          elevation={3}
        >
          <BabylonViewer zoneName={zoneName} />
        </Paper>
      </Stack>
    </ThemeProvider>
  );
}

export default App;
