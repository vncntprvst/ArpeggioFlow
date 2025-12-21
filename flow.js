/*
 * flow.js
 *
 * Main script for the Arpeggio Flow App (CAGED Chords Exercise Generator).
 *
 * Features:
 *   - Define standard guitar tuning and compute pitch range (minPitch, maxPitch).
 *   - Convert note names for use with VexFlow notation.
 *   - Render fretboard scale diagrams using Fretboard.js and highlight scale boxes.
 *   - Style fretboard dots based on scale degrees and box inclusion.
 *   - Generate musical exercises with proper voice leading across chords and measures.
 *   - Integrate VexFlow (notation), Tonal.js (music theory), and VexChords (chord visuals).
 */

// Purpose: Main script file for the CAGED Chords Exercise Generator.

// Debug flag - set to true for verbose console logging
const DEBUG = true;

function debugLog(...args) {
  if (DEBUG) {
    console.log('[flow]', ...args);
  }
}

// Define the tuning
const tuning = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

// Guitar pitch range - computed lazily to ensure Tonal is loaded
// E2 = MIDI 40, E4 + 24 semitones = E6 = MIDI 88
let minPitch = null;
let maxPitch = null;

function getGuitarPitchRange() {
  if (minPitch === null || maxPitch === null) {
    minPitch = Tonal.Note.midi(tuning[0]); // E2 = 40
    maxPitch = Tonal.Note.midi(tuning[tuning.length - 1]) + 24; // E6 = 88
    debugLog('Guitar pitch range initialized:', { minPitch, maxPitch });
  }
  return { minPitch, maxPitch };
}

// Convert a note like "C#4" to VexFlow format "c#/4"
// Guitar is a transposing instrument: it sounds one octave lower than written.
// Since our app uses sounding pitch (e.g., D3 = open D string = MIDI 50),
// we must add 1 octave when converting to VexFlow for proper staff display.
// This matches standard guitar notation convention where middle C on guitar
// is written as C4 on the treble clef but sounds as C3.
function toVexFlowFormat(note) {
  const pc = Tonal.Note.pitchClass(note);
  const octave = Tonal.Note.octave(note);
  // Add 1 octave for guitar transposition: sounding pitch → written pitch
  return `${pc.toLowerCase()}/${octave + 1}`;
}
const colors = {
  defaultFill: 'white',
  defaultActiveFill: '#ff636c',
  defaultStroke: 'black',
  defaultActiveStroke: '#ff636c',
  disabled: '#aaa',
  primaryFill: '#3273dc',
  intervals: {
    '1P': '#F25116',
    '2M': '#FCFF6C',
    '2m': '#FCFF6C',
    '3m': '#F29727',
    '3M': '#F29727',
    '4P': '#2FABEE',
    '4A': '#2FABEE',
    '5P': '#D89D6A',
    '5A': '#D89D6A',
    '6M': '#D7FFAB',
    '6m': '#D7FFAB',
    '7M': '#96ADC8',
    '7m': '#96ADC8',
  },
};

// Note: This file depends on noteFlow.js for pure note flow functions.
// Ensure noteFlow.js is loaded before this file in index.html.

// Import the CAGED Shape generator function
// import { getCAGEDShape } from './cagedShapes.js';

// import { Fretboard, Systems } from './libs/fretboard/fretboard.esm.js';
// import { colors } from './libs/fretboard/config.json';

// function renderChord(cagedShape) {
//     if (typeof vexchords === 'undefined') {
//         console.error('VexChords is not available. Please ensure it is loaded.');
//         return;
//     }

//     // Convert the frets array to a format compatible with VexChords
//     const chordArray = convertFretsToChordArray(cagedShape);

//     // Use the position from cagedShape
//     const position = cagedShape.position || 1;

//     console.log('Rendering chord with position:', position, 'and processed frets:', chordArray);

//     // Create a new div for each chord diagram
//     const chordDiagram = document.createElement('div');
//     chordDiagram.className = 'chord-diagram';
//     document.getElementById('chords-container').appendChild(chordDiagram);

