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

// Export for Node.js/Jest testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseMelodyString, parseMelodyToken, barBeats, melodyTotalBeats };
}

// Export to window for browser usage
if (typeof window !== 'undefined') {
  window.melodyParser = { parseMelodyString, parseMelodyToken, barBeats, melodyTotalBeats };
}
