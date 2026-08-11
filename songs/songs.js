import './progressionParser.js';
import './melodyParser.js';

const { parseProgressionString } = window.progressionParser;
const { parseMelodyString } = window.melodyParser;

/**
 * Define a song from an iReal Pro-style progression string.
 * Bars are separated by '|', chords within a bar by spaces, '%' repeats
 * the previous bar. See progressionParser.js.
 *
 * An optional `melody` string (see melodyParser.js: `Pitch:beats` tokens,
 * `~` rests, one 4-beat bar between '|') becomes `melodyBars` — the head
 * played once before the exercise when "Play the head first" is on. Only
 * public-domain melodies belong in this file; users can supply the rest
 * locally (planned melody editor).
 */
function defineSong({ progression, melody, ...song }) {
  return {
    ...song,
    progressionBars: parseProgressionString(progression),
    melodyBars: melody ? parseMelodyString(melody) : null,
  };
}

const AUTUMN_LEAVES = defineSong({
  id: 'autumn-leaves',
  title: 'Autumn Leaves',
  key: 'G',
  scaleType: 'major',
  tempoBpm: 80,
  progression: `
    | Am7    | D7   | Gmaj7  | Cmaj7  |
    | F#m7b5 | B7b9 | Em6    | %      |
    | Am7    | D7   | Gmaj7  | Cmaj7  |
    | F#m7b5 | B7b9 | Em6    | %      |
    | F#m7b5 | B7b9 | Em6    | %      |
    | Am7    | D7   | Gmaj7  | %      |
    | F#m7b5 | B7b9 | Em7 A7 | Dm7 G7 |
    | F#m7b5 | B7b9 | Em6    | %      |
  `,
});

// Charts below follow the common iReal Pro / Real Book changes, with
// alterations simplified to the qualities the generator supports
// (maj7, 6, m7, m6, 7, m7b5, dim7, 7b9). Last bar of a chorus is kept as
// a turnaround where the standard chart has one.

const MISTY = defineSong({
  id: 'misty',
  title: 'Misty',
  key: 'Eb',
  scaleType: 'major',
  tempoBpm: 65,
  // AABA, 32 bars
  progression: `
    | Ebmaj7     | Bbm7 Eb7 | Abmaj7      | Abm7 Db7 |
    | Ebmaj7 Cm7 | Fm7 Bb7  | Gm7 C7      | Fm7 Bb7  |
    | Ebmaj7     | Bbm7 Eb7 | Abmaj7      | Abm7 Db7 |
    | Ebmaj7 Cm7 | Fm7 Bb7  | Eb6         | %        |
    | Bbm7       | Eb7b9    | Abmaj7      | %        |
    | Am7        | D7 F7    | Gm7b5 C7b9  | Fm7 Bb7  |
    | Ebmaj7     | Bbm7 Eb7 | Abmaj7      | Abm7 Db7 |
    | Ebmaj7 Cm7 | Fm7 Bb7  | Eb6         | Fm7 Bb7  |
  `,
});

const STORMY_WEATHER = defineSong({
  id: 'stormy-weather',
  title: 'Stormy Weather',
  key: 'G',
  scaleType: 'major',
  tempoBpm: 75,
  // AABA with 2-bar extensions on the 2nd and last A (8+10+8+10 = 36 bars)
  progression: `
    | Gmaj7 G#dim7 | Am7 D7 | Gmaj7 G#dim7 | Am7 D7    |
    | G6 G#dim7    | Am7 D7 | G6 E7b9      | Am7 D7    |
    | Gmaj7 G#dim7 | Am7 D7 | Gmaj7 G#dim7 | Am7 D7    |
    | G6 G#dim7    | Am7 D7 | G6 C7        | Bm7 G#dim7 |
    | Am7 D7       | G6 G7  |
    | C6 C#dim7    | G6 G7  | C6 C#dim7    | G6 G7     |
    | C6 C#dim7    | G6 E7  | G6 Em7       | A7 D7     |
    | Gmaj7 G#dim7 | Am7 D7 | Gmaj7 G#dim7 | Am7 D7    |
    | G6 G#dim7    | Am7 D7 | G6 E7b9      | Am7 D7    |
    | G6 E7b9      | Am7 D7 |
  `,
});

const SATIN_DOLL = defineSong({
  id: 'satin-doll',
  title: 'Satin Doll',
  key: 'C',
  scaleType: 'major',
  tempoBpm: 120,
  // AABA, 32 bars
  progression: `
    | Dm7 G7 | %  | Em7 A7   | %         |
    | Am7 D7 | Abm7 Db7 | Cmaj7 F7 | Em7 A7 |
    | Dm7 G7 | %  | Em7 A7   | %         |
    | Am7 D7 | Abm7 Db7 | Cmaj7    | %      |
    | Gm7 C7 | %  | Fmaj7    | %         |
    | Am7 D7 | %  | G7       | %         |
    | Dm7 G7 | %  | Em7 A7   | %         |
    | Am7 D7 | Abm7 Db7 | Cmaj7 F7 | Em7 A7 |
  `,
});

