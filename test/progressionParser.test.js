/**
 * progressionParser.test.js
 *
 * Unit tests for the iReal Pro-style progression string parser.
 */

const { parseProgressionString } = require('../songs/progressionParser.js');

describe('parseProgressionString', () => {
  test('parses simple single-chord bars', () => {
    expect(parseProgressionString('| Am7 | D7 | Gmaj7 |')).toEqual([
      ['Am7'],
      ['D7'],
      ['Gmaj7'],
    ]);
  });

  test('parses two chords in a bar', () => {
    expect(parseProgressionString('| Em7 A7 | Dm7 G7 |')).toEqual([
      ['Em7', 'A7'],
      ['Dm7', 'G7'],
    ]);
  });

  test('supports % as repeat of previous bar', () => {
    expect(parseProgressionString('| Em6 | % | % |')).toEqual([
      ['Em6'],
      ['Em6'],
      ['Em6'],
    ]);
  });

  test('% repeats a two-chord bar by value (not reference)', () => {
    const bars = parseProgressionString('| Em7 A7 | % |');
    expect(bars).toEqual([
      ['Em7', 'A7'],
      ['Em7', 'A7'],
    ]);
    expect(bars[0]).not.toBe(bars[1]);
  });

  test('handles multi-line charts', () => {
    const chart = `
      | Am7 | D7 |
      | Gmaj7 | Cmaj7 |
    `;
    expect(parseProgressionString(chart)).toEqual([
      ['Am7'],
      ['D7'],
      ['Gmaj7'],
      ['Cmaj7'],
    ]);
  });

  test('tolerates missing leading/trailing pipes and commas', () => {
    expect(parseProgressionString('Am7 | D7, G7')).toEqual([
      ['Am7'],
      ['D7', 'G7'],
    ]);
  });

  test('returns empty array for non-string or empty input', () => {
    expect(parseProgressionString(null)).toEqual([]);
    expect(parseProgressionString(undefined)).toEqual([]);
    expect(parseProgressionString('')).toEqual([]);
    expect(parseProgressionString('   ')).toEqual([]);
  });

  test('leading % with no previous bar yields empty bar', () => {
    expect(parseProgressionString('| % | Am7 |')).toEqual([[], ['Am7']]);
  });
});
