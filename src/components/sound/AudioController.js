import { PFSArchive } from '../../lib/pfs/pfs';
import { getEQDir, getEQFile, getEQFileExists, getEQRootDir, getFiles, getRootFiles, writeEQFile } from '../../lib/util/fileHandler';
import { GlobalStore } from '../../state';
import LocalFilesManager from './midi/LocalFilesManager';
import { MIDIPlayer } from './midi/MIDIPlayer';
import ChipCore from './midi/chip-core';
import XMICore from './xmi_to_midi';
import Sequencer from './midi/Sequencer';

class AudioController {
  initPromise = new Promise(res => {
    this.res = res;
  });
  initialized = false;
  /**
   * @type {HTMLAudioElement}
   */
  mediaSessionAudio = null;
  hasAudio = false;
  type = 'mid';
  handlers = [];
  playerHandlers = [];
  async init() {
    if (this.initialized) {
      return;
    }
    await this.initializeSound(); 
    await this.initializeMidi();
    await this.initializeAudio();
    this.res();
    this.initialized = true;
  }

  async initializeAudio() {
    if ('mediaSession' in navigator) {
      this.hasAudio = true;
      console.log('Attaching Media Key event handlers.');

      // Limitations of MediaSession: there must always be an active audio element.
      // See https://bugs.chromium.org/p/chromium/issues/detail?id=944538
      //     https://github.com/GoogleChrome/samples/issues/637
      this.mediaSessionAudio = document.createElement('audio');
      this.mediaSessionAudio.src = '/static/5-seconds-of-silence.mp3';
      this.mediaSessionAudio.loop = false;
      this.mediaSessionAudio.volume = 0;

      this.mediaSessionAudio.addEventListener('loadedmetadata', this.loadedMetadata.bind(this));
      navigator.mediaSession.setActionHandler('play', () => this.togglePause());
      navigator.mediaSession.setActionHandler('pause', () => this.togglePause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prevSong());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.nextSong());
      navigator.mediaSession.setActionHandler('seekbackward', () => this.seekRelative(-5000));
      navigator.mediaSession.setActionHandler('seekforward', () => this.seekRelative(5000));
    }
  }
  togglePause() {

  }
  prevSong() {}
  nextSong() {}
  seekRelative() {}

  async initializeMidi() {
    const audioCtx = (window.audioCtx = new (window.AudioContext ||
        window.webkitAudioContext)({
      latencyHint: 'playback',
    }));
    const bufferSize = Math.max(
      // Make sure script node bufferSize is at least baseLatency
      Math.pow(
        2,
        Math.ceil(
          Math.log2((audioCtx.baseLatency || 0.001) * audioCtx.sampleRate)
        )
      ),
      2048
    );
    const chipCore = await new ChipCore({
      // Look for .wasm file in web root, not the same location as the app bundle (static/js).
      locateFile: (path, prefix) => {
        if (path.endsWith('.wasm') || path.endsWith('.wast')) {
          return `static/${path}`;
        }
        return prefix + path;
      },
      print   : (msg) => console.debug(`[stdout] ${msg}`),
      printErr: (msg) => console.debug(`[stderr] ${msg}`),
    });
    console.log('ccore', chipCore);
    const localFilesManager = new LocalFilesManager(chipCore.FS, 'local');
    const midiPlayer = new MIDIPlayer(
      chipCore,
      audioCtx.sampleRate,
      bufferSize
    );

    chipCore.FS.syncfs(true, (err) => {
      if (err) {
        console.log('Error populating FS from indexeddb.', err);
      }
      midiPlayer.handleFileSystemReady();
    });
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 1;
    gainNode.connect(audioCtx.destination);
    const playerNode = audioCtx.createScriptProcessor(bufferSize, 0, 2);
    playerNode.connect(gainNode);

    unlockAudioContext(audioCtx);
    // Set up the central audio processing callback. This is where the magic happens.
    playerNode.onaudioprocess = (e) => {
      const channels = [];
      for (let i = 0; i < e.outputBuffer.numberOfChannels; i++) {
        channels.push(e.outputBuffer.getChannelData(i));
      }
      if (!midiPlayer.stopped) {
        midiPlayer.processAudio(channels);
      }
    };
    const sequencer = new Sequencer([midiPlayer], localFilesManager);
    sequencer.player = midiPlayer;
    sequencer.on('sequencerStateUpdate', this.stateUpdate.bind(this));
    this.sequencer = sequencer;
    midiPlayer.on('playerStateUpdate', this.playerUpdate.bind(this));
  }

  addHandler(fn) {
    this.handlers.push(fn);
  }
  removeHandler(fn) {
    this.handlers = this.handlers.filter(f => f !== fn);
  }

  stateUpdate(state) {
    for (const fn of this.handlers) {
      fn(state);
    }
  }

  addPlayerHandler(fn) {
    this.playerHandlers.push(fn);
  }
  removePlayerHandler(fn) {
    this.playerHandlers = this.playerHandlers.filter(f => f !== fn);
  }

  playerUpdate(state) {
    for (const fn of this.playerHandlers) {
      fn(state);
    }
  }

  stop() {
    if (this.type === 'mid') {
      this.sequencer.player.stop();
    } else {
      this.mediaSessionAudio.pause();
      this.mediaSessionAudio.currentTime = 0;
    }
    
  }
  pause() {
    if (this.type === 'mid') {
      this.sequencer.player.togglePause();
    } else {
      this.mediaSessionAudio.pause();
    }
  }

  loadedMetadata(e) {
    const durationMs = this.mediaSessionAudio.duration * 1000; // duration in seconds, multiply by 1000 to get ms
    for (const fn of this.playerHandlers) {
      fn({ durationMs });
    }
  }
  async playAudioBuffer(audioBuffer, mimeType) {
    try {
      // Create a Blob from the audio buffer
      const blob = new Blob([audioBuffer], { type: mimeType });
  
      // Generate a URL for the Blob
      const url = URL.createObjectURL(blob);
      this.mediaSessionAudio.src = url;
      this.mediaSessionAudio.volume = 1;
  
      // Play the audio
      await this.mediaSessionAudio.play();
      
      // Cleanup the URL once the audio finishes playing
      this.mediaSessionAudio.onended = () => {
        URL.revokeObjectURL(url);
      };
    } catch (error) {
      console.error('Error playing audio buffer:', error);
    }
  }
  async play(name) {
    if (this.type === 'mid') {
      await this.sequencer.player.togglePause();
    } else {
      this.stop();
    }

    this.type = name.endsWith('mid') ? 'mid' : name.endsWith('mp3') ? 'mp3' : name.endsWith('wav') ? 'wav' : '';
    await this.initPromise;
    switch (this.type) {
      case 'mid':
        const mid = await getEQFile('sounds', name);
        if (mid) {
          await this.sequencer.playSongBuffer('local/', mid);
        }
        break;
      case 'mp3':
        const mp3Buffer = await getEQFile('root', name);
        await this.playAudioBuffer(mp3Buffer, 'mp3');
        break;
      case 'wav':
        const wavBuffer = await getEQFile('sounds', name);
        await this.playAudioBuffer(wavBuffer, 'wav');
        break;
      default:
        break;
    }

  }

  setMs(ms) {
    if (this.type === 'mid') {
      this.sequencer.player.seekMs(ms);
    } else {
      this.mediaSessionAudio.currentTime = ms / 1000;
    }
  }
  async initializeSound() {
    const root = await getEQRootDir();
    if (!(await getEQFileExists('sounds', 'metadata.json'))) {
      const metadata = {
        wav: [],
        mid: [],
        mp3: [],
      };
      GlobalStore.actions.setLoadingTitle('Loading Sounds');
      GlobalStore.actions.setLoading(true);
      const XMI = await XMICore({
        locateFile: (file) => {
          return `/static/${file}`;
        },
        print   : console.log,
        printErr: console.error,
      });
      for (const file of await getFiles(root, (f) => f.endsWith('.xmi'))) { 
        const arrayBuffer = await file.getFile().then((f) => f.arrayBuffer());
        const buffer = new Uint8Array(arrayBuffer);
        const fileName = file.name.replace(/\.[^/.]+$/, '');
        console.log('filename', fileName);
        const namePtr = XMI._malloc(fileName.length + 1); // Allocate space for file name (+1 for null terminator)
        XMI.stringToUTF8(fileName, namePtr, fileName.length + 1); // Copy string to WASM heap
    
        const arrayBufferPtr = XMI._malloc(buffer.length); // Allocate space for the array buffer
        XMI.HEAPU8.set(buffer, arrayBufferPtr); // Copy the JS buffer into the WASM memory (HEAPU8)
    
        XMI._xmi_to_midi(namePtr, arrayBufferPtr, buffer.length);
    
        XMI._free(namePtr);
        XMI._free(arrayBufferPtr);
        const files = XMI.FS.readdir('./');
        for (const file of files) {
          if (file.startsWith(fileName)) {
            const buffer = XMI.FS.readFile(file);
            GlobalStore.actions.setLoadingText(`Loading ${fileName}.mid`);
            await writeEQFile('sounds', file, buffer);
            metadata.mid.push(file);
          }
        }
      }
      
      for (const file of await getRootFiles(f => f.endsWith('.mp3'))) {
        GlobalStore.actions.setLoadingText(`Loading ${file.name}`);
        metadata.mp3.push(file.name);
      }
          
      for (const file of await getFiles(root, (f) => f.endsWith('.pfs'))) {
        const buffer = await file.getFile().then((f) => f.arrayBuffer());
        const pfs = new PFSArchive();
        pfs.openFromFile(buffer);
        await getEQDir('sounds');
   

        for (const [fileName, _data] of pfs.files.entries()) {
          GlobalStore.actions.setLoadingText(`Loading ${fileName}`);
          if (!(await getEQFileExists('sounds', fileName))) {
            await writeEQFile('sounds', fileName, pfs.getFile(fileName));
          }
          metadata.wav.push(fileName);
        }
      
      }

      await writeEQFile(
        'sounds',
        'metadata.json',
        JSON.stringify(metadata)
      );
      GlobalStore.actions.setLoading(false);
    }
  }


}

function unlockAudioContext(context) {
  // https://hackernoon.com/unlocking-web-audio-the-smarter-way-8858218c0e09
  console.log('AudioContext initial state is %s.', context.state);
  if (context.state === 'suspended') {
    const events = ['touchstart', 'touchend', 'mousedown', 'mouseup'];
    const unlock = () =>
      context
        .resume()
        .then(() =>
          events.forEach((event) =>
            document.body.removeEventListener(event, unlock)
          )
        );
    events.forEach((event) =>
      document.body.addEventListener(event, unlock, false)
    );
  }
}

export const audioController = new AudioController();