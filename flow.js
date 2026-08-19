/*
 * flow.js
 *
 * Main script for the Arpeggio Flow App.
 *
 * Features:
 *   - Define standard guitar tuning and compute pitch range (minPitch, maxPitch).
 *   - Convert note names for use with VexFlow notation and render notation.
 *   - Render fretboard scale diagrams using Fretboard.js and highlight scale boxes.
 *   - Style fretboard dots based on scale degrees and box inclusion.
 *   - Generate exercises from defined chord progressions or song-defined chords.
 *   - Integrate VexFlow (notation), Tonal.js (music theory), VexChords (chord visuals),
 *     and Strudel playback with tempo/sound controls.
 */

import { SONGS, getSongById } from './songs/songs.js';

// The app's own version, and the single place it is written down. It is
// stamped into every exported file, shown in the page footer, and mirrored in
// package.json; the git tag of a release should match it (`v1.1.0`).
// Bump the minor when a release adds features, the patch for fixes.
const APP_VERSION = '1.2.0';

// Debug flag - set to true for verbose console logging
const DEBUG = true;

function debugLog(...args) {
  if (DEBUG) {
    console.log('[flow]', ...args);
  }
}

const EXERCISE_MODES = {
  RANDOM: 'random',
  SONG: 'song',
};

const exerciseModeState = {
  mode: EXERCISE_MODES.RANDOM,
};

function parseKeySelection(keyValue) {
  const isMinor = keyValue.endsWith('m');
  const tonic = isMinor ? keyValue.slice(0, -1) : keyValue;
  return { tonic, isMinor };
}

function getVexflowKeySignature(tonic, isMinor) {
  if (!isMinor) {
    return tonic;
  }
  const keyInfo = Tonal.Key.minorKey(tonic);
  const accidentalCount = Math.abs(
    keyInfo?.alteration ??
      (keyInfo?.keySignature ? keyInfo.keySignature.length : 0)
  );
  if (accidentalCount <= 7) {
    return `${tonic}m`;
  }
  const enharmonicTonic = Tonal.Note.enharmonic(tonic);
  return `${enharmonicTonic || tonic}m`;
}

function getSelectedKeyValue() {
  const key = document.getElementById('key')?.value || '';
  const scaleType = document.getElementById('scaleType')?.value || 'major';
  return scaleType === 'minor' ? `${key}m` : key;
}

function getSelectedPlaybackEngine() {
  return document.getElementById('playbackEngine')?.value || 'off';
}

function getSelectedExerciseMode() {
  return exerciseModeState.mode;
}

// ─── Instrument (guitar / piano) ─────────────────────────────────────────────
// The exercise engine is instrument-blind: notes are sounding-pitch names all
// the way through. Everything that draws or highlights an instrument goes
// through this registry, so a feature added to the shared engine works on both
// instruments without touching either view.

function getActiveInstrument() {
  return document.getElementById('instrument')?.value === 'piano' ? 'piano' : 'guitar';
}

/** Which hand practices the arpeggio in piano mode; the other one comps. */
function getSelectedPianoHand() {
  return document.getElementById('pianoHand')?.value === 'left' ? 'left' : 'right';
}

const INSTRUMENT_VIEWS = {
  guitar: {
    shapeControlId: 'shape',
    // Guitar is a transposing instrument: written an octave above sounding.
    vexflowOctaveShift: 1,
    renderScaleDiagram: (shapeContext) => renderScaleDiagram(shapeContext),
    renderChordDiagrams: (measureData, shapeContext) =>
      renderArpeggioDiagrams(measureData, shapeContext),
    highlightChord: (measure) => updateFretboardForChord(measure),
    highlightNote: (segment, note, mode, lookahead, beats) =>
      updateFretboardForNote(segment, note, mode, lookahead, beats),
    applyPause: () => applyGuitarPauseStep(),
    resetHighlight: () => resetFretboardHighlight(),
    previewPositionForNote: (shapeContext, note) =>
      findBoxPositionForNote(shapeContext, note),
    renderNextLoopPreview: (container, positions) =>
      renderNextLoopPreview(container, positions),
  },
  piano: {
    shapeControlId: 'pianoRange',
    vexflowOctaveShift: 0,
    renderScaleDiagram: (shapeContext) => renderPianoScaleDiagram(shapeContext),
    renderChordDiagrams: (measureData, shapeContext) =>
      renderPianoChordDiagrams(measureData, shapeContext),
    highlightChord: (measure) => updatePianoForChord(measure),
    highlightNote: (segment, note, mode, lookahead, beats) =>
      updatePianoForNote(segment, note, mode, lookahead, beats),
    applyPause: () => applyPianoPauseStep(),
    resetHighlight: () => resetPianoHighlight(),
    previewPositionForNote: (shapeContext, note) =>
      findPianoPositionForNote(shapeContext, note),
    renderNextLoopPreview: (container, positions) =>
      renderPianoNextLoopPreview(container, positions),
  },
};

function getInstrumentView() {
  return INSTRUMENT_VIEWS[getActiveInstrument()];
}

function getSelectedSongId() {
  return document.getElementById('songSelect')?.value || '';
}

function getSelectedSong() {
  return getSongById(getSelectedSongId());
}

function getSelectedTempoBpm() {
  const tempoValue = parseInt(
    document.getElementById('tempoBpm')?.value || '120',
    10
  );
  if (!Number.isFinite(tempoValue) || tempoValue <= 0) {
    return 120;
  }
  return tempoValue;
}

function getSelectedStrudelSound() {
  return document.getElementById('strudelSound')?.value || 'default';
}

function getStrudelSoundConfig(sound) {
  return STRUDEL_SOUND_CONFIG[sound] || {
    type: 'synth',
    label: `${sound} sound`,
    sample: sound,
  };
}

function getStrudelSoundLabel(sound) {
  return getStrudelSoundConfig(sound).label;
}

function getSelectedRhythm() {
  return document.getElementById('rhythmSound')?.value || 'off';
}

// Bars of rest appended to the loop, so there is time to reset (or to move to
// the next shape) before it comes round again. Rest bars are part of the loop
// grid: the notes stop, the backing rhythm keeps time through them.
const MAX_LOOP_PAUSE_BARS = 16;

function getSelectedLoopPauseBars() {
  const bars = parseInt(document.getElementById('loopPause')?.value || '0', 10);
  if (!Number.isFinite(bars) || bars <= 0) return 0;
  return Math.min(bars, MAX_LOOP_PAUSE_BARS);
}

function getLoopPauseBeats() {
  return getSelectedLoopPauseBars() * getBeatsPerBar();
}

function getSelectedBackingChords() {
  return document.getElementById('backingChords')?.value || 'off';
}

function getBackingChordConfig(value) {
  return BACKING_CHORD_CONFIG[value] || BACKING_CHORD_CONFIG.off;
}

function getSelectedAmbience() {
  return document.getElementById('soundAmbience')?.value || DEFAULT_AMBIENCE;
}

function getAmbienceConfig(ambience) {
  return AMBIENCE_CONFIG[ambience] || AMBIENCE_CONFIG[DEFAULT_AMBIENCE];
}

function getRhythmConfig(rhythm) {
  return RHYTHM_CONFIG[rhythm] || RHYTHM_CONFIG.off;
}

function getRhythmLabel(rhythm) {
  return getRhythmConfig(rhythm).label;
}

/** Human-readable "<sound> + <rhythm>" for the playback banner. */
function describePlaybackVoices() {
  const soundConfig = getStrudelSoundConfig(getSelectedStrudelSound());
  const rhythm = getSelectedRhythm();
  const parts = [];
  if (soundConfig.type !== 'none') {
    parts.push(soundConfig.label);
  }
  const backing = getSelectedBackingChords();
  if (backing !== 'off') {
    parts.push(getBackingChordConfig(backing).label);
  }
  if (rhythm !== 'off') {
    parts.push(getRhythmLabel(rhythm));
  }
  return parts.length ? parts.join(' + ') : 'no sound selected';
}

async function ensureGuitarSamplesLoaded(api) {
  if (guitarSamplesLoaded) {
    return true;
  }
  if (guitarSamplesPromise) {
    return guitarSamplesPromise;
  }
  const samplesFn = api?.samples || window.samples;
  if (typeof samplesFn !== 'function') {
    return false;
  }
  guitarSamplesPromise = (async () => {
    try {
      const result = samplesFn(GUITAR_SAMPLE_MAP, GUITAR_SAMPLE_BANK);
      if (result && typeof result.then === 'function') {
        await result;
      }
      guitarSamplesLoaded = true;
      return true;
    } catch (error) {
      console.warn('Failed to load guitar samples:', error);
      return false;
    }
  })();
  return guitarSamplesPromise;
}

async function ensureGuitarVariantSamplesLoaded(api) {
  if (guitarVariantSamplesLoaded) {
    return true;
  }
  if (guitarVariantSamplesPromise) {
    return guitarVariantSamplesPromise;
  }
  const samplesFn = api?.samples || window.samples;
  if (typeof samplesFn !== 'function') {
    return false;
  }
  guitarVariantSamplesPromise = (async () => {
    try {
      const result = samplesFn(GUITAR_VARIANT_SAMPLE_MAP, GUITAR_VARIANT_SAMPLE_BANK);
      if (result && typeof result.then === 'function') {
        await result;
      }
      guitarVariantSamplesLoaded = true;
      return true;
    } catch (error) {
      console.warn('Failed to load guitar variant samples:', error);
      return false;
    }
  })();
  return guitarVariantSamplesPromise;
}

async function ensureDrumSamplesLoaded(api) {
  if (drumSamplesLoaded) {
    return true;
  }
  if (drumSamplesPromise) {
    return drumSamplesPromise;
  }
  const samplesFn = api?.samples || window.samples;
  if (typeof samplesFn !== 'function') {
    return false;
  }
  drumSamplesPromise = (async () => {
    try {
      // A URL string makes samples() fetch the map and use its _base; the
      // audio files themselves are only fetched when a sound first triggers.
      const result = samplesFn(DRUM_SAMPLE_MAP_URL);
      if (result && typeof result.then === 'function') {
        await result;
      }
      drumSamplesLoaded = true;
      return true;
    } catch (error) {
      console.warn('Failed to load drum samples:', error);
      return false;
    }
  })();
  return drumSamplesPromise;
}

const playbackState = {
  engine: 'off',
  notes: [],
  measuresData: [],
  stavePositions: [],
  beatSlots: [],
  isPlaying: false,
  isPaused: false,
};

// Stores the last generated exercise state for use in the scale-degrees modal
let lastExerciseState = null; // { cagedShape, measureData, keyLabel }

const playbackUi = {
  banner: null,
  // Two mirrored transports: below the notation and above the head/exercise
  // (long sheets otherwise put the buttons a screen away).
  playButtons: [],
  stopButtons: [],
};

let strudelApi = null;
let strudelInitPromise = null;
// Playback goes through one long-lived wrapper pattern that delegates its
// queries to strudelPatternRef; continuous shift swaps the ref without ever
// stopping the scheduler clock (a stop/start seam re-emits boundary notes).
let strudelPatternRef = null;
let strudelWrapperActive = false;
// Loop length + tempo of the pattern currently playing. An in-place swap only
// stays on the grid while both hold; when they change (cycling to a pinned
// exercise of another length or tempo) the clock has to restart instead.
let strudelLoopSignature = null;

function getStrudelPatternClass(api) {
  if (api && typeof api.Pattern === 'function') {
    return api.Pattern;
  }
  if (typeof window !== 'undefined' && typeof window.Pattern === 'function') {
    return window.Pattern;
  }
  return null;
}
let strudelCdnPromise = null;
let guitarSamplesPromise = null;
let guitarSamplesLoaded = false;
let guitarVariantSamplesPromise = null;
let guitarVariantSamplesLoaded = false;
let drumSamplesPromise = null;
let drumSamplesLoaded = false;
let soundfontsPromise = null;
let soundfontsLoaded = false;

const STRUDEL_CDN_URL = 'https://unpkg.com/@strudel/web@1.2.6';
const STRUDEL_ESM_URL = 'https://esm.sh/@strudel/web@1.2.6?target=es2022';
const SOUNDFONTS_ESM_URL =
  'https://esm.sh/@strudel/soundfonts@1.2.6?bundle';
const SOUNDFONT_BASE_URL = 'https://felixroos.github.io/webaudiofontdata/sound';
const GUITAR_SAMPLE_BANK = 'github:tidalcycles/dirt-samples';
const GUITAR_SAMPLE_MAP = {
  gtr: 'gtr/0001_cleanC.wav',
};
const GUITAR_VARIANT_SAMPLE_BANK = 'github:jarmitage/jarmitage.github.io/master/';
const GUITAR_VARIANT_SAMPLE_MAP = {
  guitar1: 'samples/guitar/guitar_0.wav',
  guitar2: 'samples/guitar/guitar_1.wav',
  guitar3: 'samples/guitar/guitar_2.wav',
  guitar4: 'samples/guitar/guitar_3.wav',
  guitar5: 'samples/guitar/guitar_4.wav',
};
const STRUDEL_SOUND_CONFIG = {
  none: { type: 'none', label: 'No melody sound' },
  'gtr-pluck': { type: 'dirt', sample: 'gtr', label: 'Plucked (Koto-like)' },
  'guitar-1': { type: 'sample-map', sample: 'guitar1', label: 'Guitar (Sample 1)' },
  'guitar-2': { type: 'sample-map', sample: 'guitar2', label: 'Guitar (Sample 2)' },
  'guitar-3': { type: 'sample-map', sample: 'guitar3', label: 'Guitar (Sample 3)' },
  'guitar-4': { type: 'sample-map', sample: 'guitar4', label: 'Guitar (Sample 4)' },
  'guitar-5': { type: 'sample-map', sample: 'guitar5', label: 'Guitar (Sample 5)' },
  gm_acoustic_guitar_nylon: {
    type: 'soundfont',
    label: 'Acoustic Guitar (Nylon)',
    sample: 'gm_acoustic_guitar_nylon',
  },
  gm_acoustic_guitar_steel: {
    type: 'soundfont',
    label: 'Acoustic Guitar (Steel)',
    sample: 'gm_acoustic_guitar_steel',
  },
  gm_distortion_guitar: {
    type: 'soundfont',
    label: 'Distortion Guitar',
    sample: 'gm_distortion_guitar',
  },
  gm_electric_guitar_clean: {
    type: 'soundfont',
    label: 'Electric Guitar (Clean)',
    sample: 'gm_electric_guitar_clean',
  },
  gm_electric_guitar_jazz: {
    type: 'soundfont',
    label: 'Electric Guitar (Jazz)',
    sample: 'gm_electric_guitar_jazz',
  },
  gm_blues_guitar: {
    type: 'soundfont',
    label: 'Blues Guitar (warm overdrive)',
    sample: 'gm_blues_guitar',
  },
  gm_electric_guitar_muted: {
    type: 'soundfont',
    label: 'Electric Guitar (Muted)',
    sample: 'gm_electric_guitar_muted',
  },
  gm_guitar_fret_noise: {
    type: 'soundfont',
    label: 'Guitar Fret Noise',
    sample: 'gm_guitar_fret_noise',
  },
  gm_guitar_harmonics: {
    type: 'soundfont',
    label: 'Guitar Harmonics',
    sample: 'gm_guitar_harmonics',
  },
  gm_overdriven_guitar: {
    type: 'soundfont',
    label: 'Overdriven Guitar',
    sample: 'gm_overdriven_guitar',
  },
  gm_acoustic_grand_piano: {
    type: 'soundfont',
    label: 'Acoustic Grand Piano',
    sample: 'gm_acoustic_grand_piano',
    // Sustain-pedal feel, tuned in debug/sound-lab.html: notes ring past
    // their beat (clip 2.05) with a long tail and their own space. Applied
    // to the lead after the ambience, so these win on overlapping keys.
    envelope: {
      attack: 0.015,
      decay: 1.12,
      sustain: 0.47,
      release: 1.58,
      clip: 2.05,
      room: 0.45,
      roomsize: 5,
    },
  },
  default: { type: 'synth', label: 'Synth (Default)' },
};
// Drum kit for the backing rhythm. @strudel/web's prebake only registers the
// synth sounds, so the sample registry has to be loaded by hand - this JSON
// map (the same one the official Strudel REPL prebakes) names bd/sd/hh/oh/
// rim/cp/rd/cr/perc and resolves them against the tidal-drum-machines repo.
const DRUM_SAMPLE_MAP_URL =
  'https://raw.githubusercontent.com/felixroos/dough-samples/main/EmuSP12.json';

// Backing rhythm played underneath (or instead of) the exercise notes. It
// follows the tempo, not the note rhythm: one token per beat of the loop.
// A layer maps (beatInMeasure, beatsInMeasure) to a mini-notation token:
// 'hh' is one hit on the beat, '[hh hh]' two eighths, '~' a rest. A layer is
// either that function or { token, gain } when it needs its own level.
const RHYTHM_CONFIG = {
  off: { type: 'off', label: 'Off' },
  metronome: { type: 'click', label: 'Metronome Click' },
  'metronome-accent': { type: 'click', label: 'Metronome (accent on 1)', accent: true },
  rim: { type: 'drums', label: 'Rimshot Click', layers: [() => 'rim'] },
  hihat: { type: 'drums', label: 'Hi-Hat (quarters)', layers: [() => 'hh'] },
  'hihat-eighths': { type: 'drums', label: 'Hi-Hat (eighths)', layers: [() => '[hh hh]'] },
  backbeat: {
    type: 'drums',
    label: 'Kick & Snare',
    layers: [(beat) => (beat % 2 === 0 ? 'bd' : 'sd')],
  },
  rock: {
    type: 'drums',
    label: 'Rock Beat',
    layers: [(beat) => (beat % 2 === 0 ? 'bd' : 'sd'), () => '[hh hh]'],
  },
  'jazz-swing': {
    type: 'drums',
    label: 'Jazz Ride (swing)',
    // Ride on every beat, swung "ding-da" on 2 and 4; hi-hat foot on 2 and 4.
    // The ride sample is far hotter than the kit's other sounds, so it sits
    // well below the default rhythm gain - it should brush along under the
    // exercise, not lead it.
    layers: [
      { token: (beat) => (beat % 2 === 0 ? 'rd' : '[rd@2 rd]'), gain: 0.22 },
      { token: (beat) => (beat % 2 === 1 ? 'hh' : '~'), gain: 0.35 },
    ],
  },
  bossa: {
    type: 'drums',
    label: 'Bossa (rim & kick)',
    layers: [
      (beat) => (beat % 2 === 0 ? 'bd' : '[~ bd]'),
      (beat) => ['rim', '[~ rim]', '~', 'rim'][beat % 4],
      () => '[hh hh]',
    ],
  },
};
const DEFAULT_RHYTHM_GAIN = 0.7;

// Effects applied to the exercise notes (never to the drums). Soundfonts
// default to a 10ms release, which is what makes the arpeggios sound clipped
// and staccato; `release` lets each note ring past its slot and `room` puts it
// in a space. `clip` stretches the note itself so neighbours overlap slightly.
// Every key here is a Strudel control name and is applied only if this build
// exposes it.
const AMBIENCE_CONFIG = {
  dry: { label: 'Dry' },
  room: { label: 'Room', release: 0.35, clip: 1.25, room: 0.3, roomsize: 2 },
  hall: { label: 'Hall', release: 0.7, clip: 1.4, room: 0.6, roomsize: 5 },
  slapback: {
    label: 'Slapback echo',
    release: 0.4,
    clip: 1.3,
    room: 0.2,
    roomsize: 1.5,
    delay: 0.3,
    delaytime: 0.14,
    delayfeedback: 0.25,
  },
};
const DEFAULT_AMBIENCE = 'room';

// Chords comped under the exercise, built from the chart's own harmony. Each
// preset says which beats of a chord's segment get a hit, and how long it
// rings (clip multiplies the note's own beat-long duration).
const BACKING_CHORD_CONFIG = {
  off: { type: 'off', label: 'Off' },
  'piano-held': {
    label: 'Piano (held)',
    sound: 'gm_acoustic_grand_piano',
    gain: 0.32,
    // One hit at the top of each chord, ringing across the whole segment.
    hits: (beats) => [{ beat: 0, clip: beats }],
  },
  'piano-comp': {
    label: 'Piano (comp on 2 & 4)',
    sound: 'gm_acoustic_grand_piano',
    gain: 0.38,
    hits: (beats) =>
      Array.from({ length: beats }, (unused, beat) => beat)
        .filter((beat) => beat % 2 === 1)
        .map((beat) => ({ beat, clip: 0.9 })),
  },
  'piano-quarters': {
    label: 'Piano (quarters)',
    sound: 'gm_acoustic_grand_piano',
    gain: 0.3,
    hits: (beats) =>
      Array.from({ length: beats }, (unused, beat) => ({ beat, clip: 0.9 })),
  },
  // The waltz-style left hand (bass note, then chords) squared to the app's
  // 4/4 grid: `bass: true` hits play the root alone, an octave below the
  // chord voicing.
  'piano-bass-chords': {
    label: 'Piano (bass & chords)',
    sound: 'gm_acoustic_grand_piano',
    gain: 0.34,
    hits: (beats) =>
      Array.from({ length: beats }, (unused, beat) =>
        beat === 0 ? { beat, clip: 1, bass: true } : { beat, clip: 0.9 }
      ),
  },
  'piano-stride': {
    label: 'Piano (stride: bass on 1 & 3)',
    sound: 'gm_acoustic_grand_piano',
    gain: 0.34,
    hits: (beats) =>
      Array.from({ length: beats }, (unused, beat) =>
        beat % 2 === 0 ? { beat, clip: 1, bass: true } : { beat, clip: 0.9 }
      ),
  },
};

const GM_SOUNDFONT_FONTS = {
  // Not a GM program of its own: the blues voice is the overdriven-guitar
  // program (29) from the JCLive bank, which is warmer and sustains longer
  // than the FluidR3 one - the singing, barely-broken-up tone of the
  // "Robben Ford - Playing the Blues" examples. Pair it with the Room or
  // Slapback ambience below for the note tails.
  gm_blues_guitar: ['0290_JCLive_sf2_file'],
  // Comping voice for the backing-chords layer, and the lead sound in
  // piano mode. JCLive over FluidR3: rounder hammer, longer natural decay
  // (auditioned in debug/sound-lab.html).
  gm_acoustic_grand_piano: ['0000_JCLive_sf2_file'],
  gm_acoustic_guitar_nylon: ['0240_FluidR3_GM_sf2_file'],
  gm_acoustic_guitar_steel: ['0250_FluidR3_GM_sf2_file'],
  gm_distortion_guitar: ['0300_FluidR3_GM_sf2_file'],
  gm_electric_guitar_clean: ['0270_FluidR3_GM_sf2_file'],
  gm_electric_guitar_jazz: ['0260_FluidR3_GM_sf2_file'],
  gm_electric_guitar_muted: ['0281_FluidR3_GM_sf2_file'],
  gm_guitar_fret_noise: ['1200_FluidR3_GM_sf2_file'],
  gm_guitar_harmonics: ['0310_FluidR3_GM_sf2_file'],
  gm_overdriven_guitar: ['0290_FluidR3_GM_sf2_file'],
};

function getGlobalStrudelApi() {
  if (typeof window === 'undefined') {
    return null;
  }
  if (typeof window.initStrudel !== 'function') {
    return null;
  }
  return {
    initStrudel: window.initStrudel,
    note: (...args) => window.note?.(...args),
    // s/stack are installed as globals by initStrudel's evalScope, so these
    // stay lazy - they are looked up at call time, not at wrapper creation.
    s: (...args) => window.s?.(...args),
    stack: (...args) => window.stack?.(...args),
    hush: (...args) => window.hush?.(...args),
    evaluate: (...args) => window.evaluate?.(...args),
    setcpm: (...args) => window.setcpm?.(...args),
    setCpm: (...args) => window.setCpm?.(...args),
    samples: (...args) => window.samples?.(...args),
    registerSound: (...args) => window.registerSound?.(...args),
    getADSRValues: (...args) => window.getADSRValues?.(...args),
    getSoundIndex: (...args) => window.getSoundIndex?.(...args),
    getAudioContext: (...args) => window.getAudioContext?.(...args),
    getParamADSR: (...args) => window.getParamADSR?.(...args),
    getVibratoOscillator: (...args) => window.getVibratoOscillator?.(...args),
    getPitchEnvelope: (...args) => window.getPitchEnvelope?.(...args),
  };
}

function waitForStrudelGlobal(timeoutMs = 3000) {
  const api = getGlobalStrudelApi();
  if (api) {
    return Promise.resolve(api);
  }
  if (typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  const script = document.querySelector('script[src*="@strudel/web"]');
  if (!script) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(getGlobalStrudelApi());
    };
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', finish, { once: true });
    setTimeout(finish, timeoutMs);
  });
}

function hasStrudelScriptTag() {
  if (typeof document === 'undefined') {
    return false;
  }
  return Boolean(document.querySelector('script[src*="@strudel/web"]'));
}

function loadStrudelCdn() {
  if (strudelCdnPromise) {
    return strudelCdnPromise;
  }
  strudelCdnPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-strudel-cdn="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Strudel CDN failed to load.')));
      return;
    }
    const script = document.createElement('script');
    script.src = STRUDEL_CDN_URL;
    script.async = true;
    script.dataset.strudelCdn = 'true';
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Strudel CDN failed to load.')));
    document.head.appendChild(script);
  });
  return strudelCdnPromise;
}

async function ensureSoundfontsLoaded(api) {
  if (soundfontsLoaded) {
    return true;
  }
  if (soundfontsPromise) {
    return soundfontsPromise;
  }
  if (!api || typeof api.registerSound !== 'function') {
    return false;
  }
  soundfontsPromise = (async () => {
    try {
      const module = await import(SOUNDFONTS_ESM_URL);
      const {
        getFontBufferSource,
        setSoundfontUrl,
      } = module;
      if (typeof getFontBufferSource !== 'function') {
        return false;
      }
      if (typeof setSoundfontUrl === 'function') {
        setSoundfontUrl(SOUNDFONT_BASE_URL);
      }
      const {
        registerSound,
        getADSRValues,
        getSoundIndex,
        getAudioContext,
        getParamADSR,
        getVibratoOscillator,
        getPitchEnvelope,
      } = api;
      if (
        typeof getADSRValues !== 'function' ||
        typeof getSoundIndex !== 'function' ||
        typeof getAudioContext !== 'function' ||
        typeof getParamADSR !== 'function' ||
        typeof getVibratoOscillator !== 'function' ||
        typeof getPitchEnvelope !== 'function'
      ) {
        return false;
      }
      Object.entries(GM_SOUNDFONT_FONTS).forEach(([name, fonts]) => {
        registerSound(
          name,
          async (startTime, event, done) => {
            const [attack, decay, sustain, release] = getADSRValues([
              event.attack,
              event.decay,
              event.sustain,
              event.release,
            ]);
            const { duration } = event;
            const fontIndex = getSoundIndex(event.n, fonts.length);
            const fontName = fonts[fontIndex];
            const audioContext = getAudioContext();
            const bufferSource = await getFontBufferSource(fontName, event, audioContext);
            bufferSource.start(startTime);
            const gainNode = audioContext.createGain();
            const outputNode = bufferSource.connect(gainNode);
            const stopTime = startTime + duration;
            getParamADSR(
              outputNode.gain,
              attack,
              decay,
              sustain,
              release,
              0,
              0.3,
              startTime,
              stopTime,
              'linear'
            );
            const tailTime = stopTime + release + 0.01;
            const vibrato = getVibratoOscillator(bufferSource.detune, event, startTime);
            getPitchEnvelope(bufferSource.detune, event, startTime, stopTime);
            bufferSource.stop(tailTime);
            bufferSource.onended = () => {
              bufferSource.disconnect();
              vibrato?.stop();
              outputNode.disconnect();
              done();
            };
            return { node: outputNode, stop: () => {} };
          },
          { type: 'soundfont', prebake: true, fonts }
        );
      });
      soundfontsLoaded = true;
      return true;
    } catch (error) {
      console.warn('Failed to load soundfonts:', error);
      return false;
    }
  })();
  return soundfontsPromise;
}

async function loadStrudelApi() {
  if (strudelApi) {
    return strudelApi;
  }
  const globalApi = getGlobalStrudelApi();
  if (globalApi) {
    strudelApi = globalApi;
    return strudelApi;
  }
  const waitedApi = await waitForStrudelGlobal();
  if (waitedApi) {
    strudelApi = waitedApi;
    return strudelApi;
  }
  if (hasStrudelScriptTag()) {
    return null;
  }
  try {
    strudelApi = await import(STRUDEL_ESM_URL);
    return strudelApi;
  } catch (error) {
    console.error('Failed to load Strudel:', error);
    try {
      await loadStrudelCdn();
      const cdnApi = getGlobalStrudelApi();
      if (cdnApi) {
        strudelApi = cdnApi;
        setPlaybackBanner('Loaded Strudel from CDN.', 'info');
        return strudelApi;
      }
    } catch (cdnError) {
      console.error('Failed to load Strudel CDN:', cdnError);
    }
    setPlaybackBanner('Strudel failed to load. Run via Parcel or allow CDN access.', 'warning');
    return null;
  }
}

async function ensureStrudelReady() {
  const api = await loadStrudelApi();
  if (!api) {
    setPlaybackBanner('Strudel failed to load. Check your CDN connection.', 'warning');
    return null;
  }
  if (!strudelInitPromise) {
    strudelInitPromise = api.initStrudel();
  }
  await strudelInitPromise;
  return api;
}

function setPlaybackBanner(message, tone = 'info') {
  if (!playbackUi.banner) {
    return;
  }
  if (!message) {
    playbackUi.banner.textContent = '';
    playbackUi.banner.classList.add('status-banner--hidden');
    playbackUi.banner.classList.remove('status-banner--info', 'status-banner--warning');
    return;
  }
  playbackUi.banner.textContent = message;
  playbackUi.banner.classList.remove('status-banner--hidden');
  playbackUi.banner.classList.toggle('status-banner--info', tone === 'info');
  playbackUi.banner.classList.toggle('status-banner--warning', tone === 'warning');
}

// ─── Visual Playback ──────────────────────────────────────────────────────────

let visualPlaybackTimerId = null;
let visualPlaybackIndex = 0;

function isVisualPlaybackEnabled() {
  return document.getElementById('playbackVisual')?.checked ?? true;
}

function isAudioPlaybackEnabled() {
  return document.getElementById('playbackAudio')?.checked ?? true;
}

/** Inject (or re-use) the playback highlight rect into the VexFlow SVG. */
function ensurePlaybackHighlightRect() {
  const notationDiv = document.getElementById('notation');
  if (!notationDiv) return null;
  let rect = notationDiv.querySelector('#playback-highlight');
  if (!rect) {
    const svg = notationDiv.querySelector('svg');
    if (!svg) return null;
    const svgNs = 'http://www.w3.org/2000/svg';
    rect = document.createElementNS(svgNs, 'rect');
    rect.setAttribute('id', 'playback-highlight');
    rect.setAttribute('fill', 'rgba(255, 220, 80, 0.18)');
    rect.setAttribute('stroke', 'rgba(255, 190, 0, 0.55)');
    rect.setAttribute('stroke-width', '1.5');
    rect.setAttribute('rx', '4');
    rect.setAttribute('visibility', 'hidden');
    // Insert as first child so it renders behind notes
    svg.insertBefore(rect, svg.firstChild);
  }
  return rect;
}

function moveHighlightToMeasure(idx) {
  const pos = playbackState.stavePositions[idx];
  if (!pos) return;
  const rect = ensurePlaybackHighlightRect();
  if (!rect) return;
  const padding = 4;
  rect.setAttribute('x', pos.x - padding);
  rect.setAttribute('y', pos.y - padding);
  rect.setAttribute('width', pos.width + padding * 2);
  rect.setAttribute('height', pos.height + padding * 2);
  rect.setAttribute('visibility', 'visible');
}

function hideHighlightRect() {
  const notationDiv = document.getElementById('notation');
  if (!notationDiv) return;
  const rect = notationDiv.querySelector('#playback-highlight');
  if (rect) rect.setAttribute('visibility', 'hidden');
}

// ── Fretboard coloring constants ─────────────────────────────────────────────
const FRETBOARD_SVG_NS = 'http://www.w3.org/2000/svg';
const FRETBOARD_DOT_RING_RADIUS = 25 * 0.5 + 1.5; // dotSize/2 + gap
// CSS colors (must match styles.css !important rules)
const FRETBOARD_COLOR_ROOT  = '#99c28d'; // matches .dot-degree-1
const FRETBOARD_COLOR_INBOX = '#accedb'; // matches .dot-in-box
const FRETBOARD_COLOR_PLAYING = '#ffb703'; // current note during per-note playback
// Upcoming notes: same amber as the current note while we stay inside the
// current chord, violet once the preview crosses into the next measure.
const FRETBOARD_COLOR_UPCOMING = '#ffb703';
const FRETBOARD_COLOR_UPCOMING_NEXT_CHORD = '#9d7bff';
// Notes from the next loop of a continuous shift: another key/shape entirely,
// so they get their own colour and sit wherever that box is on the neck.
const FRETBOARD_COLOR_UPCOMING_NEXT_LOOP = '#0d9488';
// Opacity per step of lookahead - index 0 is the note right after the current
// one. The length of this list is how far ahead the preview reaches. The next
// note stays clearly readable; the drop-off across the three does the work of
// showing how far away each one is.
const FRETBOARD_LOOKAHEAD_OPACITIES = [0.9, 0.62, 0.38];
// Rings: all black (same in static and playback views)
const SCALE_DEGREE_RING_DEGREES = new Set([1, 3, 5, 7]);

