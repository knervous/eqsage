import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import PauseIcon from '@mui/icons-material/Pause';

import { useMainContext } from '../main/context';
import { getEQFile } from '../../lib/util/fileHandler';
import { audioController } from '../sound/AudioController';

import './audio.dialog.scss';

function formatMsToMinutesSeconds(ms) {
  const minutes = Math.floor(ms / 60000); // Convert ms to full minutes
  const seconds = ((ms % 60000) / 1000).toFixed(0); // Get remaining seconds and round to 1 decimal place
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`; // Pad seconds with 0 if needed
}

export const AudioDialog = ({ open }) => {
  const { setZoneDialogOpen, zones, setAudioDialogOpen } = useMainContext();

  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [sound, setSound] = useState('');
  const [playMs, setPlayMs] = useState(0);
  const prevSound = useRef();
  const [audioState, setAudioState] = useState({
    state     : 'stop',
    ms        : 0,
    durationMs: 0,
  });

  const stop = () => {
    setAudioState((a) => ({ ...a, state: 'stop' }));
    audioController.stop();
    setPlayMs(0);
  };
  const playSound = useCallback(
    (forPause = false) => {
      if (audioState.state === 'play' && forPause) {
        setAudioState((s) => ({ ...s, state: 'pause' }));
        audioController.pause();
        return;
      }
      if (audioState.state === 'pause') {
        setAudioState((s) => ({ ...s, state: 'play' }));
        audioController.pause();
        return;
      }
      audioController.play(sound);
      setAudioState((s) => ({ ...s, state: 'play' }));
    },
    [sound, audioState.state]
  );

  useEffect(() => {
    if (sound && prevSound.current !== sound) {
      setPlayMs(0);
      playSound();
    }
    setTimeout(() => {
      prevSound.current = sound;
    }, 0);
  }, [sound, playSound]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await audioController.init();
      const metadata = await getEQFile('sounds', 'metadata.json', 'json');
      metadata.mid = metadata.mid.sort();
      metadata.wav = metadata.wav.sort();
      metadata.mp3 = metadata.mp3.sort();
      setMetadata(metadata);
      setLoading(false);
    })();
  }, [zones]);

  useEffect(() => {
    const stateHandler = (_state) => {};
    const playerHandler = (state) => {
      if (state.durationMs) {
        setAudioState((a) => ({ ...a, durationMs: state.durationMs }));
      }
    };

    audioController.addHandler(stateHandler);
    audioController.addPlayerHandler(playerHandler);
    return () => {
      audioController.removePlayerHandler(playerHandler);
      audioController.removeHandler(stateHandler);
    };
  }, []);

  useEffect(() => {
    if (audioState.state === 'stop') {
      setPlayMs(0);
      return;
    }
    if (audioState.state === 'pause') {
      return;
    }
    const interval = setInterval(() => {
      setPlayMs((ms) => ms + 100);
    }, 100);

    return () => clearInterval(interval);
  }, [audioState.duration, audioState.state]);

  return (
    <Dialog
      className="ui-dialog audio-dialog"
      onKeyDown={(e) => e.stopPropagation()}
      maxWidth="md"
      open={open}
      aria-labelledby="draggable-dialog-title"
    >
      <DialogTitle
        style={{ cursor: 'move', margin: '0 auto' }}
        id="draggable-dialog-title"
        className="ui-dialog-title"
      >
        Audio Explorer
      </DialogTitle>
      <DialogContent>
        <Stack direction={'column'}>
          <Typography
            sx={{ fontSize: 18, marginBottom: 2, margin: '15px auto' }}
            color="text.primary"
            gutterBottom
          >
            Welcome to EQ Sage Audio Explorer!
          </Typography>
          <Typography
            sx={{ fontSize: 16, marginBottom: 2, maxWidth: '100%' }}
            color="text.primary"
            gutterBottom
          >
            Audio Explorer handles extraction and conversion of audio files in
            your EverQuest directory and allows you to preview them here in the
            browser. Mp3 files are referenced, .wav files are extracted from
            .pfs archives, and .mid files are extracted from .xmi files. Happy
            listening!
          </Typography>
        </Stack>
        {loading || !metadata ? (
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
            <FormControl
              sx={{
                margin      : '20px 0px',
                border      : '1px solid',
                borderColor : 'rgba(127,127,127, 0.7)',
                padding     : '5px',
                borderRadius: '5px',
              }}
              fullWidth
            >
              <Stack
                direction={'row'}
                alignContent={'center'}
                justifyContent={'center'}
                alignItems={'center'}
              >
                <Box sx={{ width: 'calc(100% - 180px)' }}>
                  <Typography gutterBottom>
                    {`${sound} (${formatMsToMinutesSeconds(
                      audioState.durationMs
                    )})` || 'No Song Selected'}
                  </Typography>
                  <Slider
                    value={playMs}
                    min={0}
                    max={audioState.durationMs}
                    step={1}
                    onChange={(e) => {
                      setPlayMs(e.target.value);
                      audioController.setMs(+e.target.value);
                    }}
                    valueLabelDisplay="auto"
                    valueLabelFormat={formatMsToMinutesSeconds(playMs)}
                  />
                </Box>
                <Button
                  sx={{
                    width       : '62px',
                    height      : '62px',
                    borderRadius: '65px',
                    marginLeft  : '10px',
                  }}
                  disabled={!sound}
                  onClick={() => playSound(true)}
                >
                  {audioState.state === 'play' ? (
                    <PauseIcon />
                  ) : (
                    <PlayArrowIcon />
                  )}
                </Button>
                <Button
                  sx={{
                    width       : '62px',
                    height      : '62px',
                    borderRadius: '65px',
                    marginLeft  : '10px',
                  }}
                  disabled={!sound}
                  onClick={stop}
                >
                  <StopIcon />
                </Button>
              </Stack>
            </FormControl>
            <FormControl fullWidth>
              <Stack direction="row">
                <FormControl
                  size="small"
                  sx={{ m: 1, width: 300, margin: '0' }}
                >
                  <Autocomplete
                    value={sound.endsWith('mid') ? sound : null}
                    size="small"
                    sx={{ margin: '5px 0', maxWidth: '270px' }}
                    onChange={async (e, values) => {
                      setSound(values ?? '');
                    }}
                    options={metadata.mid}
                    renderInput={(params) => (
                      <TextField {...params} label="Midi" />
                    )}
                  />
                </FormControl>
                <Button
                  className="audio-btn"
                  disabled={
                    !sound ||
                    sound === metadata.mid[0] ||
                    !sound.endsWith('mid')
                  }
                  onClick={() => {
                    setSound(metadata.mid[metadata.mid.indexOf(sound) - 1]);
                  }}
                >
                  <KeyboardArrowLeftIcon />
                  Previous
                </Button>
                <Button
                  className="audio-btn"
                  disabled={sound === metadata.mid[metadata.mid.length - 1]}
                  onClick={() => {
                    setSound(metadata.mid[metadata.mid.indexOf(sound) + 1]);
                  }}
                >
                  Next
                  <KeyboardArrowRightIcon />
                </Button>
              </Stack>
            </FormControl>
            <FormControl fullWidth>
              <Stack direction="row">
                <FormControl
                  size="small"
                  sx={{ m: 1, width: 300, margin: '0' }}
                >
                  <Autocomplete
                    value={sound.endsWith('mp3') ? sound : null}
                    size="small"
                    sx={{ margin: '5px 0', maxWidth: '270px' }}
                    onChange={async (e, values) => {
                      setSound(values ?? '');
                    }}
                    options={metadata.mp3}
                    renderInput={(params) => (
                      <TextField {...params} label="Mp3" />
                    )}
                  />
                </FormControl>
                <Button
                  className="audio-btn"
                  disabled={
                    !sound ||
                    sound === metadata.mp3[0] ||
                    !sound.endsWith('mp3')
                  }
                  onClick={() => {
                    setSound(metadata.mp3[metadata.mp3.indexOf(sound) - 1]);
                  }}
                >
                  <KeyboardArrowLeftIcon />
                  Previous
                </Button>
                <Button
                  className="audio-btn"
                  disabled={sound === metadata.mp3[metadata.mp3.length - 1]}
                  onClick={() => {
                    setSound(metadata.mp3[metadata.mp3.indexOf(sound) + 1]);
                  }}
                >
                  Next
                  <KeyboardArrowRightIcon />
                </Button>
              </Stack>
            </FormControl>
            <FormControl fullWidth>
              <Stack direction="row">
                <FormControl
                  size="small"
                  sx={{ m: 1, width: 300, margin: '0' }}
                >
                  <Autocomplete
                    value={sound.endsWith('wav') ? sound : null}
                    size="small"
                    sx={{ margin: '5px 0', maxWidth: '270px' }}
                    onChange={async (e, values) => {
                      setSound(values ?? '');
                    }}
                    options={metadata.wav}
                    renderInput={(params) => (
                      <TextField {...params} label="Wav" />
                    )}
                  />
                </FormControl>
                <Button
                  className="audio-btn"
                  disabled={
                    !sound ||
                    sound === metadata.wav[0] ||
                    !sound.endsWith('wav')
                  }
                  onClick={() => {
                    setSound(metadata.wav[metadata.wav.indexOf(sound) - 1]);
                  }}
                >
                  <KeyboardArrowLeftIcon />
                  Previous
                </Button>
                <Button
                  className="audio-btn"
                  disabled={sound === metadata.wav[metadata.wav.length - 1]}
                  onClick={() => {
                    setSound(metadata.wav[metadata.wav.indexOf(sound) + 1]);
                  }}
                >
                  Next
                  <KeyboardArrowRightIcon />
                </Button>
              </Stack>
            </FormControl>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            setAudioDialogOpen(false);
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
