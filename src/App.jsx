import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { clear, entries, setMany } from 'idb-keyval';

import {
  Box,
  Button,
  List,
  ListItem,
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

async function* getFilesRecursively(entry) {
  if (entry.kind === 'file') {
    const file = await entry.getFile();
    if (file !== null) {
      yield file;
    }
  } else if (entry.kind === 'directory') {
    for await (const handle of entry.values()) {
      yield* getFilesRecursively(handle);
    }
  }
}
function App() {
  const [fileHandles, setFileHandles] = useState([]);
  const eqHandles = useMemo(() => {
    const usedZones = [...knownZoneShortNames];
    return fileHandles.reduce(
      (acc, val) => {
        const idx = usedZones.findIndex((z) =>
          new RegExp(`^${z}[_\\.].*`).test(val.name)
        );
        if (idx !== -1) {
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

        if (/global.*\.s3d/.test(val.name)) {
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

  useEffect(() => {
    entries().then((entries) => {
      const handles = [];

      for (const entry of entries) {
        if (entry[0]?.startsWith?.('eq/')) {
          handles.push(entry[1]);
        }
      }

      setFileHandles(handles);
    });
  }, []);

  const onDrop = useCallback((e) => {
    if (e.dataTransfer.items?.length) {
      const first = e.dataTransfer.items[0];
      console.log('item 1', first);

      if (first.getAsFileSystemHandle) {
        first
          .getAsFileSystemHandle()
          .then(async (handle) => {
            if (handle.kind === 'file') {
            } else if (handle.kind === 'directory') {
              await clear();
              const handles = [];
              for await (const fileHandle of getFilesRecursively(handle)) {
                handles.push([`eq/${fileHandle.name}`, fileHandle]);
              }
              setMany(handles);
              setFileHandles(handles.map(([, handle]) => handle));
            }
          })
          .catch((e) => {
            console.warn('Could not get handle', e);
          });
      }
    }
    e.preventDefault();
    e.stopPropagation();
  }, []);
  return (
    <ThemeProvider
      theme={createTheme({
        palette   : { mode: 'dark' },
        typography: { fontFamily: 'Montaga' },
      })}
    >
      <Typography
        sx={{
          color    : 'white',
          position : 'fixed',
          margin   : '0 auto',
          top      : '25px',
          width    : '100vw',
          textAlign: 'center',
        }}
        variant="h5"
      >
        Drag an EQ Directory On The Page
      </Typography>
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
            height        : '40%',
            width         : '40%',
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
              {Object.entries(eqHandles.zones).map(([name, fileHandles]) => (
                <ListItem
                  onClick={async () => {
                    const obj = new EQFileHandle(name, fileHandles);
                    await obj.initialize();
                    await obj.process();
                  }}
                >
                  <ListItemText primary={name} />
                </ListItem>
              ))}
            </List>

            
            <Button onClick={async () => {
              const obj = new EQFileHandle('gequip', eqHandles.equip);
              await obj.initialize();
              await obj.process();
            }} variant='outlined'>
              Process Equipment ({eqHandles.equip.length})
            </Button>
            <Button onClick={async () => {
              const obj = new EQFileHandle('global', eqHandles.globalChar);
              await obj.initialize();
              await obj.process();
            }} variant='outlined'>
              Process Global ({eqHandles.globalChar.length})
            </Button>
            <Button onClick={async () => {
              Object.entries(eqHandles.zones).forEach(async ([name, fileHandles]) => {
                const obj = new EQFileHandle(name, fileHandles);
                await obj.initialize();
                await obj.process();
              });
            }} variant='outlined'>
              Process All Zones ({Object.entries(eqHandles.zones).length})
            </Button>
          </Stack>
        </Paper>
      </Stack>
    </ThemeProvider>
  );
}

export default App;