function addRingToDot(dotEl, dotCircle, radius = FRETBOARD_DOT_RING_RADIUS) {
  const ring = document.createElementNS(FRETBOARD_SVG_NS, 'circle');
  ring.setAttribute('cx', dotCircle.getAttribute('cx'));
  ring.setAttribute('cy', dotCircle.getAttribute('cy'));
  ring.setAttribute('r', radius);
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', '#000000');
  ring.setAttribute('stroke-width', '2.5');
  ring.setAttribute('class', 'dot-ring');
  dotEl.insertBefore(ring, dotEl.querySelector('.dot-text, .piano-marker-text'));
}

/** Small "R"/"3"/"5"/"7" tag at the top-right of a ringed dot. */
function addDegreeLabelToDot(dotEl, dotCircle, degreeNum, radius = FRETBOARD_DOT_RING_RADIUS) {
  const label = document.createElementNS(FRETBOARD_SVG_NS, 'text');
  // cx/cy can be percentage strings (fretboard.js positions dots that way),
  // so copy them verbatim and offset with dx/dy instead of computing pixels.
  label.setAttribute('x', dotCircle.getAttribute('cx'));
  label.setAttribute('y', dotCircle.getAttribute('cy'));
  label.setAttribute('dx', radius - 3);
  label.setAttribute('dy', -(radius - 3));
  label.setAttribute('class', 'dot-degree-label');
  label.textContent = degreeNum === 1 ? 'R' : String(degreeNum);
  dotEl.appendChild(label);
}

// How long the note lasts, as a glyph beside the dot: the exercise only writes
// quarters and beamed eighths today, and anything longer would be a half note.
function getDurationGlyph(beats) {
  if (!Number.isFinite(beats) || beats <= 0) return null;
  if (beats <= 0.5) return '♪';
  if (beats >= 2) return '𝅗𝅥';
  return '♩';
}

/** Note-value glyph to the right of a dot, level with its centre. */
function addDurationLabelToDot(dotEl, dotCircle, beats, radius = FRETBOARD_DOT_RING_RADIUS) {
  const glyph = getDurationGlyph(beats);
  if (!glyph) return;
  const label = document.createElementNS(FRETBOARD_SVG_NS, 'text');
  // cx/cy can be percentage strings, so offset with dx/dy like the degree tag.
  label.setAttribute('x', dotCircle.getAttribute('cx'));
  label.setAttribute('y', dotCircle.getAttribute('cy'));
  label.setAttribute('dx', radius + 5);
  label.setAttribute('dy', 4);
  label.setAttribute('class', 'dot-duration');
  label.textContent = glyph;
  dotEl.appendChild(label);
}

/** Restore static scale-degree coloring (CSS controls fills; we only manage rings + opacity). */
function applyScaleDegreeColoring(fretboardDiv) {
  fretboardDiv.querySelectorAll('.dot').forEach((dotEl) => {
    const data = dotEl.__data__;
    if (!data) return;
    const dotCircle = dotEl.querySelector('.dot-circle');
    if (!dotCircle) return;
    dotEl.style.opacity = '1';
    // Remove any playback-time inline fill override so CSS !important takes over again
    dotCircle.style.removeProperty('fill');
    dotEl.querySelectorAll('.dot-ring, .dot-degree-label, .dot-duration').forEach((r) => r.remove());
    if (data.inBox && SCALE_DEGREE_RING_DEGREES.has(data.degree)) {
      addRingToDot(dotEl, dotCircle);
      addDegreeLabelToDot(dotEl, dotCircle, data.degree);
    }
  });
}

/**
 * During playback: re-color in-box dots relative to the current chord.
 * - Chord root        → FRETBOARD_COLOR_ROOT  + black ring
 * - Chord 3rd/5th/7th → FRETBOARD_COLOR_INBOX + black ring
 * - Non-chord in-box  → dimmed (opacity 0.2), no ring
 * Additionally, dots whose exact pitch is one of the 4 played notes get a red ring.
 */
function updateFretboardForChord(measure) {
  const fretboardDiv = document.getElementById('fretboard-container');
  if (!fretboardDiv || !measure) return;
  // The loop below only touches in-box dots, so a preview drawn outside the
  // box on the previous step has to be cleared here.
  clearNextLoopPreview(fretboardDiv);

  const { rootNote, quality } = measure;
  const chordData = Tonal.Chord.get(`${rootNote}${quality}`);
  const chromaToIntervalNum = {};
  if (chordData && chordData.notes && chordData.intervals) {
    chordData.notes.forEach((note, i) => {
      const num = parseInt(chordData.intervals[i], 10);
      chromaToIntervalNum[Tonal.Note.chroma(note)] = num;
    });
  }

  // Build a set of MIDI values for the exact notes being played this measure
  const playedMidiSet = new Set(
    (measure.generatedNotes || []).map((n) => Tonal.Note.midi(n)).filter(Number.isFinite)
  );

  fretboardDiv.querySelectorAll('.dot').forEach((dotEl) => {
    const data = dotEl.__data__;
    if (!data || !data.inBox) return;
    const dotCircle = dotEl.querySelector('.dot-circle');
    if (!dotCircle) return;

    dotEl.querySelectorAll('.dot-ring, .dot-degree-label, .dot-duration').forEach((r) => r.remove());

    const intervalNum = chromaToIntervalNum[Tonal.Note.chroma(data.note)];

    if (intervalNum === undefined) {
      dotEl.style.opacity = '0.2';
      dotCircle.style.removeProperty('fill');
      return;
    }

    dotEl.style.opacity = '1';
    // Use setProperty with 'important' to override CSS !important rules
    const fill = intervalNum === 1 ? FRETBOARD_COLOR_ROOT : FRETBOARD_COLOR_INBOX;
    dotCircle.style.setProperty('fill', fill, 'important');

    // Black ring for root, 3rd, 5th, 7th (matching static view language)
    if (SCALE_DEGREE_RING_DEGREES.has(intervalNum)) {
      addRingToDot(dotEl, dotCircle);
      addDegreeLabelToDot(dotEl, dotCircle, intervalNum);
    }

    // Red ring for the exact notes played this measure
    if (playedMidiSet.size > 0) {
      // Compute the MIDI of this dot from its string and fret
      const stringIndex = tuning.length - data.string; // data.string: 6=low E → index 0
      const openMidi = Tonal.Note.midi(tuning[stringIndex]);
      if (Number.isFinite(openMidi)) {
        const dotMidi = openMidi + data.fret;
        if (playedMidiSet.has(dotMidi)) {
          addPlayedNotesRing(dotEl, dotCircle);
        }
      }
    }
  });
}

function addPlayedNotesRing(dotEl, dotCircle, radius = FRETBOARD_DOT_RING_RADIUS) {
  const ring = document.createElementNS(FRETBOARD_SVG_NS, 'circle');
  ring.setAttribute('cx', dotCircle.getAttribute('cx'));
  ring.setAttribute('cy', dotCircle.getAttribute('cy'));
  ring.setAttribute('r', radius + 4); // slightly outside the black ring
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', '#e03030');
  ring.setAttribute('stroke-width', '2.5');
  ring.setAttribute('class', 'dot-ring dot-played-ring');
  dotEl.insertBefore(ring, dotEl.querySelector('.dot-text, .piano-marker-text'));
}

/**
 * What comes after the current step, in two parts:
 *  - byMidi: pitches still inside this exercise, keyed by MIDI, each with the
 *    closest rank it appears at (1 = next note) and whether it already belongs
 *    to a later measure. A repeated pitch keeps its earliest rank, and the note
 *    sounding right now is never a preview.
 *  - positions: notes from the *next* loop of a continuous shift, as neck
 *    positions in that loop's box - a different part of the neck, so they
 *    cannot be matched by pitch against the box currently on screen.
 * With no shift pending, the preview wraps around the loop, which is exactly
 * what will be heard again.
 */
function buildLookahead(steps, index) {
  const byMidi = new Map();
  const positions = [];
  if (!steps || steps.length < 2) return { byMidi, positions };
  // Rest bars are not notes: the preview looks straight through them to what
  // sounds next, which is the next loop (or this one coming round again).
  const noteSteps = steps.filter((step) => step.note !== undefined);
  const noteIndex = noteSteps.indexOf(steps[index]);
  if (noteIndex === -1 || noteSteps.length < 2) return { byMidi, positions };
  const currentSegment = steps[index]?.segment;
  const currentMidi = Tonal.Note.midi(steps[index]?.note);
  const nextLoop = nextExercisePreview;
  for (let ahead = 1; ahead <= FRETBOARD_LOOKAHEAD_OPACITIES.length; ahead += 1) {
    const target = noteIndex + ahead;
    if (target >= noteSteps.length && nextLoop) {
      const nextStep = nextLoop.steps[target - noteSteps.length];
      if (nextStep?.position) {
        positions.push({
          ...nextStep.position,
          rank: ahead,
          note: nextStep.note,
          beats: nextStep.beats,
        });
      }
      continue;
    }
    const step = noteSteps[target % noteSteps.length];
    if (!step) break;
    const midi = Tonal.Note.midi(step.note);
    if (!Number.isFinite(midi) || midi === currentMidi || byMidi.has(midi)) continue;
    byMidi.set(midi, {
      rank: ahead,
      nextChord: step.segment !== currentSegment,
      beats: step.beats,
    });
  }
  return { byMidi, positions };
}

/** Dot element at a neck position, or null when that note is off the scale. */
function findDotElement(fretboardDiv, string, fret) {
  return (
    [...fretboardDiv.querySelectorAll('.dot')].find((dotEl) => {
      const data = dotEl.__data__;
      return data && data.string === string && data.fret === fret;
    }) || null
  );
}

/** A dot-sized marker for a next-loop note that has no dot on this diagram. */
function drawNextLoopMarker(fretboardDiv, position, opacity) {
  const svg = fretboardDiv.querySelector('svg');
  const coords = currentFretboardPositions?.[position.string - 1]?.[position.fret];
  if (!svg || !coords) return;
  let group = svg.querySelector('.next-loop-markers');
  if (!group) {
    group = document.createElementNS(FRETBOARD_SVG_NS, 'g');
    group.setAttribute('class', 'next-loop-markers');
    svg.appendChild(group);
  }
  const marker = document.createElementNS(FRETBOARD_SVG_NS, 'g');
  marker.setAttribute('opacity', String(opacity));
  const circle = document.createElementNS(FRETBOARD_SVG_NS, 'circle');
  circle.setAttribute('cx', `${coords.x}%`);
  circle.setAttribute('cy', coords.y);
  circle.setAttribute('r', String(FRETBOARD_DOT_RING_RADIUS - 1.5));
  circle.setAttribute('fill', FRETBOARD_COLOR_UPCOMING_NEXT_LOOP);
  const text = document.createElementNS(FRETBOARD_SVG_NS, 'text');
  text.setAttribute('x', `${coords.x}%`);
  text.setAttribute('y', coords.y);
  text.setAttribute('dy', '0.34em');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('font-size', '15');
  text.setAttribute('fill', '#ffffff');
  text.textContent = Tonal.Note.pitchClass(position.note) || '';
  marker.append(circle, text);
  const glyph = getDurationGlyph(position.beats);
  if (glyph) {
    const duration = document.createElementNS(FRETBOARD_SVG_NS, 'text');
    duration.setAttribute('x', `${coords.x}%`);
    duration.setAttribute('y', coords.y);
    duration.setAttribute('dx', FRETBOARD_DOT_RING_RADIUS + 5);
    duration.setAttribute('dy', 4);
    duration.setAttribute('class', 'dot-duration');
    duration.textContent = glyph;
    marker.append(duration);
  }
  group.appendChild(marker);
}

/** Clear the previous step's next-loop preview (markers + recoloured dots). */
function clearNextLoopPreview(fretboardDiv) {
  fretboardDiv.querySelector('.next-loop-markers')?.remove();
  fretboardDiv.querySelectorAll('.dot-next-loop').forEach((dotEl) => {
    dotEl.classList.remove('dot-next-loop');
    dotEl.style.opacity = '1';
    dotEl.querySelector('.dot-circle')?.style.removeProperty('fill');
    dotEl.querySelectorAll('.dot-duration').forEach((label) => label.remove());
  });
}

function renderNextLoopPreview(fretboardDiv, positions) {
  clearNextLoopPreview(fretboardDiv);
  positions.forEach((position) => {
    const opacity = FRETBOARD_LOOKAHEAD_OPACITIES[position.rank - 1];
    const dotEl = findDotElement(fretboardDiv, position.string, position.fret);
    if (!dotEl) {
      drawNextLoopMarker(fretboardDiv, position, opacity);
      return;
    }
    dotEl.classList.add('dot-next-loop');
    dotEl.style.opacity = String(opacity);
    const dotCircle = dotEl.querySelector('.dot-circle');
    dotCircle?.style.setProperty('fill', FRETBOARD_COLOR_UPCOMING_NEXT_LOOP, 'important');
    if (dotCircle) {
      addDurationLabelToDot(dotEl, dotCircle, position.beats);
    }
  });
}

/**
 * During per-note playback: light up the dots matching the sounding pitch
 * (every position with that pitch) and fade the rest. Context dots kept
 * faintly visible are the current chord's arpeggio tones ('note-arpeggio')
 * or the whole scale shape ('note-scale'). The next few notes are previewed,
 * fading with distance in time and switching colour on the next chord.
 */
function updateFretboardForNote(segment, note, mode, lookahead, beats) {
  const fretboardDiv = document.getElementById('fretboard-container');
  if (!fretboardDiv || !segment) return;
  const targetMidi = Tonal.Note.midi(note);
  const chordChromas = getChordToneChromas(segment.rootNote, segment.quality);
  const previews = lookahead?.byMidi || new Map();
  // Out-of-box previews are cleared first: the loop below only touches in-box
  // dots, so it would leave the previous step's next-loop colours behind.
  clearNextLoopPreview(fretboardDiv);

  fretboardDiv.querySelectorAll('.dot').forEach((dotEl) => {
    const data = dotEl.__data__;
    if (!data || !data.inBox) return;
    const dotCircle = dotEl.querySelector('.dot-circle');
    if (!dotCircle) return;
    dotEl.querySelectorAll('.dot-ring, .dot-degree-label, .dot-duration').forEach((r) => r.remove());

    const stringIndex = tuning.length - data.string;
    const openMidi = Tonal.Note.midi(tuning[stringIndex]);
    const dotMidi = Number.isFinite(openMidi) ? openMidi + data.fret : null;

    if (dotMidi !== null && dotMidi === targetMidi) {
      dotEl.style.opacity = '1';
      dotCircle.style.setProperty('fill', FRETBOARD_COLOR_PLAYING, 'important');
      addPlayedNotesRing(dotEl, dotCircle);
      addDurationLabelToDot(dotEl, dotCircle, beats);
      return;
    }

    const preview = dotMidi !== null ? previews.get(dotMidi) : null;
    if (preview) {
      dotEl.style.opacity = String(FRETBOARD_LOOKAHEAD_OPACITIES[preview.rank - 1]);
      dotCircle.style.setProperty(
        'fill',
        preview.nextChord ? FRETBOARD_COLOR_UPCOMING_NEXT_CHORD : FRETBOARD_COLOR_UPCOMING,
        'important'
      );
      addDurationLabelToDot(dotEl, dotCircle, preview.beats);
      return;
    }

    const isChordTone = chordChromas.has(Tonal.Note.chroma(data.note));
    const keepFaint = mode === 'note-scale' || isChordTone;
    dotEl.style.opacity = keepFaint ? '0.35' : '0.08';
    dotCircle.style.removeProperty('fill');
  });

  renderNextLoopPreview(fretboardDiv, lookahead?.positions || []);
}

function resetFretboardHighlight() {
  const fretboardDiv = document.getElementById('fretboard-container');
  if (!fretboardDiv) return;
  clearNextLoopPreview(fretboardDiv);
  applyScaleDegreeColoring(fretboardDiv);
  renderFretboardBoxLabel(null, null);
}

// ─── Piano keyboard highlighting ─────────────────────────────────────────────
// Twins of the fretboard highlight functions above, working on the markers the
// piano keyboard renders. Strictly simpler than guitar: a midi lands on at most
// one key, so there is no chroma-position fan-out.

const PIANO_RING_RADIUS = (window.pianoKeyboard?.MARKER_RADIUS ?? 13) + 1.5;

function getPianoMarkerDegree(markerEl) {
  const match = /piano-degree-(\d+)/.exec(markerEl.getAttribute('class') || '');
  return match ? parseInt(match[1], 10) : null;
}

/** Restore static scale-degree coloring (CSS controls fills; rings + opacity here). */
function applyPianoScaleDegreeColoring(container) {
  container.querySelectorAll('.piano-marker').forEach((markerEl) => {
    const circle = markerEl.querySelector('.piano-marker-circle');
    if (!circle) return;
    markerEl.style.opacity = '1';
    circle.style.removeProperty('fill');
    markerEl.querySelectorAll('.dot-ring, .dot-degree-label, .dot-duration').forEach((r) => r.remove());
    const degree = getPianoMarkerDegree(markerEl);
    if (SCALE_DEGREE_RING_DEGREES.has(degree)) {
      addRingToDot(markerEl, circle, PIANO_RING_RADIUS);
      addDegreeLabelToDot(markerEl, circle, degree, PIANO_RING_RADIUS);
    }
  });
}

/** Chord mode: recolour the scale markers relative to the current chord. */
function updatePianoForChord(measure) {
  const container = document.getElementById('fretboard-container');
  if (!container || !measure) return;
  clearPianoNextLoopPreview(container);

  const { rootNote, quality } = measure;
  const chordData = Tonal.Chord.get(`${rootNote}${quality}`);
  const chromaToIntervalNum = {};
  if (chordData && chordData.notes && chordData.intervals) {
    chordData.notes.forEach((note, i) => {
      chromaToIntervalNum[Tonal.Note.chroma(note)] = parseInt(chordData.intervals[i], 10);
    });
  }
  const playedMidiSet = new Set(
    (measure.generatedNotes || []).map((n) => Tonal.Note.midi(n)).filter(Number.isFinite)
  );

  container.querySelectorAll('.piano-marker').forEach((markerEl) => {
    const circle = markerEl.querySelector('.piano-marker-circle');
    if (!circle) return;
    markerEl.querySelectorAll('.dot-ring, .dot-degree-label, .dot-duration').forEach((r) => r.remove());

    const midi = parseInt(markerEl.dataset.midi, 10);
    const intervalNum = chromaToIntervalNum[((midi % 12) + 12) % 12];

    if (intervalNum === undefined) {
      markerEl.style.opacity = '0.2';
      circle.style.removeProperty('fill');
      return;
    }

    markerEl.style.opacity = '1';
    const fill = intervalNum === 1 ? FRETBOARD_COLOR_ROOT : FRETBOARD_COLOR_INBOX;
    circle.style.setProperty('fill', fill, 'important');

    if (SCALE_DEGREE_RING_DEGREES.has(intervalNum)) {
      addRingToDot(markerEl, circle, PIANO_RING_RADIUS);
      addDegreeLabelToDot(markerEl, circle, intervalNum, PIANO_RING_RADIUS);
    }
    if (playedMidiSet.has(midi)) {
      addPlayedNotesRing(markerEl, circle, PIANO_RING_RADIUS);
    }
  });
}

/** Per-note mode: light the sounding key, preview the next few, fade the rest. */
function updatePianoForNote(segment, note, mode, lookahead, beats) {
  const container = document.getElementById('fretboard-container');
  if (!container || !segment) return;
  const targetMidi = Tonal.Note.midi(note);
  const chordChromas = getChordToneChromas(segment.rootNote, segment.quality);
  const previews = lookahead?.byMidi || new Map();
  clearPianoNextLoopPreview(container);

  container.querySelectorAll('.piano-marker').forEach((markerEl) => {
    const circle = markerEl.querySelector('.piano-marker-circle');
    if (!circle) return;
    markerEl.querySelectorAll('.dot-ring, .dot-degree-label, .dot-duration').forEach((r) => r.remove());

    const midi = parseInt(markerEl.dataset.midi, 10);

    if (midi === targetMidi) {
      markerEl.style.opacity = '1';
      circle.style.setProperty('fill', FRETBOARD_COLOR_PLAYING, 'important');
      addPlayedNotesRing(markerEl, circle, PIANO_RING_RADIUS);
      addDurationLabelToDot(markerEl, circle, beats, PIANO_RING_RADIUS);
      return;
    }

    const preview = previews.get(midi);
    if (preview) {
      markerEl.style.opacity = String(FRETBOARD_LOOKAHEAD_OPACITIES[preview.rank - 1]);
      circle.style.setProperty(
        'fill',
        preview.nextChord ? FRETBOARD_COLOR_UPCOMING_NEXT_CHORD : FRETBOARD_COLOR_UPCOMING,
        'important'
      );
      addDurationLabelToDot(markerEl, circle, preview.beats, PIANO_RING_RADIUS);
      return;
    }

    const isChordTone = chordChromas.has(((midi % 12) + 12) % 12);
    const keepFaint = mode === 'note-scale' || isChordTone;
    markerEl.style.opacity = keepFaint ? '0.35' : '0.08';
    circle.style.removeProperty('fill');
  });

  renderPianoNextLoopPreview(container, lookahead?.positions || []);
}

/** Piano "positions" are just midis: the keyboard shows every pitch it spans. */
function findPianoPositionForNote(shapeContext, note) {
  const midi = Tonal.Note.midi(note);
  return Number.isFinite(midi) ? { midi } : null;
}

/** Clear the previous step's next-loop preview (markers + recoloured keys). */
function clearPianoNextLoopPreview(container) {
  container.querySelectorAll('.piano-marker--next-loop').forEach((el) => el.remove());
  container.querySelectorAll('.piano-marker.dot-next-loop').forEach((markerEl) => {
    markerEl.classList.remove('dot-next-loop');
    markerEl.style.opacity = '1';
    markerEl.querySelector('.piano-marker-circle')?.style.removeProperty('fill');
    markerEl.querySelectorAll('.dot-duration').forEach((label) => label.remove());
  });
}

function renderPianoNextLoopPreview(container, positions) {
  clearPianoNextLoopPreview(container);
  positions.forEach((position) => {
    const opacity = FRETBOARD_LOOKAHEAD_OPACITIES[position.rank - 1];
    let markerEl = window.pianoKeyboard.markerAt(container, position.midi);
    if (!markerEl) {
      // In the incoming exercise but not on this diagram's scale: draw a
      // temporary marker. Midis outside the drawn register are skipped - a
      // register shift previews only the overlap; the box label still
      // announces the target.
      markerEl = window.pianoKeyboard.addMarker(container, {
        midi: position.midi,
        label: Tonal.Note.pitchClass(position.note) || '',
        className: 'piano-marker--next-loop',
        opacity,
      });
      if (!markerEl) return;
    } else {
      markerEl.classList.add('dot-next-loop');
      markerEl.style.opacity = String(opacity);
    }
    const circle = markerEl.querySelector('.piano-marker-circle');
    if (circle) {
      circle.style.setProperty('fill', FRETBOARD_COLOR_UPCOMING_NEXT_LOOP, 'important');
      addDurationLabelToDot(markerEl, circle, position.beats, PIANO_RING_RADIUS);
    }
  });
}

function resetPianoHighlight() {
  const container = document.getElementById('fretboard-container');
  if (!container) return;
  clearPianoNextLoopPreview(container);
  applyPianoScaleDegreeColoring(container);
  renderFretboardBoxLabel(null, null);
}

function updateArpeggioDiagramHighlight(chordName) {
  const container = document.getElementById('arpeggio-diagrams');
  if (!container) return;
  container.querySelectorAll('.arpeggio-diagram').forEach((el) => {
    el.classList.toggle('arpeggio-diagram--active', el.dataset.chord === chordName);
  });
}

function clearArpeggioDiagramHighlight() {
  const container = document.getElementById('arpeggio-diagrams');
  if (!container) return;
  container.querySelectorAll('.arpeggio-diagram--active').forEach((el) => {
    el.classList.remove('arpeggio-diagram--active');
  });
}

function getSelectedHighlightMode() {
  return document.getElementById('playbackHighlightMode')?.value || 'chord';
}

// Flatten segments into visual steps for the selected highlight mode:
// 'chord' → one step per chord segment; note modes → one step per note
// (half a beat for eighths).
function buildVisualSteps(mode) {
  const steps = [];
  playbackState.measuresData.forEach((segment) => {
    const generated = segment.generatedNotes || [];
    if (mode === 'chord' || !generated.length) {
      steps.push({ segment, beats: segment.beats || 4 });
      return;
    }
    const slots = segment.slots && segment.slots.length
      ? segment.slots
      : generated.map(() => 1);
    let noteIdx = 0;
    slots.forEach((slotSize) => {
      if (slotSize === 0) {
        steps.push({ segment, rest: true, beats: 1 });
        return;
      }
      if (slotSize === 'r8' || slotSize === '8r') {
        if (noteIdx >= generated.length) {
          steps.push({ segment, rest: true, beats: 1 });
          return;
        }
        const noteStep = { segment, note: generated[noteIdx], beats: 0.5 };
        noteIdx += 1;
        const restStep = { segment, rest: true, beats: 0.5 };
        steps.push(...(slotSize === 'r8' ? [restStep, noteStep] : [noteStep, restStep]));
        return;
      }
      for (let k = 0; k < slotSize && noteIdx < generated.length; k++, noteIdx++) {
        steps.push({
          segment,
          note: generated[noteIdx],
          beats: slotSize === 2 ? 0.5 : 1,
        });
      }
    });
  });
  // One step per rest bar: the chart clears and, when a shift is pending, the
  // incoming box stays lit - the pause is exactly when you move to it.
  const pauseBars = getSelectedLoopPauseBars();
  for (let bar = 0; bar < pauseBars; bar += 1) {
    steps.push({ pause: true, beats: getBeatsPerBar() });
  }
  return steps;
}

function applyVisualStep(step, mode, steps, index) {
  if (!isVisualPlaybackEnabled() || !step) return;
  const view = getInstrumentView();
  if (step.pause) {
    view.applyPause();
    return;
  }
  moveHighlightToMeasure(step.segment.barIndex ?? 0);
  if (step.rest) {
    // A written rest: the chord's context stays lit, nothing reads as
    // "sounding now" - same visual as chord mode, one beat long.
    view.highlightChord(step.segment);
  } else if (step.note !== undefined) {
    view.highlightNote(
      step.segment,
      step.note,
      mode,
      buildLookahead(steps, index),
      step.beats
    );
  } else {
    view.highlightChord(step.segment);
    // Chord mode has no per-note lookahead, so the incoming box lights up for
    // the last chord of the loop instead - the same cue, one chord wide.
    const isLastChord = steps.slice(index + 1).every((later) => later.pause);
    if (isLastChord) {
      const fretboardDiv = document.getElementById('fretboard-container');
      if (fretboardDiv) {
        view.renderNextLoopPreview(fretboardDiv, getNextLoopPreviewPositions());
      }
    }
  }
  updateArpeggioDiagramHighlight(step.segment.chordName);
  // The incoming box is named for as long as the shift is pending, whatever
  // the highlight mode: it says where the loop is going, not what sounds next.
  renderFretboardBoxLabel(step.segment.chordName, nextExercisePreview);
}

/** The precomputed next loop's opening notes, as ranked neck positions. */
function getNextLoopPreviewPositions() {
  return (nextExercisePreview?.steps || [])
    .map((previewStep, rank) =>
      previewStep.position
        ? { ...previewStep.position, rank: rank + 1, note: previewStep.note }
        : null
    )
    .filter(Boolean);
}

/**
 * A rest bar: the chart goes back to its resting colours and the notation
 * highlight clears. If a shift is pending, the incoming box keeps its preview
 * so there is something to aim at while waiting.
 */
function applyGuitarPauseStep() {
  const fretboardDiv = document.getElementById('fretboard-container');
  clearArpeggioDiagramHighlight();
  hideHighlightRect();
  if (fretboardDiv) {
    clearNextLoopPreview(fretboardDiv);
    applyScaleDegreeColoring(fretboardDiv);
    renderNextLoopPreview(fretboardDiv, getNextLoopPreviewPositions());
  }
  renderFretboardBoxLabel(null, nextExercisePreview);
}

/** The piano twin of the rest-bar step. */
function applyPianoPauseStep() {
  const container = document.getElementById('fretboard-container');
  clearArpeggioDiagramHighlight();
  hideHighlightRect();
  if (container) {
    clearPianoNextLoopPreview(container);
    applyPianoScaleDegreeColoring(container);
    renderPianoNextLoopPreview(container, getNextLoopPreviewPositions());
  }
  renderFretboardBoxLabel(null, nextExercisePreview);
}

function startVisualPlayback() {
  const mode = getSelectedHighlightMode();
  const steps = buildVisualSteps(mode);
  if (!steps.length) return;
  const bpm = getSelectedTempoBpm();
  const msPerBeat = 60000 / bpm;

  visualPlaybackIndex = 0;
  applyVisualStep(steps[0], mode, steps, 0);

  // Each step lasts its own beat count (a chord segment in chord mode, a
  // single note in the note modes). Drift-corrected against a running
  // absolute deadline.
  let nextTime = performance.now();
  const scheduleNext = () => {
    const step = steps[visualPlaybackIndex];
    nextTime += (step?.beats || 4) * msPerBeat;
    visualPlaybackTimerId = setTimeout(() => {
      visualPlaybackIndex = (visualPlaybackIndex + 1) % steps.length;
      applyVisualStep(steps[visualPlaybackIndex], mode, steps, visualPlaybackIndex);
      scheduleNext();
    }, Math.max(0, nextTime - performance.now()));
  };
  scheduleNext();
}

function clearVisualTimer() {
  if (visualPlaybackTimerId !== null) {
    clearTimeout(visualPlaybackTimerId);
    visualPlaybackTimerId = null;
  }
}

function stopVisualPlayback() {
  clearVisualTimer();
  getInstrumentView().resetHighlight();
  clearArpeggioDiagramHighlight();
  hideHighlightRect();
  playbackState.isPlaying = false;
  updateTransportButtons();
}

// ─── Continuous shift ────────────────────────────────────────────────────────
// When the exercise loop completes, move the progression to a new key (chromatic
// steps or circle of 5ths/4ths) or an adjacent CAGED shape, regenerate, and
// keep playing.

let continuousShiftTimerId = null;

const CONTINUOUS_SHIFT_KEY_DELTAS = {
  'key-up': 1, // key select options are in chromatic order
  'key-down': -1,
  fifths: 7,
  fourths: 5,
};

function getSelectedContinuousShift() {
  return document.getElementById('continuousShift')?.value || 'off';
}

function clearContinuousShiftTimer() {
  if (continuousShiftTimerId !== null) {
    clearTimeout(continuousShiftTimerId);
    continuousShiftTimerId = null;
  }
}

function getLoopDurationMs() {
  const totalBeats =
    playbackState.measuresData.reduce((sum, segment) => sum + (segment.beats || 4), 0) +
    getLoopPauseBeats();
  return totalBeats * (60000 / getSelectedTempoBpm());
}

// The value a select would land on `delta` options away (wrapping; skips empty
// placeholders), without changing it.
function peekSelectValue(selectId, delta) {
  const select = document.getElementById(selectId);
  if (!select) return null;
  const values = [...select.options].map((o) => o.value).filter((v) => v);
  const idx = values.indexOf(select.value);
  if (idx === -1) return null;
  return values[(idx + delta + values.length) % values.length];
}

/** Set a select, but only to a value it actually offers. Assigning an unknown
 * value blanks the select instead of failing, and a blank shape/register is
 * only noticed later, as "Please select a chord shape" on the next loop. */
function setSelectValue(selectId, value) {
  const select = document.getElementById(selectId);
  if (!select || value === null || value === undefined) return false;
  const offered = [...select.options].some((option) => option.value === value);
  if (!offered) {
    debugLog(`Ignored ${selectId} = "${value}": not one of its options.`);
    return false;
  }
  select.value = value;
  select.dispatchEvent(new Event('change'));
  return true;
}

// ─── Staying in one neck position ────────────────────────────────────────────
// A key shift moves every box up or down the neck, so following it with the
// shape whose box lands closest to the one being left keeps the hand still:
// Bb/G shape → Eb/C → Ab/E → Db/A around the circle of 4ths, each within half a
// fret of the last. Positions come from the shape data itself rather than CAGED
// theory, so stretched shapes and any future shape are handled the same way.

