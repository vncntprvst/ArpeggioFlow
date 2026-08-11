* Is there any point in using https://github.com/tombatossals/chords-db for chords?
* Add repeat signs and 1st/2nd endings in VexFlow is feasible, but wiring playback to honor them is tricky.
* Add option to display small chords diagrams over each chord name
* Use Parcel free hosting to host the app.
* Port to React + TypeScript?
* Create licks by selecting less or more notes for each measure, with sustained or silent notes. 
* Add more songs
* Song melodies, pass 2 (pass 1 done: "Play the head first" intro plays the
  chart comped once, with the melody stacked on top when the song has a
  `melody` field — Stardust ships one, transcribed from the public-domain
  1929 edition; the other standards' melodies are still copyrighted and stay
  out of the repo). Remaining:
    - melody editor in the Songs panel: textarea in the melodyParser format,
      live VexFlow preview, saved to localStorage per song id so user-entered
      melodies stay on the user's machine;
    - ride melodies along in the .json exercise export/import;
    - maybe later: MusicXML/MIDI import feeding the same format.
