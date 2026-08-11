/**
 * melodyParser.test.js
 *
 * Unit tests for the compact melody string parser.
 */

const {
  parseMelodyString,
  parseMelodyToken,
  barBeats,
  melodyTotalBeats,
  melodyToTimeline,
  sliceTimelineIntoBars,
  decomposeBeats,
} = require('../songs/melodyParser.js');

describe('parseMelodyToken', () => {
  test('parses a plain note as one beat', () => {
    expect(parseMelodyToken('G4')).toEqual({ note: 'G4', beats: 1 });
  });

  test('parses accidentals and durations', () => {
    expect(parseMelodyToken('F#4:0.5')).toEqual({ note: 'F#4', beats: 0.5 });
    expect(parseMelodyToken('Bb3:1.5')).toEqual({ note: 'Bb3', beats: 1.5 });
  });

  test('normalizes lowercase pitch letters', () => {
    expect(parseMelodyToken('g4:2')).toEqual({ note: 'G4', beats: 2 });
  });

  test('parses rests with and without duration', () => {
    expect(parseMelodyToken('~')).toEqual({ note: null, beats: 1 });
    expect(parseMelodyToken('~:2.5')).toEqual({ note: null, beats: 2.5 });
  });

  test('rejects garbage tokens', () => {
    expect(parseMelodyToken('H4')).toBeNull();
    expect(parseMelodyToken('G')).toBeNull();
    expect(parseMelodyToken('G4:abc')).toBeNull();
  });
});

describe('parseMelodyString', () => {
  test('parses bars of mixed notes and rests', () => {
    const bars = parseMelodyString('| G4:2 E4 F#4:0.5 G4:0.5 | A4:3 ~ |');
    expect(bars).toHaveLength(2);
    expect(bars[0]).toEqual([
      { note: 'G4', beats: 2 },
      { note: 'E4', beats: 1 },
      { note: 'F#4', beats: 0.5 },
      { note: 'G4', beats: 0.5 },
    ]);
    expect(bars[1]).toEqual([
      { note: 'A4', beats: 3 },
      { note: null, beats: 1 },
    ]);
  });

  test('supports % as repeat of the previous bar (by value)', () => {
    const bars = parseMelodyString('| C4:4 | % |');
    expect(bars).toHaveLength(2);
    expect(bars[1]).toEqual([{ note: 'C4', beats: 4 }]);
    expect(bars[1][0]).not.toBe(bars[0][0]);
  });

  test('handles multi-line strings and skips bad tokens', () => {
    const bars = parseMelodyString(`
      | E4 E4 xx E4 E4 |
      | ~:4 |
    `);
    expect(bars[0]).toHaveLength(4);
    expect(bars[1]).toEqual([{ note: null, beats: 4 }]);
  });

  test('returns empty array for non-string input', () => {
    expect(parseMelodyString(null)).toEqual([]);
    expect(parseMelodyString(undefined)).toEqual([]);
  });
});

describe('beat helpers', () => {
  test('barBeats sums a bar', () => {
    const bars = parseMelodyString('| G4:2 E4 F#4:0.5 G4:0.5 |');
    expect(barBeats(bars[0])).toBe(4);
  });

  test('melodyTotalBeats sums the whole melody', () => {
    const bars = parseMelodyString('| C4:4 | % | D4:2 ~:2 |');
    expect(melodyTotalBeats(bars)).toBe(12);
  });
});

describe('timeline slicing (notation)', () => {
  test('melodyToTimeline flattens bars into absolute starts', () => {
    const bars = parseMelodyString('| C4:2 D4:2 | E4:4 |');
    expect(melodyToTimeline(bars)).toEqual([
      { note: 'C4', start: 0, beats: 2 },
      { note: 'D4', start: 2, beats: 2 },
      { note: 'E4', start: 4, beats: 4 },
    ]);
  });

  test('splits a merged-duration tie at the barline with tie flags', () => {
    // "A4:5" spans bars 1-2 (the merged-tie idiom used in songs.js)
    const bars = parseMelodyString('| E4:2 A4:5 | F4:1 |');
    const sliced = sliceTimelineIntoBars(melodyToTimeline(bars), 2);
    expect(sliced[0]).toEqual([
      { note: 'E4', beats: 2, startBeat: 0, tieFrom: false, tieTo: false },
      { note: 'A4', beats: 2, startBeat: 2, tieFrom: false, tieTo: true },
    ]);
    expect(sliced[1]).toEqual([
      { note: 'A4', beats: 3, startBeat: 0, tieFrom: true, tieTo: false },
      { note: 'F4', beats: 1, startBeat: 3, tieFrom: false, tieTo: false },
    ]);
  });

  test('rests split silently and short melodies pad with rests', () => {
    const bars = parseMelodyString('| C4:2 ~:6 |');
    const sliced = sliceTimelineIntoBars(melodyToTimeline(bars), 3);
    expect(sliced[0][1]).toEqual({ note: null, beats: 2, startBeat: 2, tieFrom: false, tieTo: false });
    expect(sliced[1]).toEqual([{ note: null, beats: 4, startBeat: 0, tieFrom: false, tieTo: false }]);
    // bar 3 has no melody at all: padded to a whole rest
    expect(sliced[2]).toEqual([{ note: null, beats: 4, startBeat: 0, tieFrom: false, tieTo: false }]);
  });

  test('events past the form are dropped', () => {
    const bars = parseMelodyString('| C4:4 | D4:4 |');
    const sliced = sliceTimelineIntoBars(melodyToTimeline(bars), 1);
    expect(sliced).toHaveLength(1);
    expect(sliced[0]).toEqual([
      { note: 'C4', beats: 4, startBeat: 0, tieFrom: false, tieTo: false },
    ]);
  });

  test('decomposeBeats breaks fragments into engravable values', () => {
    expect(decomposeBeats(4)).toEqual([4]);
    expect(decomposeBeats(2.5)).toEqual([2, 0.5]);
    expect(decomposeBeats(3.5)).toEqual([3, 0.5]);
    expect(decomposeBeats(1.5)).toEqual([1.5]);
    expect(decomposeBeats(0.5)).toEqual([0.5]);
  });
});