/** The toggle only means anything for the key-changing shifts, on guitar:
 * "position" is a fretboard idea, and a piano register is not a CAGED box. */
function stayInPositionApplies() {
  return (
    getSelectedContinuousShift() in CONTINUOUS_SHIFT_KEY_DELTAS &&
    getActiveInstrument() === 'guitar'
  );
}

/** Checked *and* meaningful. A disabled checkbox keeps its tick, and this one
 * is remembered across sessions, so a box ticked while practising guitar is
 * still ticked in piano mode - where following it would look for a CAGED shape
 * and hand it to the register select. */
function isStayInPositionEnabled() {
  return stayInPositionApplies() && Boolean(document.getElementById('stayInPosition')?.checked);
}

function updateStayInPositionAvailability() {
  const toggle = document.getElementById('stayInPosition');
  if (!toggle) return;
  const applies = stayInPositionApplies();
  toggle.disabled = !applies;
  toggle.closest('.toggle-label')?.classList.toggle('is-disabled', !applies);
}

/** Middle fret of a shape's box in a given key, or null if it has none. */
function getShapeBoxCenter(shape, cagedKey) {
  const cagedShape = getCAGEDShape(shape, cagedKey);
  const frets = (cagedShape?.scale_frets || [])
    .flat()
    .filter((fret) => typeof fret === 'number' && fret >= 0);
  if (!frets.length) return null;
  return (Math.min(...frets) + Math.max(...frets)) / 2;
}

/** Where the hand is now: the box currently rendered, or the selected one. */
function getCurrentBoxCenter() {
  const current = lastExerciseState?.cagedShape;
  if (current) {
    const frets = (current.scale_frets || [])
      .flat()
      .filter((fret) => typeof fret === 'number' && fret >= 0);
    if (frets.length) return (Math.min(...frets) + Math.max(...frets)) / 2;
  }
  const shape = document.getElementById('shape')?.value;
  if (!shape) return null;
  return getShapeBoxCenter(shape, getKeyContext(getSelectedKeyValue()).cagedKey);
}

/** The available shape whose box in `keyValue` sits closest to `center`. */
function pickShapeNearPosition(keyValue, center) {
  if (center === null || center === undefined) return null;
  const shapes = [...(document.getElementById('shape')?.options || [])]
    .map((option) => option.value)
    .filter(Boolean);
  const cagedKey = getKeyContext(keyValue).cagedKey;
  let best = null;
  shapes.forEach((shape) => {
    const shapeCenter = getShapeBoxCenter(shape, cagedKey);
    if (shapeCenter === null) return;
    const distance = Math.abs(shapeCenter - center);
    if (!best || distance < best.distance) {
      best = { shape, distance };
    }
  });
  return best?.shape || null;
}

/** Where a shift would land, as { key } and/or { shape } - nothing is changed. */
function peekContinuousShiftTarget(mode) {
  if (mode in CONTINUOUS_SHIFT_KEY_DELTAS) {
    if (getSelectedExerciseMode() === EXERCISE_MODES.SONG) return null;
    const key = peekSelectValue('key', CONTINUOUS_SHIFT_KEY_DELTAS[mode]);
    if (!key) return null;
    const target = { key };
    if (isStayInPositionEnabled()) {
      const scaleType = document.getElementById('scaleType')?.value || 'major';
      const keyValue = scaleType === 'minor' ? `${key}m` : key;
      const shape = pickShapeNearPosition(keyValue, getCurrentBoxCenter());
      if (shape) target.shape = shape;
    }
    return target;
  }
  // On guitar these walk the shape list (up/down the neck); on piano they walk
  // the register list - same machinery, the instrument names the control.
  if (mode === 'shape-up') {
    const shape = peekSelectValue(getInstrumentView().shapeControlId, 1);
    return shape ? { shape } : null;
  }
  if (mode === 'shape-down') {
    const shape = peekSelectValue(getInstrumentView().shapeControlId, -1);
    return shape ? { shape } : null;
  }
  return null;
}

function applyContinuousShift(mode) {
  if (mode in CONTINUOUS_SHIFT_KEY_DELTAS && getSelectedExerciseMode() === EXERCISE_MODES.SONG) {
    debugLog('Continuous key shift is not available in song mode.');
    return false;
  }
  // Apply exactly what the preview was built from, so what was shown is what
  // gets generated.
  const target = peekContinuousShiftTarget(mode);
  if (!target) return false;
  let applied = false;
  if (target.key) applied = setSelectValue('key', target.key) || applied;
  if (target.shape) {
    applied = setSelectValue(getInstrumentView().shapeControlId, target.shape) || applied;
  }
  return applied;
}

// ─── Next-loop preview ───────────────────────────────────────────────────────
// A shift lands the player on a different box, so the last notes of a loop are
// previewed where they will actually be played, not at the matching pitch
// inside the box being left. That needs the next exercise before the boundary:
// it is built headlessly when the loop starts, previewed during the loop, and
// then handed to the boundary regeneration as a replay so what was shown is
// exactly what plays.

let nextExercisePreview = null;

/** measureData → the compact { chordSymbol, slots, notes, direction } form. */
function toReplayMeasures(measureData) {
  return (measureData || [])
    .filter((measure) => (measure.generatedNotes || []).length)
    .map((measure) => ({
      chordSymbol: measure.chordSymbol,
      slots: [...(measure.slots || [])],
      notes: [...(measure.generatedNotes || [])],
      direction: measure.direction ?? true,
    }));
}

/** First position inside the CAGED box that sounds `note`, or null. */
function findBoxPositionForNote(cagedShape, note) {
  const midi = Tonal.Note.midi(note);
  if (!Number.isFinite(midi) || !cagedShape?.scale_frets) return null;
  for (let si = 0; si < cagedShape.scale_frets.length; si += 1) {
    // scale_frets[0] is the low E string, which is string 6 on the diagram.
    const openMidi = Tonal.Note.midi(tuning[si]);
    if (!Number.isFinite(openMidi)) continue;
    for (const fret of cagedShape.scale_frets[si]) {
      if (typeof fret === 'number' && fret >= 0 && openMidi + fret === midi) {
        return { string: 6 - si, fret };
      }
    }
  }
  return null;
}

/** The opening notes of the next exercise, with where they sit on the neck. */
function buildNextLoopSteps(measureData, cagedShape) {
  return collectPreviewSteps(
    (measureData || []).map((measure) => ({
      notes: measure.generatedNotes || [],
      slots: measure.slots || [],
    })),
    cagedShape
  );
}

/**
 * The first few notes of an upcoming exercise, each with its neck position and
 * its length in beats (a slot of 2 is a beamed pair, so half a beat each).
 */
function collectPreviewSteps(measures, cagedShape) {
  const steps = [];
  for (const measure of measures) {
    const slots = measure.slots.length ? measure.slots : measure.notes.map(() => 1);
    let noteIdx = 0;
    for (const slotSize of slots) {
      // Rest slots contribute no preview step, but the half-rest slots
      // ('r8'/'8r') still consume their one note.
      const noteCount = slotNoteCount(slotSize);
      for (let k = 0; k < noteCount && noteIdx < measure.notes.length; k += 1, noteIdx += 1) {
        const note = measure.notes[noteIdx];
        steps.push({
          note,
          beats: slotSize === 1 ? 1 : 0.5,
          position: getInstrumentView().previewPositionForNote(cagedShape, note),
        });
        if (steps.length >= FRETBOARD_LOOKAHEAD_OPACITIES.length) return steps;
      }
    }
  }
  return steps;
}

function clearNextExercisePreview() {
  nextExercisePreview = null;
  updateLabelRowHeight();
}

// ─── Pinned rotation ─────────────────────────────────────────────────────────
// 'cycle-pinned' turns the pinned list into a playlist: at each loop boundary
// the next pinned exercise is loaded (settings + its exact notes) instead of
// the progression being transposed. Tracked by id, not index, so pinning or
// removing entries mid-rotation cannot make it jump.

let currentPinnedId = null;

/** Which instrument a snapshot was recorded on; old files predate the field. */
function snapshotInstrument(entry) {
  return entry?.settings?.instrument === 'piano' ? 'piano' : 'guitar';
}

/** The rotation only cycles snapshots of the active instrument: restoring the
 * other instrument's settings mid-playback would flip every renderer at once. */
function pinnedRotationEntries() {
  return pinnedExercises.filter(
    (entry) => snapshotInstrument(entry) === getActiveInstrument()
  );
}

function nextPinnedSnapshot() {
  const rotation = pinnedRotationEntries();
  if (!rotation.length) return null;
  // Starting the cycle on an exercise that happens to be pinned (pressing Play
  // right after starring it) should carry on from that entry, not repeat it.
  if (!currentPinnedId) {
    const current = captureExerciseSnapshot();
    const match =
      current &&
      rotation.find(
        (entry) => snapshotSignature(entry) === snapshotSignature(current)
      );
    if (match) {
      currentPinnedId = match.id;
    }
  }
  const index = rotation.findIndex((entry) => entry.id === currentPinnedId);
  return rotation[(index + 1) % rotation.length];
}

/** The shape context a snapshot will be played in, for its preview and label:
 * a CAGED box on guitar, a register descriptor on piano. */
function getShapeForSettings(settings) {
  const isPianoSnapshot = settings?.instrument === 'piano';
  if (!settings || (isPianoSnapshot ? !settings.pianoRange : !settings.shape)) {
    return null;
  }
  const keyValue =
    settings.exerciseMode === EXERCISE_MODES.SONG
      ? (() => {
          const song = getSongById(settings.songSelect);
          if (!song) return null;
          return song.scaleType === 'minor' ? `${song.key}m` : song.key;
        })()
      : settings.scaleType === 'minor'
        ? `${settings.key}m`
        : settings.key;
  if (!keyValue) return null;
  if (isPianoSnapshot) {
    return preparePianoContext(keyValue, settings.pianoRange).cagedShape;
  }
  const keyContext = getKeyContext(keyValue);
  const cagedShape = getCAGEDShape(settings.shape, keyContext.cagedKey);
  if (!cagedShape) return null;
  if (keyContext.isMinor) {
    cagedShape.key = keyContext.tonic;
    cagedShape.scaleType = keyContext.scaleType;
  }
  return cagedShape;
}

/** Opening notes of a stored snapshot, positioned in its own box. */
function buildSnapshotSteps(snapshot, cagedShape) {
  return collectPreviewSteps(
    (snapshot.measures || []).map((measure) => ({
      notes: measure.notes || [],
      slots: measure.slots || [],
    })),
    cagedShape
  );
}

function precomputePinnedCycle() {
  const snapshot = nextPinnedSnapshot();
  if (!snapshot) {
    debugLog('Pinned cycle: nothing pinned.');
    return;
  }
  const cagedShape = getShapeForSettings(snapshot.settings);
  if (!cagedShape) {
    debugLog('Pinned cycle: could not rebuild the shape for', snapshot.label);
    return;
  }
  nextExercisePreview = {
    mode: 'cycle-pinned',
    snapshot,
    cagedShape,
    scaleLabel: describeNextBox(cagedShape),
    measures: snapshot.measures,
    steps: buildSnapshotSteps(snapshot, cagedShape),
  };
  updateLabelRowHeight();
  debugLog('Next pinned exercise:', snapshot.label);
}

/** Name only what the shift changes: the key, the shape, or both. */
function describeNextBox(nextShape) {
  const current = lastExerciseState?.cagedShape;
  const scale = `${nextShape.key} ${nextShape.scaleType}`;
  const parts = [];
  if (!current || current.key !== nextShape.key || current.scaleType !== nextShape.scaleType) {
    parts.push(scale);
  }
  // getCAGEDShape() exposes the shape's name as `shape` ("E Shape").
  if (nextShape.shape && (!current || current.shape !== nextShape.shape)) {
    parts.push(nextShape.shape);
  }
  return parts.length ? parts.join(' · ') : scale;
}

/**
 * Build the exercise the current shift setting will land on. Runs once per
 * loop, off the render path (a few ms of Tonal work, no DOM).
 */
function precomputeNextExercise() {
  clearNextExercisePreview();
  const mode = getSelectedContinuousShift();
  if (mode === 'off' || !playbackState.isPlaying) return;
  if (mode === 'cycle-pinned') {
    precomputePinnedCycle();
    return;
  }
  const target = peekContinuousShiftTarget(mode);
  if (!target) return;

  const exerciseMode = getSelectedExerciseMode();
  const scaleType = document.getElementById('scaleType')?.value || 'major';
  const keyValue = target.key
    ? scaleType === 'minor'
      ? `${target.key}m`
      : target.key
    : null;
  const built = buildExerciseMeasures({
    mode: exerciseMode,
    song: exerciseMode === EXERCISE_MODES.SONG ? getSelectedSong() : null,
    key: keyValue,
    shape: target.shape || null,
    carryOver: getCarryOverFromLastExercise(),
  });
  if (!built || built.error !== undefined || !built.measureData?.length) {
    debugLog('Next-loop preview unavailable:', built?.error);
    return;
  }
  nextExercisePreview = {
    mode,
    cagedShape: built.cagedShape,
    scaleLabel: describeNextBox(built.cagedShape),
    measures: toReplayMeasures(built.measureData),
    steps: buildNextLoopSteps(built.measureData, built.cagedShape),
  };
  updateLabelRowHeight();
  debugLog('Next loop precomputed:', nextExercisePreview.scaleLabel);
}

// Fire slightly before the loop boundary: the scheduler queues audio events
// ~150ms ahead (latency 0.1s + tick interval), so hushing right at the
// boundary is too late - the old pattern's next first note is already
// scheduled and sounds together with the new pattern's first note.
const CONTINUOUS_SHIFT_GUARD_MS = 200;

// Always keeps a loop timer while playing; the mode is read when it fires so
// changing the option mid-playback takes effect at the next loop boundary.
function scheduleContinuousShift() {
  clearContinuousShiftTimer();
  if (!playbackState.isPlaying) {
    clearNextExercisePreview();
    return;
  }
  precomputeNextExercise();
  const loopMs = getLoopDurationMs();
  if (!Number.isFinite(loopMs) || loopMs <= 0) return;
  continuousShiftTimerId = setTimeout(() => {
    performContinuousShift(getSelectedContinuousShift());
  }, Math.max(0, loopMs - CONTINUOUS_SHIFT_GUARD_MS));
}

// Last note + direction of the current exercise, used to voice-lead the next
// one when continuous shift regenerates.
function getCarryOverFromLastExercise() {
  const measures = lastExerciseState?.measureData;
  const last = measures?.[measures.length - 1];
  const lastNote = last?.generatedNotes?.[last.generatedNotes.length - 1];
  if (!lastNote) return null;
  return { prevNote: lastNote, prevDirection: last.direction ?? true };
}

async function performContinuousShift(mode) {
  if (!playbackState.isPlaying) return;
  // This fires CONTINUOUS_SHIFT_GUARD_MS before the musical loop boundary
  const boundaryAt = performance.now() + CONTINUOUS_SHIFT_GUARD_MS;
  // Only reuse the precomputed loop if the mode is still the one it was built
  // for; otherwise it would land somewhere the preview never showed.
  const pending = nextExercisePreview?.mode === mode ? nextExercisePreview : null;
  if (mode === 'off') {
    scheduleContinuousShift();
    return;
  }
  if (mode === 'cycle-pinned') {
    const snapshot = pending?.snapshot || nextPinnedSnapshot();
    if (!snapshot) {
      // Nothing pinned: keep looping the current exercise rather than stopping.
      scheduleContinuousShift();
      return;
    }
    applyControlValues(snapshot.settings);
    currentPinnedId = snapshot.id;
    // No carry-over: a pinned exercise starts on its own recorded first note.
    regenerateExercise({ replay: snapshot.measures });
  } else {
    if (!applyContinuousShift(mode)) {
      scheduleContinuousShift();
      return;
    }
    regenerateExercise({
      carryOver: getCarryOverFromLastExercise(),
      replay: pending?.measures || null,
    });
  }
  // A pinned exercise can be a different length or tempo, which moves the
  // pattern onto a new cycle grid - that needs a clock restart, and a restart
  // has to happen AT the boundary, not before it.
  const audioOn = isAudioPlaybackEnabled() && playbackState.engine === 'strudel';
  const restartsClock = audioOn && willRestartStrudelLoop();
  // Otherwise swap the audio pattern NOW, before the scheduler queries the
  // boundary chunk: the delegating wrapper keeps playing without any clock
  // restart, and the swap only affects queries from here on - the old loop's
  // tail is already scheduled, the new loop's first note comes from the new
  // pattern.
  if (audioOn && !restartsClock) {
    await playStrudelExercise(playbackState.notes);
  }
  clearVisualTimer();
  // Restart the visual clock exactly at the boundary so it stays aligned
  // with the audio grid.
  const waitMs = boundaryAt - performance.now();
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  if (!playbackState.isPlaying) return;
  if (restartsClock) {
    await playStrudelExercise(playbackState.notes);
    if (!playbackState.isPlaying) return;
  }
  if (isVisualPlaybackEnabled()) {
    startVisualPlayback();
  }
  // Cycled exercises are already saved; re-recording them would bury the rest
  // of the session under repeats of the rotation.
  if (mode !== 'cycle-pinned') {
    recordExerciseInHistory();
  }
  scheduleContinuousShift();
}

const AUDIO_OFF_MESSAGE = 'Audio is off: showing the exercise without sound.';
const PAUSED_MESSAGE = 'Paused. Resume picks up from the top of the loop.';

/**
 * Re-apply the Visual / Audio switches to a playback already in progress.
 * Both layers restart from the top of the loop together, so they cannot end up
 * out of phase with each other or with the continuous-shift timer.
 */
async function restartPlaybackLayers() {
  if (!playbackState.isPlaying) return;
  clearVisualTimer();
  if (isAudioPlaybackEnabled() && playbackState.engine === 'strudel') {
    await playStrudelExercise(playbackState.notes);
  } else {
    await stopStrudelExercise();
    setPlaybackBanner(AUDIO_OFF_MESSAGE, 'warning');
  }
  if (!playbackState.isPlaying) return;
  if (isVisualPlaybackEnabled()) {
    startVisualPlayback();
  } else {
    resetFretboardHighlight();
    clearArpeggioDiagramHighlight();
    hideHighlightRect();
  }
  scheduleContinuousShift();
}

// Starting playback awaits Strudel (a cold start loads the library and a
// soundfont, seconds on a slow link). A Stop - or a second Play - during that
// wait bumps this token, and the stale start bails out instead of flipping the
// transport back to "playing" after the fact.
let playbackSessionToken = 0;

// After the intro chorus, hand the running pattern over to the exercise at
// the loop boundary (same early-swap + on-grid restart logic as continuous
// shift), then bring up the visual clock, history and shift timer that were
// held back while the head played.
let introTimerId = null;
// True once the head has fully played and handed off to the exercise. Pause
// keeps it (Resume goes straight to the exercise instead of sitting through
// the whole head again); Stop resets it (a fresh Play replays the head).
let headPlayedThisSession = false;

function clearIntroTimer() {
  if (introTimerId !== null) {
    clearTimeout(introTimerId);
    introTimerId = null;
  }
}

function scheduleIntroHandoff(token, introBeats) {
  const introMs = introBeats * (60000 / getSelectedTempoBpm());
  introTimerId = setTimeout(async () => {
    introTimerId = null;
    if (token !== playbackSessionToken || !playbackState.isPlaying) return;
    const boundaryAt = performance.now() + CONTINUOUS_SHIFT_GUARD_MS;
    const restartsClock = willRestartStrudelLoop();
    if (!restartsClock) {
      await playStrudelExercise(playbackState.notes);
    }
    const waitMs = boundaryAt - performance.now();
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    if (token !== playbackSessionToken || !playbackState.isPlaying) return;
    if (restartsClock) {
      await playStrudelExercise(playbackState.notes);
    }
    headPlayedThisSession = true;
    clearHeadVisual();
    if (isVisualPlaybackEnabled()) {
      startVisualPlayback();
    }
    recordExerciseInHistory();
    scheduleContinuousShift();
  }, Math.max(0, introMs - CONTINUOUS_SHIFT_GUARD_MS));
}

async function startPlayback() {
  // Cycle mode: make sure what plays first is part of the rotation.
  ensurePinnedRotationStart();
  stopVisualPlayback(); // clears any previous highlight, and the playing flag
  // Claim the transport before awaiting Strudel, so a click during the load is
  // read as "stop" instead of starting a second, overlapping playback.
  const token = ++playbackSessionToken;
  playbackState.isPlaying = true;
  playbackState.isPaused = false;
  updateTransportButtons();
  // Start audio first (loading Strudel and soundfonts can take a while), then
  // the visual clock right after the pattern starts, so the highlight and the
  // sound share the same t0.
  if (isAudioPlaybackEnabled() && playbackState.engine === 'strudel') {
    // "Play the head first": one chorus of comped chords (+ melody when the
    // song has one), then the exercise takes over at the loop boundary.
    // After a pause, Resume skips the head it already played.
    if (shouldPlayHeadFirst() && !headPlayedThisSession) {
      const introBeats = await playSongIntro();
      if (token !== playbackSessionToken) {
        if (!playbackState.isPlaying) {
          await stopStrudelExercise();
        }
        return;
      }
      if (introBeats > 0) {
        scheduleIntroHandoff(token, introBeats);
        if (isVisualPlaybackEnabled()) {
          startHeadVisual(introBeats / BEATS_PER_CYCLE);
        }
        return; // exercise visual, history and continuous shift start later
      }
    }
    await playStrudelExercise(playbackState.notes);
  }
  if (!isAudioPlaybackEnabled()) {
    // Silence here is a setting, not a fault - say so, or it reads as a bug.
    setPlaybackBanner(AUDIO_OFF_MESSAGE, 'warning');
  }
  if (token !== playbackSessionToken) {
    // Silence the pattern this call just started, unless a newer session is
    // already playing through it.
    if (!playbackState.isPlaying) {
      await stopStrudelExercise();
    }
    return;
  }
  if (isVisualPlaybackEnabled()) {
    startVisualPlayback();
  }
  recordExerciseInHistory();
  scheduleContinuousShift();
}

async function stopPlayback() {
  playbackSessionToken += 1; // abandon any start still waiting on Strudel
  headPlayedThisSession = false; // a fresh Play replays the head
  clearIntroTimer();
  clearHeadVisual();
  clearContinuousShiftTimer();
  clearNextExercisePreview();
  stopVisualPlayback();
  if (playbackState.engine === 'strudel') {
    await stopStrudelExercise();
  }
  playbackState.isPlaying = false;
  playbackState.isPaused = false;
  updateTransportButtons();
}

/**
 * Pause holds the picture: the highlight freezes on the note you stopped on,
 * so you can look at where you are. The scheduler cannot be resumed mid-cycle
 * without drifting off the grid, so Resume starts the loop again from the top;
 * the banner says as much. The next-shift preview is part of the held picture:
 * clearing it here would collapse the caption row's reserved height and slide
 * the transport up into the still-drawn caption (Resume recomputes it anyway
 * via scheduleContinuousShift).
 */
async function pausePlayback() {
  if (!playbackState.isPlaying) return;
  playbackSessionToken += 1; // abandon any start still waiting on Strudel
  clearIntroTimer();
  clearHeadVisual();
  clearContinuousShiftTimer();
  clearVisualTimer(); // freeze, rather than reset like stopVisualPlayback()
  if (playbackState.engine === 'strudel') {
    await stopStrudelExercise();
  }
  playbackState.isPlaying = false;
  playbackState.isPaused = true;
  updateTransportButtons();
  setPlaybackBanner(PAUSED_MESSAGE, 'info');
}

/** Play / Pause / Resume on the main buttons, with Stop beside them when active. */
function updateTransportButtons() {
  const playLabel = playbackState.isPlaying
    ? 'Pause'
    : playbackState.isPaused
      ? 'Resume'
      : 'Play';
  playbackUi.playButtons.forEach((button) => {
    button.textContent = playLabel;
  });
  const stopHidden = !(playbackState.isPlaying || playbackState.isPaused);
  playbackUi.stopButtons.forEach((button) => {
    button.hidden = stopHidden;
  });
}

// ─── Exercise history & pinned exercises ─────────────────────────────────────
// Every loop that reaches the speakers is snapshotted: the form settings plus
// the exact notes that were generated. That makes a continuous-shift run
// replayable afterwards - you can go back to the key that caught you out
// instead of waiting for it to come round again. The session list lives in
// memory; pinning copies an entry to localStorage so it survives a reload.

const HISTORY_LIMIT = 20;
const PINNED_LIMIT = 50;
const PINNED_STORAGE_KEY = 'arpeggioFlow.pinnedExercises';
// Restored in this order, so progression lands before bars (a progression
// change resets the bar count).
const SNAPSHOT_CONTROL_IDS = [
  // First so a restore lands the instrument before shape/pianoRange are read.
  'instrument',
  'scaleSystem',
  'key',
  'scaleType',
  'shape',
  'pianoHand',
  'pianoRange',
  'progression',
  'customProgression',
  'bars',
  'trueChorusLength',
  // Meter before notesPerMeasure: the notes-per-bar option list is rebuilt
  // for the meter before the stored count is written into it.
  'timeSignature',
  'notesPerMeasure',
  'addRests',
  'startDegree',
  'turnaroundMode',
  'songSelect',
  'tempoBpm',
  'strudelSound',
  'rhythmSound',
  'backingChords',
  'soundAmbience',
  'playbackHighlightMode',
  'loopPause',
];

const exerciseHistory = []; // newest first, this session only
let pinnedExercises = []; // newest first, persisted

function readPinnedExercises() {
  try {
    const raw = window.localStorage?.getItem(PINNED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Could not read pinned exercises:', error);
    return [];
  }
}

function writePinnedExercises() {
  try {
    window.localStorage?.setItem(PINNED_STORAGE_KEY, JSON.stringify(pinnedExercises));
  } catch (error) {
    console.warn('Could not save pinned exercises:', error);
  }
}

// ─── Remembered settings ─────────────────────────────────────────────────────
// The form as it was left, restored on the next visit. Same shape as a history
// snapshot's settings plus the controls a snapshot deliberately leaves alone
// (loading a saved exercise must not silently change how playback behaves).

const SETTINGS_STORAGE_KEY = 'arpeggioFlow.lastSettings';
// A history snapshot deliberately leaves the shift mode alone (loading a saved
// exercise must not change how playback behaves), but "last used" remembers it.
const EXTRA_PREF_CONTROL_IDS = ['continuousShift', 'stayInPosition'];

function saveUserDefaults() {
  try {
    const values = captureControlValues(EXTRA_PREF_CONTROL_IDS);
    window.localStorage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(values));
  } catch (error) {
    console.warn('Could not save the current settings:', error);
  }
}

function restoreUserDefaults() {
  let values = null;
  try {
    const raw = window.localStorage?.getItem(SETTINGS_STORAGE_KEY);
    values = raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Could not read the saved settings:', error);
  }
  if (!values || typeof values !== 'object') return false;
  applyControlValues(values, EXTRA_PREF_CONTROL_IDS);
  return true;
}

function readControlValue(element) {
  return element.type === 'checkbox' ? element.checked : element.value;
}

function writeControlValue(element, value) {
  if (element.type === 'checkbox') {
    element.checked = Boolean(value);
  } else {
    element.value = value;
  }
}

function captureControlValues(extraIds = []) {
  const values = {};
  [...SNAPSHOT_CONTROL_IDS, ...extraIds].forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      values[id] = readControlValue(element);
    }
  });
  values.exerciseMode = getSelectedExerciseMode();
  return values;
}

function applyControlValues(values, extraIds = []) {
  if (!values) return;
  // The shape list is rebuilt by updateShapeOptions() when the scale system
  // changes, so that one needs its change event before 'shape' is set.
  const scaleSystem = document.getElementById('scaleSystem');
  if (scaleSystem && values.scaleSystem && scaleSystem.value !== values.scaleSystem) {
    scaleSystem.value = values.scaleSystem;
    scaleSystem.dispatchEvent(new Event('change'));
  }
  // Meter first: snapshots and settings from before the time-signature
  // control are 4/4 exercises, and the notes-per-bar list must be rebuilt for
  // the meter before the stored count lands in it.
  const timeSignature = document.getElementById('timeSignature');
  if (timeSignature) {
    timeSignature.value = values.timeSignature || '4';
    updateNotesPerBarOptions();
  }
  const addRests = document.getElementById('addRests');
  if (addRests) {
    addRests.checked = Boolean(values.addRests);
  }
  [...SNAPSHOT_CONTROL_IDS, ...extraIds].forEach((id) => {
    if (id === 'scaleSystem' || values[id] === undefined) return;
    const element = document.getElementById(id);
    // No change events here: they would re-derive bars from the progression
    // and re-apply song defaults over the values being restored.
    if (element) {
      writeControlValue(element, values[id]);
    }
  });
  normalizeNotesPerBarSelection();
  // Snapshots and settings written before piano mode existed have no
  // instrument field: they are guitar exercises, and the explicit default is
  // what keeps them loading as such from piano mode.
  setInstrument(values.instrument || 'guitar', { skipSave: true });
  if (values.exerciseMode) {
    setExerciseMode(values.exerciseMode);
  }
  updateCustomProgressionVisibility();
  updateKeyDebug(getSelectedKeyValue());
  updateExportTitle();
}

// Labels travel into the exported .json, so they are kept to plain ASCII: a
// middle dot or an en dash in there survives the round trip but reads as
// mojibake in any editor that guesses the file's encoding wrong.
const LABEL_SEPARATOR = ' | ';

function describeSnapshotSettings(values) {
  const shapeLabel =
    values.instrument === 'piano'
      ? `Piano ${values.pianoHand === 'left' ? 'LH' : 'RH'} ${values.pianoRange}`
      : `Shape ${values.shape}`;
  if (values.exerciseMode === EXERCISE_MODES.SONG) {
    const song = getSongById(values.songSelect);
    return [song?.title || 'Song', shapeLabel].join(LABEL_SEPARATOR);
  }
  const quality = values.scaleType === 'minor' ? 'minor' : 'major';
  const parts = [`${values.key} ${quality}`, shapeLabel, values.progression];
  if (values.timeSignature && values.timeSignature !== '4') {
    parts.push(`${values.timeSignature}/4`);
  }
  return parts.join(LABEL_SEPARATOR);
}

function describeSnapshotVoices(values) {
  const parts = [];
  const soundConfig = getStrudelSoundConfig(values.strudelSound);
  if (soundConfig.type !== 'none') {
    parts.push(soundConfig.label);
  }
  if (values.rhythmSound && values.rhythmSound !== 'off') {
    parts.push(getRhythmLabel(values.rhythmSound));
  }
  return parts.length ? parts.join(' + ') : 'no sound';
}