//     // Render the chord diagram using VexChords
//     vexchords.draw(chordDiagram, {
//         chord: chordArray,
//         strings: 6,
//         position: position,
//         barres: cagedShape.barres || [],
//         tuning: tuning //['E', 'A', 'D', 'G', 'B', 'E'] // Standard tuning
//     });
// }

// Function to render the scale diagram
// Example usage:
// const initialKey = 'C';
// const initialScaleType = 'major';
// const initialShape = 'C';
// renderScaleDiagram(initialKey, initialScaleType, initialShape);
function computeDotClasses(fretboardInstance, boxPositionsKey) {
  // Apply the dot-in-box and dot-out-of-scale classes directly to the dots in fretboardInstance
  fretboardInstance.dots.forEach((dot) => {
    const key = `${dot.string}-${dot.fret}`;
    // console.log('Dot:', dot); // Log the entire dot object
    // console.log('Key:', key, 'In Box:', boxPositionsKey[key]); // Log the key and inBox status

    // Query the DOM element using the class names for string and fret
    const dotElement = document.querySelector(
      `.dot.dot-string-${dot.string}.dot-fret-${dot.fret}`
    );

    if (!dotElement) {
      console.error('dotElement is undefined for dot:', dot); // Log an error if dotElement is undefined
      return; // Skip further processing for this dot
    }

    if (boxPositionsKey[key]) {
      dot.inBox = true;
      dotElement.classList.add('dot-in-box'); // Add 'dot-in-box' class
    } else {
      dot.inBox = false;
      dotElement.classList.add('dot-out-of-scale'); // Add 'dot-out-of-scale' class
    }
  });
}

