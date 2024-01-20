import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { clear, get, set } from 'idb-keyval';
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  ThemeProvider,
  Typography,
  createTheme,
} from '@mui/material';

import './App.scss';
import { EQFileHandle } from './lib/model/file-handle';
import { knownZoneShortNames } from './lib/model/constants';
import Dexie from 'dexie';
import { BabylonViewer } from './viewer';

const dbVersion = 1;

const db = new Dexie('eqsage');
db.version(dbVersion).stores({
  eqdir: '++id,path,handle',
});

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
            val.name.includes('oceangreen') ||
            val.name.includes('broodlands') ||
            val.name.includes('bloodfields') ||
             val.name.includes('dranik') ||
            val.name.includes('stillmoon'))
        ) {
          const zoneName = usedZones[idx];
          // usedZones.splice(idx, 1);
          if (acc.zones[zoneName]) {
            acc.zones[zoneName].push(val);
          } else {
            acc.zones[zoneName] = [val];
          }
        }

        if (val.name.startsWith('gequip')) {
          acc.equip.push(val);
        }

        if (/global.*\.s3d/.test(val.name) || val.name === 'sky.s3d') {
          acc.globalChar.push(val);
        }

        return acc;
      },
      {
        zones     : {},
        equip     : [],
        globalChar: [],
      }
    );
  }, [fileHandles]);

  console.log('EQ files', eqFiles);

  const refresh = useCallback(async () => {
    const eqdir = await get('eqdir');
    console.log(await eqdir.queryPermission({ mode: 'read' }));
    if (!(await eqdir.requestPermission({ mode: 'read' })) === 'granted') {
      console.warn('Permissions not granted');
      return;
    }
    if (!eqdir) {
      console.warn('No EQ Directory Linked!');
      return;
    }
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
                await refresh();
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

  const getFiles = useCallback(async (fileHandles) => {
    const eqdir = await get('eqdir');
    if (!eqdir) {
      console.log('No eq dir');
      return;
    }
    const permissionLevel = await eqdir.requestPermission({ mode: 'read' });
    if (permissionLevel !== 'granted') {
      console.warn('Permissions not granted');
      return;
    }
    return Promise.all(fileHandles.map((f) => f.getFile()));
  }, []);
  return (
    <ThemeProvider
      theme={createTheme({
        palette   : { mode: 'dark' },
        typography: { fontFamily: 'Montaga' },
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
                margin   : '0 auto',
                textAlign: 'center',
              }}
              variant="h5"
            >
              Zones
            </Typography>
            <List
              sx={{
                maxHeight: '200px',
                height   : '200px',
                overflow : 'auto',
                padding  : '5px',
                margin   : '15px',
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
                      const obj = new EQFileHandle(name, files);
                      await obj.initialize();
                      await obj.process();
                    }}
                  >
                    <ListItemText primary={name} />
                    {/* {fileHandles
                      .filter(
                        (f) =>
                          f.name.endsWith('.s3d') || f.name.endsWith('.eqg')
                      )
                      .map((n) => (
                        <Button
                          size="small"
                          onClick={async (e) => {
                            const files = await getFiles([n]);
                            const obj = new EQFileHandle(name, files);
                            await obj.initialize();
                            await obj.process();
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                        >
                          {n.name}
                        </Button>
                      ))} */}
                  </ListItemButton>
                ))}
            </List>

            <Button
              onClick={async () => {
                const files = await getFiles(eqFiles.equip);
                const obj = new EQFileHandle('gequip', files);
                await obj.initialize();
                await obj.process();
              }}
              variant="outlined"
            >
              Process Equipment ({eqFiles.equip.length})
            </Button>
            <Button
              onClick={async () => {
                const files = await getFiles(eqFiles.globalChar);
                const obj = new EQFileHandle('global', files);
                await obj.initialize();
                await obj.process();
              }}
              variant="outlined"
            >
              Process Global ({eqFiles.globalChar.length})
            </Button>
            <Button
              onClick={async () => {
                for (const [name, fileHandles] of Object.entries(
                  eqFiles.zones
                )) {
                  const files = await getFiles(fileHandles);
                  const obj = new EQFileHandle(name, files);
                  await obj.initialize();
                  await obj.process();
                }
                // Object.entries(eqFiles.zones).forEach(
                //   async ([name, fileHandles]) => {

                //   }
                // );
              }}
              variant="outlined"
            >
              Process All Zones ({Object.entries(eqFiles.zones).length})
            </Button>
            {/**
             * Refresh needs user interaction
             */}
            <Button onClick={refresh} variant="outlined">
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
