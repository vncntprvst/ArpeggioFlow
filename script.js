function generateExercise() {
  const key = document.getElementById('key').value;
  const progression = document.getElementById('progression').value;
  const shape = document.getElementById('shape').value;

  // Validate selections
  if (!key || !progression || !shape) {
    alert('Please select a key, progression, and chord shape.');
    return;
  }

  // Clear previous notation
  document.getElementById('notation').innerHTML = '';

  // Initialize VexFlow Renderer
  const VF = Vex.Flow;
  const div = document.getElementById('notation');
  const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);

  // Configure the rendering context
  renderer.resize(600, 200);
  const context = renderer.getContext();
  const stave = new VF.Stave(10, 40, 580);
  stave.addClef('treble').addTimeSignature('4/4');
  stave.setContext(context).draw();

  // Parse the progression
  const chordsInProgression = progression.replace(/\s/g, '').split('-'); // e.g., ['ii', 'V', 'I']
  let notes = [];

  chordsInProgression.forEach(function(chordSymbol) {
    // Map chord numerals to scale degrees
    const scaleDegrees = {
      'I': '1M',
      'ii': '2m',
      'iii': '3m',
      'IV': '4M',
      'V': '5M',
      'vi': '6m',
      'vii°': '7dim'
    };

    const degree = scaleDegrees[chordSymbol];

    if (!degree) {
      alert(`Unknown chord symbol: ${chordSymbol}`);
      return;
    }

    // Get the chord in the key
    const chordName = Tonal.Scale.degrees(Tonal.Scale.get(`${key} major`), [parseInt(degree)]);

    // Get chord notes
    const chordNotes = Tonal.Chord.getChord(degree, key).notes;

    // Select random notes from the chordNotes array
    chordNotes.forEach(note => {
      // Adjust octave if necessary
      notes.push(new VF.StaveNote({
        clef: 'treble',
        keys: [`${note}/4`],
        duration: 'q'
      }));
    });
  });

  // Create a voice in 4/4 and add notes
  const voice = new VF.Voice({ num_beats: notes.length, beat_value: 4 });
  voice.addTickables(notes);

  // Format and justify the notes
  const formatter = new VF.Formatter().joinVoices([voice]).format([voice], 500);

  // Render voice
  voice.draw(context, stave);
}