function renderScaleDiagram(cagedShape) {
  const scaleDiagram = document.getElementById('fretboard-container');
  scaleDiagram.innerHTML = ''; // Clear previous content

  // Set a custom width before Fretboard rendering
  scaleDiagram.style.width = '75%';
  scaleDiagram.style.maxWidth = '800px';
  // console.log('Width before rendering fretboard:', scaleDiagram.style.width);

  // Create the Fretboard instance
  const fretboardInstance = new fretboard.Fretboard({
    el: scaleDiagram,
    height: 200,
    stringsWidth: 1.5,
    dotSize: 25,
    fretCount: 16,
    fretsWidth: 1.2,
    font: 'Futura',
    tuning: tuning,
    showFretNumbers: true,
  });

  // console.log('fretboardInstance:', fretboardInstance);

  // Build positions from your cagedShape data
  let positions = [];
  for (
    let stringIndex = 0;
    stringIndex < cagedShape.scale_frets.length;
    stringIndex++
  ) {
    const stringNumber = 6 - stringIndex; // Strings numbered from 6 (low E) to 1 (high E)
    const fretsOnString = cagedShape.scale_frets[stringIndex];
    for (let fret of fretsOnString) {
      if (typeof fret === 'number' && fret >= 0) {
        positions.push({
          string: stringNumber,
          fret: fret,
          inBox: true, // Custom property to indicate this note is in the box
        });
      }
    }
  }

  // Render the scale over the fretboard
  fretboardInstance.renderScale({
    type: cagedShape.scaleType,
    root: cagedShape.key,
  });

  // console.log('Width after rendering fretboard:', scaleDiagram.style.width);

  // Build a key map of positions in the box
  let boxPositionsKey = {};
  positions.forEach((pos) => {
    boxPositionsKey[`${pos.string}-${pos.fret}`] = true;
  });

  // Mark dots that are in the box
  fretboardInstance.dots.forEach((dot) => {
    const key = `${dot.string}-${dot.fret}`;
    dot.inBox = !!boxPositionsKey[key]; // Assign inBox property
    // console.log('Dot:', dot, 'Key:', key, 'In Box:', dot.inBox);
  });

  // Compute and assign dot-in-box / dot-out-of-scale classes
  computeDotClasses(fretboardInstance, boxPositionsKey);

  // Calculate start and end frets for highlighting
  const fretsInBox = positions.map((pos) => pos.fret);
  const startFret = Math.min(...fretsInBox);
  const endFret = Math.max(...fretsInBox);

  // console.log('Frets in Box:', fretsInBox);
  // console.log('Start Fret:', startFret);
  // console.log('End Fret:', endFret);

  // Highlight the area for the box
  fretboardInstance.highlightAreas([
    { string: 1, fret: startFret },
    { string: 6, fret: endFret },
  ]);

  // Style the dots
  fretboardInstance.style({
    text: (position) => (position.degree === 1 ? '1' : position.note),
    fill: (position) => {
      if (position.degree === 1) {
        return '#00BCD4'; // Teal for root notes
      } else if (position.inBox) {
        return '#FF7043'; // Coral for notes in the box
      } else {
        return 'rgba(200, 200, 200, 0.4)'; // Grey for out-of-box notes
      }
    },
    stroke: (position) => {
      if (position.inBox || position.degree === 1) {
        return '#FFFFFF'; // White stroke for notes in the box and root notes
      } else {
        return '#AAAAAA'; // Grey stroke for other notes
      }
    },
    strokeWidth: 1,
  });
}

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
  const { Renderer, Stave, StaveNote, Voice, Formatter, Annotation } = VF;
  const div = document.getElementById('notation');
  const renderer = new Renderer(div, Renderer.Backends.SVG);
  const width = 1200;
  const height = 500;
  renderer.resize(width, height);
  const context = renderer.getContext();

  // Positioning constants
  const staveHeight = 150;
  let xStart = 50;
  let yStart = 40;
  const maxStaveWidth = width - 20;

  // Progression processing
  let chordsInProgression = progression.replace(/\s/g, '').split('-');
  let adjustedProgression = [];
  const totalChords = chordsInProgression.length;
  let fullCycles = Math.floor(bars / totalChords);
  let remainingBars = bars % totalChords;

  for (let i = 0; i < fullCycles; i++) {
    adjustedProgression = adjustedProgression.concat(chordsInProgression);
  }
  if (remainingBars > 0) {
    adjustedProgression = adjustedProgression.concat(
      chordsInProgression.slice(0, remainingBars)
    );
  }

  const measures = [];
  let previousNote = null;
  let isAscending = true;

  adjustedProgression.forEach((chordSymbol, measureIndex) => {
    const chordInfo = {
      I: { degree: 1, quality: 'maj7' },
      ii: { degree: 2, quality: 'm7' },
      iii: { degree: 3, quality: 'm7' },
      IV: { degree: 4, quality: 'maj7' },
      V: { degree: 5, quality: '7' },
      vi: { degree: 6, quality: 'm7' },
      'vii°': { degree: 7, quality: 'm7b5' },
    }[chordSymbol];

    const scale = Tonal.Scale.get(`${key} major`).notes;
    const rootNote = scale[chordInfo.degree - 1];
    const chordData = Tonal.Chord.get(`${rootNote}${chordInfo.quality}`);

    // Expand chord tones across multiple octaves within the guitar range
    const { minPitch, maxPitch } = getGuitarPitchRange();
    debugLog('Guitar range:', { minPitch, maxPitch, minNote: 'E2 (MIDI 40)', maxNote: 'E6 (MIDI 88)' });
    
    const octaves = [2, 3, 4, 5, 6];
    let chordNotes = [];
    let excludedNotes = [];
    octaves.forEach((oct) => {
      chordData.notes.forEach((n) => {
        // Use tonal format (e.g. "C#4") for calculations
        const tonalNote = `${n}${oct}`;
        const midi = Tonal.Note.midi(tonalNote);
        if (midi >= minPitch && midi <= maxPitch) {
          chordNotes.push(tonalNote);
        } else {
          excludedNotes.push({ note: tonalNote, midi, reason: midi < minPitch ? 'below min' : 'above max' });
        }
      });
    });
    
    if (excludedNotes.length > 0) {
      debugLog('Excluded notes (outside guitar range):', excludedNotes);
    }

    if (!chordNotes || chordNotes.length === 0) {
      console.error(
        `No notes found for chord: ${rootNote}${chordInfo.quality}`
      );
      return;
    }

    // Sort notes in ascending order of pitch for controlled progression
    chordNotes = chordNotes.sort(
      (a, b) => Tonal.Note.freq(a) - Tonal.Note.freq(b)
    );
    
    // Validate all notes are within guitar range
    const invalidNotes = chordNotes.filter(note => {
      const midi = Tonal.Note.midi(note);
      return midi < minPitch || midi > maxPitch;
    });
    if (invalidNotes.length > 0) {
      console.error('Notes outside guitar range:', invalidNotes);
    }
    
    debugLog(`Chord ${rootNote}${chordInfo.quality} notes (filtered):`, chordNotes);

    // Use noteFlow module to generate measure notes with proper voice leading
    const { notes: generatedNotes, newDirection } = window.noteFlow.generateMeasureNotes(
      chordNotes,
      4, // notes per measure
      previousNote,
      isAscending,
      Tonal.Note.freq,
      Tonal.Note.midi
    );

    // Validate generated notes are within range
    generatedNotes.forEach((note, idx) => {
      const midi = Tonal.Note.midi(note);
      if (midi < minPitch || midi > maxPitch) {
        console.error(`Generated note ${note} (MIDI ${midi}) at position ${idx} is outside guitar range [${minPitch}, ${maxPitch}]`);
      }
    });

    debugLog(`Measure ${measureIndex + 1} (${chordSymbol}):`, {
      chordNotes: chordNotes.slice(0, 5).join(', ') + '...',
      generatedNotes,
      previousNote,
      wasAscending: isAscending,
      newDirection
    });

    // Update state for next measure
    isAscending = newDirection;
    previousNote = generatedNotes[generatedNotes.length - 1];

    // Validate and log the VexFlow format conversion
    const vexFlowNotes = generatedNotes.map(note => ({
      original: note,
      midi: Tonal.Note.midi(note),
      vexFormat: toVexFlowFormat(note)
    }));
    debugLog(`Measure ${measureIndex + 1} VexFlow notes:`, vexFlowNotes);

    // Convert generated notes to VexFlow StaveNotes
    let measureNotes = generatedNotes.map(note => 
      new StaveNote({
        clef: 'treble',
        keys: [toVexFlowFormat(note)],
        duration: 'q',
      })
    );

    measures.push({
      chordSymbol,
      chordName: `${rootNote}${chordInfo.quality}`,
      notes: measureNotes,
    });
  });

  // Render each measure
  measures.forEach((measureData, index) => {
    // Calculate stave width based on whether it's the first measure (needs space for key signature)
    // This dynamic width calculation ensures that the first measure can accommodate 
    // the key signature and all notes without overflowing into the next measure
    const staveWidth = calculateMeasureWidth(key, index === 0);
    
    // Debug logging for first measure
    if (index === 0) {
      debugLog(`First measure width for key ${key}:`, staveWidth);
    }
    
    if (xStart + staveWidth > maxStaveWidth) {
      xStart = 50;
      yStart += staveHeight;
    }
    const stave = new Stave(xStart, yStart, staveWidth);
    if (index === 0) {
      stave.addClef('treble').addKeySignature(key).addTimeSignature('4/4');
    }
    stave.setContext(context).draw();

    const chordAnnotation = new Annotation(measureData.chordName)
      .setFont('Arial', 12, 'normal')
      .setVerticalJustification(Annotation.VerticalJustify.TOP);
    measureData.notes[0].addModifier(chordAnnotation, 0);

    const voice = new Voice({ num_beats: 4, beat_value: 4 }).addTickables(
      measureData.notes
    );
    new Formatter().joinVoices([voice]).format([voice], stave.width - 50);
    voice.draw(context, stave);

    xStart += stave.width;
  });
}