/** Settings + the exact notes on screen, or null if nothing is rendered. */
function captureExerciseSnapshot() {
  const measures = toReplayMeasures(lastExerciseState?.measureData);
  if (!measures.length) {
    return null;
  }
  const settings = captureControlValues();
  return {
    id: `ex-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    savedAt: Date.now(),
    label: describeSnapshotSettings(settings),
    detail: `${settings.tempoBpm || '?'} BPM${LABEL_SEPARATOR}${describeSnapshotVoices(settings)}`,
    settings,
    measures,
  };
}

/** Same chart and same notes → same exercise, whatever the timestamps say.
 * The separator is normalised so exercises pinned before labels went ASCII
 * still match the ones generated now. */
function snapshotSignature(snapshot) {
  return [
    snapshot.label.replace(/\s*[·|]\s*/g, LABEL_SEPARATOR),
    snapshot.measures.map((measure) => measure.notes.join(',')).join('|'),
  ].join('#');
}

function recordExerciseInHistory() {
  const snapshot = captureExerciseSnapshot();
  if (!snapshot) return;
  const newest = exerciseHistory[0];
  if (newest && snapshotSignature(newest) === snapshotSignature(snapshot)) {
    return;
  }
  exerciseHistory.unshift(snapshot);
  if (exerciseHistory.length > HISTORY_LIMIT) {
    exerciseHistory.length = HISTORY_LIMIT;
  }
  updateHistoryButton();
  renderExerciseHistory();
}

/** Replayed slots/notes only fit if the rebuilt chart has the same shape. */
function matchReplayMeasures(replay, measureData) {
  if (!Array.isArray(replay) || replay.length !== measureData.length) {
    return null;
  }
  const fits = replay.every((entry, index) => {
    const measure = measureData[index];
    return (
      entry &&
      Array.isArray(entry.slots) &&
      Array.isArray(entry.notes) &&
      entry.notes.length > 0 &&
      entry.slots.length === (measure.slots || []).length &&
      countSlotNotes(entry.slots) === entry.notes.length
    );
  });
  return fits ? replay : null;
}

/** Put a saved exercise on screen - settings, chart and its exact notes. */
function showExerciseSnapshot(snapshot, { warnOnMismatch = false } = {}) {
  if (!snapshot) return;
  applyControlValues(snapshot.settings);
  // Loading a pinned entry also sets where the rotation carries on from.
  currentPinnedId = isPinned(snapshot.id) ? snapshot.id : null;
  regenerateExercise({ replay: snapshot.measures, warnOnReplayMismatch: warnOnMismatch });
}

async function loadExerciseSnapshot(snapshot) {
  if (!snapshot) return;
  if (playbackState.isPlaying || playbackState.isPaused) {
    await stopPlayback();
  }
  showExerciseSnapshot(snapshot, { warnOnMismatch: true });
  renderExerciseHistory();
  document.getElementById('exerciseHistoryModal')?.close();
}

/**
 * Cycle mode plays the rotation, not whatever happened to be on screen: if the
 * current exercise is not one of the pinned ones, start on the first pinned
 * entry instead of running the stale one for a loop first.
 */
function ensurePinnedRotationStart() {
  if (getSelectedContinuousShift() !== 'cycle-pinned' || !pinnedExercises.length) return;
  const rotation = pinnedRotationEntries();
  if (!rotation.length) {
    setPlaybackBanner(
      `No pinned exercises for the ${getActiveInstrument()}: the cycle only plays snapshots of the active instrument.`,
      'warning'
    );
    return;
  }
  const current = captureExerciseSnapshot();
  const signature = current ? snapshotSignature(current) : null;
  const match =
    signature && rotation.find((entry) => snapshotSignature(entry) === signature);
  if (match) {
    currentPinnedId = match.id;
    return;
  }
  showExerciseSnapshot(rotation[0]);
  renderExerciseHistory();
}

/** Move a pinned entry up or down the rotation. */
function movePinnedExercise(id, delta) {
  const index = pinnedExercises.findIndex((entry) => entry.id === id);
  const target = index + delta;
  if (index === -1 || target < 0 || target >= pinnedExercises.length) return;
  const [entry] = pinnedExercises.splice(index, 1);
  pinnedExercises.splice(target, 0, entry);
  writePinnedExercises();
  renderExerciseHistory();
}

function isPinned(id) {
  return pinnedExercises.some((entry) => entry.id === id);
}

function togglePinned(snapshot) {
  if (isPinned(snapshot.id)) {
    pinnedExercises = pinnedExercises.filter((entry) => entry.id !== snapshot.id);
  } else {
    pinnedExercises.unshift({ ...snapshot });
    if (pinnedExercises.length > PINNED_LIMIT) {
      pinnedExercises.length = PINNED_LIMIT;
    }
  }
  writePinnedExercises();
  updateHistoryButton();
  renderExerciseHistory();
}

function removePinned(id) {
  pinnedExercises = pinnedExercises.filter((entry) => entry.id !== id);
  writePinnedExercises();
  updateHistoryButton();
  renderExerciseHistory();
}

// ─── Pinned exercises: file in, file out ─────────────────────────────────────
// localStorage is per browser, so the pinned set is also written to (and read
// from) a plain JSON file - a backup, and the way to carry a practice set to
// another device.

// The shape of the file itself, bumped only when the layout of what is written
// changes in a way an importer has to know about (the app version travels
// alongside it, and says which build wrote the file).
const EXERCISE_FILE_FORMAT = 1;

function setHistoryHint(message) {
  const hint = document.getElementById('histToolbarHint');
  if (hint) {
    hint.textContent = message;
  }
}

/** Write exercises to a .json file the Import button can read back. */
function downloadExercisesFile(exercises, filenameStem) {
  const payload = {
    app: 'arpeggio-flow',
    kind: 'exercises',
    appVersion: APP_VERSION,
    formatVersion: EXERCISE_FILE_FORMAT,
    savedAt: new Date().toISOString(),
    exercises,
  };
  // The charset matters: labels are plain ASCII, but without it a browser
  // opening the saved file falls back to a legacy codepage and any accented
  // song title comes out as mojibake.
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenameStem}-${new Date().toISOString().slice(0, 10)}.json`;
  // Safari only downloads from an anchor that is in the document, and revoking
  // the blob URL in the same tick cancels the download - hence the timeout.
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

function exportPinnedExercises() {
  if (!pinnedExercises.length) {
    setHistoryHint('Nothing pinned yet: star an exercise first.');
    return;
  }
  downloadExercisesFile(pinnedExercises, `arpeggio-flow-pinned-${pinnedExercises.length}`);
  setHistoryHint(`Exported ${pinnedExercises.length} pinned exercise(s).`);
}

/** The exercise on screen, as a file that Import (or another device) accepts.
 * Named like the PNG/PDF exports, so the three files of one exercise sort
 * together: instrument, then key/progression (or song) and shape/register. */
function exportCurrentExercise() {
  const snapshot = captureExerciseSnapshot();
  if (!snapshot) {
    setPlaybackBanner('Generate an exercise before exporting it.', 'warning');
    return;
  }
  downloadExercisesFile([snapshot], buildExportFileName(null));
  setPlaybackBanner(`Exported “${snapshot.label}” as a file.`, 'info');
}

/**
 * Load an exported exercise file straight onto the main window, ready to
 * Play - unlike History → Import, which only adds entries to the pinned list
 * and still needs Load clicked on one of them. A multi-exercise (pinned
 * export) file loads its first entry.
 */
async function loadExerciseFromFile(file) {
  if (!file) return;
  let entries = [];
  try {
    entries = readPinnedFilePayload(await file.text());
  } catch (error) {
    setPlaybackBanner(
      `Could not read “${file.name}”: ${error?.message || error}`,
      'warning'
    );
    return;
  }
  if (!entries.length) {
    setPlaybackBanner(`No exercise found in “${file.name}”.`, 'warning');
    return;
  }
  const snapshot = entries[0];
  await loadExerciseSnapshot(snapshot);
  const extra = entries.length > 1 ? ` (first of ${entries.length} in the file)` : '';
  setPlaybackBanner(`Loaded “${snapshot.label}”${extra}, ready to play.`, 'info');
}

/** Accepts the exported wrapper or a bare array of exercises. */
function readPinnedFilePayload(text) {
  const parsed = JSON.parse(text);
  const list = Array.isArray(parsed) ? parsed : parsed?.exercises;
  if (!Array.isArray(list)) {
    throw new Error('not an Arpeggio Flow pinned file');
  }
  return list.filter(
    (entry) =>
      entry &&
      typeof entry.label === 'string' &&
      entry.settings &&
      typeof entry.settings === 'object' &&
      Array.isArray(entry.measures) &&
      entry.measures.length &&
      entry.measures.every((measure) => Array.isArray(measure?.notes) && measure.notes.length)
  );
}

async function importPinnedExercises(file) {
  if (!file) return;
  let incoming = [];
  try {
    incoming = readPinnedFilePayload(await file.text());
  } catch (error) {
    console.warn('Could not read the pinned file:', error);
    setHistoryHint('That file could not be read as an Arpeggio Flow pinned list.');
    return;
  }
  if (!incoming.length) {
    setHistoryHint('No usable exercises in that file.');
    return;
  }
  // Merge rather than replace, and match on content so re-importing the same
  // file does not pile up duplicates.
  const known = new Set(pinnedExercises.map((entry) => snapshotSignature(entry)));
  const added = [];
  incoming.forEach((entry) => {
    const signature = snapshotSignature(entry);
    if (known.has(signature)) return;
    known.add(signature);
    added.push({
      ...entry,
      id: entry.id || `ex-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      savedAt: entry.savedAt || Date.now(),
    });
  });
  pinnedExercises = [...added, ...pinnedExercises].slice(0, PINNED_LIMIT);
  writePinnedExercises();
  updateHistoryButton();
  renderExerciseHistory();
  const skipped = incoming.length - added.length;
  // Loading is enough on its own: with nothing on screen yet (a fresh visit),
  // put the first loaded exercise up so Play is usable straight away.
  let shown = '';
  if (!playbackState.measuresData.length && pinnedExercises.length) {
    showExerciseSnapshot(pinnedExercises[0]);
    renderExerciseHistory();
    shown = ` Showing “${pinnedExercises[0].label}”.`;
  }
  setHistoryHint(
    `Loaded ${added.length} exercise(s)${skipped ? `, ${skipped} already pinned` : ''}.${shown}`
  );
}

function formatRelativeTime(timestamp) {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function buildHistoryRow(snapshot, { pinnedList, order }) {
  const row = document.createElement('div');
  row.className = 'hist-row';
  const isCurrent = pinnedList && snapshot.id === currentPinnedId;
  row.classList.toggle('hist-row--current', isCurrent);

  const main = document.createElement('div');
  main.className = 'hist-row__main';
  const label = document.createElement('div');
  label.className = 'hist-row__label';
  if (order) {
    // Rotation position, so "Cycle pinned exercises" is readable at a glance.
    const ordinal = document.createElement('span');
    ordinal.className = 'hist-row__order';
    ordinal.textContent = `${order}`;
    label.append(ordinal);
  }
  label.append(document.createTextNode(snapshot.label));
  if (isCurrent) {
    const now = document.createElement('span');
    now.className = 'hist-row__now';
    now.textContent = 'now';
    label.append(now);
  }
  const detail = document.createElement('div');
  detail.className = 'hist-row__detail';
  detail.textContent = `${snapshot.detail} · ${formatRelativeTime(snapshot.savedAt)}`;
  main.append(label, detail);

  const actions = document.createElement('div');
  actions.className = 'hist-row__actions';

  const loadButton = document.createElement('button');
  loadButton.type = 'button';
  loadButton.className = 'secondary-button';
  loadButton.textContent = 'Load';
  loadButton.addEventListener('click', () => loadExerciseSnapshot(snapshot));
  actions.append(loadButton);

  const pinButton = document.createElement('button');
  pinButton.type = 'button';
  pinButton.className = 'hist-icon-button';
  const pinned = isPinned(snapshot.id);
  pinButton.classList.toggle('is-pinned', pinned);
  pinButton.textContent = pinned ? '★' : '☆';
  pinButton.title = pinned ? 'Unpin' : 'Pin (kept after reload)';
  pinButton.setAttribute('aria-label', pinButton.title);
  pinButton.addEventListener('click', () => togglePinned(snapshot));
  actions.append(pinButton);

  if (pinnedList) {
    const index = pinnedExercises.findIndex((entry) => entry.id === snapshot.id);
    [
      { label: '▲', delta: -1, title: 'Move up in the cycle' },
      { label: '▼', delta: 1, title: 'Move down in the cycle' },
    ].forEach(({ label, delta, title }) => {
      const moveButton = document.createElement('button');
      moveButton.type = 'button';
      moveButton.className = 'hist-icon-button';
      moveButton.textContent = label;
      moveButton.title = title;
      moveButton.setAttribute('aria-label', title);
      moveButton.disabled = index + delta < 0 || index + delta >= pinnedExercises.length;
      moveButton.addEventListener('click', () => movePinnedExercise(snapshot.id, delta));
      actions.append(moveButton);
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'hist-icon-button';
    deleteButton.textContent = '✕';
    deleteButton.title = 'Remove';
    deleteButton.setAttribute('aria-label', 'Remove');
    deleteButton.addEventListener('click', () => removePinned(snapshot.id));
    actions.append(deleteButton);
  }

  row.append(main, actions);
  return row;
}

function buildHistorySection(title, snapshots, emptyText, options) {
  const fragment = document.createDocumentFragment();
  const heading = document.createElement('h3');
  heading.className = 'hist-section-title';
  heading.textContent = title;
  fragment.append(heading);
  if (!snapshots.length) {
    const empty = document.createElement('p');
    empty.className = 'hist-empty';
    empty.textContent = emptyText;
    fragment.append(empty);
    return fragment;
  }
  snapshots.forEach((snapshot, index) =>
    fragment.append(
      buildHistoryRow(snapshot, { ...options, order: options.pinnedList ? index + 1 : 0 })
    )
  );
  return fragment;
}

function renderExerciseHistory() {
  const body = document.getElementById('exerciseHistoryBody');
  if (!body) return;
  body.innerHTML = '';
  body.append(
    buildHistorySection(
      'Pinned (cycled top to bottom)',
      pinnedExercises,
      'Nothing pinned yet: use ☆ to keep an exercise after a reload, and to add it to the cycle.',
      { pinnedList: true }
    )
  );
  body.append(
    buildHistorySection(
      'This session',
      exerciseHistory,
      'Press Play and the exercises you hear will show up here.',
      { pinnedList: false }
    )
  );
}

function updateHistoryButton() {
  const button = document.getElementById('exerciseHistoryButton');
  if (!button) return;
  const count = exerciseHistory.length + pinnedExercises.length;
  button.textContent = count ? `History (${count})` : 'History';
}

// ─────────────────────────────────────────────────────────────────────────────

function updatePlaybackControls() {
  if (!playbackUi.playButtons.length) {
    return;
  }
  const hasExercise = playbackState.measuresData.length > 0;
  const canPlay =
    hasExercise &&
    (isVisualPlaybackEnabled() ||
      (playbackState.engine === 'strudel' && playbackState.notes.length > 0));
  playbackUi.playButtons.forEach((button) => {
    button.disabled = !canPlay;
  });
  playbackUi.stopButtons.forEach((button) => {
    button.disabled = !hasExercise;
  });
  updateTransportButtons();
}

function updatePlaybackStateFromExercise(exerciseData) {
  playbackState.notes = exerciseData?.generatedNotes || [];
  playbackState.measuresData = exerciseData?.measuresData || [];
  playbackState.stavePositions = exerciseData?.stavePositions || [];
  playbackState.beatSlots = exerciseData?.beatSlots || [];
  updatePlaybackControls();
  refreshPlaybackBanner();
}

function refreshPlaybackBanner() {
  if (playbackState.isPaused) {
    setPlaybackBanner(PAUSED_MESSAGE, 'info');
    return;
  }
  if (playbackState.engine === 'strudel') {
    if (!isAudioPlaybackEnabled()) {
      setPlaybackBanner(AUDIO_OFF_MESSAGE, 'warning');
      return;
    }
    if (playbackState.notes.length) {
      const bpm = getSelectedTempoBpm();
      setPlaybackBanner(
        `Strudel ready at ${bpm} BPM (${describePlaybackVoices()}). Click Play to hear the exercise.`,
        'info'
      );
    } else {
      setPlaybackBanner('Generate an exercise to enable playback.', 'warning');
    }
  }
}

function toStrudelNote(note) {
  if (typeof note !== 'string') {
    return null;
  }
  const match = note.trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!match) {
    return null;
  }
  const letter = match[1].toLowerCase();
  const accidental = match[2] || '';
  const octave = match[3];
  return `${letter}${accidental}${octave}`;
}

function buildStrudelNotePattern(notes) {
  const tokens = notes
    .map(toStrudelNote)
    .filter((token) => token && token.length > 0);
  return tokens.join(' ');
}

// Build a mini-notation pattern where each top-level token is one beat:
// a quarter note is "c4", a pair of eighths "[c4 d4]". Rests (nulls) become
// "~" so every beat keeps its place on the grid.
function buildStrudelBeatPattern(beatSlots) {
  return beatSlots
    .map((slotNotes) => {
      const entries = slotNotes && slotNotes.length ? slotNotes : [null];
      const tokens = entries.map((note) => toStrudelNote(note) || '~');
      return tokens.length === 1 ? tokens[0] : `[${tokens.join(' ')}]`;
    })
    .join(' ');
}

/**
 * Strudel uses cycles as its fundamental timing unit, not beats.
 * According to Strudel docs (https://strudel.cc/understand/cycles/):
 * setcpm(bpm / bpc) where bpc = beats per cycle
 * 
 * This app uses bpc=4 as a fixed calibration unit: cycles per minute =
 * bpm / 4, whatever the written meter. The bar length is a separate,
 * user-picked value - see getBeatsPerBar() - and all the pattern math is
 * driven by total beat counts, so a 3/4 bar is simply three beat tokens.
 */

const BEATS_PER_CYCLE = 4;

function getCyclesPerMinute(bpm) {
  return bpm / BEATS_PER_CYCLE;
}

function getCyclesPerSecond(bpm) {
  return getCyclesPerMinute(bpm) / 60;
}

function buildStrudelEvaluateCode(notes, bpm) {
  const patternText = buildStrudelNotePattern(notes);
  const measures = getMeasures(notes.length);
  const cyclesPerMinute = getCyclesPerMinute(bpm);
  const cyclesPerSecond = getCyclesPerSecond(bpm);
  return [
    `typeof setcpm === "function" && setcpm(${cyclesPerMinute})`,
    `typeof setCpm === "function" && setCpm(${cyclesPerMinute})`,
    `typeof setcps === "function" && setcps(${cyclesPerSecond})`,
    `note("${patternText}").slow(${measures})`,
  ].join('; ');
}

// The tempo setters are NOT exports of the @strudel/web ES module - they are
// only installed as window globals once initStrudel() has run. Look in both
// places (api for the CDN/global build, window for the ESM build).
function resolveStrudelFn(api, names) {
  for (const name of names) {
    if (typeof api?.[name] === 'function') {
      return { name, fn: api[name] };
    }
    if (typeof window !== 'undefined' && typeof window[name] === 'function') {
      return { name, fn: window[name] };
    }
  }
  return null;
}

function applyStrudelTempo(api, bpm) {
  const cyclesPerMinute = getCyclesPerMinute(bpm);
  const cyclesPerSecond = getCyclesPerSecond(bpm);
  const setCpmFn = resolveStrudelFn(api, ['setcpm', 'setCpm']);
  if (setCpmFn) {
    setCpmFn.fn(cyclesPerMinute);
    debugLog(`Strudel tempo applied via ${setCpmFn.name}:`, { cyclesPerMinute });
    return true;
  }
  const setCpsFn = resolveStrudelFn(api, ['setcps', 'setCps']);
  if (setCpsFn) {
    setCpsFn.fn(cyclesPerSecond);
    debugLog(`Strudel tempo applied via ${setCpsFn.name}:`, { cyclesPerSecond });
    return true;
  }
  return false;
}

function getMeasures(beatCount) {
  // Empirical Strudel constants this formula is calibrated against (the web
  // build exposes NO scheduler tempo setters, so both are fixed):
  //   - scheduler runs at 0.5 cycles/sec, always
  //   - pattern.cpm(x) means pattern.fast(x / 60)
  // slow(beats / 8) puts 8 beat-tokens in one cycle; combined with
  // pattern.cpm(bpm / 4) the note rate is 8 * (bpm/240) * 0.5 = bpm/60
  // beats per second - exactly the notated tempo. Do not "simplify" this
  // to beats / BEATS_PER_CYCLE: that plays at half speed.
  // Loops shorter than 8 beats must return a fraction (slow(0.5) fits a
  // 4-beat loop twice in a cycle) - clamping the RESULT to 1 played a
  // single-bar exercise at half tempo. Only the beat count is guarded.
  return Math.max(1, beatCount) / (2 * BEATS_PER_CYCLE);
}

// ─── Backing rhythm ──────────────────────────────────────────────────────────

/**
 * One entry per beat of the loop: its 0-based position inside its measure and
 * that measure's beat count, so rhythms can put the kick on 1 and 3 whatever
 * the measure lengths are. Falls back to a flat grid of the current meter if
 * the measure data does not add up to the beat count.
 */
function getBeatMeta(beatCount) {
  const segments = playbackState.measuresData || [];
  const total = segments.reduce((sum, segment) => sum + (segment.beats || 4), 0);
  const meta = [];
  if (segments.length && total === beatCount) {
    segments.forEach((segment) => {
      const beats = segment.beats || 4;
      for (let beat = 0; beat < beats; beat += 1) {
        meta.push({ beat, beats });
      }
    });
  } else {
    const beatsPerBar = getBeatsPerBar();
    for (let index = 0; index < beatCount; index += 1) {
      meta.push({ beat: index % beatsPerBar, beats: beatsPerBar });
    }
  }
  // Trailing rest bars, if any: part of the loop's grid, so every layer and
  // the visual clock see the same length.
  const pauseBarBeats = getBeatsPerBar();
  for (let index = 0; index < getLoopPauseBeats(); index += 1) {
    meta.push({
      beat: index % pauseBarBeats,
      beats: pauseBarBeats,
      isPause: true,
    });
  }
  return meta;
}

// Fixed pitch (c5) so every click sounds identical regardless of exercise
// notes. 15ms decay on a square wave = inaudible pitch, pure percussive click.
// One click per beat, independent of the note rhythm.
function buildClickPattern(api, beatMeta, measures, accent) {
  const clickText = beatMeta.map(() => 'c5').join(' ');
  const gain = accent
    ? beatMeta.map(({ beat }) => (beat === 0 ? '1' : '0.55')).join(' ')
    : 0.75;
  // gain before slow(): the two token strings are the same length, so beat i
  // of the click lines up with beat i of the gain pattern.
  return api.note(clickText).gain(gain).slow(measures).s('square').decay(0.015).sustain(0);
}

/** Drum/click layer for the selected rhythm, or null when it is off. */
async function buildRhythmPattern(api, beatMeta, measures) {
  const rhythm = getSelectedRhythm();
  const config = getRhythmConfig(rhythm);
  if (config.type === 'off') {
    return null;
  }
  if (config.type === 'click') {
    return buildClickPattern(api, beatMeta, measures, config.accent);
  }
  const soundFn = resolveStrudelFn(api, ['s', 'sound']);
  if (!soundFn) {
    setPlaybackBanner('This Strudel build cannot play drums; rhythm is off.', 'warning');
    return null;
  }
  if (!(await ensureDrumSamplesLoaded(api))) {
    setPlaybackBanner('Drum samples failed to load; rhythm is off.', 'warning');
    return null;
  }
  const layers = [];
  for (const spec of config.layers) {
    const tokenFor = typeof spec === 'function' ? spec : spec.token;
    const text = beatMeta.map(({ beat, beats }) => tokenFor(beat, beats) || '~').join(' ');
    let layer = soundFn.fn(text);
    if (!layer || typeof layer.slow !== 'function') {
      setPlaybackBanner('This Strudel build cannot play drums; rhythm is off.', 'warning');
      return null;
    }
    layer = layer.slow(measures);
    if (typeof layer.gain === 'function') {
      layer = layer.gain(spec.gain ?? config.gain ?? DEFAULT_RHYTHM_GAIN);
    }
    layers.push(layer);
  }
  return layers.reduce((combined, layer) => stackPatterns(api, combined, layer));
}

/**
 * A voice's own envelope from STRUDEL_SOUND_CONFIG (tuned in
 * debug/sound-lab.html). Runs after applyAmbience, so where the two set the
 * same control (release, clip, room…) the voice's audited value wins; keys
 * only the ambience sets (delay…) still come through the select.
 */
function applySoundEnvelope(pattern, soundConfig) {
  if (!pattern || !soundConfig?.envelope) {
    return pattern;
  }
  let result = pattern;
  Object.entries(soundConfig.envelope).forEach(([control, value]) => {
    if (typeof result[control] === 'function') {
      result = result[control](value);
    }
  });
  return result;
}

/** Apply the selected ambience controls to the melodic pattern. */
function applyAmbience(pattern) {
  if (!pattern) {
    return pattern;
  }
  const config = getAmbienceConfig(getSelectedAmbience());
  const applied = {};
  let result = pattern;
  Object.entries(config).forEach(([control, value]) => {
    if (control === 'label' || typeof result[control] !== 'function') {
      return;
    }
    result = result[control](value);
    applied[control] = value;
  });
  debugLog('Ambience applied:', applied);
  return result;
}

/** Loop length + tempo of the exercise currently loaded, as a comparable key. */
function getStrudelLoopSignature() {
  const beatCount =
    (playbackState.beatSlots?.length || playbackState.notes.length) + getLoopPauseBeats();
  return `${getMeasures(beatCount)}@${getCyclesPerMinute(getSelectedTempoBpm())}`;
}

/** True when the next play() cannot be an in-place swap (grid change). */
function willRestartStrudelLoop() {
  return strudelWrapperActive && strudelLoopSignature !== getStrudelLoopSignature();
}

// ─── Backing chords ──────────────────────────────────────────────────────────

// Comping register: root from C3 up, so the voicing sits under the exercise
// (which lives in guitar range) without crowding it.
const BACKING_CHORD_LOW_MIDI = Tonal.Note.midi('C3');
// Three notes, not four: a fourth tone under the exercise turns the comp into
// a wall, and three is what a hand comping behind a soloist actually holds.
const BACKING_CHORD_VOICE_COUNT = 3;

// The comp is background, so it is played with a soft attack and a long tail:
// no percussive edge on the front, and no abrupt cut when a chord is followed
// by a rest.
const BACKING_CHORD_ENVELOPE = {
  attack: 0.05,
  decay: 0.3,
  sustain: 0.75,
  release: 0.9,
};

/**
 * Where the comp voicing starts. On guitar it always sits at C3, under the
 * exercise. On piano the comp is the resting hand, so it moves to the other
 * side of the practice register: below it for right-hand practice, above it
 * for left-hand practice.
 */
function getBackingChordLowMidi() {
  if (getActiveInstrument() !== 'piano') {
    return BACKING_CHORD_LOW_MIDI;
  }
  const range = window.pianoKeyboard.parsePianoRange(
    document.getElementById('pianoRange')?.value
  );
  if (getSelectedPianoHand() === 'left') {
    return range.maxMidi + 4; // right hand comps just above the register
  }
  // Left hand comps an octave under the register, kept out of the mud.
  return Math.max(36, range.minMidi - 12);
}

/**
 * The three chord tones a comping hand would actually hold: the root, the
 * third (or the tone that stands in for it in a sus chord), and the colour
 * tone on top - the seventh when there is one, else the sixth, else the fifth.
 * Extensions above the seventh are dropped. Triads keep all three notes.
 */
function selectVoicingTones(chordData) {
  const notes = chordData?.notes || [];
  const intervals = chordData?.intervals || [];
  if (notes.length <= BACKING_CHORD_VOICE_COUNT) return notes;
  const byDegree = new Map();
  intervals.forEach((interval, index) => {
    const degree = parseInt(String(interval).replace(/\D/g, ''), 10);
    if (Number.isFinite(degree) && !byDegree.has(degree) && notes[index]) {
      byDegree.set(degree, notes[index]);
    }
  });
  const chosen = [];
  const take = (...degrees) => {
    const found = degrees.find(
      (degree) => byDegree.has(degree) && !chosen.includes(byDegree.get(degree))
    );
    if (found) chosen.push(byDegree.get(found));
  };
  take(1);
  take(3, 4, 2);
  take(7, 6, 5);
  // Anything the degree map could not name (odd chord symbols) is filled in
  // from the plain note list, so the voicing is never short.
  notes.forEach((note) => {
    if (chosen.length < BACKING_CHORD_VOICE_COUNT && !chosen.includes(note)) {
      chosen.push(note);
    }
  });
  return chosen.slice(0, BACKING_CHORD_VOICE_COUNT);
}

/** Stack pitch classes upwards, the first one at or above lowMidi. */
function stackVoicing(pitchClasses, lowMidi) {
  const notes = [];
  let previousMidi = lowMidi - 1;
  pitchClasses.forEach((pitchClass) => {
    let octave = Math.floor(previousMidi / 12) - 1;
    let midi = Tonal.Note.midi(`${pitchClass}${octave}`);
    while (Number.isFinite(midi) && midi <= previousMidi) {
      octave += 1;
      midi = Tonal.Note.midi(`${pitchClass}${octave}`);
    }
    if (!Number.isFinite(midi)) return;
    previousMidi = midi;
    // Note names, not strudel tokens: the notation layer reads this too, and
    // it needs the chord's own spelling (Eb, not D#).
    notes.push({ name: `${pitchClass}${octave}`, midi });
  });
  return notes;
}

/** How far the hand travels between two voicings, low note to low note. */
function voicingDistance(candidate, previous) {
  return candidate.reduce(
    (sum, note, index) => sum + Math.abs(note.midi - (previous[index]?.midi ?? note.midi)),
    0
  );
}

/**
 * A three-note voicing for one chord. `state` (optional, `{ previous }`) is
 * carried along a chart: each chord is written in whichever inversion lies
 * closest to the one before it, so the comp stays put instead of jumping back
 * to root position on every bar. The first chord is in root position.
 */
function buildBackingChordVoicing(
  rootNote,
  quality,
  lowMidi = BACKING_CHORD_LOW_MIDI,
  state = null
) {
  const chordData = Tonal.Chord.get(`${rootNote}${quality || ''}`);
  const tones = selectVoicingTones(chordData);
  if (!tones.length) return null;
  const inversions = tones.map((unused, rotation) =>
    stackVoicing([...tones.slice(rotation), ...tones.slice(0, rotation)], lowMidi)
  );
  const previous = state?.previous;
  const best = previous
    ? inversions.reduce((closest, candidate) =>
        voicingDistance(candidate, previous) < voicingDistance(closest, previous)
          ? candidate
          : closest
      )
    : inversions[0];
  if (!best?.length) return null;
  if (state) {
    state.previous = best;
  }
  return best.map((note) => note.name);
}

/** The bass hit of a bass-&-chords preset: the root alone, placed in the
 * octave just below the chord voicing. */
function buildBackingBassNote(rootNote, lowMidi = BACKING_CHORD_LOW_MIDI) {
  const pitchClass = Tonal.Note.pitchClass(rootNote);
  if (!pitchClass) return null;
  for (let octave = 0; octave <= 7; octave += 1) {
    const midi = Tonal.Note.midi(`${pitchClass}${octave}`);
    if (Number.isFinite(midi) && midi >= lowMidi - 12 && midi < lowMidi) {
      return `${pitchClass}${octave}`;
    }
  }
  return null;
}

/**
 * Chord layer for the whole loop: one mini-notation token per beat, a stacked
 * "[c3,e3,g3,b3]" where the preset asks for a hit and "~" elsewhere. Clip is
 * patterned alongside so a held chord can ring past its own beat.
 */
async function buildBackingChordsPattern(api, beatMeta, measures, options = {}) {
  // The song intro reuses this layer over the chart's own bars (and forces a
  // preset when backing chords are off, so the head is always comped).
  const config = options.forceConfig || getBackingChordConfig(getSelectedBackingChords());
  if (config.type === 'off') return null;
  const segments = options.segments || playbackState.measuresData || [];
  const totalBeats = segments.reduce((sum, segment) => sum + (segment.beats || 4), 0);
  const pauseBeats = beatMeta.filter((entry) => entry.isPause).length;
  if (!segments.length || totalBeats + pauseBeats !== beatMeta.length) {
    debugLog('Backing chords skipped: measure data does not line up with the beat grid.');
    return null;
  }
  const noteTokens = [];
  const clipTokens = [];
  const compLowMidi = getBackingChordLowMidi();
  // Voice leading runs along the chart, so the segments have to be walked in
  // order - the same order the notation walks them in, which is what keeps
  // the written comp and the played one identical.
  const voicingState = { previous: null };
  segments.forEach((segment) => {
    const beats = segment.beats || 4;
    const voicingNotes = buildBackingChordVoicing(
      segment.rootNote,
      segment.quality,
      compLowMidi,
      voicingState
    );
    const voicing = (voicingNotes || []).map(toStrudelNote).filter(Boolean);
    const bassToken = toStrudelNote(
      buildBackingBassNote(segment.rootNote, compLowMidi) || ''
    );
    const hits = new Map((config.hits(beats) || []).map((hit) => [hit.beat, hit]));
    for (let beat = 0; beat < beats; beat += 1) {
      const hit = voicing.length ? hits.get(beat) : null;
      if (!hit) {
        noteTokens.push('~');
        clipTokens.push('1');
        continue;
      }
      // A bass hit is the root alone; when it cannot be placed (or the preset
      // has no bass hits) the full voicing plays as before.
      noteTokens.push(hit.bass && bassToken ? bassToken : `[${voicing.join(',')}]`);
      clipTokens.push(`${hit.clip}`);
    }
  });
  // The comp rests through the trailing bars; only the backing rhythm keeps
  // time there, so the pause reads as a pause.
  for (let index = 0; index < pauseBeats; index += 1) {
    noteTokens.push('~');
    clipTokens.push('1');
  }
  if (!noteTokens.some((token) => token !== '~')) return null;

  if (!(await ensureSoundfontsLoaded(api))) {
    setPlaybackBanner('Piano soundfont failed to load; backing chords are off.', 'warning');
    return null;
  }
  let pattern = api.note(noteTokens.join(' '));
  if (typeof pattern.clip === 'function') {
    pattern = pattern.clip(clipTokens.join(' '));
  }
  pattern = pattern.slow(measures);
  if (typeof pattern.s === 'function') {
    pattern = pattern.s(config.sound);
  }
  if (typeof pattern.gain === 'function') {
    pattern = pattern.gain(config.gain);
  }
  // Soft onset, long tail: the comp fades in under the exercise instead of
  // striking on top of it, and a chord followed by a rest dies away rather
  // than being switched off.
  Object.entries(BACKING_CHORD_ENVELOPE).forEach(([control, value]) => {
    if (typeof pattern[control] === 'function') {
      pattern = pattern[control](value);
    }
  });
  // A touch of room so the comp sits behind the exercise rather than on top.
  if (typeof pattern.room === 'function') {
    pattern = pattern.room(0.3);
  }
  return pattern;
}

// ─── Song intro: the head played once before the exercise ────────────────────
// One pass of the song's chart - comped chords, plus the melody when the song
// carries one (`melodyBars`, parsed from the PD-only `melody` field in
// songs/songs.js). After the chart, the running pattern is handed over to the
// exercise at the loop boundary (same wrapper-swap machinery as continuous
// shift).

function shouldPlayHeadFirst() {
  return (
    getSelectedExerciseMode() === EXERCISE_MODES.SONG &&
    (document.getElementById('playHeadFirst')?.checked ?? false)
  );
}

/** Chord segments of the chart's true form (one bar per written bar). */
function getSongIntroSegments(song) {
  const chartBars = normalizeSongBars(song?.progressionBars);
  if (!chartBars.length) return null;
  const segments = [];
  chartBars.forEach((barChords) => {
    const segmentBeats = distributeBeatsPerBar(barChords.length);
    segmentBeats.forEach((beats, index) => {
      const parsed = parseChordSymbol(barChords[index]);
      segments.push({
        rootNote: parsed?.rootNote || '',
        quality: parsed?.quality || '',
        beats,
      });
    });
  });
  return segments;
}

/**
 * Melody as one weighted mini-notation sequence: token weight = beats
 * ("g4@2 e4 [~]…"), so the total weight equals the chart's beat count and the
 * exercise tempo math applies unchanged. Padded with a rest when the melody
 * is shorter than the form.
 */
function buildMelodyPatternText(melodyBars, totalBeats) {
  const tokens = [];
  let beatsUsed = 0;
  (melodyBars || []).forEach((events) => {
    events.forEach(({ note, beats }) => {
      const token = note ? toStrudelNote(note) : '~';
      if (!token || !(beats > 0)) return;
      tokens.push(beats === 1 ? token : `${token}@${beats}`);
      beatsUsed += beats;
    });
  });
  if (!tokens.some((token) => !token.startsWith('~'))) return null;
  if (beatsUsed > totalBeats) {
    debugLog('Melody is longer than the chart; it will spill past the form.', {
      beatsUsed,
      totalBeats,
    });
  } else if (beatsUsed < totalBeats) {
    tokens.push(`~@${totalBeats - beatsUsed}`);
  }
  return tokens.join(' ');
}

/**
 * Build and start the intro pattern. Returns its length in beats, or 0 when
 * there is nothing to play (not in song mode, empty chart, Strudel missing).
 */
async function playSongIntro() {
  const song = getSelectedSong();
  const segments = getSongIntroSegments(song);
  if (!segments) return 0;
  const api = await ensureStrudelReady();
  if (!api) return 0;
  const bpm = getSelectedTempoBpm();
  const introBeats = segments.reduce((sum, segment) => sum + segment.beats, 0);
  const measures = getMeasures(introBeats);
  const beatMeta = [];
  segments.forEach((segment) => {
    for (let beat = 0; beat < segment.beats; beat += 1) {
      beatMeta.push({ beat, beats: segment.beats });
    }
  });

  // The head is always comped: the selected backing preset, or quarter-note
  // piano when backing chords are off.
  const backingSelection = getBackingChordConfig(getSelectedBackingChords());
  const compConfig =
    backingSelection.type === 'off'
      ? getBackingChordConfig('piano-quarters')
      : backingSelection;
  let pattern = await buildBackingChordsPattern(api, beatMeta, measures, {
    segments,
    forceConfig: compConfig,
  });

  const sound = getSelectedStrudelSound();
  const soundConfig = getStrudelSoundConfig(sound);
  const melodyText =
    soundConfig.type === 'none'
      ? null
      : buildMelodyPatternText(song.melodyBars, introBeats);
  if (melodyText) {
    let melody = api.note(melodyText).slow(measures);
    melody = await applySelectedSound(api, melody, sound, soundConfig);
    melody = applyAmbience(melody);
    pattern = stackPatterns(api, pattern, melody);
  }
  pattern = stackPatterns(api, pattern, await buildRhythmPattern(api, beatMeta, measures));
  if (!pattern) return 0;

  if (typeof pattern.cpm === 'function') {
    pattern = pattern.cpm(getCyclesPerMinute(bpm));
  } else if (!applyStrudelTempo(api, bpm)) {
    debugLog('No Strudel tempo API available; using the default clock.');
  }
  startOrSwapStrudelPattern(api, pattern, `${measures}@${getCyclesPerMinute(bpm)}`);
  const barsCount = normalizeSongBars(song.progressionBars).length;
  setPlaybackBanner(
    `Playing the head first (${barsCount} bars${song.melodyBars ? ', with melody' : ''}); the exercise follows.`,
    'info'
  );
  return introBeats;
}

/**
 * Give a melodic pattern the selected instrument voice, loading whatever
 * sample set the sound needs. Shared by the exercise notes and the intro
 * melody. Returns the pattern unchanged when the sound is the synth default
 * or a load fails (with a banner).
 */
async function applySelectedSound(api, pattern, sound, soundConfig) {
  if (!pattern) return pattern;
  if (soundConfig.type === 'dirt') {
    const loaded = await ensureGuitarSamplesLoaded(api);
    if (loaded && typeof pattern.s === 'function') {
      return pattern.s(soundConfig.sample);
    }
    setPlaybackBanner('Guitar samples failed to load. Using default synth.', 'warning');
  } else if (soundConfig.type === 'sample-map') {
    const loaded = await ensureGuitarVariantSamplesLoaded(api);
    if (loaded && typeof pattern.s === 'function') {
      return pattern.s(soundConfig.sample);
    }
    setPlaybackBanner('Guitar samples failed to load. Using default synth.', 'warning');
  } else if (soundConfig.type === 'soundfont') {
    const loaded = await ensureSoundfontsLoaded(api);
    if (loaded && typeof pattern.s === 'function') {
      return pattern.s(soundConfig.sample);
    }
    setPlaybackBanner('Soundfont guitars failed to load. Using default synth.', 'warning');
  } else if (sound !== 'default' && typeof pattern.s === 'function') {
    return pattern.s(sound);
  }
  return pattern;
}

/**
 * Start the delegating wrapper for a ready pattern, or swap its target when
 * one is already playing on the same cycle grid. The wrapper (see
 * strudelPatternRef) is what keeps loop-boundary swaps seamless.
 */
function startOrSwapStrudelPattern(api, pattern, signature) {
  strudelPatternRef = pattern;
  const PatternClass = getStrudelPatternClass(api);
  // A different loop length or tempo means a different cycle grid: swapping in
  // place would drop the new pattern in mid-cycle, so the clock restarts.
  if (strudelWrapperActive && strudelLoopSignature !== signature) {
    debugLog('Strudel loop grid changed; restarting the clock.', {
      from: strudelLoopSignature,
      to: signature,
    });
    strudelWrapperActive = false;
  }
  strudelLoopSignature = signature;
  if (strudelWrapperActive) {
    // Already playing through the delegating wrapper: swapping the ref is
    // enough. The scheduler clock never stops, so there is no restart seam
    // (no doubled or re-scheduled boundary notes); the new pattern has the
    // same loop length, so it stays on the same cycle grid.
    debugLog('Strudel pattern swapped in place.');
  } else if (PatternClass) {
    // Fresh start: stop the clock so the pattern begins at cycle 0, then
    // play a wrapper that delegates every query to the current pattern ref.
    if (typeof api.hush === 'function') {
      api.hush();
    }
    const wrapper = new PatternClass((state) => strudelPatternRef.query(state));
    wrapper.play();
    strudelWrapperActive = true;
  } else {
    // No Pattern class exposed by this build: restart the scheduler directly
    if (typeof api.hush === 'function') {
      api.hush();
    }
    pattern.play();
  }
}

function stackPatterns(api, first, second) {
  if (!first) return second;
  if (!second) return first;
  if (typeof first.stack === 'function') {
    return first.stack(second);
  }
  const stackFn = resolveStrudelFn(api, ['stack']);
  return stackFn ? stackFn.fn(first, second) : first;
}

async function playStrudelExercise(notes) {
  if (!notes.length) {
    setPlaybackBanner('Generate an exercise before playing.', 'warning');
    return;
  }
  const api = await ensureStrudelReady();
  if (!api) {
    return;
  }
  const bpm = getSelectedTempoBpm();
  const sound = getSelectedStrudelSound();
  const soundConfig = getStrudelSoundConfig(sound);
  // Beat-grouped pattern (eighth pairs bracketed); fall back to one note per
  // beat if no slot data is around (e.g. stale pre-rhythm exercise state).
  const beatSlots =
    playbackState.beatSlots && playbackState.beatSlots.length
      ? playbackState.beatSlots
      : notes.map((note) => [note]);
  const patternText = buildStrudelBeatPattern(beatSlots);
  if (!patternText) {
    setPlaybackBanner('No playable notes were generated.', 'warning');
    return;
  }
  // Rest bars extend the loop rather than pausing the transport: the notes go
  // quiet, the grid keeps running, and the swap at the loop boundary still
  // lands where it should.
  const pauseBeats = getLoopPauseBeats();
  const loopText = pauseBeats
    ? `${patternText} ${Array(pauseBeats).fill('~').join(' ')}`
    : patternText;
  const measures = getMeasures(beatSlots.length + pauseBeats);
  const beatMeta = getBeatMeta(beatSlots.length);
  let pattern = soundConfig.type === 'none' ? null : api.note(loopText).slow(measures);
  // "None (rhythm only)": the backing rhythm below is the whole pattern.
  pattern = await applySelectedSound(api, pattern, sound, soundConfig);

  // Effects go on the notes only - a reverbed metronome is unusable as a
  // reference, and the drum samples already have their own room in them.
  pattern = applyAmbience(pattern);
  pattern = applySoundEnvelope(pattern, soundConfig);

  // The backing rhythm rides on the same beat grid as the notes, so stacking
  // it here keeps one pattern for the scheduler (and one loop length for the
  // in-place swap that continuous shift relies on).
  pattern = stackPatterns(api, pattern, await buildBackingChordsPattern(api, beatMeta, measures));
  pattern = stackPatterns(api, pattern, await buildRhythmPattern(api, beatMeta, measures));
  if (!pattern) {
    setPlaybackBanner('Pick a sound or a backing rhythm to hear playback.', 'warning');
    return;
  }

  // Tempo lives on the pattern: pattern.cpm(bpm/4) with the slow() factor
  // from getMeasures() - see the calibration note there. The scheduler's
  // clock cannot be changed in this Strudel build (no setcpm/setcps globals
  // or exports), so applyStrudelTempo is only a fallback for other builds.
  if (typeof pattern.cpm === 'function') {
    const cpm = getCyclesPerMinute(bpm);
    pattern = pattern.cpm(cpm);
    debugLog('Strudel tempo applied via pattern.cpm:', { cpm });
  } else if (!applyStrudelTempo(api, bpm)) {
    debugLog('No Strudel tempo API available; using the default clock.');
  }

  startOrSwapStrudelPattern(api, pattern, getStrudelLoopSignature());
  const context = getStrudelAudioContext();
  if (context && context.state !== 'running') {
    // Nothing will be heard until a gesture wakes the context back up.
    setPlaybackBanner('The browser suspended audio; tap Play again to re-enable it.', 'warning');
    return;
  }
  setPlaybackBanner(`Playing via Strudel at ${bpm} BPM (${describePlaybackVoices()}).`, 'info');
}

/** The AudioContext Strudel plays through, once it exists. */
function getStrudelAudioContext() {
  const getter = strudelApi?.getAudioContext || window.getAudioContext;
  if (typeof getter !== 'function') return null;
  try {
    return getter();
  } catch (error) {
    debugLog('No audio context available:', error);
    return null;
  }
}

/**
 * iOS suspends the audio context whenever the page goes to the background, and
 * Strudel only ever resumes it once - initAudioOnFirstClick removes its own
 * listener after the first click. Everything afterwards then drives a dead
 * context: Play does nothing, and neither does toggling Audio or changing the
 * sound. Resuming must happen synchronously inside a user gesture, so this runs
 * on pointerdown, before any await.
 */
function resumeAudioContextIfSuspended() {
  const context = getStrudelAudioContext();
  if (!context || context.state === 'running') return false;
  context.resume?.().catch((error) => debugLog('Audio context resume failed:', error));
  debugLog('Audio context was suspended; resume requested.');
  return true;
}

async function stopStrudelExercise() {
  if (!strudelInitPromise) {
    setPlaybackBanner('Strudel is idle. Click Play to start.', 'warning');
    return;
  }
  const api = await ensureStrudelReady();
  if (!api) {
    return;
  }
  api.hush();
  strudelWrapperActive = false;
  strudelPatternRef = null;
  strudelLoopSignature = null;
  setPlaybackBanner('Playback stopped.', 'info');
}

function getKeyContext(keyValue) {
  const { tonic, isMinor } = parseKeySelection(keyValue);
  const scaleType = isMinor ? 'minor' : 'major';
  const keySignature = isMinor ? `${tonic}m` : tonic;
  const vexflowKeySignature = getVexflowKeySignature(tonic, isMinor);
  let cagedKey = tonic;

  if (isMinor) {
    const minorKeyInfo = Tonal.Key.minorKey(tonic);
    if (minorKeyInfo && minorKeyInfo.relativeMajor) {
      cagedKey = minorKeyInfo.relativeMajor;
    }
  }

  return { tonic, isMinor, scaleType, keySignature, vexflowKeySignature, cagedKey };
}

function updateKeyDebug(keyValue) {
  const debugEl = document.getElementById('key-debug');
  if (!debugEl) {
    return;
  }
  const {
    tonic,
    scaleType,
    keySignature,
    vexflowKeySignature,
    cagedKey,
  } = getKeyContext(keyValue);
  const signatureLabel =
    keySignature === vexflowKeySignature
      ? keySignature
      : `${keySignature} (notation: ${vexflowKeySignature})`;
  debugEl.textContent = `Key signature: ${signatureLabel} | Scale: ${tonic} ${scaleType} | CAGED: ${cagedKey} ${scaleType}`;
}

// ─── Custom progressions ─────────────────────────────────────────────────────
// "Custom…" swaps the preset menu for a free-text field. Input is forgiving:
// any of "I-vi-ii-V", "i vi ii v", "| I | vi | ii | V |" work - and resolves to
// the same roman symbols the presets use, so nothing downstream changes.

const ROMAN_NUMERAL_TO_DEGREE = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7 };
// The canonical symbol per degree, as getChordNotesForRomanSymbol keys them.
const DEGREE_TO_ROMAN_SYMBOL = {
  1: 'I',
  2: 'ii',
  3: 'iii',
  4: 'IV',
  5: 'V',
  6: 'vi',
  7: 'viiAø',
};

function isCustomProgressionSelected() {
  return document.getElementById('progression')?.value === 'custom';
}

function updateCustomProgressionVisibility() {
  const field = document.getElementById('customProgressionField');
  if (field) {
    field.hidden = !isCustomProgressionSelected();
  }
}

/**
 * Parse free-text roman numerals into chord symbols.
 * @returns {{ chords: string[] } | { error: string }}
 */
function parseCustomProgression(text) {
  const tokens = String(text || '')
    .split(/[\s,|\-–—]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  if (!tokens.length) {
    return { error: 'Type a progression first, for example "I - vi - ii - V".' };
  }
  const chords = [];
  const unknown = [];
  tokens.forEach((token) => {
    // Tolerate decorations the generator derives itself (7, maj7, °, ø …).
    const roman = token.replace(/[^ivx]/gi, '').toLowerCase();
    const degree = ROMAN_NUMERAL_TO_DEGREE[roman];
    if (!degree) {
      unknown.push(token);
      return;
    }
    chords.push(DEGREE_TO_ROMAN_SYMBOL[degree]);
  });
  if (unknown.length) {
    return { error: `Not a roman numeral: ${unknown.join(', ')}. Use I ii iii IV V vi vii.` };
  }
  return { chords };
}

/** Chord symbols for the selected progression, or an error to show. */
function getProgressionChords() {
  const progression = document.getElementById('progression')?.value;
  if (progression === 'custom') {
    const parsed = parseCustomProgression(document.getElementById('customProgression')?.value);
    if (parsed.error) return parsed;
    return { chords: parsed.chords, custom: true };
  }
  if (!progression) {
    return { error: 'Please select a key, progression, and number of bars.' };
  }
  // Preset values are written with plain numerals ('vii'); resolve each token
  // to the same canonical symbol the custom parser produces ('viiAø'), so the
  // quality tables downstream always see the keys they know.
  return {
    chords: progression
      .replace(/\s/g, '')
      .split('-')
      .map((token) => {
        const roman = token.replace(/[^ivx]/gi, '').toLowerCase();
        return DEGREE_TO_ROMAN_SYMBOL[ROMAN_NUMERAL_TO_DEGREE[roman]] || token;
      }),
  };
}

function updateBarsForProgression(progressionValue) {
  const barsInput = document.getElementById('bars');
  if (!barsInput) {
    return;
  }
  if (progressionValue === 'custom') {
    // One bar per chord typed; nothing to set until something parses.
    const parsed = parseCustomProgression(document.getElementById('customProgression')?.value);
    if (parsed.chords?.length) {
      barsInput.value = parsed.chords.length;
    }
    return;
  }
  let defaultBars = 4;
  switch (progressionValue) {
    case 'ii-V-I':
      defaultBars = 3;
      break;
    case 'I-vi-ii-V':
    case 'I-vi-IV-V':
    case 'I-IV-vi-V':
      defaultBars = 4;
      break;
    case 'I-I-I-I-IV-IV-I-I-V-IV-I-V':
      defaultBars = 12;
      break;
    default:
      defaultBars = progressionValue.split('-').length;
      break;
  }
  barsInput.value = defaultBars;
}

function updateSongDetails(song) {
  const keyDisplay = document.getElementById('songKeyDisplay');
  const tempoDisplay = document.getElementById('songTempoDisplay');
  if (keyDisplay) {
    keyDisplay.textContent = song ? `${song.key} ${song.scaleType}` : '';
  }
  if (tempoDisplay) {
    tempoDisplay.value = song ? `${song.tempoBpm}` : '';
  }
}

function applySongDefaults(song) {
  if (!song) {
    return;
  }
  const keySelect = document.getElementById('key');
  const scaleSelect = document.getElementById('scaleType');
  const tempoInput = document.getElementById('tempoBpm');
  const songTempoInput = document.getElementById('songTempoDisplay');
  if (keySelect) {
    keySelect.value = song.key;
  }
  if (scaleSelect) {
    scaleSelect.value = song.scaleType;
  }
  if (tempoInput) {
    tempoInput.value = song.tempoBpm;
  }
  if (songTempoInput) {
    songTempoInput.value = song.tempoBpm;
  }
  updateSongDetails(song);
  updateKeyDebug(getSelectedKeyValue());
}

function setExerciseMode(mode) {
  exerciseModeState.mode = mode;
  const randomPanel = document.getElementById('random-exercise-panel');
  const songPanel = document.getElementById('song-exercise-panel');
  const randomButton = document.getElementById('modeRandom');
  const songButton = document.getElementById('modeSong');
  const isSongMode = mode === EXERCISE_MODES.SONG;

  if (randomPanel) {
    randomPanel.classList.toggle('is-active', !isSongMode);
  }
  if (songPanel) {
    songPanel.classList.toggle('is-active', isSongMode);
  }
  if (randomButton) {
    randomButton.classList.toggle('is-active', !isSongMode);
    randomButton.setAttribute('aria-pressed', (!isSongMode).toString());
  }
  if (songButton) {
    songButton.classList.toggle('is-active', isSongMode);
    songButton.setAttribute('aria-pressed', isSongMode.toString());
  }

  if (isSongMode) {
    applySongDefaults(getSelectedSong());
  }
  // Songs are written 4/4 charts; the meter control only drives random mode.
  const timeSignatureSelect = document.getElementById('timeSignature');
  if (timeSignatureSelect) {
    timeSignatureSelect.disabled = isSongMode;
    timeSignatureSelect.title = isSongMode
      ? 'Songs are played as written, in 4/4.'
      : 'Beats per bar: 4/4, 3/4 waltz or 2/4';
  }
  updateNotesPerBarOptions();
  updateExportTitle();
}

// The shape-walking shift options read differently per instrument: the same
// machinery moves along the neck on guitar and between registers on piano.
const CONTINUOUS_SHIFT_SHAPE_LABELS = {
  guitar: {
    'shape-up': 'Adjacent shape (up the neck)',
    'shape-down': 'Adjacent shape (down the neck)',
  },
  piano: {
    'shape-up': 'Adjacent register (higher)',
    'shape-down': 'Adjacent register (lower)',
  },
};

const INSTRUMENT_DEFAULT_SOUNDS = {
  guitar: 'gm_electric_guitar_jazz',
  piano: 'gm_acoustic_grand_piano',
};

// Where each hand's practice register lands when the hand is picked; the
// register list stays free to change afterwards.
const PIANO_HAND_DEFAULT_RANGE = {
  left: 'C2-C4',
  right: 'C4-C6',
};

/**
 * The register select must always show a real register. Every reader of it
 * falls back to C3–C5 on garbage (playback keeps working), so a stale or
 * invalid stored value would otherwise sit as a silently-blank select;
 * snap the control to the same fallback the readers use instead.
 */
function normalizePianoRangeSelection() {
  const select = document.getElementById('pianoRange');
  if (select && select.selectedIndex === -1) {
    select.value = 'C3-C5';
  }
}

/** Swap the melody sound only when the current pick belongs to the other
 * instrument's optgroup; ungrouped picks ("None") are left alone. */
function updateInstrumentSoundSelection(instrument) {
  const select = document.getElementById('strudelSound');
  const group = select?.selectedOptions?.[0]
    ?.closest('optgroup')
    ?.label?.toLowerCase();
  if (!select || !group || group === instrument) return;
  const fallback = INSTRUMENT_DEFAULT_SOUNDS[instrument];
  if (fallback) select.value = fallback;
}

/** Apply the instrument to the form and chrome. Does not touch the rendered
 * exercise - restores regenerate right after, and the toggle buttons go
 * through switchInstrument() for that. */
function setInstrument(instrument, { skipSave = false } = {}) {
  const target = instrument === 'piano' ? 'piano' : 'guitar';
  const input = document.getElementById('instrument');
  if (input) input.value = target;
  normalizePianoRangeSelection();
  const isPiano = target === 'piano';
  // One header button showing the current instrument; clicking flips it.
  const toggleButton = document.getElementById('instrumentToggle');
  if (toggleButton) {
    toggleButton.textContent = isPiano ? 'Piano' : 'Guitar';
    // toggleButton.textContent = isPiano ? '🎹 Piano' : '🎸 Guitar';
    toggleButton.title = isPiano ? 'Switch to guitar' : 'Switch to piano';
    toggleButton.setAttribute(
      'aria-label',
      isPiano
        ? 'Instrument: piano. Switch to guitar.'
        : 'Instrument: guitar. Switch to piano.'
    );
  }
  document.body.classList.toggle('instrument-piano', isPiano);
  const shiftSelect = document.getElementById('continuousShift');
  if (shiftSelect) {
    const labels = CONTINUOUS_SHIFT_SHAPE_LABELS[target];
    [...shiftSelect.options].forEach((option) => {
      if (labels[option.value]) option.textContent = labels[option.value];
    });
  }
  updateInstrumentSoundSelection(target);
  updateStayInPositionAvailability();
  updateExportTitle();
  if (!skipSave) saveUserDefaults();
}

/** The toggle buttons: land the instrument, then re-roll or clear the sheet. */
async function switchInstrument(instrument) {
  if (getActiveInstrument() === instrument) return;
  if (playbackState.isPlaying || playbackState.isPaused) {
    await stopPlayback();
  }
  setInstrument(instrument);
  // The register (or shape) changes the pitch pool, so the notes must be
  // re-rolled - re-skinning the old ones could show pitches the new
  // instrument's constraint would never generate.
  const hasExercise = Boolean(lastExerciseState?.measureData?.length);
  const shapeValue = document.getElementById(getInstrumentView().shapeControlId)?.value;
  if (hasExercise && shapeValue) {
    regenerateExercise();
    return;
  }
  // Nothing to re-roll (or no shape picked yet): clear the other instrument's
  // leftovers so a guitar diagram never sits next to piano settings.
  ['fretboard-container', 'fretboard-labels', 'notation', 'arpeggio-diagrams'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  currentScaleLabel = '';
  lastExerciseState = null;
  updatePlaybackStateFromExercise(null);
}

function updateExportTitle() {
  const titleEl = document.getElementById('export-title');
  if (!titleEl) {
    return;
  }
  const isPiano = getActiveInstrument() === 'piano';
  let shapeCaption;
  if (isPiano) {
    const rangeValue = document.getElementById('pianoRange')?.value;
    const handTag = getSelectedPianoHand() === 'left' ? 'LH' : 'RH';
    shapeCaption = `Piano: ${handTag} ${window.pianoKeyboard.parsePianoRange(rangeValue).label}`;
  } else {
    const shapeSelect = document.getElementById('shape');
    const shapeLabel =
      shapeSelect?.selectedOptions?.[0]?.textContent || shapeSelect?.value || '';
    shapeCaption = `Shape: ${shapeLabel}`;
  }
  const mode = getSelectedExerciseMode();
  if (mode === EXERCISE_MODES.SONG) {
    const song = getSelectedSong();
    if (song) {
      const songKeyLabel = `${song.key} ${song.scaleType}`;
      titleEl.textContent = `Song: ${song.title} | Key: ${songKeyLabel} | ${shapeCaption}`;
    } else {
      titleEl.textContent = `Song exercise | ${shapeCaption}`;
    }
    return;
  }
  const key = getSelectedKeyValue();
  const progressionSelect = document.getElementById('progression');
  const parsed = isCustomProgressionSelected() ? getProgressionChords() : null;
  const progressionLabel = parsed
    ? parsed.chords?.join(' - ') || 'custom'
    : progressionSelect?.selectedOptions?.[0]?.textContent ||
      progressionSelect?.value ||
      '';
  const beatsPerBar = getBeatsPerBar();
  const meterCaption = beatsPerBar !== 4 ? ` | ${beatsPerBar}/4` : '';
  titleEl.textContent = `Key: ${key} | Progression: ${progressionLabel} | ${shapeCaption}${meterCaption}`;
}
// Define the tuning
const tuning = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

// Guitar pitch range - computed lazily to ensure Tonal is loaded
// E2 = MIDI 40, E4 + 16 semitones = G#5 = MIDI 80 (16 frets displayed on fretboard)
let minPitch = null;
let maxPitch = null;

function getGuitarPitchRange() {
  if (minPitch === null || maxPitch === null) {
    minPitch = Tonal.Note.midi(tuning[0]); // E2 = 40
    // Max pitch is 16 frets above the highest open string (E4)
    // This ensures notes stay within the displayed fretboard (16 frets)
    maxPitch = Tonal.Note.midi(tuning[tuning.length - 1]) + 16; // G#5 = 80
    debugLog('Guitar pitch range initialized:', { minPitch, maxPitch, maxNote: 'G#5 (fret 16 on high E)' });
  }
  return { minPitch, maxPitch };
}

/**
 * Convert fret positions from a CAGED shape to actual note names.
 * @param {Array<Array<number>>} scaleFrets - Array of fret arrays for each string (low E to high E order in shape)
 * @param {string[]} tuningNotes - Array of open string notes ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']
 * @returns {string[]} - Array of note names (e.g., ['E2', 'F2', 'G2', ...])
 */
function fretPositionsToNotes(scaleFrets, tuningNotes) {
  const notes = [];
  
  // scaleFrets is ordered from low E (string 6) to high E (string 1)
  // tuningNotes is ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] which is also low to high
  for (let stringIndex = 0; stringIndex < scaleFrets.length; stringIndex++) {
    const openStringNote = tuningNotes[stringIndex];
    const openStringMidi = Tonal.Note.midi(openStringNote);
    const fretsOnString = scaleFrets[stringIndex];
    
    for (const fret of fretsOnString) {
      if (typeof fret === 'number' && fret >= 0) {
        const midi = openStringMidi + fret;
        const noteName = Tonal.Note.fromMidi(midi);
        notes.push(noteName);
      }
    }
  }
  
  // Remove duplicates and sort by pitch
  const uniqueNotes = [...new Set(notes)];
  return uniqueNotes.sort((a, b) => Tonal.Note.midi(a) - Tonal.Note.midi(b));
}

// Convert a note like "C#4" to VexFlow format "c#/4"
// Guitar is a transposing instrument: it sounds one octave lower than written.
// Since our app uses sounding pitch (e.g., D3 = open D string = MIDI 50),
// we must add 1 octave when converting to VexFlow for proper staff display.
// This matches standard guitar notation convention where middle C on guitar
// is written as C4 on the treble clef but sounds as C3.
function toVexFlowFormat(note) {
  const pc = Tonal.Note.pitchClass(note);
  const octave = Tonal.Note.octave(note);
  // Guitar transposes (+1 octave, sounding pitch → written pitch); piano is
  // written at sounding pitch. Reads the active instrument at render time,
  // which is safe because settings are always applied before an exercise is
  // (re)rendered - a caller that renders before applying settings would
  // mis-transpose.
  return `${pc.toLowerCase()}/${octave + getInstrumentView().vexflowOctaveShift}`;
}

/** Piano low registers read better in bass clef; guitar is always treble. */
function getNotationClef() {
  if (getActiveInstrument() !== 'piano') return 'treble';
  const range = window.pianoKeyboard.parsePianoRange(
    document.getElementById('pianoRange')?.value
  );
  return (range.minMidi + range.maxMidi) / 2 < 60 ? 'bass' : 'treble';
}
// Note: This file depends on noteFlow.js for pure note flow functions.
// Ensure noteFlow.js is loaded before this file in index.html.

// Function to render the scale diagram
// Example usage:
// const initialKey = 'C';
// const initialScaleType = 'major';
// const initialShape = 'C';
// renderScaleDiagram(initialKey, initialScaleType, initialShape);
function computeDotClasses(fretboardInstance, boxPositionsKey) {
  // Apply the dot-in-box and dot-out-of-scale classes directly to the dots in fretboardInstance
  fretboardInstance.dots.forEach((dot) => {
    const key = `${dot.string}-${dot.fret}`;
    // console.log('Dot:', dot); // Log the entire dot object
    // console.log('Key:', key, 'In Box:', boxPositionsKey[key]); // Log the key and inBox status

    // Query the DOM element using the class names for string and fret
    const dotElement = document.querySelector(
      `.dot.dot-string-${dot.string}.dot-fret-${dot.fret}`
    );

    if (!dotElement) {
      console.error('dotElement is undefined for dot:', dot); // Log an error if dotElement is undefined
      return; // Skip further processing for this dot
    }

    if (boxPositionsKey[key]) {
      dot.inBox = true;
      dotElement.classList.add('dot-in-box'); // Add 'dot-in-box' class
    } else {
      dot.inBox = false;
      dotElement.classList.add('dot-out-of-scale'); // Add 'dot-out-of-scale' class
    }
  });
}

function renderScaleDiagram(cagedShape) {
  const scaleDiagram = document.getElementById('fretboard-container');
  scaleDiagram.innerHTML = ''; // Clear previous content

  // Width only: the SVG carries a viewBox, so its height follows the width on
  // its own. Pinning the container to 200px left a growing band of dead space
  // under the diagram as the viewport narrowed (112px on a phone).
  scaleDiagram.style.width = '100%';
  scaleDiagram.style.maxWidth = '900px';
  scaleDiagram.style.margin = '0 auto';
  // console.log('Width before rendering fretboard:', scaleDiagram.style.width);

  // Create the Fretboard instance
  const fretboardInstance = new fretboard.Fretboard({
    el: scaleDiagram,
    height: 200,
    stringsWidth: 1.5,
    dotSize: 25,
    fretCount: 16,
    fretsWidth: 1.2,
    font: 'Futura',
    tuning: tuning,
    showFretNumbers: true,
    highlightFill: 'rgba(100, 160, 255, 0.15)',
    highlightStroke: '#aaaaaa',
    highlightBlendMode: 'normal',
  });

  // console.log('fretboardInstance:', fretboardInstance);

  // Build positions from your cagedShape data
  let positions = [];
  for (
    let stringIndex = 0;
    stringIndex < cagedShape.scale_frets.length;
    stringIndex++
  ) {
    const stringNumber = 6 - stringIndex; // Strings numbered from 6 (low E) to 1 (high E)
    const fretsOnString = cagedShape.scale_frets[stringIndex];
    for (let fret of fretsOnString) {
      if (typeof fret === 'number' && fret >= 0) {
        positions.push({
          string: stringNumber,
          fret: fret,
          inBox: true, // Custom property to indicate this note is in the box
        });
      }
    }
  }

  // Render the scale over the fretboard
  fretboardInstance.renderScale({
    type: cagedShape.scaleType,
    root: cagedShape.key,
  });

  // console.log('Width after rendering fretboard:', scaleDiagram.style.width);

  // Build a key map of positions in the box
  let boxPositionsKey = {};
  positions.forEach((pos) => {
    boxPositionsKey[`${pos.string}-${pos.fret}`] = true;
  });

  // Mark dots that are in the box
  fretboardInstance.dots.forEach((dot) => {
    const key = `${dot.string}-${dot.fret}`;
    dot.inBox = !!boxPositionsKey[key]; // Assign inBox property
    // console.log('Dot:', dot, 'Key:', key, 'In Box:', dot.inBox);
  });

  // Compute and assign dot-in-box / dot-out-of-scale classes
  computeDotClasses(fretboardInstance, boxPositionsKey);

  // Calculate start and end frets for highlighting
  const fretsInBox = positions.map((pos) => pos.fret);
  const startFret = Math.min(...fretsInBox);
  const endFret = Math.max(...fretsInBox);

  // console.log('Frets in Box:', fretsInBox);
  // console.log('Start Fret:', startFret);
  // console.log('End Fret:', endFret);

  // Highlight the area for the box
  fretboardInstance.highlightAreas([
    { string: 1, fret: startFret },
    { string: 6, fret: endFret },
  ]);

  // Style the dots
  // Style the dots via the library API (sets text/fontSize)
  fretboardInstance.style({
    text: (position) => position.note,
    fontSize: 17,
  });

  // Apply scale-degree coloring (fills + rings) to all dots
  applyScaleDegreeColoring(scaleDiagram);

  // Kept for the next-loop preview: [string - 1][fret] → { x: %, y: px }, the
  // only way to place a marker where this diagram has no dot.
  currentFretboardPositions = fretboardInstance.positions;
  currentScaleLabel = `${cagedShape.key} ${cagedShape.scaleType}`;
  currentChordLabel = null;
  currentNextLabel = null;
  renderFretboardBoxLabel(null, null);
}

// ─── Scale / chord label under the box ───────────────────────────────────────
// Centred under the highlighted part of the neck, so it reads as a caption for
// the box rather than for the whole fretboard. The scale comes from the
// rendered CAGED shape and the chord follows the playback highlight.

let currentFretboardPositions = null;
let currentScaleLabel = '';
let currentChordLabel = null;
let currentNextLabel = null;

/** Centre of the highlighted box, in px from the fretboard's left edge. */
function getBoxCenterOffset() {
  const container = document.getElementById('fretboard-container');
  const area = container?.querySelector('.highlight-areas rect.area');
  if (!container || !area) return null;
  const containerRect = container.getBoundingClientRect();
  const areaRect = area.getBoundingClientRect();
  if (!containerRect.width || !areaRect.width) return null;
  return areaRect.left - containerRect.left + areaRect.width / 2;
}

/** Centre of an arbitrary shape's box, from the rendered fret geometry. */
function getBoxCenterOffsetForShape(cagedShape) {
  const container = document.getElementById('fretboard-container');
  const frets = (cagedShape?.scale_frets || [])
    .flat()
    .filter((fret) => typeof fret === 'number' && fret >= 0);
  const row = currentFretboardPositions?.[0];
  if (!container || !frets.length || !row) return null;
  const low = row[Math.min(...frets)];
  const high = row[Math.max(...frets)];
  const width = container.getBoundingClientRect().width;
  if (!low || !high || !width) return null;
  return (((low.x + high.x) / 2) * width) / 100;
}

/**
 * The second caption row is reserved for as long as a shift is pending, not
 * just for the beats the incoming-box caption is visible, so the notation
 * below never jumps mid-loop.
 */
function updateLabelRowHeight() {
  document
    .getElementById('fretboard-labels')
    ?.classList.toggle('has-next-row', Boolean(nextExercisePreview));
}

function buildBoxLabel(className, scaleText, chordText, scaleTag = 'scale') {
  const label = document.createElement('div');
  label.className = `fretboard-box-label ${className}`.trim();
  const addPart = (tag, text, valueClass) => {
    const part = document.createElement('span');
    part.className = 'fretboard-box-label__part';
    if (tag) {
      const tagEl = document.createElement('span');
      tagEl.className = 'fretboard-box-label__tag';
      tagEl.textContent = tag;
      part.append(tagEl);
    }
    const value = document.createElement('span');
    value.className = valueClass;
    value.textContent = text;
    part.append(value);
    label.append(part);
  };
  addPart(scaleTag, scaleText, 'fretboard-box-label__scale');
  if (chordText) {
    addPart('chord', chordText, 'fretboard-box-label__chord');
  }
  return label;
}

function placeBoxLabel(label, center) {
  // No box drawn (or the fretboard is not laid out yet): centre on the neck.
  label.style.left = center === null ? '50%' : `${center}px`;
}

/**
 * Caption under the box: the scale being played plus the chord of the moment.
 * `next` (the precomputed next loop) adds a second, muted caption under the
 * box its preview notes are showing up in.
 */
function renderFretboardBoxLabel(chordName = null, next = null) {
  const host = document.getElementById('fretboard-labels');
  if (!host) return;
  const nextLabelText = next?.scaleLabel || null;
  if (chordName === currentChordLabel && nextLabelText === currentNextLabel && host.children.length) {
    return;
  }
  currentChordLabel = chordName;
  currentNextLabel = nextLabelText;
  updateLabelRowHeight();
  host.innerHTML = '';
  if (!currentScaleLabel) return;

  const label = buildBoxLabel('', currentScaleLabel, chordName);
  host.append(label);
  placeBoxLabel(label, getBoxCenterOffset());

  if (nextLabelText) {
    const nextLabel = buildBoxLabel(
      'fretboard-box-label--next',
      `${nextLabelText} →`,
      null,
      'next'
    );
    host.append(nextLabel);
    placeBoxLabel(nextLabel, getBoxCenterOffsetForShape(next.cagedShape));
  }
}

/** Re-place the labels after a resize; the fretboard positions dots in %. */
function repositionFretboardBoxLabel() {
  const host = document.getElementById('fretboard-labels');
  if (!host) return;
  const [label, nextLabel] = host.children;
  if (label) placeBoxLabel(label, getBoxCenterOffset());
  if (nextLabel) placeBoxLabel(nextLabel, getBoxCenterOffsetForShape(nextExercisePreview?.cagedShape));
}

function getArpeggioDiagramContainer() {
  return document.getElementById('arpeggio-diagrams');
}

// ─── Piano keyboard rendering ────────────────────────────────────────────────
// Piano twins of renderScaleDiagram / renderArpeggioDiagrams. The keyboard is
// drawn by pianoKeyboard.js; the theory (which keys, what label, what color
// class) is decided here, mirroring how fretboard.js draws and flow.js colors.

/** Scale markers for a register: one per in-scale key, spelled from the scale
 * (so Db stays Db), classed by 1-based scale degree for CSS coloring. */
function buildPianoScaleMarkers(shapeContext) {
  const scaleData = Tonal.Scale.get(`${shapeContext.key} ${shapeContext.scaleType}`);
  const chromaToDegree = new Map();
  const chromaToName = new Map();
  (scaleData.notes || []).forEach((note, index) => {
    const chroma = Tonal.Note.chroma(note);
    chromaToDegree.set(chroma, index + 1);
    chromaToName.set(chroma, note);
  });
  const markers = [];
  for (let midi = shapeContext.minMidi; midi <= shapeContext.maxMidi; midi += 1) {
    const degree = chromaToDegree.get(midi % 12);
    if (!degree) continue;
    markers.push({
      midi,
      label: chromaToName.get(midi % 12),
      className: `piano-degree-${degree}`,
    });
  }
  return markers;
}

function renderPianoScaleDiagram(shapeContext) {
  const container = document.getElementById('fretboard-container');
  if (!container) return;
  container.style.width = '100%';
  container.style.maxWidth = '900px';
  container.style.margin = '0 auto';
  window.pianoKeyboard.render(container, {
    minMidi: shapeContext.minMidi,
    maxMidi: shapeContext.maxMidi,
    markers: buildPianoScaleMarkers(shapeContext),
  });
  applyPianoScaleDegreeColoring(container);
  // No fret geometry on a keyboard: the caption falls back to centring itself.
  currentFretboardPositions = null;
  currentScaleLabel = `${shapeContext.key} ${shapeContext.scaleType} · ${shapeContext.shape}`;
  currentChordLabel = null;
  currentNextLabel = null;
  // Empty the host so the unchanged-label guard cannot keep a stale caption
  // (e.g. the guitar one) after an instrument or register switch.
  const labelHost = document.getElementById('fretboard-labels');
  if (labelHost) labelHost.innerHTML = '';
  renderFretboardBoxLabel(null, null);
}

/** Per-chord mini keyboards: one octave, chord tones by chroma with R/3/5/7
 * tags. Emits the same wrapper markup as the guitar chord boxes, so playback
 * highlighting and the existing CSS work unchanged. */
function renderPianoChordDiagrams(measureData, shapeContext) {
  const container = getArpeggioDiagramContainer();
  if (!container) {
    return;
  }
  container.innerHTML = '';
  if (!measureData?.length || !window.pianoKeyboard) {
    return;
  }

  const seenChords = new Set();
  measureData.forEach((measure) => {
    if (seenChords.has(measure.chordName)) {
      return;
    }
    seenChords.add(measure.chordName);
    const chordData = Tonal.Chord.get(`${measure.rootNote}${measure.quality}`);
    if (!chordData?.notes?.length || !chordData.intervals) {
      return;
    }

    const diagram = document.createElement('div');
    diagram.className = 'arpeggio-diagram arpeggio-diagram--piano';
    diagram.dataset.chord = measure.chordName;
    const label = document.createElement('div');
    label.className = 'arpeggio-diagram__label';
    label.textContent = measure.chordName;
    const box = document.createElement('div');
    box.className = 'arpeggio-diagram__box';
    diagram.appendChild(label);
    diagram.appendChild(box);
    container.appendChild(diagram);

    const markers = chordData.notes.map((note, i) => {
      const intervalNum = parseInt(chordData.intervals[i], 10);
      return {
        midi: 60 + Tonal.Note.chroma(note),
        label: intervalNum === 1 ? 'R' : String(intervalNum),
        className: intervalNum === 1 ? 'piano-chord-root' : 'piano-chord-tone',
      };
    });
    window.pianoKeyboard.render(box, {
      minMidi: 60,
      maxMidi: 71, // C..B - one octave, chroma only
      markers,
      showOctaveLabels: false,
    });
  });

  // Reveal the "View all scale arpeggios" button (it lives in the card footer)
  const scaleDegreeButton = document.getElementById('scaleDegreeModalBtn');
  if (scaleDegreeButton) scaleDegreeButton.style.display = '';
}

// ─── Scale-degree modal ───────────────────────────────────────────────────────

const SCALE_DEGREE_INFO = [
  { degree: 1, label: 'Root'  },
  { degree: 2, label: '2nd'   },
  { degree: 3, label: '3rd'   },
  { degree: 4, label: '4th'   },
  { degree: 5, label: '5th'   },
  { degree: 6, label: '6th'   },
  { degree: 7, label: '7th'   },
];

// Chord qualities for each scale degree (major and minor)
const SCALE_DEGREE_QUALITIES_MAJOR = ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'];
const SCALE_DEGREE_QUALITIES_MINOR = ['m7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7', '7'];

/** Dot ring radius scaled to the smaller dotSize used in modal rows. */
const SDM_DOT_SIZE = 20;
const SDM_DOT_RING_RADIUS = SDM_DOT_SIZE * 0.5 + 1.5;

function addSmallRingToDot(dotEl, dotCircle) {
  const ring = document.createElementNS(FRETBOARD_SVG_NS, 'circle');
  ring.setAttribute('cx', dotCircle.getAttribute('cx'));
  ring.setAttribute('cy', dotCircle.getAttribute('cy'));
  ring.setAttribute('r', SDM_DOT_RING_RADIUS);
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', '#000000');
  ring.setAttribute('stroke-width', '2');
  ring.setAttribute('class', 'dot-ring');
  dotEl.insertBefore(ring, dotEl.querySelector('.dot-text'));
}

function openScaleDegreeModal() {
  if (!lastExerciseState) return;
  const { cagedShape } = lastExerciseState;

  const modal = document.getElementById('scaleDegreeModal');
  const body  = document.getElementById('scaleDegreeModalBody');
  const titleEl = document.getElementById('scaleDegreeModalTitle');
  if (!modal || !body) return;

  // Use cagedShape.shape (e.g. "G Shape") directly - no extra "shape" suffix
  titleEl.textContent = `Scale Arpeggios: ${cagedShape.key} ${cagedShape.scaleType} (${cagedShape.shape || ''})`.replace(/\s*\(\s*\)\s*$/, '');
  body.innerHTML = '';

  if (cagedShape.instrument === 'piano') {
    renderPianoScaleDegreeRows(body, cagedShape);
    modal.showModal();
    return;
  }

  // Build a lookup of which fret positions are inside the CAGED box
  const boxPositionsKey = {};
  for (let si = 0; si < cagedShape.scale_frets.length; si++) {
    const stringNumber = 6 - si; // Fretboard.js: string 6 = low E
    for (const fret of cagedShape.scale_frets[si]) {
      if (typeof fret === 'number' && fret >= 0) {
        boxPositionsKey[`${stringNumber}-${fret}`] = true;
      }
    }
  }

  const allBoxFrets = Object.keys(boxPositionsKey).map((k) =>
    parseInt(k.split('-')[1], 10)
  );
  const startFret = Math.min(...allBoxFrets);
  const endFret   = Math.max(...allBoxFrets);

  // Scale notes for this key/scale type (e.g. ['Bb','C','D','Eb','F','G','A'])
  const scaleData  = Tonal.Scale.get(`${cagedShape.key} ${cagedShape.scaleType}`);
  const scaleNotes = scaleData.notes;
  const qualities  = cagedShape.scaleType === 'minor'
    ? SCALE_DEGREE_QUALITIES_MINOR
    : SCALE_DEGREE_QUALITIES_MAJOR;

  SCALE_DEGREE_INFO.forEach(({ degree, label }) => {
    if (degree > scaleNotes.length) return;

    const degreeNote = scaleNotes[degree - 1];
    const quality    = qualities[degree - 1];

    // Build chroma → interval number map for this degree's full arpeggio
    // (mirrors updateFretboardForChord logic)
    const chordData = Tonal.Chord.get(`${degreeNote}${quality}`);
    const chromaToIntervalNum = {};
    if (chordData && chordData.notes && chordData.intervals) {
      chordData.notes.forEach((note, i) => {
        const num = parseInt(chordData.intervals[i], 10);
        chromaToIntervalNum[Tonal.Note.chroma(note)] = num;
      });
    }

    // Row wrapper
    const row = document.createElement('div');
    row.className = 'sdm-row';

    const labelEl = document.createElement('div');
    labelEl.className = 'sdm-label';
    labelEl.innerHTML = `${label}<span class="sdm-label__degree">${degreeNote}${quality}</span>`;

    const fbContainer = document.createElement('div');
    fbContainer.className = 'sdm-fretboard';

    row.appendChild(labelEl);
    row.appendChild(fbContainer);
    body.appendChild(row);

    // Render a Fretboard instance into this row
    const fb = new fretboard.Fretboard({
      el: fbContainer,
      height: 120,
      stringsWidth: 1.5,
      dotSize: SDM_DOT_SIZE,
      fretCount: 16,
      fretsWidth: 1.2,
      font: 'Futura',
      tuning: tuning,
      showFretNumbers: degree === 1,
      highlightFill: 'rgba(100, 160, 255, 0.15)',
      highlightStroke: '#aaaaaa',
      highlightBlendMode: 'normal',
    });

    fb.renderScale({ type: cagedShape.scaleType, root: cagedShape.key });

    // Highlight the CAGED box region
    fb.highlightAreas([
      { string: 1, fret: startFret },
      { string: 6, fret: endFret  },
    ]);

    // Apply text/fontSize via the library (must come before coloring)
    fb.style({ text: (p) => p.note, fontSize: 12 });

    // Color dots exactly like updateFretboardForChord:
    //   chord root → green + ring, other chord tones → blue + ring, non-chord in-box → dimmed
    fbContainer.querySelectorAll('.dot').forEach((dotEl) => {
      const data = dotEl.__data__;
      if (!data) return;
      const dotCircle = dotEl.querySelector('.dot-circle');
      if (!dotCircle) return;

      dotEl.querySelectorAll('.dot-ring').forEach((r) => r.remove());

      const posKey     = `${data.string}-${data.fret}`;
      const noteChroma = Tonal.Note.chroma(data.note);

      if (boxPositionsKey[posKey]) {
        const intervalNum = chromaToIntervalNum[noteChroma];
        if (intervalNum !== undefined) {
          // This in-box note is a chord tone
          dotEl.style.opacity = '1';
          const fill = intervalNum === 1 ? FRETBOARD_COLOR_ROOT : FRETBOARD_COLOR_INBOX;
          dotCircle.style.setProperty('fill', fill, 'important');
          if (SCALE_DEGREE_RING_DEGREES.has(intervalNum)) {
            addSmallRingToDot(dotEl, dotCircle);
          }
        } else {
          // In-box but not a chord tone of this arpeggio: dimmed
          dotEl.style.opacity = '0.18';
          dotCircle.style.removeProperty('fill');
        }
      } else {
        // Out-of-box: very faint
        dotEl.style.opacity = '0.08';
        dotCircle.style.removeProperty('fill');
      }
    });
  });

  modal.showModal();
}

/** Piano rows for the scale-degree modal: one register-wide keyboard per
 * degree, chord tones lit exactly like the guitar rows. */
function renderPianoScaleDegreeRows(body, shapeContext) {
  const scaleData = Tonal.Scale.get(`${shapeContext.key} ${shapeContext.scaleType}`);
  const scaleNotes = scaleData.notes;
  const qualities = shapeContext.scaleType === 'minor'
    ? SCALE_DEGREE_QUALITIES_MINOR
    : SCALE_DEGREE_QUALITIES_MAJOR;

  SCALE_DEGREE_INFO.forEach(({ degree, label }) => {
    if (degree > scaleNotes.length) return;

    const degreeNote = scaleNotes[degree - 1];
    const quality    = qualities[degree - 1];

    const chordData = Tonal.Chord.get(`${degreeNote}${quality}`);
    const chromaToIntervalNum = {};
    if (chordData && chordData.notes && chordData.intervals) {
      chordData.notes.forEach((note, i) => {
        chromaToIntervalNum[Tonal.Note.chroma(note)] = parseInt(chordData.intervals[i], 10);
      });
    }

    const row = document.createElement('div');
    row.className = 'sdm-row';

    const labelEl = document.createElement('div');
    labelEl.className = 'sdm-label';
    labelEl.innerHTML = `${label}<span class="sdm-label__degree">${degreeNote}${quality}</span>`;

    const kbContainer = document.createElement('div');
    kbContainer.className = 'sdm-fretboard sdm-piano';

    row.appendChild(labelEl);
    row.appendChild(kbContainer);
    body.appendChild(row);

    window.pianoKeyboard.render(kbContainer, {
      minMidi: shapeContext.minMidi,
      maxMidi: shapeContext.maxMidi,
      markers: buildPianoScaleMarkers(shapeContext),
      showOctaveLabels: degree === 1,
    });

    // Chord root → green + ring, other chord tones → blue + ring, rest dimmed
    kbContainer.querySelectorAll('.piano-marker').forEach((markerEl) => {
      const circle = markerEl.querySelector('.piano-marker-circle');
      if (!circle) return;
      const midi = parseInt(markerEl.dataset.midi, 10);
      const intervalNum = chromaToIntervalNum[((midi % 12) + 12) % 12];
      if (intervalNum !== undefined) {
        markerEl.style.opacity = '1';
        const fill = intervalNum === 1 ? FRETBOARD_COLOR_ROOT : FRETBOARD_COLOR_INBOX;
        circle.style.setProperty('fill', fill, 'important');
        if (SCALE_DEGREE_RING_DEGREES.has(intervalNum)) {
          addRingToDot(markerEl, circle, PIANO_RING_RADIUS);
        }
      } else {
        markerEl.style.opacity = '0.18';
        circle.style.removeProperty('fill');
      }
    });
  });
}


function getDiagramBasePosition(cagedShape) {
  const frets = cagedShape.scale_frets
    .flat()
    .filter((fret) => typeof fret === 'number' && fret >= 0);
  if (!frets.length) {
    return 1;
  }
  const minFret = Math.min(...frets);
  return minFret <= 1 ? 1 : minFret;
}

function getShapeFretBounds(cagedShape) {
  const frets = cagedShape.scale_frets
    .flat()
    .filter((fret) => typeof fret === 'number' && fret >= 0);
  if (!frets.length) {
    return { minFret: 1, maxFret: 1 };
  }
  return { minFret: Math.min(...frets), maxFret: Math.max(...frets) };
}

function getRelativeFret(fret, basePosition) {
  if (fret === 0) {
    return 0;
  }
  return Math.max(1, fret - basePosition + 1);
}

function getChordToneChromas(rootNote, quality) {
  const chordData = Tonal.Chord.get(`${rootNote}${quality}`);
  return new Set(chordData.notes.map((note) => Tonal.Note.chroma(note)));
}

function parseChordSymbol(chordSymbol) {
  if (!chordSymbol) {
    return null;
  }
  const match = chordSymbol.match(/^([A-G](?:b|#)?)(.*)$/);
  if (!match) {
    return null;
  }
  return { rootNote: match[1], quality: match[2] || '' };
}

function formatChordName(rootNote, quality) {
  if (!quality) {
    return rootNote;
  }
  const normalized = quality.toLowerCase();
  if (normalized === 'm7b5') {
    return `${rootNote}\u00f87`;
  }
  if (normalized === 'dim') {
    return `${rootNote}\u00b0`;
  }
  return `${rootNote}${normalized}`;
}

function formatChordSymbol(chordSymbol) {
  const parsed = parseChordSymbol(chordSymbol);
  if (!parsed) {
    return chordSymbol;
  }
  return formatChordName(parsed.rootNote, parsed.quality);
}

/** The instrument's full sounding range; the shape/register then narrows it
 * via scaleMidiSet, exactly like the CAGED box narrows the guitar's neck. */
function getInstrumentPitchRange() {
  if (getActiveInstrument() === 'piano') {
    return { minPitch: 21, maxPitch: 108 }; // A0..C8
  }
  return getGuitarPitchRange();
}

function buildChordNotesInRange(chordNoteNames) {
  const safeNotes = Array.isArray(chordNoteNames) ? chordNoteNames : [];
  const { minPitch, maxPitch } = getInstrumentPitchRange();
  const octaves = [1, 2, 3, 4, 5, 6, 7];
  const chordNotes = [];
  octaves.forEach((oct) => {
    safeNotes.forEach((note) => {
      const tonalNote = `${note}${oct}`;
      const midi = Tonal.Note.midi(tonalNote);
      if (midi >= minPitch && midi <= maxPitch) {
        chordNotes.push(tonalNote);
      }
    });
  });
  return chordNotes.sort((a, b) => Tonal.Note.freq(a) - Tonal.Note.freq(b));
}

function filterChordNotesToShape(chordNotes, scaleMidiSet) {
  const filteredNotes = chordNotes.filter((note) => {
    const noteMidi = Tonal.Note.midi(note);
    return scaleMidiSet.has(noteMidi);
  });
  if (filteredNotes.length > 0) {
    return filteredNotes;
  }
  debugLog('No chord tones found in shape range; using full chord tones.');
  return chordNotes;
}

function getVexChordRenderSettings(basePosition) {
  return {
    position: basePosition,
    positionText: 0,
  };
}

/** Piano twin of prepareExerciseContext: the register is the "shape". Returns
 * the same bundle, with a register descriptor in the cagedShape slot - no
 * scale_frets, so every guitar-only consumer that guards on them stays inert. */
function preparePianoContext(keyValue, rangeValue) {
  const keyContext = getKeyContext(keyValue);
  const range = window.pianoKeyboard.parsePianoRange(rangeValue);
  const scaleData = Tonal.Scale.get(`${keyContext.tonic} ${keyContext.scaleType}`);
  const scalePitchClasses = scaleData.notes || [];
  const scaleChromaSet = new Set(
    scalePitchClasses.map((note) => Tonal.Note.chroma(note))
  );
  const scaleMidiSet = new Set();
  for (let midi = range.minMidi; midi <= range.maxMidi; midi += 1) {
    if (scaleChromaSet.has(midi % 12)) {
      scaleMidiSet.add(midi);
    }
  }
  return {
    keyContext,
    cagedShape: {
      instrument: 'piano',
      key: keyContext.tonic,
      scaleType: keyContext.scaleType,
      shape: range.label,
      minMidi: range.minMidi,
      maxMidi: range.maxMidi,
    },
    scalePitchClasses,
    scaleChromaSet,
    scaleMidiSet,
  };
}

function prepareExerciseContext(keyValue, shape) {
  if (getActiveInstrument() === 'piano') {
    return preparePianoContext(keyValue, shape);
  }
  const keyContext = getKeyContext(keyValue);
  const cagedShape = getCAGEDShape(shape, keyContext.cagedKey);
  if (!cagedShape) {
    console.error('Could not get CAGED shape');
    return null;
  }
  if (keyContext.isMinor) {
    cagedShape.key = keyContext.tonic;
    cagedShape.scaleType = keyContext.scaleType;
  }

  const scaleNotesInShape = fretPositionsToNotes(
    cagedShape.scale_frets,
    tuning
  );
  debugLog('Scale notes in CAGED shape:', scaleNotesInShape);

  const scalePitchClasses = [
    ...new Set(scaleNotesInShape.map((note) => Tonal.Note.pitchClass(note))),
  ];
  debugLog('Scale pitch classes:', scalePitchClasses);

  const scaleChromaSet = new Set(
    scaleNotesInShape.map((note) => Tonal.Note.chroma(note))
  );
  const scaleMidiSet = new Set(
    scaleNotesInShape.map((note) => Tonal.Note.midi(note))
  );
  debugLog('Scale chromas:', [...scaleChromaSet]);

  return {
    keyContext,
    cagedShape,
    scalePitchClasses,
    scaleChromaSet,
    scaleMidiSet,
  };
}

function normalizeSongBars(progressionBars) {
  if (!Array.isArray(progressionBars)) {
    return [];
  }
  return progressionBars
    .map((bar) => (Array.isArray(bar) ? bar.filter(Boolean) : []))
    .filter((bar) => bar.length > 0);
}

function isTrueChorusLengthEnabled() {
  const checkbox = document.getElementById('trueChorusLength');
  return !!(checkbox && checkbox.checked);
}

/**
 * Beats in one written bar - the time signature's top number (the beat is
 * always a quarter note). Songs are written 4/4 charts, so song mode pins it.
 * Distinct from BEATS_PER_CYCLE, the fixed Strudel calibration unit.
 */
function getBeatsPerBar() {
  if (getSelectedExerciseMode() === EXERCISE_MODES.SONG) return 4;
  const value = parseInt(document.getElementById('timeSignature')?.value, 10);
  return Number.isFinite(value) && value >= 2 && value <= 4 ? value : 4;
}

// Split a bar's beats among its chords (bars with more chords than beats are
// truncated). The remainder lands on the earlier chords: 4/4 with three
// chords → [2, 1, 1], 3/4 with two → [2, 1].
function distributeBeatsPerBar(chordCount, beatsPerBar = 4) {
  const count = Math.max(1, Math.min(chordCount, beatsPerBar));
  const base = Math.floor(beatsPerBar / count);
  const remainder = beatsPerBar - base * count;
  return Array.from({ length: count }, (unused, index) =>
    base + (index < remainder ? 1 : 0)
  );
}

// Selected notes-per-bar option, clamped to the meter's playable range
// (beatsPerBar..2*beatsPerBar), or 'random' (rolled per bar)
function getSelectedNotesPerBar() {
  const select = document.getElementById('notesPerMeasure');
  const beatsPerBar = getBeatsPerBar();
  if (!select || !select.value) return beatsPerBar;
  if (select.value === 'random') return 'random';
  const n = parseInt(select.value, 10);
  if (!Number.isFinite(n)) return beatsPerBar;
  return Math.max(beatsPerBar, Math.min(2 * beatsPerBar, n));
}

function isMidMeasureTurnaroundEnabled() {
  return document.getElementById('turnaroundMode')?.value === 'mid';
}

function isAddRestsEnabled() {
  return !!document.getElementById('addRests')?.checked;
}

// A bar is one slot per beat; each slot holds one quarter note (1) or a
// beamed pair of eighths (2). n notes per bar → (n - beatsPerBar) slots
// become eighth pairs, placed on random beats for variety. With rests on,
// some slots become 0 (quarter rest), 'r8' (eighth rest then eighth note) or
// '8r' (eighth note then eighth rest) - see addRestsToSlots.
function buildBarSlots(notesPerBar, beatsPerBar = 4) {
  const n = Math.max(beatsPerBar, Math.min(2 * beatsPerBar, notesPerBar));
  const slots = Array(beatsPerBar).fill(1);
  const beatOrder = Array.from({ length: beatsPerBar }, (unused, index) => index);
  for (let i = beatOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [beatOrder[i], beatOrder[j]] = [beatOrder[j], beatOrder[i]];
  }
  for (let i = 0; i < n - beatsPerBar; i++) {
    slots[beatOrder[i]] = 2;
  }
  return slots;
}

/** Notes a slot contributes (a rest slot keeps its beat but drops notes). */
function slotNoteCount(slot) {
  if (slot === 'r8' || slot === '8r') return 1;
  return typeof slot === 'number' ? slot : 0;
}

function countSlotNotes(slots) {
  return (slots || []).reduce((sum, slot) => sum + slotNoteCount(slot), 0);
}

/**
 * Swap a few of a segment's slots for rests. The first beat never rests (the
 * chord change must be heard, and the chord symbol hangs on that note), so
 * one-beat segments pass through. Quarters become quarter rests; eighth pairs
 * keep one of their notes, resting the other half of the beat.
 */
function addRestsToSlots(slots) {
  const candidates = [];
  for (let index = 1; index < slots.length; index += 1) {
    candidates.push(index);
  }
  if (!candidates.length) return slots;
  const result = [...slots];
  let restCount = 0;
  if (Math.random() < (candidates.length >= 3 ? 0.75 : 0.5)) {
    restCount = 1 + (candidates.length >= 2 && Math.random() < 0.3 ? 1 : 0);
  }
  for (let n = 0; n < restCount; n += 1) {
    const pick = candidates.splice(
      Math.floor(Math.random() * candidates.length),
      1
    )[0];
    result[pick] =
      result[pick] === 2 ? (Math.random() < 0.5 ? 'r8' : '8r') : 0;
  }
  return result;
}

/**
 * The notes-per-bar list is meter-dependent: a 3/4 bar holds 3–6 notes. The
 * option values are literal note counts, so switching meters carries the
 * density over (how many beats are eighth pairs) rather than the raw count.
 */
function updateNotesPerBarOptions() {
  const select = document.getElementById('notesPerMeasure');
  if (!select) return;
  const beatsPerBar = getBeatsPerBar();
  const previous = select.value;
  const previousBeats = parseInt(select.dataset.beatsPerBar || '4', 10) || 4;
  if (beatsPerBar === previousBeats && select.selectedIndex !== -1) return;
  const pairWords = ['one', 'two', 'three', 'four'];
  select.innerHTML = '';
  for (let n = beatsPerBar; n <= 2 * beatsPerBar; n += 1) {
    const pairs = n - beatsPerBar;
    const option = document.createElement('option');
    option.value = String(n);
    option.textContent =
      pairs === 0
        ? `${n} - quarter notes`
        : pairs === beatsPerBar
          ? `${n} - eighth notes`
          : `${n} - ${pairWords[pairs - 1]} pair${pairs > 1 ? 's' : ''} of 8ths`;
    select.append(option);
  }
  const randomOption = document.createElement('option');
  randomOption.value = 'random';
  randomOption.textContent = `Random (${beatsPerBar}-${2 * beatsPerBar} per bar)`;
  select.append(randomOption);
  if (previous === 'random') {
    select.value = 'random';
  } else {
    const pairs = Math.max(0, (parseInt(previous, 10) || previousBeats) - previousBeats);
    select.value = String(beatsPerBar + Math.min(beatsPerBar, pairs));
  }
  select.dataset.beatsPerBar = String(beatsPerBar);
}

/** Snap the notes-per-bar select onto a real option after a raw restore. */
function normalizeNotesPerBarSelection() {
  const select = document.getElementById('notesPerMeasure');
  if (select && select.selectedIndex === -1) {
    select.value = String(getBeatsPerBar());
  }
}

function getChordNotesForRomanSymbol(
  chordSymbol,
  keyContext,
  scaleMidiSet,
  filterToShape = false
) {
  const chordQualitiesMajor = {
    I: { degree: 1, quality: 'maj7' },
    ii: { degree: 2, quality: 'm7' },
    iii: { degree: 3, quality: 'm7' },
    IV: { degree: 4, quality: 'maj7' },
    V: { degree: 5, quality: '7' },
    vi: { degree: 6, quality: 'm7' },
    'viiA\u00F8': { degree: 7, quality: 'm7b5' },
    'viiA\u0173': { degree: 7, quality: 'm7b5' },
  };
  const chordQualitiesMinor = {
    I: { degree: 1, quality: 'm7' },
    ii: { degree: 2, quality: 'm7b5' },
    iii: { degree: 3, quality: 'maj7' },
    IV: { degree: 4, quality: 'm7' },
    V: { degree: 5, quality: 'm7' },
    vi: { degree: 6, quality: 'maj7' },
    'viiA\u00F8': { degree: 7, quality: '7' },
    'viiA\u0173': { degree: 7, quality: '7' },
  };

  const chordInfo = (keyContext.isMinor
    ? chordQualitiesMinor
    : chordQualitiesMajor)[chordSymbol];
  if (!chordInfo) {
    return { chordNotes: [], rootNote: '', quality: '' };
  }

  const scale = Tonal.Scale.get(
    `${keyContext.tonic} ${keyContext.scaleType}`
  ).notes;
  const rootNote = scale[chordInfo.degree - 1];
  const chordData = Tonal.Chord.get(`${rootNote}${chordInfo.quality}`);

  let chordNotes = buildChordNotesInRange(chordData.notes);

  if (filterToShape) {
    chordNotes = filterChordNotesToShape(chordNotes, scaleMidiSet);
  }

  return { chordNotes, rootNote, quality: chordInfo.quality };
}

function getChordNotesForSongSymbol(
  chordSymbol,
  scaleMidiSet,
  filterToShape = false
) {
  const parsed = parseChordSymbol(chordSymbol);
  const chordData = Tonal.Chord.get(chordSymbol);
  const rootNote = chordData.tonic || parsed?.rootNote || '';
  const quality = chordData.type || parsed?.quality || '';
  const chordNotesSource =
    chordData.notes && chordData.notes.length
      ? chordData.notes
      : Tonal.Chord.get(`${rootNote}${quality}`).notes;

  let chordNotes = buildChordNotesInRange(chordNotesSource);

  if (filterToShape) {
    chordNotes = filterChordNotesToShape(chordNotes, scaleMidiSet);
  }

  return { chordNotes, rootNote, quality };
}

// Build all chord-tone positions within the current scale shape.
function buildArpeggioPositionsInShape(cagedShape, chordChromas) {
  const positions = [];
  cagedShape.scale_frets.forEach((stringFrets, stringIndex) => {
    const openStringNote = tuning[stringIndex];
    const openMidi = Tonal.Note.midi(openStringNote);
    if (!Number.isFinite(openMidi)) {
      return;
    }
    stringFrets.forEach((fret) => {
      if (typeof fret !== 'number' || fret < 0) {
        return;
      }
      const noteName = Tonal.Note.fromMidi(openMidi + fret);
      const chroma = Tonal.Note.chroma(noteName);
      if (chroma === null || !chordChromas.has(chroma)) {
        return;
      }
      positions.push({
        stringNumber: tuning.length - stringIndex,
        fret,
      });
    });
  });
  return positions;
}

function renderArpeggioDiagrams(measureData, cagedShape) {
  const container = getArpeggioDiagramContainer();
  if (!container) {
    return;
  }
  container.innerHTML = '';
  if (!measureData?.length || !cagedShape?.scale_frets?.length) {
    return;
  }
  if (typeof vexchords === 'undefined') {
    return;
  }

  const basePosition = getDiagramBasePosition(cagedShape);
  const { maxFret } = getShapeFretBounds(cagedShape);
  const numFrets = Math.max(4, maxFret - basePosition + 1);
  const seenChords = new Set();

  measureData.forEach((measure) => {
    if (seenChords.has(measure.chordName)) {
      return;
    }
    seenChords.add(measure.chordName);
    // Render every chord tone inside the selected scale shape.
    const chordChromas = getChordToneChromas(measure.rootNote, measure.quality);
    const positions = buildArpeggioPositionsInShape(cagedShape, chordChromas);
    if (!positions.length) {
      return;
    }
    const chordArray = positions.map((position) => [
      position.stringNumber,
      getRelativeFret(position.fret, basePosition),
    ]);

    const diagram = document.createElement('div');
    diagram.className = 'arpeggio-diagram';
    diagram.dataset.chord = measure.chordName;
    const label = document.createElement('div');
    label.className = 'arpeggio-diagram__label';
    label.textContent = measure.chordName;
    const box = document.createElement('div');
    box.className = 'arpeggio-diagram__box';
    diagram.appendChild(label);
    diagram.appendChild(box);
    container.appendChild(diagram);

    const renderSettings = getVexChordRenderSettings(basePosition);
    vexchords.draw(
      box,
      {
        chord: chordArray,
        ...renderSettings,
        tuning: ['E', 'A', 'D', 'G', 'B', 'E'],
      },
      {
        width: 80,
        height: 100,
        showTuning: true,
        numFrets,
        strokeWidth: 1,
        defaultColor: '#1f2937',
        bgColor: '#ffffff',
        strokeColor: 'rgba(103, 40, 185, 1)',
      }
    );
  });

  // Reveal the "View all scale arpeggios" button (it lives in the card footer)
  const scaleDegreeButton = document.getElementById('scaleDegreeModalBtn');
  if (scaleDegreeButton) scaleDegreeButton.style.display = '';
}

// Selected "start each chord on" option: null for free flow, or 1/3/5/7
function getSelectedStartDegree() {
  const select = document.getElementById('startDegree');
  if (!select || select.value === 'flow' || select.value === 'flow-different') {
    return null;
  }
  const degree = parseInt(select.value, 10);
  return Number.isFinite(degree) ? degree : null;
}

/** "Closest different tone": a chord change may not land on the note it left. */
function isDifferentToneStartEnabled() {
  return document.getElementById('startDegree')?.value === 'flow-different';
}

/**
 * Closest chord tone in the current direction, excluding the note just played.
 * Dropping the unison from the pool first keeps the usual direction and
 * turnaround logic intact. Null when the chord offers nothing else.
 */
function findDifferentStartNote(chordNotes, previousNote, isAscending) {
  const previousMidi = Tonal.Note.midi(previousNote);
  if (!Number.isFinite(previousMidi)) return null;
  const candidates = (chordNotes || []).filter(
    (note) => Tonal.Note.midi(note) !== previousMidi
  );
  if (!candidates.length) return null;
  return window.noteFlow.findClosestNoteInDirection(
    previousNote,
    candidates,
    isAscending,
    Tonal.Note.midi
  ).note;
}

// All notes in the measure's chord-note pool matching the requested chord
// degree (1 = root, 3, 5, 7), across octaves. Empty if the chord has no such
// tone (e.g. asking for the 7th of a 6 chord) or it fell outside the shape.
function getChordToneStartCandidates(measure, degree) {
  const chordData = Tonal.Chord.get(`${measure.rootNote}${measure.quality}`);
  if (!chordData || !chordData.notes || !chordData.intervals) {
    return [];
  }
  let targetChroma = null;
  chordData.notes.forEach((note, i) => {
    if (parseInt(chordData.intervals[i], 10) === degree) {
      targetChroma = Tonal.Note.chroma(note);
    }
  });
  if (targetChroma === null) {
    return [];
  }
  return measure.chordNotes.filter(
    (note) => Tonal.Note.chroma(note) === targetChroma
  );
}

/**
 * The musical half of an exercise: chords, beat slots and generated notes, with
 * no DOM rendering. Key and shape can be overridden so the next loop of a
 * continuous shift can be built ahead of time (see precomputeNextExercise);
 * everything else comes from the form. Returns { error } instead of alerting,
 * so a background build can fail quietly.
 */
function buildExerciseMeasures(options = {}) {
  const mode = options.mode || EXERCISE_MODES.RANDOM;
  const shape =
    options.shape ||
    document.getElementById(getInstrumentView().shapeControlId)?.value;
  const song = options.song || null;
  const isSongMode = mode === EXERCISE_MODES.SONG;
  let key = '';
  let chordBars = []; // one entry per rendered bar: 1+ chord symbols

  if (!shape) {
    return { error: 'Please select a chord shape.' };
  }

  if (isSongMode) {
    if (!song) {
      return { error: 'Please select a song.' };
    }
    key = options.key || (song.scaleType === 'minor' ? `${song.key}m` : song.key);
    const songBars = normalizeSongBars(song.progressionBars);
    // True chorus length: chords keep the bar they share in the chart.
    // Otherwise every chord is stretched to its own full bar.
    chordBars = isTrueChorusLengthEnabled()
      ? songBars
      : songBars.flat().map((chord) => [chord]);
  } else {
    key = options.key || getSelectedKeyValue();
    const bars = parseInt(document.getElementById('bars').value);
    const parsed = getProgressionChords();

    if (!key || !bars) {
      return { error: 'Please select a key, progression, and number of bars.' };
    }
    if (parsed.error) {
      return { error: parsed.error };
    }

    const chordsInProgression = parsed.chords;
    const totalChords = chordsInProgression.length;
    const fullCycles = Math.floor(bars / totalChords);
    const remainingBars = bars % totalChords;

    let adjustedProgression = [];
    for (let i = 0; i < fullCycles; i++) {
      adjustedProgression = adjustedProgression.concat(chordsInProgression);
    }
    if (remainingBars > 0) {
      adjustedProgression = adjustedProgression.concat(
        chordsInProgression.slice(0, remainingBars)
      );
    }
    chordBars = adjustedProgression.map((chord) => [chord]);
  }

  if (!chordBars.length) {
    return { error: 'No chords found for the selected exercise.' };
  }

  const exerciseContext = prepareExerciseContext(key, shape);
  if (!exerciseContext) {
    return { error: null }; // prepareExerciseContext already logged the reason
  }
  const { keyContext, cagedShape, scaleMidiSet } = exerciseContext;
  const chordResolver = isSongMode
    ? (chordSymbol) => getChordNotesForSongSymbol(chordSymbol, scaleMidiSet, true)
    : (chordSymbol) =>
        getChordNotesForRomanSymbol(chordSymbol, keyContext, scaleMidiSet, true);

  // Build measure data: one entry per chord. A bar is 4 beat slots (quarter
  // note or eighth pair each); chords sharing a bar (true chorus length)
  // split the bar's slots between them.
  const notesPerBarSetting = getSelectedNotesPerBar();
  const beatsPerBar = getBeatsPerBar();
  const addRests = isAddRestsEnabled();
  const measureData = [];
  chordBars.forEach((barChords, barIndex) => {
    const segmentBeats = distributeBeatsPerBar(barChords.length, beatsPerBar);
    if (barChords.length > segmentBeats.length) {
      debugLog(
        `Bar ${barIndex + 1} has ${barChords.length} chords; keeping the first ${segmentBeats.length}.`
      );
    }
    const notesPerBar =
      notesPerBarSetting === 'random'
        ? beatsPerBar + Math.floor(Math.random() * (beatsPerBar + 1))
        : notesPerBarSetting;
    const barSlots = buildBarSlots(notesPerBar, beatsPerBar);
    let slotCursor = 0;
    segmentBeats.forEach((beats, chordIdx) => {
      const chordSymbol = barChords[chordIdx];
      const sliced = barSlots.slice(slotCursor, slotCursor + beats);
      const slots = addRests ? addRestsToSlots(sliced) : sliced;
      slotCursor += beats;
      const { chordNotes, rootNote, quality } = chordResolver(chordSymbol);
      const chordName = isSongMode
        ? formatChordSymbol(chordSymbol)
        : rootNote
          ? formatChordName(rootNote, quality)
          : formatChordSymbol(chordSymbol);
      measureData.push({
        index: measureData.length,
        barIndex,
        chordSymbol,
        chordName,
        rootNote,
        quality,
        chordNotes,
        slots,
        beats,
        notesPerMeasure: countSlotNotes(slots),
        generatedNotes: null, // Will be filled in
        direction: null, // Will be filled in
      });
    });
  });

  const startDegree = getSelectedStartDegree();
  const requireDifferentStart = isDifferentToneStartEnabled();
  const midMeasureTurnaround = isMidMeasureTurnaroundEnabled();

  // Replaying a recorded exercise: the chord skeleton above is rebuilt from
  // the (restored) form values, and the stored slots + notes are dropped in
  // instead of rolling new ones. Anything that does not line up falls back to
  // a fresh generation rather than rendering a half-restored chart.
  const replayMeasures = matchReplayMeasures(options.replay, measureData);

  // Generate all measures forward from the first. Each measure starts on the
  // closest chord tone in the current direction (or on the requested chord
  // degree in chord-tone start mode); direction reverses only at the range
  // boundaries (plus mid-measure when that turnaround option is on).
  // A carry-over (continuous shift) voice-leads from the previous exercise's
  // last note instead of starting on a random one.
  let prevNote = options.carryOver?.prevNote || null;
  let prevDirection = options.carryOver?.prevDirection ?? true;
  measureData.forEach((measure, measureIdx) => {
    const replayed = replayMeasures?.[measureIdx];
    if (replayed) {
      measure.slots = [...replayed.slots];
      measure.notesPerMeasure = countSlotNotes(replayed.slots);
      measure.generatedNotes = [...replayed.notes];
      measure.direction = replayed.direction ?? true;
      prevNote = replayed.notes[replayed.notes.length - 1] || prevNote;
      prevDirection = measure.direction;
      return;
    }
    if (measure.chordNotes.length === 0) {
      console.error(`No notes for chord: ${measure.chordName}`);
      return;
    }
    let startNote = null;
    if (startDegree !== null) {
      const candidates = getChordToneStartCandidates(measure, startDegree);
      if (candidates.length) {
        startNote =
          prevNote === null
            ? candidates[Math.floor(candidates.length / 2)]
            : window.noteFlow.findClosestNote(
                prevNote,
                candidates,
                prevDirection,
                Tonal.Note.freq,
                Tonal.Note.midi
              );
      } else {
        debugLog(
          `No degree-${startDegree} tone for ${measure.chordName}; free flow for this measure.`
        );
      }
    } else if (requireDifferentStart && prevNote !== null) {
      startNote = findDifferentStartNote(measure.chordNotes, prevNote, prevDirection);
      if (startNote === null) {
        debugLog(
          `${measure.chordName} has no tone other than ${prevNote}; free flow for this measure.`
        );
      }
    }
    const result = window.noteFlow.generateMeasureNotes(
      measure.chordNotes,
      measure.notesPerMeasure || 4,
      prevNote,
      prevDirection,
      Tonal.Note.freq,
      Tonal.Note.midi,
      startNote,
      midMeasureTurnaround
    );
    measure.generatedNotes = result.notes;
    measure.direction = result.newDirection;
    prevNote = result.notes[result.notes.length - 1];
    prevDirection = result.newDirection;
    debugLog(
      `Generated measure ${measure.index + 1} (${measure.chordSymbol}):`,
      result.notes
    );
  });

  return {
    key,
    keyContext,
    cagedShape,
    measureData,
    isSongMode,
    replayApplied: Boolean(replayMeasures),
  };
}

/**
 * The accompaniment staff spec, or null when there is nothing to notate.
 * Piano mode with a backing-chords preset on gets a grand staff: the practice
 * line on one staff, the resting hand's comp written on the other - the
 * Chopin-waltz layout (melody over bass-and-chords), squared to 4/4.
 */
function getNotatedAccompaniment() {
  if (getActiveInstrument() !== 'piano') return null;
  const config = getBackingChordConfig(getSelectedBackingChords());
  if (config.type === 'off' || typeof config.hits !== 'function') return null;
  const lowMidi = getBackingChordLowMidi();
  return {
    config,
    lowMidi,
    clef: lowMidi < 60 ? 'bass' : 'treble',
    // Practicing the left hand puts the comp (the right hand) above the line.
    above: getSelectedPianoHand() === 'left',
  };
}

/** Do these notes fill exactly `beats` quarter notes? (VexFlow counts a
 * quarter note as 4096 ticks.) */
function barFits(notes, beats) {
  if (!notes?.length) return false;
  const ticks = notes.reduce((sum, note) => sum + note.getTicks().value(), 0);
  const fits = ticks === beats * 4096;
  if (!fits) {
    debugLog(`Accompaniment bar skipped: ${ticks} ticks for ${beats} beats.`);
  }
  return fits;
}

/**
 * One bar of the accompaniment staff, from the same preset the audio layer
 * plays: bass hits as single low roots, chord hits as stacks, each written to
 * last until the next hit (gaps become rests) so the bar always sums to 4.
 */
function buildAccompanimentBarNotes(VF, segments, accomp, voicingState) {
  const notes = [];
  const restKey = accomp.clef === 'bass' ? 'd/3' : 'b/4';
  const pushRest = (beats) => {
    decomposeRestBeats(beats).forEach((value) => {
      const spec = headDurationFor(value);
      if (!spec) return;
      notes.push(makeSpecNote(VF, { clef: accomp.clef, keys: [restKey], spec, rest: true }));
    });
  };
  segments.forEach((segment) => {
    const beats = segment.beats || 4;
    // Same voice-leading state the audio layer uses, threaded through the
    // whole sheet, so the written comp is the one that plays.
    const voicing = buildBackingChordVoicing(
      segment.rootNote,
      segment.quality,
      accomp.lowMidi,
      voicingState
    );
    const bassNote = buildBackingBassNote(segment.rootNote, accomp.lowMidi);
    const hits = (accomp.config.hits(beats) || [])
      .filter((hit) => hit.beat >= 0 && hit.beat < beats)
      .sort((a, b) => a.beat - b.beat);
    if (!voicing || !hits.length) {
      pushRest(beats);
      return;
    }
    let cursor = 0;
    hits.forEach((hit, idx) => {
      if (hit.beat > cursor) {
        pushRest(hit.beat - cursor);
      }
      const until = idx + 1 < hits.length ? hits[idx + 1].beat : beats;
      const duration = until - hit.beat;
      const spec = headDurationFor(duration);
      if (!spec) {
        pushRest(duration);
        cursor = until;
        return;
      }
      const keys =
        hit.bass && bassNote
          ? [toVexFlowFormat(bassNote)]
          : voicing.map(toVexFlowFormat);
      notes.push(makeSpecNote(VF, { clef: accomp.clef, keys, spec }));
      cursor = until;
    });
    if (cursor < beats) {
      pushRest(beats - cursor);
    }
  });
  return notes;
}

function generateExercise(options = {}) {
  const built = buildExerciseMeasures(options);
  if (built.error !== undefined) {
    if (built.error) {
      alert(built.error);
    }
    return;
  }
  const { keyContext, cagedShape, measureData, key } = built;
  if (options.replay && !built.replayApplied && options.warnOnReplayMismatch) {
    setPlaybackBanner(
      'The saved exercise no longer matches these settings; generated a new one.',
      'warning'
    );
  }

  // Clear previous notation
  document.getElementById('notation').innerHTML = '';
  const arpeggioDiagramContainer = getArpeggioDiagramContainer();
  if (arpeggioDiagramContainer) {
    arpeggioDiagramContainer.innerHTML = '';
  }

  // Initialize VexFlow Renderer
  const VF = Vex.Flow;
  const { Renderer, Stave, StaveNote, Voice, Formatter, Annotation, Beam } = VF;
  const div = document.getElementById('notation');
  const containerWidth = div.getBoundingClientRect().width;
  const width = Math.max(900, Math.min(1600, Math.floor(containerWidth || 1200)));
  const maxStaveWidth = width - 20;
  const maxMeasuresPerLine = 4;

  // Now build the VexFlow notes for rendering, one stave per bar
  const notationClef = getNotationClef();
  const accomp = getNotatedAccompaniment();
  const generatedNotes = measureData.flatMap((measure) => measure.generatedNotes || []);
  const barGroups = [];
  measureData.forEach((segment) => {
    if (!barGroups[segment.barIndex]) {
      barGroups[segment.barIndex] = { segments: [] };
    }
    barGroups[segment.barIndex].segments.push(segment);
  });
  const beatsPerBar = getBeatsPerBar();
  const restKey = notationClef === 'bass' ? 'd/3' : 'b/4';
  const makeRest = (duration) =>
    new StaveNote({ clef: notationClef, keys: [restKey], duration: `${duration}r` });
  // Carried across bars so the comp voice-leads through the whole chart.
  const accompVoicing = { previous: null };
  const measures = barGroups.map((bar) => {
    const notes = [];
    const segmentStarts = [];
    let barBeat = 0;
    bar.segments.forEach((segment) => {
      segmentStarts.push(notes.length);
      const generated = segment.generatedNotes || [];
      const slots = segment.slots || generated.map(() => 1);
      let noteIdx = 0;
      // Adjacent quarter rests merge into a half rest when the pair starts
      // on a strong beat (1 or 3 of a 4/4 bar); elsewhere the printed
      // convention keeps them as two quarter rests.
      let pendingRests = 0;
      let pendingStart = 0;
      const flushRests = () => {
        while (pendingRests > 0) {
          if (pendingRests >= 2 && beatsPerBar === 4 && pendingStart % 2 === 0) {
            notes.push(makeRest('h'));
            pendingRests -= 2;
            pendingStart += 2;
          } else {
            notes.push(makeRest('q'));
            pendingRests -= 1;
            pendingStart += 1;
          }
        }
      };
      const pushNote = (duration) => {
        if (noteIdx >= generated.length) return;
        notes.push(
          new StaveNote({
            clef: notationClef,
            keys: [toVexFlowFormat(generated[noteIdx])],
            duration,
          })
        );
        noteIdx += 1;
      };
      slots.forEach((slotSize) => {
        if (slotSize === 0) {
          if (pendingRests === 0) pendingStart = barBeat;
          pendingRests += 1;
          barBeat += 1;
          return;
        }
        flushRests();
        if (slotSize === 'r8') {
          notes.push(makeRest('8'));
          pushNote('8');
        } else if (slotSize === '8r') {
          pushNote('8');
          notes.push(makeRest('8'));
        } else {
          for (let k = 0; k < slotSize; k += 1) {
            pushNote(slotSize === 2 ? '8' : 'q');
          }
        }
        barBeat += 1;
      });
      flushRests();
    });
    return {
      segments: bar.segments,
      segmentStarts,
      accompNotes: accomp
        ? buildAccompanimentBarNotes(VF, bar.segments, accomp, accompVoicing)
        : null,
      notes,
    };
  });

  const measureWidths = measures.map((measure, idx) =>
    calculateMeasureWidth(
      keyContext.vexflowKeySignature,
      idx === 0,
      measure.notes.length
    )
  );
  const lineLayouts = [];
  let currentLine = { measures: [], width: 0 };

  measureWidths.forEach((measureWidth, idx) => {
    const needsWrap =
      currentLine.measures.length >= maxMeasuresPerLine ||
      (currentLine.width + measureWidth > maxStaveWidth &&
        currentLine.measures.length > 0);
    if (needsWrap) {
      lineLayouts.push(currentLine);
      currentLine = { measures: [], width: 0 };
    }
    currentLine.measures.push({ index: idx, width: measureWidth });
    currentLine.width += measureWidth;
  });
  if (currentLine.measures.length > 0) {
    lineLayouts.push(currentLine);
  }

  // Vertical budget per line: a stave is ~80px plus its chord annotations, so
  // 170 left ~70px of empty air under every line and 60 above the first.
  // A grand staff (piano accompaniment) adds a second stave 90px below.
  const accompStaveOffset = 90;
  const staveHeight = accomp ? 120 + accompStaveOffset : 120;
  const topPadding = 28;
  const bottomPadding = 16;
  const height =
    topPadding + lineLayouts.length * staveHeight + bottomPadding;

  const renderer = new Renderer(div, Renderer.Backends.SVG);
  renderer.resize(width, height);
  // resize() writes width/height inline, which beats the stylesheet: on a
  // narrow screen the SVG kept its full height and letterboxed the staves in
  // the middle of it. Let the viewBox drive the height instead.
  const notationSvg = div.querySelector('svg');
  if (notationSvg) {
    notationSvg.style.width = '100%';
    notationSvg.style.height = 'auto';
  }
  const context = renderer.getContext();
  // Pre-inject the highlight rect as first SVG child (renders behind notes)
  ensurePlaybackHighlightRect();

  // Render each measure, centered by line
  const stavePositions = [];
  lineLayouts.forEach((line, lineIndex) => {
    let xStart = Math.max(20, Math.floor((width - line.width) / 2));
    let yStart = topPadding + lineIndex * staveHeight;

    line.measures.forEach(({ index, width: staveWidth }, lineMeasureIdx) => {
      const measure = measures[index];

      if (index === 0) {
        debugLog(`First measure width for key ${key}:`, staveWidth);
      }

      // Grand staff: whichever part sits higher gets the upper stave.
      const practiceY = accomp?.above ? yStart + accompStaveOffset : yStart;
      const stave = new Stave(xStart, practiceY, staveWidth);
      if (index === 0) {
        stave
          .addClef(notationClef)
          .addKeySignature(keyContext.vexflowKeySignature)
          .addTimeSignature(`${beatsPerBar}/4`);
      }
      stave.setContext(context).draw();

      let accompStave = null;
      if (accomp) {
        const accompY = accomp.above ? yStart : yStart + accompStaveOffset;
        accompStave = new Stave(xStart, accompY, staveWidth);
        if (index === 0) {
          accompStave
            .addClef(accomp.clef)
            .addKeySignature(keyContext.vexflowKeySignature)
            .addTimeSignature(`${beatsPerBar}/4`);
        }
        accompStave.setContext(context).draw();
        if (lineMeasureIdx === 0 && VF.StaveConnector) {
          const topStave = accomp.above ? accompStave : stave;
          const bottomStave = accomp.above ? stave : accompStave;
          new VF.StaveConnector(topStave, bottomStave)
            .setType(VF.StaveConnector.type.BRACE)
            .setContext(context)
            .draw();
          new VF.StaveConnector(topStave, bottomStave)
            .setType(VF.StaveConnector.type.SINGLE_LEFT)
            .setContext(context)
            .draw();
        }
      }
      stavePositions[index] = {
        x: xStart,
        y: yStart,
        width: staveWidth,
        height: accomp ? 80 + accompStaveOffset : 80,
      };

      // One chord annotation per segment, at the segment's first note (a
      // segment's opening beat never rests, so this is always a real note)
      measure.segments.forEach((segment, segmentIdx) => {
        const chordAnnotation = new Annotation(segment.chordName)
          .setFont('Arial', 12, 'normal')
          .setVerticalJustification(Annotation.VerticalJustify.TOP)
          .setYShift(10);
        const target = measure.notes[measure.segmentStarts[segmentIdx]];
        if (target) {
          target.addModifier(chordAnnotation, 0);
        }
      });

      // Beam eighth-note pairs (grouped per beat) like a printed chart
      const beams = Beam.generateBeams(measure.notes);
      const barBeats = measure.segments.reduce(
        (sum, segment) => sum + (segment.beats || 4),
        0
      );
      const voice = new Voice({ num_beats: barBeats, beat_value: 4 }).addTickables(
        measure.notes
      );
      let accompVoice = null;
      // A voice whose notes do not add up to the bar throws on draw, which
      // would leave the reader with two empty staves. The comp is the
      // dispensable part, so a bar that does not add up is simply left blank.
      if (accompStave && barFits(measure.accompNotes, barBeats)) {
        accompVoice = new Voice({ num_beats: barBeats, beat_value: 4 }).addTickables(
          measure.accompNotes
        );
      }
      // The formatter lays notes out from the stave's note-start x, so
      // measure the clef/key/time overhead off the drawn stave rather than
      // guessing it (a wide key signature plus a dense bar used to push the
      // first bar's last note over the barline). What remains after a small
      // right padding - smaller in dense bars, which need the room - is the
      // real formatting width.
      const extraNotes = Math.max(0, measure.notes.length - barBeats);
      const modifierWidth = Math.max(
        stave.getNoteStartX() - stave.getX(),
        accompStave ? accompStave.getNoteStartX() - accompStave.getX() : 0
      );
      const endPadding = 50 - Math.min(20, extraNotes * 5);
      const availableWidth = stave.width - modifierWidth - endPadding;
      // One formatter across both staves so the hands' beats line up.
      const formatter = new Formatter().joinVoices([voice]);
      if (accompVoice) {
        formatter.joinVoices([accompVoice]);
      }
      formatter.format(
        accompVoice ? [voice, accompVoice] : [voice],
        Math.max(120, availableWidth)
      );
      voice.draw(context, stave);
      if (accompVoice) {
        accompVoice.draw(context, accompStave);
      }
      beams.forEach((beam) => beam.setContext(context).draw());

      xStart += stave.width;
    });
  });

  getInstrumentView().renderChordDiagrams(measureData, cagedShape);

  // Store for the scale-degrees modal
  lastExerciseState = { cagedShape, measureData };

  // Playback steps chord by chord: each segment carries its own beat length,
  // so bars shared by two chords switch the fretboard/diagram highlight
  // mid-bar. The notation highlight rect follows barIndex (one rect per stave).
  const measuresForPlayback = measureData.map((segment) => ({
    barIndex: segment.barIndex,
    chordName: segment.chordName,
    rootNote: segment.rootNote,
    quality: segment.quality,
    generatedNotes: segment.generatedNotes || [],
    slots: segment.slots || [],
    beats: segment.beats || (segment.slots || []).length || 4,
  }));

  // One entry per beat for audio: a quarter note is [note], eighths [n1, n2],
  // and rests hold their grid position as nulls (rendered as "~" tokens).
  const beatSlots = [];
  measureData.forEach((segment) => {
    const generated = segment.generatedNotes || [];
    const slots = segment.slots || generated.map(() => 1);
    let noteIdx = 0;
    slots.forEach((slotSize) => {
      if (slotSize === 0) {
        beatSlots.push([null]);
        return;
      }
      if (slotSize === 'r8' || slotSize === '8r') {
        const note = generated[noteIdx] ?? null;
        noteIdx += 1;
        beatSlots.push(slotSize === 'r8' ? [null, note] : [note, null]);
        return;
      }
      beatSlots.push(generated.slice(noteIdx, noteIdx + slotSize));
      noteIdx += slotSize;
    });
  });

  return {
    generatedNotes,
    measuresData: measuresForPlayback,
    stavePositions,
    beatSlots,
  };
}

// ─── Head lead sheet ─────────────────────────────────────────────────────────
// Notation for the intro chorus: the song's melody (with ties and beams) when
// it has one, chord symbols over slash notation otherwise - so the user can
// play the head along with the comped intro.

const HEAD_BEAT_TO_DURATION = [
  { beats: 4, duration: 'w', dots: 0 },
  { beats: 3, duration: 'h', dots: 1 },
  { beats: 2, duration: 'h', dots: 0 },
  { beats: 1.5, duration: 'q', dots: 1 },
  { beats: 1, duration: 'q', dots: 0 },
  { beats: 0.5, duration: '8', dots: 0 },
];

function headDurationFor(beats) {
  return HEAD_BEAT_TO_DURATION.find((entry) => Math.abs(entry.beats - beats) < 1e-6);
}

/**
 * A note (or rest) for one HEAD_BEAT_TO_DURATION spec.
 *
 * The dots have to be in the duration string - 'hd', not 'h' plus a Dot
 * modifier. VexFlow counts a note's ticks from the string alone, so a dotted
 * half built the other way is two beats short and the voice it lands in throws
 * IncompleteVoice, taking the whole sheet down with it. The modifier is still
 * what prints the dot, so both go on.
 */
function makeSpecNote(VF, { clef, keys, spec, rest = false }) {
  const staveNote = new VF.StaveNote({
    clef,
    keys,
    duration: `${spec.duration}${'d'.repeat(spec.dots)}${rest ? 'r' : ''}`,
  });
  for (let dot = 0; dot < spec.dots; dot += 1) {
    if (VF.Dot?.buildAndAttach) {
      VF.Dot.buildAndAttach([staveNote], { all: true });
    } else if (typeof staveNote.addDot === 'function') {
      staveNote.addDot(0);
    }
  }
  return staveNote;
}

function makeHeadNote(VF, note, beats) {
  const spec = headDurationFor(beats);
  if (!spec) return null;
  const clef = getNotationClef();
  return note
    ? makeSpecNote(VF, { clef, keys: [toVexFlowFormat(note)], spec })
    : makeSpecNote(VF, { clef, keys: ['b/4'], spec, rest: true });
}

// Rests avoid dotted values (a dotted rest reads worse than two plain ones)
function decomposeRestBeats(beats) {
  const parts = [];
  let remaining = beats;
  [4, 2, 1, 0.5].forEach((value) => {
    while (remaining >= value - 1e-9) {
      parts.push(value);
      remaining -= value;
    }
  });
  return parts;
}

/**
 * Build the VexFlow notes for one head bar plus the tie plan.
 * Returns { notes, ties } where ties are index pairs into `notes`, and the
 * bar's trailing tie (into the next bar) is flagged on the last note entry.
 */
function buildHeadBarNotes(VF, fragments) {
  const notes = [];
  const ties = [];
  const noteMeta = []; // { startBeat, tieToNext }
  fragments.forEach((fragment) => {
    const values = fragment.note
      ? decomposeBeatsForHead(fragment.beats)
      : decomposeRestBeats(fragment.beats);
    let startBeat = fragment.startBeat;
    values.forEach((beats, index) => {
      const staveNote = makeHeadNote(VF, fragment.note, beats);
      if (!staveNote) return;
      const noteIndex = notes.length;
      notes.push(staveNote);
      noteMeta.push({ startBeat, tieToNext: false });
      // Tie decomposed parts of one fragment together, and honor the
      // fragment's own tie flags at its edges.
      if (fragment.note) {
        if (index > 0 || fragment.tieFrom) {
          if (noteIndex > 0 || fragment.tieFrom) {
            ties.push({ from: noteIndex - 1, to: noteIndex, fromPreviousBar: noteIndex === 0 });
          }
        }
        if (index === values.length - 1 && fragment.tieTo) {
          noteMeta[noteIndex].tieToNext = true;
        }
      }
      startBeat += beats;
    });
  });
  return { notes, ties, noteMeta };
}

function decomposeBeatsForHead(beats) {
  return window.melodyParser.decomposeBeats(beats);
}

/** Chord-over-slashes bar for songs without a melody: one slash per beat. */
function buildHeadSlashBarNotes(VF) {
  const notes = [];
  for (let beat = 0; beat < BEATS_PER_CYCLE; beat += 1) {
    let staveNote;
    try {
      staveNote = new VF.StaveNote({ keys: ['b/4'], duration: 'qs' });
    } catch (error) {
      staveNote = new VF.StaveNote({ clef: getNotationClef(), keys: ['b/4'], duration: 'qr' });
    }
    notes.push(staveNote);
  }
  return { notes, ties: [], noteMeta: notes.map((unused, beat) => ({ startBeat: beat, tieToNext: false })) };
}

let headStavePositions = [];
let headVisualTimerId = null;

function ensureHeadHighlightRect() {
  const container = document.getElementById('head-notation');
  if (!container) return null;
  let rect = container.querySelector('#head-highlight');
  if (!rect) {
    const svg = container.querySelector('svg');
    if (!svg) return null;
    rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('id', 'head-highlight');
    rect.setAttribute('fill', 'rgba(255, 220, 80, 0.18)');
    rect.setAttribute('stroke', 'rgba(255, 190, 0, 0.55)');
    rect.setAttribute('stroke-width', '1.5');
    rect.setAttribute('rx', '4');
    svg.insertBefore(rect, svg.firstChild);
  }
  return rect;
}

function moveHeadHighlightToBar(index) {
  const pos = headStavePositions[index];
  const rect = ensureHeadHighlightRect();
  if (!pos || !rect) return;
  const padding = 4;
  rect.setAttribute('x', pos.x - padding);
  rect.setAttribute('y', pos.y - padding);
  rect.setAttribute('width', pos.width + padding * 2);
  rect.setAttribute('height', pos.height + padding * 2);
  rect.setAttribute('visibility', 'visible');
}

function clearHeadVisual() {
  if (headVisualTimerId !== null) {
    clearTimeout(headVisualTimerId);
    headVisualTimerId = null;
  }
  const rect = document.querySelector('#head-notation #head-highlight');
  if (rect) rect.setAttribute('visibility', 'hidden');
}

/** Step the head-sheet bar highlight through one pass of the form. */
function startHeadVisual(totalBars) {
  clearHeadVisual();
  if (!totalBars || !headStavePositions.length) return;
  const msPerBar = BEATS_PER_CYCLE * (60000 / getSelectedTempoBpm());
  let barIndex = 0;
  moveHeadHighlightToBar(0);
  let nextTime = performance.now();
  const scheduleNext = () => {
    nextTime += msPerBar;
    headVisualTimerId = setTimeout(() => {
      barIndex += 1;
      debugLog('Head highlight bar:', barIndex, 'of', totalBars);
      if (barIndex >= totalBars) {
        clearHeadVisual(); // the exercise handoff takes over from here
        return;
      }
      moveHeadHighlightToBar(barIndex);
      scheduleNext();
    }, Math.max(0, nextTime - performance.now()));
  };
  scheduleNext();
}

function renderHeadSheet(song) {
  const wrapper = document.getElementById('head-sheet');
  const container = document.getElementById('head-notation');
  if (!wrapper || !container) return;
  container.innerHTML = '';
  headStavePositions = [];
  const shouldShow =
    Boolean(song) &&
    getSelectedExerciseMode() === EXERCISE_MODES.SONG &&
    (document.getElementById('playHeadFirst')?.checked ?? false);
  wrapper.hidden = !shouldShow;
  if (!shouldShow) return;

  const chartBars = normalizeSongBars(song.progressionBars);
  if (!chartBars.length) return;

  const hasMelody = Boolean(song.melodyBars && song.melodyBars.length);
  const melodyFragmentBars = hasMelody
    ? window.melodyParser.sliceTimelineIntoBars(
        window.melodyParser.melodyToTimeline(song.melodyBars),
        chartBars.length
      )
    : null;

  const keyValue = song.scaleType === 'minor' ? `${song.key}m` : song.key;
  const keyContext = getKeyContext(keyValue);
  const VF = Vex.Flow;
  const { Renderer, Stave, Voice, Formatter, Annotation, Beam, StaveTie } = VF;

  const containerWidth = container.getBoundingClientRect().width;
  const width = Math.max(900, Math.min(1600, Math.floor(containerWidth || 1200)));
  const maxStaveWidth = width - 20;
  const maxMeasuresPerLine = 4;

  // Build every bar's notes first, so layout can size to note counts
  const bars = chartBars.map((barChords, barIndex) => {
    const built = hasMelody
      ? buildHeadBarNotes(VF, melodyFragmentBars[barIndex])
      : buildHeadSlashBarNotes(VF);
    return { barChords, ...built };
  });

  const measureWidths = bars.map((bar, index) =>
    calculateMeasureWidth(keyContext.vexflowKeySignature, index === 0, Math.max(4, bar.notes.length))
  );
  const lineLayouts = [];
  let currentLine = { measures: [], width: 0 };
  measureWidths.forEach((measureWidth, index) => {
    const needsWrap =
      currentLine.measures.length >= maxMeasuresPerLine ||
      (currentLine.width + measureWidth > maxStaveWidth && currentLine.measures.length > 0);
    if (needsWrap) {
      lineLayouts.push(currentLine);
      currentLine = { measures: [], width: 0 };
    }
    currentLine.measures.push({ index, width: measureWidth });
    currentLine.width += measureWidth;
  });
  if (currentLine.measures.length > 0) lineLayouts.push(currentLine);

  const staveHeight = 120;
  const topPadding = 30;
  const height = topPadding + lineLayouts.length * staveHeight + 20;
  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(width, height);
  const context = renderer.getContext();

  const pendingCrossBarTies = []; // { fromNote } waiting for the next bar's first note
  lineLayouts.forEach((line, lineIndex) => {
    let xStart = Math.max(20, Math.floor((width - line.width) / 2));
    const yStart = topPadding + lineIndex * staveHeight;
    line.measures.forEach(({ index, width: staveWidth }) => {
      const bar = bars[index];
      const stave = new Stave(xStart, yStart, staveWidth);
      if (index === 0) {
        stave
          .addClef(getNotationClef())
          .addKeySignature(keyContext.vexflowKeySignature)
          .addTimeSignature('4/4');
      }
      stave.setContext(context).draw();
      headStavePositions[index] = { x: xStart, y: yStart, width: staveWidth, height: 80 };

      // Chord symbols at their beats (2-chord bars annotate beat 0 and 2)
      const chordBeats = distributeBeatsPerBar(bar.barChords.length);
      const floatingChords = [];
      let chordStart = 0;
      bar.barChords.slice(0, chordBeats.length).forEach((chordSymbol, chordIndex) => {
        const target = bar.noteMeta.findIndex(
          (meta) => meta.startBeat >= chordStart - 1e-6
        );
        if (target !== -1) {
          const annotation = new Annotation(formatChordSymbol(chordSymbol))
            .setFont('Arial', 12, 'normal')
            .setVerticalJustification(Annotation.VerticalJustify.TOP)
            .setYShift(10);
          bar.notes[target].addModifier(annotation, 0);
        } else {
          // A held note spans this chord's beat - nothing to attach to, so
          // the symbol is drawn at its beat position once the bar is laid out
          // (otherwise both chords stack on the same note).
          floatingChords.push({
            text: formatChordSymbol(chordSymbol),
            beat: chordStart,
          });
        }
        chordStart += chordBeats[chordIndex];
      });

      const beams = Beam.generateBeams(bar.notes);
      const voice = new Voice({ num_beats: 4, beat_value: 4 })
        .setMode(Voice.Mode.SOFT)
        .addTickables(bar.notes);
      // Same measured layout as the exercise sheet: clef/key/time overhead
      // comes off the drawn stave, not a guess.
      const extraNotes = Math.max(0, bar.notes.length - 4);
      const endPadding = 50 - Math.min(20, extraNotes * 5);
      const headModifierWidth = stave.getNoteStartX() - stave.getX();
      new Formatter()
        .joinVoices([voice])
        .format([voice], Math.max(120, staveWidth - headModifierWidth - endPadding));
      voice.draw(context, stave);
      beams.forEach((beam) => beam.setContext(context).draw());

      // Chords whose beat had no note to carry them: draw at the beat's
      // proportional x, on the same text line as the attached annotations
      floatingChords.forEach(({ text, beat }) => {
        const startX = stave.getNoteStartX();
        const endX =
          typeof stave.getNoteEndX === 'function'
            ? stave.getNoteEndX()
            : stave.getX() + stave.getWidth();
        const x = startX + ((endX - startX) * beat) / BEATS_PER_CYCLE;
        const y =
          typeof stave.getYForTopText === 'function'
            ? stave.getYForTopText(1)
            : yStart;
        context.save();
        context.setFont('Arial', 12, 'normal');
        context.fillText(text, x, y);
        context.restore();
      });

      // Ties inside the bar, plus any tie left hanging from the previous bar
      bar.ties.forEach(({ from, to, fromPreviousBar }) => {
        if (fromPreviousBar) return; // handled via pendingCrossBarTies
        new StaveTie({ first_note: bar.notes[from], last_note: bar.notes[to] })
          .setContext(context)
          .draw();
      });
      if (pendingCrossBarTies.length && bar.notes.length) {
        const from = pendingCrossBarTies.pop();
        new StaveTie({ first_note: from, last_note: bar.notes[0] })
          .setContext(context)
          .draw();
      }
      const lastMeta = bar.noteMeta[bar.noteMeta.length - 1];
      if (lastMeta?.tieToNext) {
        pendingCrossBarTies.push(bar.notes[bar.notes.length - 1]);
      }
      xStart += stave.width;
    });
  });
}

// Full regeneration: scale diagram + notation + playback state, from the
// current form values. Used by the Generate button and by continuous shift
// (which passes options.carryOver to voice-lead across the boundary).
function regenerateExercise(options = {}) {
  const mode = getSelectedExerciseMode();
  const song = mode === EXERCISE_MODES.SONG ? getSelectedSong() : null;
  const keyValue =
    mode === EXERCISE_MODES.SONG && song
      ? song.scaleType === 'minor'
        ? `${song.key}m`
        : song.key
      : getSelectedKeyValue();
  updateKeyDebug(keyValue);

  const view = getInstrumentView();
  const shape = document.getElementById(view.shapeControlId)?.value;
  if (!shape) {
    alert('Please select a chord shape.');
    return;
  }

  let shapeContext;
  if (getActiveInstrument() === 'guitar') {
    const keyContext = getKeyContext(keyValue);
    const cagedShape = getCAGEDShape(shape, keyContext.cagedKey);
    if (!cagedShape) {
      alert('Please select a chord shape.');
      return;
    }
    if (keyContext.isMinor) {
      cagedShape.key = keyContext.tonic;
      cagedShape.scaleType = keyContext.scaleType;
    }
    shapeContext = cagedShape;
  } else {
    shapeContext = preparePianoContext(keyValue, shape).cagedShape;
  }
  debugLog('shapeContext:', shapeContext);

  // Clear previous chords and diagrams
  document.getElementById('fretboard-container').innerHTML = '';

  // Render the instrument diagram (fretboard or keyboard)
  view.renderScaleDiagram(shapeContext);

  // Generate the musical exercise
  const exerciseData = generateExercise({
    mode,
    song,
    carryOver: options.carryOver || null,
    replay: options.replay || null,
    warnOnReplayMismatch: options.warnOnReplayMismatch || false,
  });
  renderHeadSheet(mode === EXERCISE_MODES.SONG ? song : null);
  updateExportTitle();
  updatePlaybackStateFromExercise(exerciseData);
}

// Note: findClosestIndex has been moved to noteFlow.js module

// Case is kept: it carries meaning in these names - "Ab-I-V" is A-flat major
// with major chords, where "ab-i-v" reads as minors.
function sanitizeFilePart(value) {
  return value
    .toString()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_]+/g, '');
}

/**
 * A file name that says what the exercise is: instrument first, then the song
 * (with its key) or the key and progression, then the shape - or, on piano,
 * the hand and register that stand in for it. Pass a null extension for the
 * bare stem.
 */
function buildExportFileName(extension) {
  const mode = getSelectedExerciseMode();
  const isPiano = getActiveInstrument() === 'piano';
  let parts = ['arpeggio-flow', isPiano ? 'piano' : 'guitar'];
  if (mode === EXERCISE_MODES.SONG) {
    const song = getSelectedSong();
    parts = parts.concat([
      'song',
      sanitizeFilePart(song?.title || song?.id || 'song'),
      sanitizeFilePart(song ? `${song.key}${song.scaleType === 'minor' ? 'm' : ''}` : ''),
    ]);
  } else {
    const key = getSelectedKeyValue() || 'key';
    const progression = isCustomProgressionSelected()
      ? getProgressionChords().chords?.join('-') || 'custom'
      : document.getElementById('progression')?.value || 'progression';
    const bars = document.getElementById('bars')?.value || 'bars';
    parts = parts.concat([
      sanitizeFilePart(key),
      sanitizeFilePart(progression),
      sanitizeFilePart(`${bars}bars`),
    ]);
  }
  if (getBeatsPerBar() !== 4) {
    parts.push(`${getBeatsPerBar()}4`);
  }
  if (isPiano) {
    parts.push(getSelectedPianoHand() === 'left' ? 'lh' : 'rh');
    parts.push(sanitizeFilePart(document.getElementById('pianoRange')?.value || ''));
  } else {
    const shape = document.getElementById('shape')?.value || '';
    if (shape) {
      parts.push(sanitizeFilePart(`shape-${shape}`));
    }
  }
  parts = parts.filter(Boolean);
  const stem = parts.join('-');
  return extension ? `${stem}.${extension}` : stem;
}

/** Controls that sit inside the exported block but must not be in the image. */
function isExportIgnored(element) {
  return element?.dataset?.exportIgnore === 'true';
}

function getExportTarget() {
  return document.getElementById('exercise-export');
}

async function exportExerciseAsPng() {
  const target = getExportTarget();
  if (!target || !target.children.length) {
    alert('Please generate an exercise before exporting.');
    return;
  }
  updateExportTitle();
  if (!window.html2canvas) {
    alert('Export failed: html2canvas is not available.');
    return;
  }
  const canvas = await window.html2canvas(target, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    ignoreElements: isExportIgnored,
  });
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = buildExportFileName('png');
  link.click();
}

async function exportExerciseAsPdf() {
  const target = getExportTarget();
  if (!target || !target.children.length) {
    alert('Please generate an exercise before exporting.');
    return;
  }
  updateExportTitle();
  if (!window.html2canvas) {
    alert('Export failed: html2canvas is not available.');
    return;
  }
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('Export failed: jsPDF is not available.');
    return;
  }
  const canvas = await window.html2canvas(target, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    ignoreElements: isExportIgnored,
  });
  const imgData = canvas.toDataURL('image/png');
  const pdfWidth = canvas.width;
  const pdfHeight = canvas.height;
  const orientation = pdfWidth > pdfHeight ? 'landscape' : 'portrait';
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [pdfWidth, pdfHeight],
  });
  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(buildExportFileName('pdf'));
}

// Calculate the required width for a measure based on key signature complexity
// and how many notes it holds (eighth-note bars need more room; the first
// measure needs extra because clef/key/time also take space)
function calculateMeasureWidth(key, isFirstMeasure, noteCount = 4) {
  const extraNoteWidth = Math.max(0, noteCount - 4) * (isFirstMeasure ? 24 : 16);
  if (!isFirstMeasure) {
    return 250 + extraNoteWidth; // Default width for non-first measures
  }

  // Get the key info to determine how many accidentals we have
  // Tonal.Key.majorKey() returns an object with 'keySignature' (e.g., "##" or "bbb")
  // and 'alteration' (number of sharps/flats, positive for sharps, negative for flats)
  const isMinor = typeof key === 'string' && key.endsWith('m');
  const tonic = isMinor ? key.slice(0, -1) : key;
  const keyInfo = isMinor ? Tonal.Key.minorKey(tonic) : Tonal.Key.majorKey(tonic);
  
  // Safely get accidental count - use alteration (absolute value) or keySignature length
  let accidentalCount = 0;
  if (keyInfo) {
    if (typeof keyInfo.alteration === 'number') {
      accidentalCount = Math.abs(keyInfo.alteration);
    } else if (keyInfo.keySignature) {
      accidentalCount = keyInfo.keySignature.length;
    } else if (keyInfo.alteredNotes && Array.isArray(keyInfo.alteredNotes)) {
      accidentalCount = keyInfo.alteredNotes.length;
    }
  }
  
  debugLog('calculateMeasureWidth:', { key, keyInfo, accidentalCount });
  
  // Base width plus additional space for each accidental
  // First measure needs extra space for clef, key signature, and time signature
  const baseWidth = 260;
  
  // More sophisticated calculation:
  // - Clef takes ~40px
  // - Time signature takes ~40px
  // - Each accidental takes ~15px
  // - Need some extra room for notes with accidentals
  const clefWidth = 40;
  const timeSignatureWidth = 40;
  const extraWidthPerAccidental = accidentalCount >= 5 ? 14 : 15;
  const safetyMargin = 0;
  
  const keySignatureWidth = accidentalCount * extraWidthPerAccidental;
  const firstMeasureWidth = baseWidth + clefWidth + timeSignatureWidth + keySignatureWidth + safetyMargin;
  
  // Ensure a minimum width and cap the maximum to avoid extreme values
  return Math.max(260, Math.min(520, firstMeasureWidth)) + extraNoteWidth;
}

// Make function available globally for testing
if (typeof window !== 'undefined') {
  window.calculateMeasureWidth = calculateMeasureWidth;
}

// Note: findClosestNote, getNextNoteInDirection, reachedBoundary have been moved to noteFlow.js module

// Initialize the application after DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
  const statusDiv = document.getElementById('status');
  const versionLabel = document.getElementById('appVersion');
  if (versionLabel) {
    versionLabel.textContent = `v${APP_VERSION}`;
    versionLabel.title = `Arpeggio Flow ${APP_VERSION}, the version stamped into exported files`;
  }

  // Check if VexFlow and Tonal.js are loaded
  let vexflowLoaded = typeof Vex !== 'undefined';
  let tonalLoaded = typeof Tonal !== 'undefined';
  let vexchordsLoaded = typeof vexchords !== 'undefined';

  if (!vexflowLoaded || !tonalLoaded || !vexchordsLoaded) {
    statusDiv.innerHTML = 'Failed to load VexFlow, Tonal, or VexChords.';
  } else {
    statusDiv.style.display = 'none'; // Hide the status div if everything is loaded
    updateKeyDebug(getSelectedKeyValue());
    updateExportTitle();
    updateBarsForProgression(document.getElementById('progression').value);
    setExerciseMode(EXERCISE_MODES.RANDOM);

    playbackUi.banner = document.getElementById('playback-banner');
    playbackUi.playButtons = ['playbackPlayButton', 'playbackPlayButtonTop']
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    playbackUi.stopButtons = ['playbackStopButton', 'playbackStopButtonTop']
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    playbackState.engine = getSelectedPlaybackEngine();
    updatePlaybackControls();

    document.getElementById('progression').addEventListener('change', (event) => {
      updateCustomProgressionVisibility();
      updateBarsForProgression(event.target.value);
      updateExportTitle();
    });

    document.getElementById('customProgression')?.addEventListener('input', () => {
      updateBarsForProgression('custom');
      updateExportTitle();
    });

    document.getElementById('key').addEventListener('change', () => {
      updateKeyDebug(getSelectedKeyValue());
      updateExportTitle();
    });

    document.getElementById('scaleType').addEventListener('change', () => {
      updateKeyDebug(getSelectedKeyValue());
      updateExportTitle();
    });
    
    document.getElementById('shape').addEventListener('change', () => {
      updateExportTitle();
    });

    const songSelect = document.getElementById('songSelect');
    if (songSelect) {
      songSelect.innerHTML = '';
      SONGS.forEach((song) => {
        const option = document.createElement('option');
        option.value = song.id;
        option.textContent = song.title;
        songSelect.appendChild(option);
      });
      if (SONGS.length) {
        songSelect.value = SONGS[0].id;
        updateSongDetails(SONGS[0]);
      }
      songSelect.addEventListener('change', () => {
        const selectedSong = getSelectedSong();
        updateSongDetails(selectedSong);
        if (getSelectedExerciseMode() === EXERCISE_MODES.SONG) {
          applySongDefaults(selectedSong);
        }
        updateExportTitle();
      });
    }

    const songTempoInput = document.getElementById('songTempoDisplay');
    if (songTempoInput) {
      songTempoInput.addEventListener('change', () => {
        const tempoValue = parseInt(songTempoInput.value || '0', 10);
        if (!Number.isFinite(tempoValue) || tempoValue <= 0) {
          return;
        }
        const tempoInput = document.getElementById('tempoBpm');
        if (tempoInput) {
          tempoInput.value = tempoValue;
        }
        if (getSelectedExerciseMode() !== EXERCISE_MODES.SONG) {
          return;
        }
        if (playbackState.engine !== 'strudel') {
          return;
        }
        updatePlaybackStateFromExercise({ generatedNotes: playbackState.notes });
      });
    }

    const modeRandomButton = document.getElementById('modeRandom');
    const modeSongButton = document.getElementById('modeSong');
    if (modeRandomButton) {
      modeRandomButton.addEventListener('click', () => {
        setExerciseMode(EXERCISE_MODES.RANDOM);
      });
    }
    if (modeSongButton) {
      modeSongButton.addEventListener('click', () => {
        setExerciseMode(EXERCISE_MODES.SONG);
      });
    }

    document.getElementById('instrumentToggle')?.addEventListener('click', () => {
      switchInstrument(getActiveInstrument() === 'piano' ? 'guitar' : 'piano');
    });
    // The meter defines how many notes fit in a bar, so its option list
    // follows the select (the exercise itself changes on the next Generate).
    document.getElementById('timeSignature')?.addEventListener('change', () => {
      updateNotesPerBarOptions();
      updateExportTitle();
    });
    document.getElementById('pianoRange')?.addEventListener('change', () => {
      updateExportTitle();
    });
    // Picking a hand lands the register on that hand's home range (the
    // change event this fires also saves and refreshes the title), then
    // re-rolls the exercise so the sheet matches the new register.
    document.getElementById('pianoHand')?.addEventListener('change', () => {
      setSelectValue('pianoRange', PIANO_HAND_DEFAULT_RANGE[getSelectedPianoHand()]);
      updateExportTitle();
      if (getActiveInstrument() === 'piano' && lastExerciseState?.measureData?.length) {
        regenerateExercise();
      }
    });

    const playbackEngineSelect = document.getElementById('playbackEngine');
    if (playbackEngineSelect) {
      playbackEngineSelect.addEventListener('change', () => {
        playbackState.engine = getSelectedPlaybackEngine();
        updateKeyDebug(getSelectedKeyValue());
        updateExportTitle();
        if (playbackState.engine === 'strudel') {
          updatePlaybackStateFromExercise({ generatedNotes: playbackState.notes });
        } else {
          setPlaybackBanner('');
        }
        updatePlaybackControls();
      });
    }

    const tempoInput = document.getElementById('tempoBpm');
    if (tempoInput) {
      tempoInput.addEventListener('change', () => {
        if (playbackState.engine !== 'strudel') {
          return;
        }
        refreshPlaybackBanner();
      });
    }
    const soundSelect = document.getElementById('strudelSound');
    if (soundSelect) {
      soundSelect.addEventListener('change', () => {
        if (playbackState.engine !== 'strudel') {
          return;
        }
        refreshPlaybackBanner();
      });
    }
    // The Visual / Audio switches apply straight away: leaving Audio off from
    // an earlier session and pressing Play is the most confusing way to get
    // silence, so toggling it back on has to be audible immediately.
    ['playbackVisual', 'playbackAudio'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => {
        updatePlaybackControls();
        if (playbackState.isPlaying) {
          restartPlaybackLayers();
        } else {
          refreshPlaybackBanner();
        }
      });
    });

    // Changing the shift mid-loop must rebuild the precomputed next exercise,
    // or the preview would still point at the old target.
    document.getElementById('continuousShift')?.addEventListener('change', (event) => {
      updateStayInPositionAvailability();
      if (event.target.value === 'cycle-pinned' && !pinnedExercises.length) {
        setPlaybackBanner(
          'Nothing pinned yet: open History and star the exercises you want in the cycle.',
          'warning'
        );
      }
      if (playbackState.isPlaying) {
        precomputeNextExercise();
      }
    });

    ['rhythmSound', 'soundAmbience', 'backingChords', 'loopPause'].forEach((id) => {
      document.getElementById(id)?.addEventListener('change', () => {
        if (playbackState.engine !== 'strudel') {
          return;
        }
        refreshPlaybackBanner();
      });
    });

    // In piano mode the backing style is also written on the accompaniment
    // staff, so the sheet re-renders - replaying the same notes, not rolling
    // new ones.
    document.getElementById('backingChords')?.addEventListener('change', () => {
      if (getActiveInstrument() === 'piano' && lastExerciseState?.measureData?.length) {
        regenerateExercise({ replay: toReplayMeasures(lastExerciseState.measureData) });
      }
    });

    playbackUi.playButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        if (playbackState.isPlaying) {
          await pausePlayback();
        } else {
          await startPlayback();
        }
      });
    });
    playbackUi.stopButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        await stopPlayback();
        refreshPlaybackBanner();
      });
    });

    document.getElementById('generateButton').addEventListener('click', async () => {
      // A paused (or still-playing) loop belongs to the old exercise: stop it
      // so the fresh one lands on a clean transport, ready to Play.
      if (playbackState.isPlaying || playbackState.isPaused) {
        await stopPlayback();
      }
      regenerateExercise();
    });

    // Load an exported exercise file onto the main window.
    const loadExerciseInput = document.getElementById('loadExerciseInput');
    document.getElementById('loadExerciseButton')?.addEventListener('click', () => {
      loadExerciseInput?.click();
    });
    loadExerciseInput?.addEventListener('change', async (event) => {
      await loadExerciseFromFile(event.target.files?.[0]);
      // Clear the input so picking the same file twice still fires a change.
      event.target.value = '';
    });

    window.addEventListener('resize', repositionFretboardBoxLabel);

    // Any tap re-arms audio if the browser suspended it (see the function).
    document.addEventListener('pointerdown', resumeAudioContextIfSuspended, true);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) resumeAudioContextIfSuspended();
    });

    // Remember the form as it is left. The inline window.onload handler in the
    // page rebuilds the shape list, so the restore waits for 'load' to run
    // after it - otherwise the restored shape is overwritten.
    const rememberedIds = new Set([...SNAPSHOT_CONTROL_IDS, ...EXTRA_PREF_CONTROL_IDS]);
    document.addEventListener('change', (event) => {
      if (rememberedIds.has(event.target?.id)) {
        saveUserDefaults();
      }
    });
    document.getElementById('customProgression')?.addEventListener('input', saveUserDefaults);
    document.getElementById('stayInPosition')?.addEventListener('change', () => {
      if (playbackState.isPlaying) precomputeNextExercise();
    });
    // Show/hide the head lead sheet as the toggle changes, without waiting
    // for the next Generate.
    document.getElementById('playHeadFirst')?.addEventListener('change', () => {
      renderHeadSheet(
        getSelectedExerciseMode() === EXERCISE_MODES.SONG ? getSelectedSong() : null
      );
    });
    updateStayInPositionAvailability();
    updateNotesPerBarOptions();
    ['modeRandom', 'modeSong'].forEach((id) => {
      document.getElementById(id)?.addEventListener('click', saveUserDefaults);
    });
    window.addEventListener('load', () => {
      if (restoreUserDefaults()) {
        debugLog('Restored the settings from the last session.');
        updateKeyDebug(getSelectedKeyValue());
        updateExportTitle();
      }
      // Runs either way: the restored (or default) shift decides whether the
      // stay-in-position toggle applies.
      updateStayInPositionAvailability();
    });

    pinnedExercises = readPinnedExercises();
    renderExerciseHistory();
    updateHistoryButton();

    const historyModal = document.getElementById('exerciseHistoryModal');
    document.getElementById('exerciseHistoryButton')?.addEventListener('click', () => {
      renderExerciseHistory(); // refresh the "x min ago" stamps
      historyModal?.showModal();
    });
    document.getElementById('exerciseHistoryClose')?.addEventListener('click', () => {
      historyModal?.close();
    });
    historyModal?.addEventListener('click', (event) => {
      if (event.target === historyModal) historyModal.close();
    });
    document.getElementById('exportPinnedButton')?.addEventListener('click', exportPinnedExercises);
    const importInput = document.getElementById('importPinnedInput');
    document.getElementById('importPinnedButton')?.addEventListener('click', () => {
      importInput?.click();
    });
    importInput?.addEventListener('change', async (event) => {
      await importPinnedExercises(event.target.files?.[0]);
      // Clear the input so picking the same file twice still fires a change.
      event.target.value = '';
    });
    document.getElementById('pinCurrentExerciseButton')?.addEventListener('click', () => {
      const snapshot = captureExerciseSnapshot();
      if (!snapshot) {
        return;
      }
      // Pin what is on screen, re-using the history entry when it is the same
      // exercise so the star does not end up on two copies of one loop.
      const existing = exerciseHistory.find(
        (entry) => snapshotSignature(entry) === snapshotSignature(snapshot)
      );
      const target = existing || snapshot;
      if (!isPinned(target.id)) {
        togglePinned(target);
      }
    });

    // One Export button in the footer, with the three formats behind it.
    const exportMenuButton = document.getElementById('exportMenuButton');
    const exportMenuList = document.getElementById('exportMenuList');
    const setExportMenuOpen = (open) => {
      if (!exportMenuList || !exportMenuButton) return;
      exportMenuList.hidden = !open;
      exportMenuButton.setAttribute('aria-expanded', String(open));
    };
    exportMenuButton?.addEventListener('click', (event) => {
      event.stopPropagation();
      setExportMenuOpen(exportMenuList?.hidden !== false);
    });
    document.addEventListener('click', (event) => {
      if (!exportMenuList || exportMenuList.hidden) return;
      if (!event.target.closest('.export-menu')) setExportMenuOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setExportMenuOpen(false);
    });
    [
      ['exportPngButton', exportExerciseAsPng],
      ['exportPdfButton', exportExerciseAsPdf],
      ['exportExerciseButton', exportCurrentExercise],
    ].forEach(([id, action]) => {
      document.getElementById(id)?.addEventListener('click', () => {
        setExportMenuOpen(false);
        action();
      });
    });

    // Scale-degree modal: open button
    const scaleDegreeModalBtn = document.getElementById('scaleDegreeModalBtn');
    if (scaleDegreeModalBtn) {
      scaleDegreeModalBtn.addEventListener('click', () => {
        openScaleDegreeModal();
      });
    }

    // FAQ: a static dialog, same chrome as the other modals.
    const faqModal = document.getElementById('faqModal');
    document.getElementById('faqButton')?.addEventListener('click', () => {
      faqModal?.showModal();
    });
    document.getElementById('faqModalClose')?.addEventListener('click', () => {
      faqModal?.close();
    });

    // Scale-degree modal: close button
    const scaleDegreeModalClose = document.getElementById('scaleDegreeModalClose');
    if (scaleDegreeModalClose) {
      scaleDegreeModalClose.addEventListener('click', () => {
        document.getElementById('scaleDegreeModal')?.close();
      });
    }

    // Scale-degree modal: click outside (backdrop) to close
    const scaleDegreeModal = document.getElementById('scaleDegreeModal');
    if (scaleDegreeModal) {
      scaleDegreeModal.addEventListener('click', (e) => {
        if (e.target === scaleDegreeModal) scaleDegreeModal.close();
      });
    }
  }
});

// Clear previous chords and diagrams
document.getElementById('fretboard-container').innerHTML = '';


