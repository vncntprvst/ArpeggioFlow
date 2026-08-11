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