// Note: findClosestIndex has been moved to noteFlow.js module

// Calculate the required width for a measure based on key signature complexity
function calculateMeasureWidth(key, isFirstMeasure) {
  if (!isFirstMeasure) {
    return 250; // Default width for non-first measures
  }

  // Get the key info to determine how many accidentals we have
  // Tonal.Key.majorKey() returns an object with 'keySignature' (e.g., "##" or "bbb")
  // and 'alteration' (number of sharps/flats, positive for sharps, negative for flats)
  const keyInfo = Tonal.Key.majorKey(key);
  
  // Safely get accidental count - use alteration (absolute value) or keySignature length
  let accidentalCount = 0;
  if (keyInfo) {
    if (typeof keyInfo.alteration === 'number') {
      accidentalCount = Math.abs(keyInfo.alteration);
    } else if (keyInfo.keySignature) {
      accidentalCount = keyInfo.keySignature.length;
    } else if (keyInfo.alteredNotes && Array.isArray(keyInfo.alteredNotes)) {
      accidentalCount = keyInfo.alteredNotes.length;
    }
  }
  
  debugLog('calculateMeasureWidth:', { key, keyInfo, accidentalCount });
  
  // Base width plus additional space for each accidental
  // First measure needs extra space for clef, key signature, and time signature
  const baseWidth = 250;
  
  // More sophisticated calculation:
  // - Clef takes ~40px
  // - Time signature takes ~40px
  // - Each accidental takes ~15px
  // - Need some extra room for notes with accidentals
  const clefWidth = 40;
  const timeSignatureWidth = 40;
  const extraWidthPerAccidental = 15;
  const safetyMargin = 20;
  
  const keySignatureWidth = accidentalCount * extraWidthPerAccidental;
  const firstMeasureWidth = baseWidth + clefWidth + timeSignatureWidth + keySignatureWidth + safetyMargin;
  
  // Ensure a minimum width and cap the maximum to avoid extreme values
  return Math.max(250, Math.min(400, firstMeasureWidth));
}

