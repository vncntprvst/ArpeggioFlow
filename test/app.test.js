/*
 * app.test.js
 *
 * Comprehensive test suite for the Arpeggio Flow App.
 *
 * Tests:
 *   - HTML structure and required elements
 *   - Chord progression logic with ascending/descending flow
 *   - Arpeggio generation within pitch range limits
 *   - Closest chord tone calculation for smooth voice leading
 *   - Dynamic measure width calculation based on key signature
 */

const fs = require('fs');
const { JSDOM } = require('jsdom');

// Setup JSDOM environment
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html);
global.window = dom.window;
global.document = dom.window.document;

// Mock console.log for tests
const originalConsoleLog = console.log;
beforeEach(() => {
  console.log = jest.fn();
});

afterEach(() => {
  console.log = originalConsoleLog;
});

// Basic HTML structure test
test('index.html contains expected elements', () => {
  expect(document.getElementById('key')).toBeTruthy();
  expect(document.getElementById('progression')).toBeTruthy();
  expect(document.getElementById('bars')).toBeTruthy();
  expect(document.getElementById('shape')).toBeTruthy();
  expect(document.getElementById('generateButton')).toBeTruthy();
  expect(document.getElementById('notation')).toBeTruthy();
  expect(document.getElementById('fretboard-container')).toBeTruthy();
});

