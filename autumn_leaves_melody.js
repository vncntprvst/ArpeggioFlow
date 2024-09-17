export const autumnLeavesData = [
    {
      chords: "Am7",
      chordFretboard: [[1, 0], [2, 1], [3, 0], [4, 2], [5, 0], [6, 'x']],  // Fretboard chart for Am7
      notes: [
        new Vex.Flow.StaveNote({ keys: ["e/4", "g/4", "a/4"], duration: "q" }),
        new Vex.Flow.StaveNote({ keys: ["c/5"], duration: "q" }),
        new Vex.Flow.StaveNote({ keys: ["e/5"], duration: "q" }),
        new Vex.Flow.StaveNote({ keys: ["g/5"], duration: "q" })
      ]
    },
    {
      chords: "D7",
      chordFretboard: [[1, 2], [2, 1], [3, 2], [4, 0], [5, 'x'], [6, 'x']],  // Fretboard chart for D7
      notes: [
        new Vex.Flow.StaveNote({ keys: ["d/4", "f#/4", "a/4"], duration: "q" }),
        new Vex.Flow.StaveNote({ keys: ["c/5"], duration: "q" }),
        new Vex.Flow.StaveNote({ keys: ["e/5"], duration: "q" }),
        new Vex.Flow.StaveNote({ keys: ["f#/5"], duration: "q" })
      ]
    },
    {
      chords: "Gmaj7",
      chordFretboard: [[1, 2], [2, 3], [3, 4], [4, 0], [5, 2], [6, 3]],  // Fretboard chart for Gmaj7
      notes: [
        new Vex.Flow.StaveNote({ keys: ["g/4", "b/4", "d/5"], duration: "q" }),
        new Vex.Flow.StaveNote({ keys: ["e/5"], duration: "q" }),
        new Vex.Flow.StaveNote({ keys: ["g/5"], duration: "q" }),
        new Vex.Flow.StaveNote({ keys: ["b/5"], duration: "q" })
      ]
    },
    {
      chords: "Cmaj7",
      chordFretboard: [[1, 0], [2, 1], [3, 0], [4, 2], [5, 3], [6, 'x']],  // Fretboard chart for Cmaj7
      notes: [
        new Vex.Flow.StaveNote({ keys: ["c/4", "e/4", "g/4"], duration: "q" }),
        new Vex.Flow.StaveNote({ keys: ["d/5"], duration: "q" }),
        new Vex.Flow.StaveNote({ keys: ["f/5"], duration: "q" }),
        new Vex.Flow.StaveNote({ keys: ["a/5"], duration: "q" })
      ]
    }
  ];
  