const AUTUMN_LEAVES = {
  id: 'autumn-leaves',
  title: 'Autumn Leaves',
  key: 'G',
  scaleType: 'major',
  tempoBpm: 80,
  progressionBars: [
    ['Am7'],
    ['D7'],
    ['Gmaj7'],
    ['Cmaj7'],
    ['F#m7b5'],
    ['B7b9'],
    ['Em6'],
    ['Em6'],
    ['Am7'],
    ['D7'],
    ['Gmaj7'],
    ['Cmaj7'],
    ['F#m7b5'],
    ['B7b9'],
    ['Em6'],
    ['Em6'],
    ['F#m7b5'],
    ['B7b9'],
    ['Em6'],
    ['Em6'],
    ['Am7'],
    ['D7'],
    ['Gmaj7'],
    ['Gmaj7'],
    ['F#m7b5'],
    ['B7b9'],
    ['Em7', 'A7'],
    ['Dm7', 'G7'],
    ['F#m7b5'],
    ['B7b9'],
    ['Em6'],
    ['Em6'],
  ],
};

const SONGS = [AUTUMN_LEAVES];

function getSongById(songId) {
  return SONGS.find((song) => song.id === songId);
}

export { SONGS, getSongById };
