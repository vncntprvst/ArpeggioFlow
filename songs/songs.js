import './progressionParser.js';

const { parseProgressionString } = window.progressionParser;

/**
 * Define a song from an iReal Pro-style progression string.
 * Bars are separated by '|', chords within a bar by spaces, '%' repeats
 * the previous bar. See progressionParser.js.
 */
function defineSong({ progression, ...song }) {
  return { ...song, progressionBars: parseProgressionString(progression) };
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
