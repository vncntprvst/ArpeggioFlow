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
};

// Stores the last generated exercise state for use in the scale-degrees modal
let lastExerciseState = null; // { cagedShape, measureData, keyLabel }

const playbackUi = {
  banner: null,
  playButton: null,
  stopButton: null,
};

let strudelApi = null;
let strudelInitPromise = null;
// Playback goes through one long-lived wrapper pattern that delegates its
// queries to strudelPatternRef; continuous shift swaps the ref without ever
// stopping the scheduler clock (a stop/start seam re-emits boundary notes).
let strudelPatternRef = null;
let strudelWrapperActive = false;

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
// 'hh' is one hit on the beat, '[hh hh]' two eighths, '~' a rest.
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
    layers: [
      (beat) => (beat % 2 === 0 ? 'rd' : '[rd@2 rd]'),
      (beat) => (beat % 2 === 1 ? 'hh' : '~'),
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

const GM_SOUNDFONT_FONTS = {
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
    dotEl.querySelectorAll('.dot-ring, .dot-degree-label').forEach((r) => r.remove());
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

    dotEl.querySelectorAll('.dot-ring, .dot-degree-label').forEach((r) => r.remove());

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
 * During per-note playback: light up the dots matching the sounding pitch
 * (every position with that pitch) and fade the rest. Context dots kept
 * faintly visible are the current chord's arpeggio tones ('note-arpeggio')
 * or the whole scale shape ('note-scale').
 */
function updateFretboardForNote(segment, note, mode) {
  const fretboardDiv = document.getElementById('fretboard-container');
  if (!fretboardDiv || !segment) return;
  const targetMidi = Tonal.Note.midi(note);
  const chordChromas = getChordToneChromas(segment.rootNote, segment.quality);

  fretboardDiv.querySelectorAll('.dot').forEach((dotEl) => {
    const data = dotEl.__data__;
    if (!data || !data.inBox) return;
    const dotCircle = dotEl.querySelector('.dot-circle');
    if (!dotCircle) return;
    dotEl.querySelectorAll('.dot-ring, .dot-degree-label').forEach((r) => r.remove());

    const stringIndex = tuning.length - data.string;
    const openMidi = Tonal.Note.midi(tuning[stringIndex]);
    const dotMidi = Number.isFinite(openMidi) ? openMidi + data.fret : null;

    if (dotMidi !== null && dotMidi === targetMidi) {
      dotEl.style.opacity = '1';
      dotCircle.style.setProperty('fill', FRETBOARD_COLOR_PLAYING, 'important');
      addPlayedNotesRing(dotEl, dotCircle);
      return;
    }

    const isChordTone = chordChromas.has(Tonal.Note.chroma(data.note));
    const keepFaint = mode === 'note-scale' || isChordTone;
    dotEl.style.opacity = keepFaint ? '0.35' : '0.08';
    dotCircle.style.removeProperty('fill');
  });
}

function resetFretboardHighlight() {
  const fretboardDiv = document.getElementById('fretboard-container');
  if (!fretboardDiv) return;
  applyScaleDegreeColoring(fretboardDiv);
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
  return steps;
}

function applyVisualStep(step, mode) {
  if (!isVisualPlaybackEnabled() || !step) return;
  moveHighlightToMeasure(step.segment.barIndex ?? 0);
  if (step.note !== undefined) {
    updateFretboardForNote(step.segment, step.note, mode);
  } else {
    updateFretboardForChord(step.segment);
  }
  updateArpeggioDiagramHighlight(step.segment.chordName);
}

function startVisualPlayback() {
  const mode = getSelectedHighlightMode();
  const steps = buildVisualSteps(mode);
  if (!steps.length) return;
  const bpm = getSelectedTempoBpm();
  const msPerBeat = 60000 / bpm;

  visualPlaybackIndex = 0;
  applyVisualStep(steps[0], mode);

  // Each step lasts its own beat count (a chord segment in chord mode, a
  // single note in the note modes). Drift-corrected against a running
  // absolute deadline.
  let nextTime = performance.now();
  const scheduleNext = () => {
    const step = steps[visualPlaybackIndex];
    nextTime += (step?.beats || 4) * msPerBeat;
    visualPlaybackTimerId = setTimeout(() => {
      visualPlaybackIndex = (visualPlaybackIndex + 1) % steps.length;
      applyVisualStep(steps[visualPlaybackIndex], mode);
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
  if (playbackUi.playButton) playbackUi.playButton.textContent = 'Play';
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
  const totalBeats = playbackState.measuresData.reduce(
    (sum, segment) => sum + (segment.beats || 4),
    0
  );
  return totalBeats * (60000 / getSelectedTempoBpm());
}

// Advance a select to a nearby option (wrapping; skips empty placeholders)
function advanceSelect(selectId, delta) {
  const select = document.getElementById(selectId);
  if (!select) return false;
  const values = [...select.options].map((o) => o.value).filter((v) => v);
  const idx = values.indexOf(select.value);
  if (idx === -1) return false;
  select.value = values[(idx + delta + values.length) % values.length];
  select.dispatchEvent(new Event('change'));
  return true;
}

function applyContinuousShift(mode) {
  if (mode in CONTINUOUS_SHIFT_KEY_DELTAS) {
    if (getSelectedExerciseMode() === EXERCISE_MODES.SONG) {
      debugLog('Continuous key shift is not available in song mode.');
      return false;
    }
    return advanceSelect('key', CONTINUOUS_SHIFT_KEY_DELTAS[mode]);
  }
  if (mode === 'shape-up') return advanceSelect('shape', 1);
  if (mode === 'shape-down') return advanceSelect('shape', -1);
  return false;
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
  if (!playbackState.isPlaying) return;
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
  if (mode === 'off' || !applyContinuousShift(mode)) {
    scheduleContinuousShift();
    return;
  }
  regenerateExercise({ carryOver: getCarryOverFromLastExercise() });
  // Swap the audio pattern NOW, before the scheduler queries the boundary
  // chunk: the delegating wrapper keeps playing without any clock restart,
  // and the swap only affects queries from here on — the old loop's tail is
  // already scheduled, the new loop's first note comes from the new pattern.
  if (isAudioPlaybackEnabled() && playbackState.engine === 'strudel') {
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
  if (isVisualPlaybackEnabled()) {
    startVisualPlayback();
  }
  scheduleContinuousShift();
}

// ─────────────────────────────────────────────────────────────────────────────

function updatePlaybackControls() {
  if (!playbackUi.playButton || !playbackUi.stopButton) {
    return;
  }
  const hasExercise = playbackState.measuresData.length > 0;
  const canPlay =
    hasExercise &&
    (isVisualPlaybackEnabled() ||
      (playbackState.engine === 'strudel' && playbackState.notes.length > 0));
  playbackUi.playButton.disabled = !canPlay;
  playbackUi.stopButton.disabled = !hasExercise;
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
  if (playbackState.engine === 'strudel') {
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
    return meta;
  }
  for (let index = 0; index < beatCount; index += 1) {
    meta.push({ beat: index % BEATS_PER_CYCLE, beats: BEATS_PER_CYCLE });
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
  for (const tokenFor of config.layers) {
    const text = beatMeta.map(({ beat, beats }) => tokenFor(beat, beats) || '~').join(' ');
    const layer = soundFn.fn(text);
    if (!layer || typeof layer.slow !== 'function') {
      setPlaybackBanner('This Strudel build cannot play drums; rhythm is off.', 'warning');
      return null;
    }
    layers.push(layer.slow(measures));
  }
  const pattern = layers.reduce((combined, layer) => stackPatterns(api, combined, layer));
  return typeof pattern.gain === 'function'
    ? pattern.gain(config.gain ?? DEFAULT_RHYTHM_GAIN)
    : pattern;
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
  const measures = getMeasures(beatSlots.length);
  const beatMeta = getBeatMeta(beatSlots.length);
  let pattern = soundConfig.type === 'none' ? null : api.note(patternText).slow(measures);
  if (soundConfig.type === 'none') {
    // "None (rhythm only)": the backing rhythm below is the whole pattern.
  } else if (soundConfig.type === 'dirt') {
    const loaded = await ensureGuitarSamplesLoaded(api);
    if (loaded && typeof pattern.s === 'function') {
      pattern = pattern.s(soundConfig.sample);
    } else {
      setPlaybackBanner('Guitar samples failed to load. Using default synth.', 'warning');
    }
  } else if (soundConfig.type === 'sample-map') {
    const loaded = await ensureGuitarVariantSamplesLoaded(api);
    if (loaded && typeof pattern.s === 'function') {
      pattern = pattern.s(soundConfig.sample);
    } else {
      setPlaybackBanner('Guitar samples failed to load. Using default synth.', 'warning');
    }
  } else if (soundConfig.type === 'soundfont') {
    const loaded = await ensureSoundfontsLoaded(api);
    if (loaded && typeof pattern.s === 'function') {
      pattern = pattern.s(soundConfig.sample);
    } else {
      setPlaybackBanner('Soundfont guitars failed to load. Using default synth.', 'warning');
    }
  } else if (sound !== 'default' && typeof pattern.s === 'function') {
    pattern = pattern.s(sound);
  }

  // The backing rhythm rides on the same beat grid as the notes, so stacking
  // it here keeps one pattern for the scheduler (and one loop length for the
  // in-place swap that continuous shift relies on).
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

  strudelPatternRef = pattern;
  const PatternClass = getStrudelPatternClass(api);
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
  setPlaybackBanner(`Playing via Strudel at ${bpm} BPM (${describePlaybackVoices()}).`, 'info');
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

function updateBarsForProgression(progressionValue) {
  const barsInput = document.getElementById('bars');
  if (!barsInput) {
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
  const progressionLabel =
    progressionSelect?.selectedOptions?.[0]?.textContent ||
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

  // Set a stable size before Fretboard rendering
  scaleDiagram.style.width = '100%';
  scaleDiagram.style.maxWidth = '900px';
  scaleDiagram.style.minWidth = '320px';
  scaleDiagram.style.height = '200px';
  scaleDiagram.style.minHeight = '200px';
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

  // Show the "View all scale arpeggios" button header
  const arpeggioHeader = document.getElementById('arpeggio-diagrams-header');
  if (arpeggioHeader) arpeggioHeader.style.display = '';
}

// Selected "start each chord on" option: null for free flow, or 1/3/5/7
function getSelectedStartDegree() {
  const select = document.getElementById('startDegree');
  if (!select || select.value === 'flow') {
    return null;
  }
  const degree = parseInt(select.value, 10);
  return Number.isFinite(degree) ? degree : null;
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

function generateExercise(options = {}) {
  const mode = options.mode || EXERCISE_MODES.RANDOM;
  const shape = document.getElementById('shape').value;
  const song = options.song || null;
  const isSongMode = mode === EXERCISE_MODES.SONG;
  let key = '';
  let chordBars = []; // one entry per rendered bar: 1+ chord symbols

  if (!shape) {
    alert('Please select a chord shape.');
    return;
  }

  if (isSongMode) {
    if (!song) {
      alert('Please select a song.');
      return;
    }
    key = song.scaleType === 'minor' ? `${song.key}m` : song.key;
    const songBars = normalizeSongBars(song.progressionBars);
    // True chorus length: chords keep the bar they share in the chart.
    // Otherwise every chord is stretched to its own full bar.
    chordBars = isTrueChorusLengthEnabled()
      ? songBars
      : songBars.flat().map((chord) => [chord]);
  } else {
    key = getSelectedKeyValue();
    const progression = document.getElementById('progression').value;
    const bars = parseInt(document.getElementById('bars').value);

    if (!key || !progression || !bars) {
      alert('Please select a key, progression, and number of bars.');
      return;
    }

    const chordsInProgression = progression.replace(/\s/g, '').split('-');
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
    alert('No chords found for the selected exercise.');
    return;
  }

  const exerciseContext = prepareExerciseContext(key, shape);
  if (!exerciseContext) {
    return;
  }
  const { keyContext, cagedShape, scaleMidiSet } = exerciseContext;

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

  const chordResolver = isSongMode
    ? (chordSymbol) =>
        getChordNotesForSongSymbol(chordSymbol, scaleMidiSet, true)
    : (chordSymbol) =>
        getChordNotesForRomanSymbol(
          chordSymbol,
          keyContext,
          scaleMidiSet,
          true
        );

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
  const midMeasureTurnaround = isMidMeasureTurnaroundEnabled();

  // Generate all measures forward from the first. Each measure starts on the
  // closest chord tone in the current direction (or on the requested chord
  // degree in chord-tone start mode); direction reverses only at the range
  // boundaries (plus mid-measure when that turnaround option is on).
  // A carry-over (continuous shift) voice-leads from the previous exercise's
  // last note instead of starting on a random one.
  let prevNote = options.carryOver?.prevNote || null;
  let prevDirection = options.carryOver?.prevDirection ?? true;
  measureData.forEach((measure) => {
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

  const staveHeight = 170;
  const topPadding = 60;
  const bottomPadding = 30;
  const height =
    topPadding + lineLayouts.length * staveHeight + bottomPadding;

  const renderer = new Renderer(div, Renderer.Backends.SVG);
  renderer.resize(width, height);
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
  });
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
    const progression =
      document.getElementById('progression')?.value || 'progression';
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
    playbackUi.playButton = document.getElementById('playbackPlayButton');
    playbackUi.stopButton = playbackUi.playButton; // same element
    playbackState.engine = getSelectedPlaybackEngine();
    updatePlaybackControls();

    document.getElementById('progression').addEventListener('change', (event) => {
      updateBarsForProgression(event.target.value);
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
    const rhythmSelect = document.getElementById('rhythmSound');
    if (rhythmSelect) {
      rhythmSelect.addEventListener('change', () => {
        if (playbackState.engine !== 'strudel') {
          return;
        }
        refreshPlaybackBanner();
      });
    }

    if (playbackUi.playButton) {
      playbackUi.playButton.addEventListener('click', async () => {
        if (playbackState.isPlaying) {
          // Stop
          clearContinuousShiftTimer();
          stopVisualPlayback();
          if (playbackState.engine === 'strudel') {
            await stopStrudelExercise();
          }
          playbackState.isPlaying = false;
          playbackUi.playButton.textContent = 'Play';
        } else {
          // Play
          stopVisualPlayback();
          // Start audio first (loading Strudel and soundfonts can take a
          // while), then the visual clock right after the pattern starts,
          // so the highlight and the sound share the same t0.
          if (isAudioPlaybackEnabled() && playbackState.engine === 'strudel') {
            await playStrudelExercise(playbackState.notes);
          }
          if (isVisualPlaybackEnabled()) {
            startVisualPlayback();
          }
          playbackState.isPlaying = true;
          playbackUi.playButton.textContent = 'Stop';
          scheduleContinuousShift();
        }
      });
    }

    document.getElementById('generateButton').addEventListener('click', () => {
      regenerateExercise();
    });

    const exportPngButton = document.getElementById('exportPngButton');
    if (exportPngButton) {
      exportPngButton.addEventListener('click', () => {
        exportExerciseAsPng();
      });
    }

    const exportPdfButton = document.getElementById('exportPdfButton');
    if (exportPdfButton) {
      exportPdfButton.addEventListener('click', () => {
        exportExerciseAsPdf();
      });
    }

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


