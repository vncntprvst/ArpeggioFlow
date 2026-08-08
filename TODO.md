* Is there any point in using https://github.com/tombatossals/chords-db for chords?
* Add repeat signs and 1st/2nd endings in VexFlow is feasible, but wiring playback to honor them is tricky.
* Add option to display small chords diagrams over each chord name
* Use Parcel free hosting to host the app.
* Port to React + TypeScript?
* Create licks by selecting less or more notes for each measure, with sustained or silent notes. 
* Add more songs
* Song melodies (revisit): play the head once before the exercise, and/or as a
  backing track. Blocked on data, not on code — `songs/songs.js` holds chord
  charts only, and the melodies of the standards currently listed (Misty,
  Stardust, Autumn Leaves…) are still under copyright, unlike their changes.
  Options when we pick this up:
    - public-domain or original heads only, shipped in the repo;
    - a `melody` field per song (note + duration per bar), filled by hand;
    - a runtime MusicXML/MIDI import so melodies stay on the user's machine.
  Playback side is small: melody → the same Strudel note pattern the exercise
  uses, either played once as an intro or stacked as a layer. See
  `buildBackingChordsPattern()` in flow.js for the layer shape to copy, and the
  SONG_MELODY placeholder next to it.
