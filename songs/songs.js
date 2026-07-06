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

const SONGS = [AUTUMN_LEAVES];

function getSongById(songId) {
  return SONGS.find((song) => song.id === songId);
}

export { SONGS, getSongById };
