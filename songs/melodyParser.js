/**
 * melodyParser.js
 *
 * Parse a compact melody string into bars of timed note events.
 * Bars are separated by '|'; inside a bar each token is either
 *   Pitch[:beats]  e.g. "G4", "E4:2", "F#4:0.5"  (default 1 beat)
 *   ~[:beats]      a rest
 *   %              repeat the previous bar
 * Durations are in beats (decimals allowed: 0.5 = eighth, 1.5 = dotted
 * quarter). In 4/4 a bar's durations should sum to 4 — the parser does not
 * enforce it, but exposes barBeats() so callers/editors can validate.
 *
 * Example:
 *   '| G4:2 E4 F#4:0.5 G4:0.5 | A4:3 ~ | % |'
 *   → [ [{note:'G4',beats:2},{note:'E4',beats:1},{note:'F#4',beats:0.5},{note:'G4',beats:0.5}],
 *       [{note:'A4',beats:3},{note:null,beats:1}],
 *       (repeat of bar 2) ]
 *
 * Same dual-export pattern as progressionParser.js (browser + Jest).
 */

const MELODY_NOTE_RE = /^([A-Ga-g](?:#|b)?-?\d)(?::(\d+(?:\.\d+)?))?$/;
const MELODY_REST_RE = /^~(?::(\d+(?:\.\d+)?))?$/;

function parseMelodyToken(token) {
  const rest = token.match(MELODY_REST_RE);
  if (rest) {
    return { note: null, beats: rest[1] ? parseFloat(rest[1]) : 1 };
  }
  const note = token.match(MELODY_NOTE_RE);
  if (note) {
    const pitch = note[1].charAt(0).toUpperCase() + note[1].slice(1);
    return { note: pitch, beats: note[2] ? parseFloat(note[2]) : 1 };
  }
  return null; // unrecognized token: skipped (callers may warn)
}

function parseMelodyString(melody) {
  if (typeof melody !== 'string') {
    return [];
  }
  const bars = [];
  melody
    .split('|')
    .map((bar) => bar.trim())
    .filter((bar) => bar.length > 0)
    .forEach((bar) => {
      if (bar === '%') {
        const previous = bars.length ? bars[bars.length - 1] : [];
        bars.push(previous.map((event) => ({ ...event })));
        return;
      }
      const events = bar
        .split(/[\s,]+/)
        .filter(Boolean)
        .map(parseMelodyToken)
        .filter((event) => event && event.beats > 0);
      bars.push(events);
    });
  return bars;
}

/** Total beats in one parsed bar (for 4/4 validation: should be 4). */
function barBeats(events) {
  return (events || []).reduce((sum, event) => sum + (event.beats || 0), 0);
}

/** Total beats across all parsed bars. */
function melodyTotalBeats(bars) {
  return (bars || []).reduce((sum, events) => sum + barBeats(events), 0);
}

/**
 * Flatten parsed bars into one absolute timeline. Merged-duration ties (a
 * "bar" carrying more than 4 beats) simply become long events, so bar
 * boundaries in the source text stop mattering here.
 */
function melodyToTimeline(bars) {
  const events = [];
  let start = 0;
  (bars || []).forEach((barEvents) => {
    (barEvents || []).forEach(({ note, beats }) => {
      if (!(beats > 0)) return;
      events.push({ note: note || null, start, beats });
      start += beats;
    });
  });
  return events;
}

/**
 * Re-slice a timeline into fixed-length bars for notation. Events that cross
 * a barline are split into fragments carrying tieFrom/tieTo flags (rests
 * split silently — rests never tie).
 */
function sliceTimelineIntoBars(events, barCount, beatsPerBar = 4) {
  const bars = Array.from({ length: barCount }, () => []);
  (events || []).forEach(({ note, start, beats }) => {
    let remaining = beats;
    let position = start;
    let first = true;
    while (remaining > 1e-9) {
      const barIndex = Math.floor(position / beatsPerBar + 1e-9);
      if (barIndex >= barCount) break; // spills past the form: dropped
      const barEnd = (barIndex + 1) * beatsPerBar;
      const chunk = Math.min(remaining, barEnd - position);
      const last = remaining - chunk <= 1e-9;
      bars[barIndex].push({
        note,
        beats: chunk,
        startBeat: position - barIndex * beatsPerBar,
        tieFrom: Boolean(note) && !first,
        tieTo: Boolean(note) && !last,
      });
      position += chunk;
      remaining -= chunk;
      first = false;
    }
  });
  // Pad each bar to its full length with a trailing rest
  bars.forEach((barEvents, barIndex) => {
    const used = barEvents.reduce((sum, event) => sum + event.beats, 0);
    if (used < beatsPerBar - 1e-9) {
      barEvents.push({
        note: null,
        beats: beatsPerBar - used,
        startBeat: used,
        tieFrom: false,
        tieTo: false,
      });
    }
  });
  return bars;
}

/**
 * Break a fragment length into engravable values (whole to eighth, dotted
 * included), longest first: 2.5 → [2, 0.5], 3.5 → [3, 0.5]. Values map to
 * VexFlow as 4=w, 3=hd, 2=h, 1.5=qd, 1=q, 0.5=8.
 */
const ENGRAVABLE_BEATS = [4, 3, 2, 1.5, 1, 0.5];

function decomposeBeats(beats) {
  const parts = [];
  let remaining = beats;
  while (remaining > 1e-9) {
    const value = ENGRAVABLE_BEATS.find((candidate) => candidate <= remaining + 1e-9);
    if (!value) break; // below eighth resolution: dropped
    parts.push(value);
    remaining -= value;
  }
  return parts;
}

// Export for Node.js/Jest testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseMelodyString,
    parseMelodyToken,
    barBeats,
    melodyTotalBeats,
    melodyToTimeline,
    sliceTimelineIntoBars,
    decomposeBeats,
  };
}

// Export to window for browser usage
if (typeof window !== 'undefined') {
  window.melodyParser = {
    parseMelodyString,
    parseMelodyToken,
    barBeats,
    melodyTotalBeats,
    melodyToTimeline,
    sliceTimelineIntoBars,
    decomposeBeats,
  };
}
