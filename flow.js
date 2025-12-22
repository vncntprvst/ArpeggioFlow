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

function parseKeySelection(keyValue) {
  const isMinor = keyValue.endsWith('m');
  const tonic = isMinor ? keyValue.slice(0, -1) : keyValue;
  return { tonic, isMinor };
}

function getKeyContext(keyValue) {
  const { tonic, isMinor } = parseKeySelection(keyValue);
  const scaleType = isMinor ? 'minor' : 'major';
  const keySignature = isMinor ? `${tonic}m` : tonic;
  let cagedKey = tonic;

  if (isMinor) {
    const minorKeyInfo = Tonal.Key.minorKey(tonic);
    if (minorKeyInfo && minorKeyInfo.relativeMajor) {
      cagedKey = minorKeyInfo.relativeMajor;
    }
  }

  return { tonic, isMinor, scaleType, keySignature, cagedKey };
}

function updateKeyDebug(keyValue) {
  const debugEl = document.getElementById('key-debug');
  if (!debugEl) {
    return;
  }
  const { tonic, scaleType, keySignature, cagedKey } = getKeyContext(keyValue);
  debugEl.textContent = `Key signature: ${keySignature} | Scale: ${tonic} ${scaleType} | CAGED: ${cagedKey} ${scaleType}`;
}

// Define the tuning
const tuning = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

// Guitar pitch range - computed lazily to ensure Tonal is loaded
// E2 = MIDI 40, E4 + 16 semitones = G#5 = MIDI 80 (16 frets displayed on fretboard)
let minPitch = null;
let maxPitch = null;

function getGuitarPitchRange() {
  if (minPitch === null || maxPitch === null) {
    minPitch = Tonal.Note.midi(tuning[0]); // E2 = 40
    // Max pitch is 16 frets above the highest open string (E4)
    // This ensures notes stay within the displayed fretboard (16 frets)
    maxPitch = Tonal.Note.midi(tuning[tuning.length - 1]) + 16; // G#5 = 80
    debugLog('Guitar pitch range initialized:', { minPitch, maxPitch, maxNote: 'G#5 (fret 16 on high E)' });
  }
  return { minPitch, maxPitch };
}

/**
 * Convert fret positions from a CAGED shape to actual note names.
 * @param {Array<Array<number>>} scaleFrets - Array of fret arrays for each string (low E to high E order in shape)
 * @param {string[]} tuningNotes - Array of open string notes ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']
 * @returns {string[]} - Array of note names (e.g., ['E2', 'F2', 'G2', ...])
 */
