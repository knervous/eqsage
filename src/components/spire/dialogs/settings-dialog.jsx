import React, { useCallback, useState } from 'react';
import {
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { CommonDialog } from './common';
import { useSettingsContext } from '../../../context/settings';
import { useDebouncedCallback } from 'use-debounce';
import { UserContext } from 'spire-api';
export const SettingsDialog = ({ onClose }) => {
  const {
    setOption,
    showRegions,
    flySpeed,
    glow,
    webgpu = false,
    forceReload = false,
    singleWorker = false,
    imgCompression = 'png',
    clipPlane = 10000,
    spawnLOD = 500,
    remoteUrl = '',
    showCompass = true,
  } = useSettingsContext();
  const [testState, setTestState] = useState('Ready');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [loginState, setLoginState] = useState('Not Logged In');

  const testConnection = useCallback(async () => {
    UserContext.getUser()
      .then((a) => {
        console.log('user', a);
        setTestState('Succeeded');
      })
      .catch((_e) => {
        setTestState('Failed');
      });
  }, []);
  const login = useCallback(async () => {
    UserContext.loginSpire(user, password)
      .then((a) => {
        console.log('login', a);
        setLoginState(a ? 'Logged in' : 'Failed Login');
      })
      .catch((_e) => {
        setLoginState('Failed Login');
      });
  }, [user, password]);

  return (
    <CommonDialog onClose={onClose} title={'Settings'}>
      <FormControl sx={{}} fullWidth>
        <Typography
          sx={{ fontSize: 14, marginTop: 2, width: '80%' }}
          color="text.secondary"
          gutterBottom
        >
          Camera Fly Speed: {flySpeed}
        </Typography>
        <Slider
          value={flySpeed}
          onChange={(e) => setOption('flySpeed', +e.target.value)}
          step={0.01}
          min={0.01}
          max={20}
        />
      </FormControl>
      <FormControl sx={{}} fullWidth>
        <Typography
          sx={{ fontSize: 14, marginTop: 2, width: '80%' }}
          color="text.secondary"
          gutterBottom
        >
          Clip Plane: {clipPlane}
        </Typography>
        <Slider
          value={clipPlane}
          onChange={(e) => setOption('clipPlane', +e.target.value)}
          step={1}
          min={5}
          max={30000}
        />
      </FormControl>
      <FormControl sx={{}} fullWidth>
        <Typography
          sx={{ fontSize: 14, marginTop: 2, width: '80%' }}
          color="text.secondary"
          gutterBottom
        >
          Spawn LOD: {spawnLOD}
        </Typography>
        <Slider
          value={spawnLOD}
          onChange={useDebouncedCallback(
            (e) => setOption('spawnLOD', +e.target.value),
            100
          )}
          step={1}
          min={0}
          max={1000}
        />
      </FormControl>

      <FormControlLabel
        control={
          <Checkbox
            checked={showRegions}
            onChange={({ target: { checked } }) =>
              setOption('showRegions', checked)
            }
          />
        }
        label="Show Regions"
      />
      <br />
      <FormControlLabel
        control={
          <Checkbox
            checked={glow}
            onChange={({ target: { checked } }) => setOption('glow', checked)}
          />
        }
        label="NPC Glow"
      />
      <br />
      <FormControlLabel
        control={
          <Checkbox
            checked={webgpu}
            onChange={({ target: { checked } }) => setOption('webgpu', checked)}
          />
        }
        label="Use WebGPU Engine"
      />
      <br />
      <FormControlLabel
        control={
          <Checkbox
            checked={singleWorker}
            onChange={({ target: { checked } }) =>
              setOption('singleWorker', checked)
            }
          />
        }
        label="Single Worker Thread"
      />
      <br />
      <FormControlLabel
        control={
          <Checkbox
            checked={forceReload}
            onChange={({ target: { checked } }) =>
              setOption('forceReload', checked)
            }
          />
        }
        label="Force zone reload"
      />
      <br />
      <FormControlLabel
        control={
          <Checkbox
            checked={showCompass}
            onChange={({ target: { checked } }) =>
              setOption('showCompass', checked)
            }
          />
        }
        label="Show Compass"
      />
      <br />
      <FormControl size={'small'}>
        <Typography sx={{ margin: '3px 0' }}>Export Image Compression</Typography>
        <Select
          onChange={(e) => setOption('imgCompression', e.target.value)}
          value={imgCompression}
        >
          <MenuItem value={'webp'}>webp</MenuItem>
          <MenuItem value={'png'}>png</MenuItem>
          <MenuItem value={'jpeg'}>jpeg</MenuItem>
          <MenuItem value={'avif'}>avif</MenuItem>
        </Select>
      </FormControl>
      {!window.Spire && (
        <>
          <FormControl sx={{ margin: '15px 0px' }} fullWidth>
            <Stack
              direction={'row'}
              alignContent={'space-evenly'}
              // justifyContent={'space-evenly'}
              sx={{ width: '100%' }}
            >
              <TextField
                label="Remote URL (Spire Backend)"
                sx={{ width: '300px', marginRight: '10px' }}
                value={remoteUrl}
                placeholder="http://your-url-or-ip:8090"
                onChange={(e) => {
                  setOption('remoteUrl', e.target.value);
                }}
              ></TextField>
              <Button onClick={testConnection}>
                Test Connection ({testState})
              </Button>
            </Stack>
          </FormControl>

          <FormControl sx={{ margin: '15px 0px' }} fullWidth>
            <Stack
              direction={'row'}
              // alignContent={'space-evenly'}
              // justifyContent={'space-around'}
              sx={{ width: '100%' }}
            >
              <TextField
                label="Username"
                sx={{ width: '200px', marginRight: '10px' }}
                value={user}
                onChange={(e) => {
                  setUser(e.target.value);
                }}
              ></TextField>
              <TextField
                type="password"
                label="Password"
                sx={{ width: '200px', marginRight: '10px' }}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
              ></TextField>
              <Button onClick={login}>Login ({loginState})</Button>
            </Stack>
          </FormControl>
        </>
      )}
    </CommonDialog>
  );
};