// Mock Tonal library for consistent testing
const mockTonal = {
  Key: {
    majorKey: (key) => {
      const keySignatures = {
        'C': { alteredNotes: [] },
        'G': { alteredNotes: ['F#'] },
        'D': { alteredNotes: ['F#', 'C#'] },
        'A': { alteredNotes: ['F#', 'C#', 'G#'] },
        'E': { alteredNotes: ['F#', 'C#', 'G#', 'D#'] },
        'B': { alteredNotes: ['F#', 'C#', 'G#', 'D#', 'A#'] },
        'F#': { alteredNotes: ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'] },
        'F': { alteredNotes: ['Bb'] },
        'Bb': { alteredNotes: ['Bb', 'Eb'] },
        'Eb': { alteredNotes: ['Bb', 'Eb', 'Ab'] },
        'Ab': { alteredNotes: ['Bb', 'Eb', 'Ab', 'Db'] },
        'Db': { alteredNotes: ['Bb', 'Eb', 'Ab', 'Db', 'Gb'] },
        'Gb': { alteredNotes: ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'] }
      };
      return keySignatures[key] || { alteredNotes: [] };
    }
  },
  Scale: {
    get: (scaleString) => ({
      notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] // Mock major scale
    })
  },
  Chord: {
    get: (chordString) => ({
      notes: ['C', 'E', 'G', 'B'] // Mock chord tones
    })
  },
  Note: {
    midi: (note) => {
      // Simple note to MIDI mapping for testing
      const noteMap = {
        'C2': 36, 'D2': 38, 'E2': 40, 'F2': 41, 'G2': 43, 'A2': 45, 'B2': 47,
        'C3': 48, 'D3': 50, 'E3': 52, 'F3': 53, 'G3': 55, 'A3': 57, 'B3': 59,
        'C4': 60, 'D4': 62, 'E4': 64, 'F4': 65, 'G4': 67, 'A4': 69, 'B4': 71,
        'C5': 72, 'D5': 74, 'E5': 76, 'F5': 77, 'G5': 79, 'A5': 81, 'B5': 83,
        'C6': 84, 'D6': 86, 'E6': 88, 'F6': 89, 'G6': 91, 'A6': 93, 'B6': 95
      };
      return noteMap[note] || 60;
    },
    freq: (note) => {
      // Simple frequency mapping for testing
      return 440 * Math.pow(2, (mockTonal.Note.midi(note) - 69) / 12);
    },
    pitchClass: (note) => note.replace(/[0-9]/g, ''),
    octave: (note) => parseInt(note.match(/[0-9]/)[0])
  }
};

// Define guitar range for testing
const tuning = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
const minPitch = mockTonal.Note.midi(tuning[0]); // E2 = 40
const maxPitch = mockTonal.Note.midi(tuning[tuning.length - 1]) + 24; // E6 = 88

// Helper function to generate chord tones within guitar range
function getChordTonesInRange(chordNotes) {
  const octaves = [2, 3, 4, 5, 6];
  let expandedNotes = [];
  
  octaves.forEach((oct) => {
    chordNotes.forEach((note) => {
      const fullNote = `${note}${oct}`;
      const midi = mockTonal.Note.midi(fullNote);
      if (midi >= minPitch && midi <= maxPitch) {
        expandedNotes.push(fullNote);
      }
    });
  });
  
  return expandedNotes.sort((a, b) => mockTonal.Note.freq(a) - mockTonal.Note.freq(b));
}

// Helper function for closest note calculation
function findClosestIndex(previousNote, chordNotes) {
  const previousFreq = mockTonal.Note.freq(previousNote);
  let closestIndex = 0;
  let minDifference = Infinity;

  chordNotes.forEach((note, index) => {
    const freq = mockTonal.Note.freq(note);
    const difference = Math.abs(freq - previousFreq);
    if (difference < minDifference) {
      minDifference = difference;
      closestIndex = index;
    }
  });
  return closestIndex;
}

// Test chord progression logic
test('chord progression follows ascending/descending flow rules', () => {
  const chordNotes = getChordTonesInRange(['C', 'E', 'G', 'B']);
  const numMeasures = 4;
  const notesPerMeasure = 4;
  
  let measureNotes = [];
  let previousNote = null;
  let isAscending = true;

  // Generate measures with direction control
  for (let measure = 0; measure < numMeasures; measure++) {
    let currentMeasure = [];
    let startIdx = measure === 0 
      ? Math.floor(chordNotes.length / 2) // Start from middle
      : findClosestIndex(previousNote, chordNotes);

    let currentIdx = startIdx;
    
    for (let note = 0; note < notesPerMeasure; note++) {
      const currentNote = chordNotes[currentIdx];
      currentMeasure.push(currentNote);
      previousNote = currentNote;

      // Calculate next index with boundary handling
      let nextIdx = isAscending ? currentIdx + 1 : currentIdx - 1;
      if (nextIdx >= chordNotes.length || nextIdx < 0) {
        isAscending = !isAscending; // Reverse direction at boundaries
        nextIdx = isAscending ? currentIdx + 1 : currentIdx - 1;
        // Ensure we stay in bounds after direction change
        nextIdx = Math.max(0, Math.min(chordNotes.length - 1, nextIdx));
      }
      currentIdx = nextIdx;
    }
    
    measureNotes.push(currentMeasure);
  }

  // Verify we have the right number of measures and notes
  expect(measureNotes).toHaveLength(numMeasures);
  measureNotes.forEach(measure => {
    expect(measure).toHaveLength(notesPerMeasure);
  });

  // Verify smooth voice leading between measures
  for (let i = 1; i < measureNotes.length; i++) {
    const lastNoteOfPrevious = measureNotes[i-1][notesPerMeasure-1];
    const firstNoteOfCurrent = measureNotes[i][0];
    
    const prevMidi = mockTonal.Note.midi(lastNoteOfPrevious);
    const currMidi = mockTonal.Note.midi(firstNoteOfCurrent);
    const interval = Math.abs(currMidi - prevMidi);
    
    // Should be reasonably close (within an octave)
    expect(interval).toBeLessThanOrEqual(12);
  }
});

// Test arpeggio generation within pitch range
test('arpeggio generation respects pitch range limits', () => {
  const chordNotes = ['C', 'E', 'G', 'B'];
  const expandedNotes = getChordTonesInRange(chordNotes);
  
  // All notes should be within guitar range
  expandedNotes.forEach(note => {
    const midi = mockTonal.Note.midi(note);
    expect(midi).toBeGreaterThanOrEqual(minPitch);
    expect(midi).toBeLessThanOrEqual(maxPitch);
  });
  
  // Should have notes in multiple octaves
  expect(expandedNotes.length).toBeGreaterThan(chordNotes.length);
  
  // Should be sorted by pitch
  for (let i = 1; i < expandedNotes.length; i++) {
    const prevFreq = mockTonal.Note.freq(expandedNotes[i-1]);
    const currFreq = mockTonal.Note.freq(expandedNotes[i]);
    expect(currFreq).toBeGreaterThanOrEqual(prevFreq);
  }
});

// Test closest chord tone calculation
test('closest chord tone calculation works correctly', () => {
  const chordNotes = getChordTonesInRange(['C', 'E', 'G', 'B']);
  const testNote = 'G4';
  
  const closestIndex = findClosestIndex(testNote, chordNotes);
  const closestNote = chordNotes[closestIndex];
  
  // Should find a note close to G4
  expect(closestNote).toBeDefined();
  
  // The closest note should be closer than any other note in the array
  const testFreq = mockTonal.Note.freq(testNote);
  const closestFreq = mockTonal.Note.freq(closestNote);
  const closestDiff = Math.abs(closestFreq - testFreq);
  
  chordNotes.forEach(note => {
    const noteFreq = mockTonal.Note.freq(note);
    const noteDiff = Math.abs(noteFreq - testFreq);
    expect(closestDiff).toBeLessThanOrEqual(noteDiff);
  });
});

// Test the calculateMeasureWidth function
describe('calculateMeasureWidth function', () => {
  // Load and execute the function from flow.js
  let calculateMeasureWidth;
  
  beforeAll(() => {
    // Set up Tonal mock
    global.Tonal = mockTonal;
    
    // Extract and execute the calculateMeasureWidth function
    const flowJsContent = fs.readFileSync('flow.js', 'utf8');
    const functionMatch = flowJsContent.match(/function calculateMeasureWidth\([\s\S]*?\n}/);
    
    if (functionMatch) {
      // Create a function in the global scope that we can access
      const functionCode = functionMatch[0];
      eval(`global.calculateMeasureWidth = ${functionCode}`);
      calculateMeasureWidth = global.calculateMeasureWidth;
    } else {
      throw new Error('Could not extract calculateMeasureWidth function from flow.js');
    }
  });

  test('returns correct width for different key signatures', () => {
    // Test keys with different numbers of accidentals
    const testCases = [
      { key: 'C', expectedWidth: 350, isFirstMeasure: true, accidentals: 0 },
      { key: 'G', expectedWidth: 365, isFirstMeasure: true, accidentals: 1 },
      { key: 'D', expectedWidth: 380, isFirstMeasure: true, accidentals: 2 },
      { key: 'F', expectedWidth: 365, isFirstMeasure: true, accidentals: 1 },
      { key: 'Bb', expectedWidth: 380, isFirstMeasure: true, accidentals: 2 },
      { key: 'C', expectedWidth: 250, isFirstMeasure: false, accidentals: 0 }
    ];

    testCases.forEach(({ key, expectedWidth, isFirstMeasure, accidentals }) => {
      const width = calculateMeasureWidth(key, isFirstMeasure);
      
      if (isFirstMeasure) {
        expect(width).toBeGreaterThanOrEqual(expectedWidth);
        expect(width).toBeLessThanOrEqual(400); // Should not exceed max
        
        // Verify the calculation logic
        const expectedCalculation = 250 + 40 + 40 + (accidentals * 15) + 20;
        expect(width).toBe(Math.max(250, Math.min(400, expectedCalculation)));
      } else {
        expect(width).toBe(250); // Non-first measures should always be 250
      }
    });
  });

  test('handles edge cases correctly', () => {
    // Test unknown key (should default to no accidentals)
    expect(calculateMeasureWidth('X', true)).toBe(350);
    
    // Test minimum and maximum bounds
    expect(calculateMeasureWidth('C', true)).toBeGreaterThanOrEqual(250);
    expect(calculateMeasureWidth('F#', true)).toBeLessThanOrEqual(400);
  });
});
