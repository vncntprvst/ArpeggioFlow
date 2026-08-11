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
  return getSelectedLoopPauseBars() * BEATS_PER_CYCLE;
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
  default: { type: 'synth', label: 'Synth (Default)' },
};
// Drum kit for the backing rhythm. @strudel/web's prebake only registers the
// synth sounds, so the sample registry has to be loaded by hand — this JSON
// map (the same one the official Strudel REPL prebakes) names bd/sd/hh/oh/
// rim/cp/rd/cr/perc and resolves them against the tidal-drum-machines repo.
const DRUM_SAMPLE_MAP_URL =
  'https://raw.githubusercontent.com/felixroos/dough-samples/main/EmuSP12.json';

// Backing rhythm played underneath (or instead of) the exercise notes. It
// follows the tempo, not the note rhythm: one token per beat of the loop.
// A layer maps (beatInMeasure, beatsInMeasure) to a mini-notation token —
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
    // well below the default rhythm gain — it should brush along under the
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
};

const GM_SOUNDFONT_FONTS = {
  // Not a GM program of its own: the blues voice is the overdriven-guitar
  // program (29) from the JCLive bank, which is warmer and sustains longer
  // than the FluidR3 one — the singing, barely-broken-up tone of the
  // "Robben Ford - Playing the Blues" examples. Pair it with the Room or
  // Slapback ambience below for the note tails.
  gm_blues_guitar: ['0290_JCLive_sf2_file'],
  // Comping voice for the backing-chords layer, not offered as a lead sound.
  gm_acoustic_grand_piano: ['0000_FluidR3_GM_sf2_file'],
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
    // stay lazy — they are looked up at call time, not at wrapper creation.
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
// Opacity per step of lookahead — index 0 is the note right after the current
// one. The length of this list is how far ahead the preview reaches. The next
// note stays clearly readable; the drop-off across the three does the work of
// showing how far away each one is.
const FRETBOARD_LOOKAHEAD_OPACITIES = [0.9, 0.62, 0.38];
// Rings: all black (same in static and playback views)
const SCALE_DEGREE_RING_DEGREES = new Set([1, 3, 5, 7]);

function addRingToDot(dotEl, dotCircle) {
  const ring = document.createElementNS(FRETBOARD_SVG_NS, 'circle');
  ring.setAttribute('cx', dotCircle.getAttribute('cx'));
  ring.setAttribute('cy', dotCircle.getAttribute('cy'));
  ring.setAttribute('r', FRETBOARD_DOT_RING_RADIUS);
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', '#000000');
  ring.setAttribute('stroke-width', '2.5');
  ring.setAttribute('class', 'dot-ring');
  dotEl.insertBefore(ring, dotEl.querySelector('.dot-text'));
}

/** Small "R"/"3"/"5"/"7" tag at the top-right of a ringed dot. */
function addDegreeLabelToDot(dotEl, dotCircle, degreeNum) {
  const label = document.createElementNS(FRETBOARD_SVG_NS, 'text');
  // cx/cy can be percentage strings (fretboard.js positions dots that way),
  // so copy them verbatim and offset with dx/dy instead of computing pixels.
  label.setAttribute('x', dotCircle.getAttribute('cx'));
  label.setAttribute('y', dotCircle.getAttribute('cy'));
  label.setAttribute('dx', FRETBOARD_DOT_RING_RADIUS - 3);
  label.setAttribute('dy', -(FRETBOARD_DOT_RING_RADIUS - 3));
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
function addDurationLabelToDot(dotEl, dotCircle, beats) {
  const glyph = getDurationGlyph(beats);
  if (!glyph) return;
  const label = document.createElementNS(FRETBOARD_SVG_NS, 'text');
  // cx/cy can be percentage strings, so offset with dx/dy like the degree tag.
  label.setAttribute('x', dotCircle.getAttribute('cx'));
  label.setAttribute('y', dotCircle.getAttribute('cy'));
  label.setAttribute('dx', FRETBOARD_DOT_RING_RADIUS + 5);
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

function addPlayedNotesRing(dotEl, dotCircle) {
  const ring = document.createElementNS(FRETBOARD_SVG_NS, 'circle');
  ring.setAttribute('cx', dotCircle.getAttribute('cx'));
  ring.setAttribute('cy', dotCircle.getAttribute('cy'));
  ring.setAttribute('r', FRETBOARD_DOT_RING_RADIUS + 4); // slightly outside the black ring
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', '#e03030');
  ring.setAttribute('stroke-width', '2.5');
  ring.setAttribute('class', 'dot-ring dot-played-ring');
  dotEl.insertBefore(ring, dotEl.querySelector('.dot-text'));
}

/**
 * What comes after the current step, in two parts:
 *  - byMidi: pitches still inside this exercise, keyed by MIDI, each with the
 *    closest rank it appears at (1 = next note) and whether it already belongs
 *    to a later measure. A repeated pitch keeps its earliest rank, and the note
 *    sounding right now is never a preview.
 *  - positions: notes from the *next* loop of a continuous shift, as neck
 *    positions in that loop's box — a different part of the neck, so they
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
  // incoming box stays lit — the pause is exactly when you move to it.
  const pauseBars = getSelectedLoopPauseBars();
  for (let bar = 0; bar < pauseBars; bar += 1) {
    steps.push({ pause: true, beats: BEATS_PER_CYCLE });
  }
  return steps;
}

function applyVisualStep(step, mode, steps, index) {
  if (!isVisualPlaybackEnabled() || !step) return;
  if (step.pause) {
    applyPauseStep();
    return;
  }
  moveHighlightToMeasure(step.segment.barIndex ?? 0);
  if (step.note !== undefined) {
    updateFretboardForNote(
      step.segment,
      step.note,
      mode,
      buildLookahead(steps, index),
      step.beats
    );
  } else {
    updateFretboardForChord(step.segment);
    // Chord mode has no per-note lookahead, so the incoming box lights up for
    // the last chord of the loop instead — the same cue, one chord wide.
    const isLastChord = steps.slice(index + 1).every((later) => later.pause);
    if (isLastChord) {
      const fretboardDiv = document.getElementById('fretboard-container');
      if (fretboardDiv) {
        renderNextLoopPreview(fretboardDiv, getNextLoopPreviewPositions());
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
function applyPauseStep() {
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
  resetFretboardHighlight();
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

function setSelectValue(selectId, value) {
  const select = document.getElementById(selectId);
  if (!select || value === null || value === undefined) return false;
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

function isStayInPositionEnabled() {
  return document.getElementById('stayInPosition')?.checked ?? false;
}

/** The toggle only means anything for the key-changing shifts. */
function updateStayInPositionAvailability() {
  const toggle = document.getElementById('stayInPosition');
  if (!toggle) return;
  const applies = getSelectedContinuousShift() in CONTINUOUS_SHIFT_KEY_DELTAS;
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

/** Where a shift would land, as { key } and/or { shape } — nothing is changed. */
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
  if (mode === 'shape-up') {
    const shape = peekSelectValue('shape', 1);
    return shape ? { shape } : null;
  }
  if (mode === 'shape-down') {
    const shape = peekSelectValue('shape', -1);
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
  if (target.shape) applied = setSelectValue('shape', target.shape) || applied;
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
      for (let k = 0; k < slotSize && noteIdx < measure.notes.length; k += 1, noteIdx += 1) {
        const note = measure.notes[noteIdx];
        steps.push({
          note,
          beats: slotSize === 2 ? 0.5 : 1,
          position: findBoxPositionForNote(cagedShape, note),
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

function nextPinnedSnapshot() {
  if (!pinnedExercises.length) return null;
  // Starting the cycle on an exercise that happens to be pinned (pressing Play
  // right after starring it) should carry on from that entry, not repeat it.
  if (!currentPinnedId) {
    const current = captureExerciseSnapshot();
    const match =
      current &&
      pinnedExercises.find(
        (entry) => snapshotSignature(entry) === snapshotSignature(current)
      );
    if (match) {
      currentPinnedId = match.id;
    }
  }
  const index = pinnedExercises.findIndex((entry) => entry.id === currentPinnedId);
  return pinnedExercises[(index + 1) % pinnedExercises.length];
}

/** The CAGED box a snapshot will be played in, for its preview and label. */
function getShapeForSettings(settings) {
  if (!settings?.shape) return null;
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
// boundary is too late — the old pattern's next first note is already
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
  // pattern onto a new cycle grid — that needs a clock restart, and a restart
  // has to happen AT the boundary, not before it.
  const audioOn = isAudioPlaybackEnabled() && playbackState.engine === 'strudel';
  const restartsClock = audioOn && willRestartStrudelLoop();
  // Otherwise swap the audio pattern NOW, before the scheduler queries the
  // boundary chunk: the delegating wrapper keeps playing without any clock
  // restart, and the swap only affects queries from here on — the old loop's
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

const AUDIO_OFF_MESSAGE = 'Audio is off — showing the exercise without sound.';
const PAUSED_MESSAGE = 'Paused — Resume picks up from the top of the loop.';

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
// soundfont, seconds on a slow link). A Stop — or a second Play — during that
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
    // Silence here is a setting, not a fault — say so, or it reads as a bug.
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
 * without drifting off the grid, so Resume starts the loop again from the top —
 * the banner says as much.
 */
async function pausePlayback() {
  if (!playbackState.isPlaying) return;
  playbackSessionToken += 1; // abandon any start still waiting on Strudel
  clearIntroTimer();
  clearHeadVisual();
  clearContinuousShiftTimer();
  clearNextExercisePreview();
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
// replayable afterwards — you can go back to the key that caught you out
// instead of waiting for it to come round again. The session list lives in
// memory; pinning copies an entry to localStorage so it survives a reload.

const HISTORY_LIMIT = 20;
const PINNED_LIMIT = 50;
const PINNED_STORAGE_KEY = 'arpeggioFlow.pinnedExercises';
// Restored in this order, so progression lands before bars (a progression
// change resets the bar count).
const SNAPSHOT_CONTROL_IDS = [
  'scaleSystem',
  'key',
  'scaleType',
  'shape',
  'progression',
  'customProgression',
  'bars',
  'trueChorusLength',
  'notesPerMeasure',
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
  [...SNAPSHOT_CONTROL_IDS, ...extraIds].forEach((id) => {
    if (id === 'scaleSystem' || values[id] === undefined) return;
    const element = document.getElementById(id);
    // No change events here: they would re-derive bars from the progression
    // and re-apply song defaults over the values being restored.
    if (element) {
      writeControlValue(element, values[id]);
    }
  });
  if (values.exerciseMode) {
    setExerciseMode(values.exerciseMode);
  }
  updateCustomProgressionVisibility();
  updateKeyDebug(getSelectedKeyValue());
  updateExportTitle();
}

function describeSnapshotSettings(values) {
  if (values.exerciseMode === EXERCISE_MODES.SONG) {
    const song = getSongById(values.songSelect);
    return song ? `${song.title} · Shape ${values.shape}` : `Song · Shape ${values.shape}`;
  }
  const quality = values.scaleType === 'minor' ? 'minor' : 'major';
  return `${values.key} ${quality} · Shape ${values.shape} · ${values.progression}`;
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
    detail: `${settings.tempoBpm || '?'} BPM · ${describeSnapshotVoices(settings)}`,
    settings,
    measures,
  };
}

/** Same chart and same notes → same exercise, whatever the timestamps say. */
function snapshotSignature(snapshot) {
  return [
    snapshot.label,
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
      entry.slots.reduce((sum, slot) => sum + slot, 0) === entry.notes.length
    );
  });
  return fits ? replay : null;
}

/** Put a saved exercise on screen — settings, chart and its exact notes. */
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
  const current = captureExerciseSnapshot();
  const signature = current ? snapshotSignature(current) : null;
  const match =
    signature && pinnedExercises.find((entry) => snapshotSignature(entry) === signature);
  if (match) {
    currentPinnedId = match.id;
    return;
  }
  showExerciseSnapshot(pinnedExercises[0]);
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
// from) a plain JSON file — a backup, and the way to carry a practice set to
// another device.

const PINNED_FILE_VERSION = 1;

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
    version: PINNED_FILE_VERSION,
    savedAt: new Date().toISOString(),
    exercises,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenameStem}-${new Date().toISOString().slice(0, 10)}.json`;
  // Safari only downloads from an anchor that is in the document, and revoking
  // the blob URL in the same tick cancels the download — hence the timeout.
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
    setHistoryHint('Nothing pinned yet — star an exercise first.');
    return;
  }
  downloadExercisesFile(pinnedExercises, 'arpeggio-flow-pinned');
  setHistoryHint(`Exported ${pinnedExercises.length} pinned exercise(s).`);
}

/** The exercise on screen, as a file that Import (or another device) accepts. */
function exportCurrentExercise() {
  const snapshot = captureExerciseSnapshot();
  if (!snapshot) {
    setPlaybackBanner('Generate an exercise before exporting it.', 'warning');
    return;
  }
  downloadExercisesFile([snapshot], 'arpeggio-flow-exercise');
  setPlaybackBanner(`Exported “${snapshot.label}” as a file.`, 'info');
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
      'Pinned — cycled top to bottom',
      pinnedExercises,
      'Nothing pinned yet — use ☆ to keep an exercise after a reload, and to add it to the cycle.',
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
// a quarter note is "c4", a pair of eighths "[c4 d4]".
function buildStrudelBeatPattern(beatSlots) {
  return beatSlots
    .map((slotNotes) => {
      const tokens = (slotNotes || [])
        .map(toStrudelNote)
        .filter((token) => token && token.length > 0);
      if (!tokens.length) return null;
      return tokens.length === 1 ? tokens[0] : `[${tokens.join(' ')}]`;
    })
    .filter(Boolean)
    .join(' ');
}

/**
 * Strudel uses cycles as its fundamental timing unit, not beats.
 * According to Strudel docs (https://strudel.cc/understand/cycles/):
 * setcpm(bpm / bpc) where bpc = beats per cycle
 * 
 * This app uses bpc=4, treating each cycle as a full measure in 4/4 time.
 * Therefore: cycles per minute = bpm / 4
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

// The tempo setters are NOT exports of the @strudel/web ES module — they are
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
  // beats per second — exactly the notated tempo. Do not "simplify" this
  // to beats / BEATS_PER_CYCLE: that plays at half speed.
  return Math.max(1, beatCount / (2 * BEATS_PER_CYCLE));
}

// ─── Backing rhythm ──────────────────────────────────────────────────────────

/**
 * One entry per beat of the loop: its 0-based position inside its measure and
 * that measure's beat count, so rhythms can put the kick on 1 and 3 whatever
 * the measure lengths are. Falls back to a 4/4 grid if the measure data does
 * not add up to the beat count.
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
    for (let index = 0; index < beatCount; index += 1) {
      meta.push({ beat: index % BEATS_PER_CYCLE, beats: BEATS_PER_CYCLE });
    }
  }
  // Trailing rest bars, if any: part of the loop's grid, so every layer and
  // the visual clock see the same length.
  for (let index = 0; index < getLoopPauseBeats(); index += 1) {
    meta.push({
      beat: index % BEATS_PER_CYCLE,
      beats: BEATS_PER_CYCLE,
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
const BACKING_CHORD_MAX_TONES = 4;

/**
 * A close-position voicing for one chord, as Strudel note tokens. Chord tones
 * are stacked upwards from the root, so the shape never inverts mid-chart.
 */
function buildBackingChordVoicing(rootNote, quality) {
  const chordData = Tonal.Chord.get(`${rootNote}${quality || ''}`);
  const pitchClasses = (chordData?.notes || []).slice(0, BACKING_CHORD_MAX_TONES);
  if (!pitchClasses.length) return null;
  const tokens = [];
  let previousMidi = BACKING_CHORD_LOW_MIDI - 1;
  pitchClasses.forEach((pitchClass) => {
    let octave = Math.floor(previousMidi / 12) - 1;
    let midi = Tonal.Note.midi(`${pitchClass}${octave}`);
    while (Number.isFinite(midi) && midi <= previousMidi) {
      octave += 1;
      midi = Tonal.Note.midi(`${pitchClass}${octave}`);
    }
    if (!Number.isFinite(midi)) return;
    previousMidi = midi;
    const token = toStrudelNote(`${pitchClass}${octave}`);
    if (token) tokens.push(token);
  });
  return tokens.length ? tokens : null;
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
  segments.forEach((segment) => {
    const beats = segment.beats || 4;
    const voicing = buildBackingChordVoicing(segment.rootNote, segment.quality);
    const hits = new Map((config.hits(beats) || []).map((hit) => [hit.beat, hit]));
    for (let beat = 0; beat < beats; beat += 1) {
      const hit = voicing ? hits.get(beat) : null;
      noteTokens.push(hit ? `[${voicing.join(',')}]` : '~');
      clipTokens.push(hit ? `${hit.clip}` : '1');
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
  // A touch of room so the comp sits behind the exercise rather than on top.
  if (typeof pattern.room === 'function') {
    pattern = pattern.room(0.25);
  }
  return pattern;
}

// ─── Song intro: the head played once before the exercise ────────────────────
// One pass of the song's chart — comped chords, plus the melody when the song
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
    `Playing the head first (${barsCount} bars${song.melodyBars ? ', with melody' : ''}) — the exercise follows.`,
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

  // Effects go on the notes only — a reverbed metronome is unusable as a
  // reference, and the drum samples already have their own room in them.
  pattern = applyAmbience(pattern);

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
  // from getMeasures() — see the calibration note there. The scheduler's
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
    setPlaybackBanner('The browser suspended audio — tap Play again to re-enable it.', 'warning');
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
 * Strudel only ever resumes it once — initAudioOnFirstClick removes its own
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
// "Custom…" swaps the preset menu for a free-text field. Input is forgiving —
// any of "I-vi-ii-V", "i vi ii v", "| I | vi | ii | V |" work — and resolves to
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
  return { chords: progression.replace(/\s/g, '').split('-') };
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
  updateExportTitle();
}

function updateExportTitle() {
  const titleEl = document.getElementById('export-title');
  if (!titleEl) {
    return;
  }
  const shapeSelect = document.getElementById('shape');
  const shapeLabel =
    shapeSelect?.selectedOptions?.[0]?.textContent || shapeSelect?.value || '';
  const mode = getSelectedExerciseMode();
  if (mode === EXERCISE_MODES.SONG) {
    const song = getSelectedSong();
    if (song) {
      const songKeyLabel = `${song.key} ${song.scaleType}`;
      titleEl.textContent = `Song: ${song.title} | Key: ${songKeyLabel} | Shape: ${shapeLabel}`;
    } else {
      titleEl.textContent = `Song exercise | Shape: ${shapeLabel}`;
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
  titleEl.textContent = `Key: ${key} | Progression: ${progressionLabel} | Shape: ${shapeLabel}`;
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
  // Add 1 octave for guitar transposition: sounding pitch → written pitch
  return `${pc.toLowerCase()}/${octave + 1}`;
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

  // Use cagedShape.shape (e.g. "G Shape") directly — no extra "shape" suffix
  titleEl.textContent = `Scale Arpeggios — ${cagedShape.key} ${cagedShape.scaleType} (${cagedShape.shape || ''})`.replace(/\s*\(\s*\)\s*$/, '');
  body.innerHTML = '';

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

function buildChordNotesInRange(chordNoteNames) {
  const safeNotes = Array.isArray(chordNoteNames) ? chordNoteNames : [];
  const { minPitch, maxPitch } = getGuitarPitchRange();
  const octaves = [2, 3, 4, 5, 6];
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

function prepareExerciseContext(keyValue, shape) {
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

// Split a bar's 4 beats among its chords (bars with more than 4 chords are
// truncated to the first 4).
function distributeBeatsPerBar(chordCount) {
  if (chordCount <= 1) return [4];
  if (chordCount === 2) return [2, 2];
  if (chordCount === 3) return [2, 1, 1];
  return [1, 1, 1, 1];
}

// Selected notes-per-bar option: 4-8, or 'random' (rolled per bar)
function getSelectedNotesPerBar() {
  const select = document.getElementById('notesPerMeasure');
  if (!select || !select.value) return 4;
  if (select.value === 'random') return 'random';
  const n = parseInt(select.value, 10);
  return Number.isFinite(n) && n >= 4 && n <= 8 ? n : 4;
}

function isMidMeasureTurnaroundEnabled() {
  return document.getElementById('turnaroundMode')?.value === 'mid';
}

// A bar is 4 beat slots; each slot holds one quarter note (1) or a beamed
// pair of eighths (2). n notes per bar → (n - 4) slots become eighth pairs,
// placed on random beats for variety.
function buildBarSlots(notesPerBar) {
  const n = Math.max(4, Math.min(8, notesPerBar));
  const slots = [1, 1, 1, 1];
  const beatOrder = [0, 1, 2, 3];
  for (let i = beatOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [beatOrder[i], beatOrder[j]] = [beatOrder[j], beatOrder[i]];
  }
  for (let i = 0; i < n - 4; i++) {
    slots[beatOrder[i]] = 2;
  }
  return slots;
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
  const shape = options.shape || document.getElementById('shape')?.value;
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
  const measureData = [];
  chordBars.forEach((barChords, barIndex) => {
    const segmentBeats = distributeBeatsPerBar(barChords.length);
    if (barChords.length > segmentBeats.length) {
      debugLog(
        `Bar ${barIndex + 1} has ${barChords.length} chords; keeping the first ${segmentBeats.length}.`
      );
    }
    const notesPerBar =
      notesPerBarSetting === 'random'
        ? 4 + Math.floor(Math.random() * 5)
        : notesPerBarSetting;
    const barSlots = buildBarSlots(notesPerBar);
    let slotCursor = 0;
    segmentBeats.forEach((beats, chordIdx) => {
      const chordSymbol = barChords[chordIdx];
      const slots = barSlots.slice(slotCursor, slotCursor + beats);
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
        notesPerMeasure: slots.reduce((sum, slotSize) => sum + slotSize, 0),
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
      measure.notesPerMeasure = replayed.slots.reduce((sum, slot) => sum + slot, 0);
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
  const generatedNotes = measureData.flatMap((measure) => measure.generatedNotes || []);
  const barGroups = [];
  measureData.forEach((segment) => {
    if (!barGroups[segment.barIndex]) {
      barGroups[segment.barIndex] = { segments: [] };
    }
    barGroups[segment.barIndex].segments.push(segment);
  });
  const measures = barGroups.map((bar) => ({
    segments: bar.segments,
    notes: bar.segments.flatMap((segment) => {
      const generated = segment.generatedNotes || [];
      const slots = segment.slots || generated.map(() => 1);
      const staveNotes = [];
      let noteIdx = 0;
      slots.forEach((slotSize) => {
        for (let k = 0; k < slotSize && noteIdx < generated.length; k++, noteIdx++) {
          staveNotes.push(
            new StaveNote({
              clef: 'treble',
              keys: [toVexFlowFormat(generated[noteIdx])],
              duration: slotSize === 2 ? '8' : 'q',
            })
          );
        }
      });
      return staveNotes;
    }),
  }));

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
  const staveHeight = 120;
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

    line.measures.forEach(({ index, width: staveWidth }) => {
      const measure = measures[index];

      if (index === 0) {
        debugLog(`First measure width for key ${key}:`, staveWidth);
      }

      const stave = new Stave(xStart, yStart, staveWidth);
      if (index === 0) {
        stave
          .addClef('treble')
          .addKeySignature(keyContext.vexflowKeySignature)
          .addTimeSignature('4/4');
      }
      stave.setContext(context).draw();
      stavePositions[index] = { x: xStart, y: yStart, width: staveWidth, height: 80 };

      // One chord annotation per segment, at the segment's first note
      let annotationNoteIndex = 0;
      measure.segments.forEach((segment) => {
        const chordAnnotation = new Annotation(segment.chordName)
          .setFont('Arial', 12, 'normal')
          .setVerticalJustification(Annotation.VerticalJustify.TOP)
          .setYShift(10);
        if (measure.notes[annotationNoteIndex]) {
          measure.notes[annotationNoteIndex].addModifier(chordAnnotation, 0);
        }
        annotationNoteIndex += (segment.generatedNotes || []).length;
      });

      // Beam eighth-note pairs (grouped per beat) like a printed chart
      const beams = Beam.generateBeams(measure.notes);
      const voice = new Voice({ num_beats: 4, beat_value: 4 }).addTickables(
        measure.notes
      );
      // Dense (eighth-note) bars: the first measure needs extra right padding
      // so the last note clears the barline after clef/key/time take their
      // share; later measures instead spread their notes into more of the bar.
      const extraNotes = Math.max(0, measure.notes.length - 4);
      const reserve =
        index === 0 ? 100 + extraNotes * 8 : 50 - Math.min(20, extraNotes * 5);
      const availableWidth = stave.width - reserve;
      new Formatter()
        .joinVoices([voice])
        .format([voice], Math.max(120, availableWidth));
      voice.draw(context, stave);
      beams.forEach((beam) => beam.setContext(context).draw());

      xStart += stave.width;
    });
  });

  renderArpeggioDiagrams(measureData, cagedShape);

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

  // One entry per beat for audio: a quarter note is [note], eighths [n1, n2]
  const beatSlots = [];
  measureData.forEach((segment) => {
    const generated = segment.generatedNotes || [];
    const slots = segment.slots || generated.map(() => 1);
    let noteIdx = 0;
    slots.forEach((slotSize) => {
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
// it has one, chord symbols over slash notation otherwise — so the user can
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

function makeHeadNote(VF, note, beats) {
  const spec = headDurationFor(beats);
  if (!spec) return null;
  let staveNote;
  if (note) {
    staveNote = new VF.StaveNote({
      clef: 'treble',
      keys: [toVexFlowFormat(note)],
      duration: spec.duration,
    });
  } else {
    staveNote = new VF.StaveNote({
      clef: 'treble',
      keys: ['b/4'],
      duration: `${spec.duration}r`,
    });
  }
  for (let dot = 0; dot < spec.dots; dot += 1) {
    if (VF.Dot?.buildAndAttach) {
      VF.Dot.buildAndAttach([staveNote], { all: true });
    } else if (typeof staveNote.addDot === 'function') {
      staveNote.addDot(0);
    }
  }
  return staveNote;
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
      staveNote = new VF.StaveNote({ clef: 'treble', keys: ['b/4'], duration: 'qr' });
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
          .addClef('treble')
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
          // A held note spans this chord's beat — nothing to attach to, so
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
      const extraNotes = Math.max(0, bar.notes.length - 4);
      const reserve = index === 0 ? 100 + extraNotes * 8 : 50 - Math.min(20, extraNotes * 5);
      new Formatter().joinVoices([voice]).format([voice], Math.max(120, staveWidth - reserve));
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

  const shape = document.getElementById('shape').value;
  if (!shape) {
    alert('Please select a chord shape.');
    return;
  }

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
  debugLog('cagedShape:', cagedShape);

  // Clear previous chords and diagrams
  document.getElementById('fretboard-container').innerHTML = '';

  // Render the scale diagram using Fretboard.js
  renderScaleDiagram(cagedShape);

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

function sanitizeFilePart(value) {
  return value
    .toString()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_]+/g, '')
    .toLowerCase();
}

function buildExportFileName(extension) {
  const mode = getSelectedExerciseMode();
  let parts = ['arpeggio-flow'];
  if (mode === EXERCISE_MODES.SONG) {
    const song = getSelectedSong();
    parts = parts.concat([
      sanitizeFilePart(song?.id || 'song'),
      sanitizeFilePart(song?.title || ''),
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
      sanitizeFilePart(bars),
    ]);
  }
  const shape = document.getElementById('shape')?.value || '';
  if (shape) {
    parts.push(sanitizeFilePart(shape));
  }
  parts = parts.filter(Boolean);
  return `${parts.join('-')}.${extension}`;
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
          'Nothing pinned yet — open History and star the exercises you want in the cycle.',
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

    document.getElementById('generateButton').addEventListener('click', () => {
      regenerateExercise();
    });

    window.addEventListener('resize', repositionFretboardBoxLabel);

    // Any tap re-arms audio if the browser suspended it (see the function).
    document.addEventListener('pointerdown', resumeAudioContextIfSuspended, true);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) resumeAudioContextIfSuspended();
    });

    // Remember the form as it is left. The inline window.onload handler in the
    // page rebuilds the shape list, so the restore waits for 'load' to run
    // after it — otherwise the restored shape is overwritten.
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


