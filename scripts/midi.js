import MidiWriter from 'midi-writer-js';
import fs from 'fs';
// Create two tracks: one for chords and one for melody.
const chordTrack = new MidiWriter.Track();
const melodyTrack = new MidiWriter.Track();

// Set tempo (90 BPM) on both tracks.
chordTrack.setTempo(90);
melodyTrack.setTempo(90);

// Assign instruments and channels:
// - Chord track (channel 1) gets French Horn (program 60).
// - Melody track (channel 2) gets Acoustic Grand Piano (program 1).
chordTrack.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 60, channel: 1 }));
melodyTrack.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 1, channel: 2 }));

// Helper function to convert MIDI note numbers to note names.
// (Middle C is C4, so note 60 => C4)
function midiToNoteName(midi) {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const note = notes[midi % 12];
  return note + octave;
}

// Define the chord progression (each lasts 4 beats; using whole note duration '1')
// Chords (as MIDI numbers):
//   D minor: [62, 65, 69]  -> D4, F4, A4
//   G minor: [67, 70, 74]  -> G4, A#4, D5
//   A major: [69, 73, 76]  -> A4, C#5, E5
const chords = [
  { notes: [62, 65, 69], beats: 4 },
  { notes: [67, 70, 74], beats: 4 },
  { notes: [69, 73, 76], beats: 4 },
  { notes: [62, 65, 69], beats: 4 },
  { notes: [62, 65, 69], beats: 4 },
  { notes: [67, 70, 74], beats: 4 },
  { notes: [69, 73, 76], beats: 4 },
  { notes: [62, 65, 69], beats: 4 },
];

// In a 4/4 time signature, 4 beats is a whole note ('1')
chords.forEach(chord => {
  const pitches = chord.notes.map(n => midiToNoteName(n));
  chordTrack.addEvent(new MidiWriter.NoteEvent({
    pitch   : pitches,
    duration: '1', // whole note
    channel : 1
  }));
});

// Define the melody as an array of objects.
// Each object has a note (MIDI number) and its duration in beats.
// Beat durations are mapped as follows:
//   1 beat (quarter note) -> '4'
//   2 beats (half note)   -> '2'
//   4 beats (whole note)   -> '1'
const melody = [
  { note: 62, beats: 1 }, { note: 64, beats: 1 }, { note: 65, beats: 2 },
  { note: 65, beats: 1 }, { note: 67, beats: 1 }, { note: 69, beats: 2 },
  { note: 69, beats: 1 }, { note: 67, beats: 1 }, { note: 65, beats: 2 },
  { note: 65, beats: 1 }, { note: 64, beats: 1 }, { note: 62, beats: 2 },
  { note: 62, beats: 1 }, { note: 62, beats: 1 }, { note: 64, beats: 1 }, { note: 65, beats: 1 },
  { note: 67, beats: 1 }, { note: 69, beats: 1 }, { note: 70, beats: 1 }, { note: 69, beats: 1 },
  { note: 67, beats: 1 }, { note: 65, beats: 1 }, { note: 64, beats: 1 }, { note: 62, beats: 1 },
  { note: 62, beats: 4 },
];

function beatsToDuration(beats) {
  if (beats === 1) {
    return '4';
  } // quarter note
  if (beats === 2) {
    return '2';
  } // half note
  if (beats === 4) {
    return '1';
  } // whole note
  return '4';
}

// Add each melody note sequentially on channel 2.
melody.forEach(m => {
  melodyTrack.addEvent(new MidiWriter.NoteEvent({
    pitch   : midiToNoteName(m.note),
    duration: beatsToDuration(m.beats),
    channel : 2
  }));
});

// Create a writer with both tracks.
const writer = new MidiWriter.Writer([chordTrack, melodyTrack]);

// Write the MIDI file to disk.
fs.writeFileSync('regal_rpg_sea_shanty.mid', writer.buildFile());
console.log('MIDI file generated: regal_rpg_sea_shanty.mid');
