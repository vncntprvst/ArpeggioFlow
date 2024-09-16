function generateExercise() {
  const key = document.getElementById('key').value;
  const progression = document.getElementById('progression').value;
  const bars = parseInt(document.getElementById('bars').value);
  const shape = document.getElementById('shape').value;

  // Validate selections
  if (!key || !progression || !bars || !shape) {
    alert('Please select a key, progression, number of bars, and chord shape.');
    return;
  }

  // Clear previous notation
  document.getElementById('notation').innerHTML = '';

  // Initialize VexFlow Renderer
  const VF = Vex.Flow;
  const div = document.getElementById('notation');
  const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);

  // Configure the rendering context
  renderer.resize(700, 200);
  const context = renderer.getContext();
  const stave = new VF.Stave(10, 40, 680);
  stave.addClef('treble').addTimeSignature('4/4');
  stave.setContext(context).draw();

  // Parse the progression and adjust for the number of bars
  let chordsInProgression = progression.replace(/\s/g, '').split('-'); // e.g., ['ii', 'V', 'I']
  let totalChords = chordsInProgression.length;

  // Adjust the progression to fit the number of bars
  let adjustedProgression = [];
  let barCount = 0;

  while (barCount < bars) {
    for (let i = 0; i < totalChords && barCount < bars; i++) {
      adjustedProgression.push(chordsInProgression[i]);

      // Special case: For ii-V-I, repeat the I chord if needed
      if (progression === 'ii-V-I' && barCount === totalChords - 1 && bars > totalChords) {
        adjustedProgression.push(chordsInProgression[totalChords - 1]); // Repeat I chord
        barCount++;
      }

      barCount++;
    }
  }

  let notes = [];

  adjustedProgression.forEach(function(chordSymbol) {
    // Map chord numerals to scale degrees and qualities
    const chordMap = {
      'I': { degree: 1, quality: 'maj7' },
      'ii': { degree: 2, quality: 'm7' },
      'iii': { degree: 3, quality: 'm7' },
      'IV': { degree: 4, quality: 'maj7' },
      'V': { degree: 5, quality: '7' },
      'vi': { degree: 6, quality: 'm7' },
      'vii°': { degree: 7, quality: 'm7b5' }
    };

    const chordInfo = chordMap[chordSymbol];

    if (!chordInfo) {
      alert(`Unknown chord symbol: ${chordSymbol}`);
      return;
    }

    // Get the chord root note
    const scale = Tonal.Scale.get(`${key} major`).notes;
    const rootNote = scale[chordInfo.degree - 1];

    // Get chord notes using Tonal.js
    const chordName = `${rootNote}${chordInfo.quality}`;
    const chordNotes = Tonal.Chord.get(chordName).notes;

    // Generate random notes from the chord notes
    chordNotes.forEach(note => {
      // Adjust octave to fit within a reasonable range
      const octaveAdjustedNote = `${note}4`; // You might want to adjust octaves based on the note
      notes.push(new VF.StaveNote({
        clef: 'treble',
        keys: [octaveAdjustedNote],
        duration: 'q'
      }));
    });
  });

  // Create a voice and add notes
  const voice = new VF.Voice({ num_beats: bars * 4, beat_value: 4 });
  voice.addTickables(notes);

  // Format and justify the notes
  const formatter = new VF.Formatter().joinVoices([voice]).format([voice], 650);

  // Render voice
  voice.draw(context, stave);
}