// Make function available globally for testing
if (typeof window !== 'undefined') {
  window.calculateMeasureWidth = calculateMeasureWidth;
}

// Note: findClosestNote, getNextNoteInDirection, reachedBoundary have been moved to noteFlow.js module

// Initialize the application after DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
  const statusDiv = document.getElementById('status');

  // Check if VexFlow and Tonal.js are loaded
  let vexflowLoaded = typeof Vex !== 'undefined';
  let tonalLoaded = typeof Tonal !== 'undefined';
  let vexchordsLoaded = typeof vexchords !== 'undefined';

  if (!vexflowLoaded || !tonalLoaded || !vexchordsLoaded) {
    statusDiv.innerHTML = 'Failed to load VexFlow, Tonal, or VexChords.';
  } else {
    statusDiv.style.display = 'none'; // Hide the status div if everything is loaded

    // Attach event listener to the Generate Exercise button
    document.getElementById('generateButton').addEventListener('click', () => {
      const key = document.getElementById('key').value;
      const progression = document.getElementById('progression').value;
      const bars = document.getElementById('bars').value;
      const shape = document.getElementById('shape').value;

      // Validate selections
      if (!key || !progression || !bars || !shape) {
        alert(
          'Please select a key, progression, number of bars, and chord shape.'
        );
        return;
      }

      // Generate CAGED shape (ensure getCAGEDShape is working)
      const cagedShape = getCAGEDShape(shape, key);
      console.log('cagedShape:', cagedShape);

      // For testing, use a sample chord
      // const cagedShape = aShapeChord;

      // Clear previous chords and diagrams
      // document.getElementById('chords-container').innerHTML = '';
      document.getElementById('fretboard-container').innerHTML = '';

      // Render the chord shape visually using VexChords
      // renderChord(cagedShape);

      // Render the scale diagram using Fretboard.js
      renderScaleDiagram(cagedShape);

      // Generate the musical exercise
      generateExercise();
    });
  }
});

// Clear previous chords and diagrams
// document.getElementById('chords-container').innerHTML = '';
document.getElementById('fretboard-container').innerHTML = '';

// Sample chord definitions
// const aShapeChord = {
//     shape: 'A Shape',
//     frets: [['x', 0, 2, 2, 2, 0]]
// };

// const cShapeChord = {
//     shape: 'C Shape',
//     frets: [[0, 3, 2, 0, 1, 0]]
// };

// const dShapeChord = {
//     shape: 'D Shape',
//     frets: [['x', 'x', 0, 2, 3, 2]]
// };

// const gShapeChord = {
//     shape: 'G Shape',
//     frets: [[3, 2, 0, 0, 0, 3]]
// };

// const eShapeChord = {
//     shape: 'E Shape',
//     frets: [[0, 2, 2, 1, 0, 0]]
// };

// Render the sample chords
// renderChord(cShapeChord);
// renderChord(aShapeChord);
// renderChord(gShapeChord);
// renderChord(eShapeChord);
// renderChord(dShapeChord);
// console.log('Plotting D Shape Chord');