function fretPositionsToNotes(scaleFrets, tuningNotes) {
  const notes = [];
  
  // scaleFrets is ordered from low E (string 6) to high E (string 1)
  // tuningNotes is ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] which is also low to high
  for (let stringIndex = 0; stringIndex < scaleFrets.length; stringIndex++) {
    const openStringNote = tuningNotes[stringIndex];
    const openStringMidi = Tonal.Note.midi(openStringNote);
    const fretsOnString = scaleFrets[stringIndex];
    
    for (const fret of fretsOnString) {
      if (typeof fret === 'number' && fret >= 0) {
        const midi = openStringMidi + fret;
        const noteName = Tonal.Note.fromMidi(midi);
        notes.push(noteName);
      }
    }
  }
  
  // Remove duplicates and sort by pitch
  const uniqueNotes = [...new Set(notes)];
  return uniqueNotes.sort((a, b) => Tonal.Note.midi(a) - Tonal.Note.midi(b));
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

  const keyContext = getKeyContext(key);

  // Get the CAGED shape to access scale notes for root chord constraint
  const cagedShape = getCAGEDShape(shape, keyContext.cagedKey);
  if (!cagedShape) {
    console.error('Could not get CAGED shape');
    return;
  }

  if (keyContext.isMinor) {
    cagedShape.key = keyContext.tonic;
    cagedShape.scaleType = keyContext.scaleType;
  }
  
  // Convert the scale fret positions to actual note names
  // These are the notes that the root chord (I chord) must use
  const scaleNotesInShape = fretPositionsToNotes(cagedShape.scale_frets, tuning);
  debugLog('Scale notes in CAGED shape:', scaleNotesInShape);
  
  // Get just the pitch classes for matching (e.g., ['C', 'D', 'E', 'F', 'G', 'A', 'B'])
  const scalePitchClasses = [...new Set(scaleNotesInShape.map(n => Tonal.Note.pitchClass(n)))];
  debugLog('Scale pitch classes:', scalePitchClasses);
  
  // Create a Set of scale chromas (0-11) for enharmonic-agnostic matching
  // This ensures D# (chroma 3) matches Eb (chroma 3), F# (chroma 6) matches Gb (chroma 6), etc.
  const scaleChromaSet = new Set(scaleNotesInShape.map(n => Tonal.Note.chroma(n)));
  debugLog('Scale chromas:', [...scaleChromaSet]);

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

  // Helper function to get chord notes for a given chord symbol
  function getChordNotesForSymbol(chordSymbol, filterToScale = false) {
    const chordQualitiesMajor = {
      I: { degree: 1, quality: 'maj7' },
      ii: { degree: 2, quality: 'm7' },
      iii: { degree: 3, quality: 'm7' },
      IV: { degree: 4, quality: 'maj7' },
      V: { degree: 5, quality: '7' },
      vi: { degree: 6, quality: 'm7' },
      'viiA\u00F8': { degree: 7, quality: 'm7b5' },
      'viiA\u0173': { degree: 7, quality: 'm7b5' },
    };
    const chordQualitiesMinor = {
      I: { degree: 1, quality: 'm7' },
      ii: { degree: 2, quality: 'm7b5' },
      iii: { degree: 3, quality: 'maj7' },
      IV: { degree: 4, quality: 'm7' },
      V: { degree: 5, quality: 'm7' },
      vi: { degree: 6, quality: 'maj7' },
      'viiA\u00F8': { degree: 7, quality: '7' },
      'viiA\u0173': { degree: 7, quality: '7' },
    };

    const chordInfo = (keyContext.isMinor ? chordQualitiesMinor : chordQualitiesMajor)[
      chordSymbol
    ];

    const scale = Tonal.Scale.get(
      `${keyContext.tonic} ${keyContext.scaleType}`
    ).notes;
    const rootNote = scale[chordInfo.degree - 1];
    const chordData = Tonal.Chord.get(`${rootNote}${chordInfo.quality}`);

    const { minPitch, maxPitch } = getGuitarPitchRange();
    const octaves = [2, 3, 4, 5, 6];
    let chordNotes = [];
    
    octaves.forEach((oct) => {
      chordData.notes.forEach((n) => {
        const tonalNote = `${n}${oct}`;
        const midi = Tonal.Note.midi(tonalNote);
        if (midi >= minPitch && midi <= maxPitch) {
          chordNotes.push(tonalNote);
        }
      });
    });

    // For the root chord (I), filter to only notes within the scale shape
    // Use chroma (0-11) comparison for enharmonic-agnostic matching
    // This ensures D# matches Eb, F# matches Gb, A# matches Bb, etc.
    if (filterToScale) {
      chordNotes = chordNotes.filter(note => {
        const noteChroma = Tonal.Note.chroma(note);
        return scaleChromaSet.has(noteChroma);
      });
      debugLog(`Filtered to scale shape (chroma-matched):`, chordNotes);
    }

    // Sort notes in ascending order of pitch
    chordNotes = chordNotes.sort((a, b) => Tonal.Note.freq(a) - Tonal.Note.freq(b));
    
    return { chordNotes, rootNote, quality: chordInfo.quality };
  }

  // Build measure data array with chord info
  const measureData = adjustedProgression.map((chordSymbol, idx) => {
    const isRootChord = chordSymbol === 'I';
    const { chordNotes, rootNote, quality } = getChordNotesForSymbol(chordSymbol, isRootChord);
    return {
      index: idx,
      chordSymbol,
      chordName: `${rootNote}${quality}`,
      chordNotes,
      isRootChord,
      generatedNotes: null, // Will be filled in
      direction: null, // Will be filled in
    };
  });

  // Find the first I chord (root chord) index
  const firstRootChordIndex = measureData.findIndex(m => m.isRootChord);
  
  debugLog('Measure generation strategy:', {
    totalMeasures: measureData.length,
    firstRootChordIndex,
    progression: adjustedProgression
  });

  // If no I chord found, fall back to sequential generation starting from measure 0
  const startIndex = firstRootChordIndex >= 0 ? firstRootChordIndex : 0;

  // Generate the starting measure (I chord or first measure if no I chord)
  let startMeasure = measureData[startIndex];
  if (startMeasure.chordNotes.length === 0) {
    console.error(`No notes found for starting chord: ${startMeasure.chordName}`);
    return;
  }

  // Generate the first (anchor) measure - random start, ascending direction
  const startResult = window.noteFlow.generateMeasureNotes(
    startMeasure.chordNotes,
    4,
    null, // No previous note
    true, // Start ascending
    Tonal.Note.freq,
    Tonal.Note.midi
  );
  startMeasure.generatedNotes = startResult.notes;
  startMeasure.direction = startResult.newDirection;

  debugLog(`Generated anchor measure ${startIndex + 1} (${startMeasure.chordSymbol}):`, startResult.notes);

  // Generate measures AFTER the start index (forward direction)
  for (let i = startIndex + 1; i < measureData.length; i++) {
    const prevMeasure = measureData[i - 1];
    const currentMeasure = measureData[i];
    
    if (currentMeasure.chordNotes.length === 0) {
      console.error(`No notes for chord: ${currentMeasure.chordName}`);
      continue;
    }

    const previousNote = prevMeasure.generatedNotes[prevMeasure.generatedNotes.length - 1];
    const result = window.noteFlow.generateMeasureNotes(
      currentMeasure.chordNotes,
      4,
      previousNote,
      prevMeasure.direction,
      Tonal.Note.freq,
      Tonal.Note.midi
    );
    currentMeasure.generatedNotes = result.notes;
    currentMeasure.direction = result.newDirection;

    debugLog(`Generated measure ${i + 1} (forward, ${currentMeasure.chordSymbol}):`, result.notes);
  }

  // Generate measures BEFORE the start index (backward direction)
  // We work backwards, using the FIRST note of the next measure as our target
  for (let i = startIndex - 1; i >= 0; i--) {
    const nextMeasure = measureData[i + 1];
    const currentMeasure = measureData[i];
    
    if (currentMeasure.chordNotes.length === 0) {
      console.error(`No notes for chord: ${currentMeasure.chordName}`);
      continue;
    }

    // The target is the first note of the next measure
    // We need to find notes that flow INTO that target
    const targetNote = nextMeasure.generatedNotes[0];
    const targetMidi = Tonal.Note.midi(targetNote);
    
    // Determine direction: if next measure's first note came from descending,
    // this measure should end descending (so we were ascending within it)
    // We need to figure out what direction we need to END with
    // The next measure received our last note and continued in some direction
    // For smooth flow, we work backwards
    
    // Find the closest chord tone to the target (the note we need to end on)
    const closestToTarget = window.noteFlow.findClosestNote(
      targetNote,
      currentMeasure.chordNotes,
      true, // direction hint (not critical since we prioritize proximity)
      Tonal.Note.freq,
      Tonal.Note.midi
    );
    
    const closestMidi = Tonal.Note.midi(closestToTarget);
    
    // Generate this measure ending on or near closestToTarget
    // We'll generate normally then check if we can adjust
    // For now, generate with the target as the "previous note" (working backwards)
    // But we need to reverse the logic - we want to END near the target
    
    // Strategy: Generate measure ending at closestToTarget
    // Work out what the last note should be, then generate 4 notes ending there
    
    // Simple approach: Use the closestToTarget as the last note,
    // and work backwards to generate the preceding 3 notes
    const closestIdx = currentMeasure.chordNotes.indexOf(closestToTarget);
    
    // Determine direction for this measure: 
    // If closestToTarget < targetNote, we were ascending (ended lower, going up to target)
    // If closestToTarget > targetNote, we were descending
    // If equal, use the next measure's entry direction
    let measureDirection;
    if (closestMidi < targetMidi) {
      measureDirection = true; // ascending - we end low and flow up to target
    } else if (closestMidi > targetMidi) {
      measureDirection = false; // descending - we end high and flow down to target
    } else {
      measureDirection = true; // same note, default ascending
    }
    
    // Generate notes going backwards from the end point
    // We'll generate 4 notes where the last one is at or near closestToTarget
    const notes = [];
    let currentIdx = closestIdx;
    const len = currentMeasure.chordNotes.length;
    
    // Build notes array in reverse (from last to first)
    for (let n = 0; n < 4; n++) {
      notes.unshift(currentMeasure.chordNotes[currentIdx]);
      
      // Move in opposite direction (since we're building backwards)
      if (measureDirection) {
        // Measure ends ascending, so going backwards we descend
        currentIdx = currentIdx - 1;
        if (currentIdx < 0) {
          currentIdx = 1; // Bounce back
          measureDirection = false; // Reverse
        }
      } else {
        // Measure ends descending, so going backwards we ascend
        currentIdx = currentIdx + 1;
        if (currentIdx >= len) {
          currentIdx = len - 2;
          measureDirection = true; // Reverse
        }
      }
    }
    
    currentMeasure.generatedNotes = notes;
    // Direction at the END of this measure (for consistency)
    currentMeasure.direction = closestMidi <= targetMidi;

    debugLog(`Generated measure ${i + 1} (backward, ${currentMeasure.chordSymbol}):`, notes);
  }

  // Now build the VexFlow notes for rendering
  const measures = measureData.map(m => {
    const measureNotes = m.generatedNotes.map(note =>
      new StaveNote({
        clef: 'treble',
        keys: [toVexFlowFormat(note)],
        duration: 'q',
      })
    );
    
    return {
      chordSymbol: m.chordSymbol,
      chordName: m.chordName,
      notes: measureNotes,
    };
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
      stave
        .addClef('treble')
        .addKeySignature(keyContext.keySignature)
        .addTimeSignature('4/4');
    }
    stave.setContext(context).draw();

    const chordAnnotation = new Annotation(measureData.chordName)
      .setFont('Arial', 12, 'normal')
      .setVerticalJustification(Annotation.VerticalJustify.TOP);
    measureData.notes[0].addModifier(chordAnnotation, 0);

    const voice = new Voice({ num_beats: 4, beat_value: 4 }).addTickables(
      measureData.notes
    );
    const availableWidth = stave.width - (index === 0 ? 90 : 50);
    new Formatter().joinVoices([voice]).format([voice], Math.max(120, availableWidth));
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
  const isMinor = typeof key === 'string' && key.endsWith('m');
  const tonic = isMinor ? key.slice(0, -1) : key;
  const keyInfo = isMinor ? Tonal.Key.minorKey(tonic) : Tonal.Key.majorKey(tonic);
  
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
  const baseWidth = 260;
  
  // More sophisticated calculation:
  // - Clef takes ~40px
  // - Time signature takes ~40px
  // - Each accidental takes ~15px
  // - Need some extra room for notes with accidentals
  const clefWidth = 40;
  const timeSignatureWidth = 40;
  const extraWidthPerAccidental = accidentalCount >= 5 ? 20 : 15;
  const safetyMargin = 30;
  
  const keySignatureWidth = accidentalCount * extraWidthPerAccidental;
  const firstMeasureWidth = baseWidth + clefWidth + timeSignatureWidth + keySignatureWidth + safetyMargin;
  
  // Ensure a minimum width and cap the maximum to avoid extreme values
  return Math.max(260, Math.min(520, firstMeasureWidth));
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

    // updateKeyDebug(document.getElementById('key').value);

    // Attach event listener to the Generate Exercise button
    document.getElementById('key').addEventListener('change', (event) => {
      updateKeyDebug(event.target.value);
    });

    document.getElementById('generateButton').addEventListener('click', () => {
      const key = document.getElementById('key').value;
      // updateKeyDebug(key);
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
      const keyContext = getKeyContext(key);
      const cagedShape = getCAGEDShape(shape, keyContext.cagedKey);
      if (cagedShape && keyContext.isMinor) {
        cagedShape.key = keyContext.tonic;
        cagedShape.scaleType = keyContext.scaleType;
      }
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