const GONE_WITH_THE_WIND = defineSong({
  id: 'gone-with-the-wind',
  title: 'Gone with the Wind',
  key: 'Eb',
  scaleType: 'major',
  tempoBpm: 140,
  // ABAC, 32 bars
  progression: `
    | Fm7 Bb7   | Ebmaj7 C7 | Fm7 Bb7 | Ebmaj7     |
    | Am7 D7    | G6 E7     | Am7 D7  | Gmaj7      |
    | Gm7       | F#dim7    | Fm7     | Bb7        |
    | Ebmaj7 D7 | Db7 C7b9  | Fm7     | Bb7        |
    | Fm7 Bb7   | Ebmaj7 C7 | Fm7 Bb7 | Ebmaj7     |
    | Am7 D7    | G6 E7     | Am7 D7  | Gmaj7      |
    | Fm7       | Cm7       | Fm7 Bb7 | Gm7b5 C7b9 |
    | Fm7       | Bb7       | Ebmaj7  | Gm7b5 C7   |
  `,
});

const STARDUST = defineSong({
  id: 'stardust',
  title: 'Stardust',
  key: 'C',
  scaleType: 'major',
  tempoBpm: 65,
  // ABAC, 32 bars (chorus only, no verse)
  progression: `
    | Fmaj7     | %       | Fm6     | Fm7 Bb7 |
    | Cmaj7     | Em7 A7  | Dm7 A7  | Dm7     |
    | G7        | Dm7 G7  | Cmaj7 Dm7 | Em7 Am7 |
    | D7        | Am7 D7  | G7 Dm7  | G7 C7   |
    | Fmaj7     | %       | Fm6     | Fm7 Bb7 |
    | Cmaj7     | Em7 A7  | Dm7 A7  | Dm7     |
    | Fm7       | Bb7     | Cmaj7 Am7 | Em7 A7 |
    | Dm7       | G7      | Cmaj7   | Gm7 C7  |
  `,
  // Chorus melody from the 1929 Mills Music first edition (US public domain;
  // scan: archive.org/details/stardust00carm, pages 4-5). Adapted for a
  // single one-chorus pass: the 1.5-beat pickup before bar 1 (B4:0.5 C5:0.5
  // C#5:0.5) is omitted — a one-pass chart has no pickup bar — and cross-bar
  // ties are written as merged durations (bars 11-12, 25-26, 29-30, 31-32),
  // so some "bars" below carry more than 4 beats. Total: 128 beats.
  melody: `
    | D5 C5 A4 F4 | D4 F4 A4 E5 | E5:4 | D5:0.5 C5:0.5 Ab4:0.5 F4:0.5 D4:1.5 D5:0.5 |
    | C5 G4 C5:2 | B4:0.5 E5:0.5 B4:0.5 G4:0.5 E4:2 | ~:0.5 A4:0.5 C5:0.5 A4:0.5 F4:0.5 G4:0.5 E4:0.5 F4:0.5 | D4:2.5 E4:0.5 D4:1 |
    | G4 G4 G4:2 | ~:1 D4:0.5 E4:0.5 G4:0.5 D4:0.5 D#4:0.5 G4:0.5 | E4:2 A4:5 | E5:1 |
    | E5:0.5 D5:0.5 C5:0.5 A4:0.5 E4 F#4 | B4:0.5 D4:0.5 Db4:0.5 C4:0.5 C4:0.5 A4:1 D4:0.5 | G4 G4 A4:0.5 D5:0.5 D4:0.5 A4:0.5 | G4:3 C5:1 |
    | D5 C5 A4 F4 | D4 F4 A4 E5 | E5:4 | D5:0.5 C5:0.5 Ab4:0.5 F4:0.5 D4:1.5 D5:0.5 |
    | C5 G4 C5:2 | B4:0.5 E5:0.5 B4:0.5 G4:0.5 E4:2 | ~:0.5 A4:0.5 C5:0.5 A4:0.5 F4:0.5 G4:0.5 E4:0.5 F4:0.5 | D4:2.5 E4:1 D4:0.5 |
    | G4 F#4 F4:5 | C4:0.5 D4:0.5 | E4 G4 C5 E5 | B4:3 C5:1 |
    | D5:0.5 C5:0.5 A4:0.5 F4:0.5 A4:2.5 | G4:0.5 A4:0.5 F4:0.5 G4:0.5 E4:0.5 F4:0.5 D4:0.5 | C4:8 |
  `,
});

const SONGS = [
  AUTUMN_LEAVES,
  GONE_WITH_THE_WIND,
  MISTY,
  SATIN_DOLL,
  STARDUST,
  STORMY_WEATHER,
];

function getSongById(songId) {
  return SONGS.find((song) => song.id === songId);
}

export { SONGS, getSongById };
