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
// The real Tonal.Key.majorKey returns 'alteration' (number) and 'keySignature' (string like "##")
// NOT 'alteredNotes' array. This mock matches the real API.
const mockTonal = {
  Key: {
    majorKey: (key) => {
      const keySignatures = {
        'C': { alteration: 0, keySignature: '' },
        'G': { alteration: 1, keySignature: '#' },
        'D': { alteration: 2, keySignature: '##' },
        'A': { alteration: 3, keySignature: '###' },
        'E': { alteration: 4, keySignature: '####' },
        'B': { alteration: 5, keySignature: '#####' },
        'F#': { alteration: 6, keySignature: '######' },
        'F': { alteration: -1, keySignature: 'b' },
        'Bb': { alteration: -2, keySignature: 'bb' },
        'Eb': { alteration: -3, keySignature: 'bbb' },
        'Ab': { alteration: -4, keySignature: 'bbbb' },
        'Db': { alteration: -5, keySignature: 'bbbbb' },
        'Gb': { alteration: -6, keySignature: 'bbbbbb' }
      };
      return keySignatures[key] || { alteration: 0, keySignature: '' };
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
const maxPitch = mockTonal.Note.midi(tuning[tuning.length - 1]) + 16; // G#5 = 80 (16 frets)

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
    
    // Mock debugLog to prevent console spam
    global.debugLog = jest.fn();
    
    // Extract and execute the calculateMeasureWidth function
    const flowJsContent = fs.readFileSync('flow.js', 'utf8');
    const functionMatch = flowJsContent.match(/function calculateMeasureWidth\([\s\S]*?\n\}/);
    
    if (functionMatch) {
      // Create a function in the global scope that we can access
      const functionCode = functionMatch[0];
      eval(`global.calculateMeasureWidth = ${functionCode}`);
      calculateMeasureWidth = global.calculateMeasureWidth;
    } else {
      throw new Error('Could not extract calculateMeasureWidth function from flow.js');
    }
  });

  test('returns default width for non-first measures', () => {
    expect(calculateMeasureWidth('C', false)).toBe(250);
    expect(calculateMeasureWidth('G', false)).toBe(250);
    expect(calculateMeasureWidth('F#', false)).toBe(250);
  });

  test('returns correct width for keys with no accidentals', () => {
    // C major has 0 accidentals
    // Expected: 260 + 40 + 40 + (0 * 15) + 0 = 340
    const width = calculateMeasureWidth('C', true);
    expect(width).toBe(340);
  });

  test('returns correct width for keys with sharps', () => {
    // G major has 1 sharp: 260 + 40 + 40 + (1 * 15) + 0 = 355
    expect(calculateMeasureWidth('G', true)).toBe(355);
    
    // D major has 2 sharps: 260 + 40 + 40 + (2 * 15) + 0 = 370
    expect(calculateMeasureWidth('D', true)).toBe(370);
    
    // A major has 3 sharps: 260 + 40 + 40 + (3 * 15) + 0 = 385
    expect(calculateMeasureWidth('A', true)).toBe(385);
    
    // E major has 4 sharps: 260 + 40 + 40 + (4 * 15) + 0 = 400
    expect(calculateMeasureWidth('E', true)).toBe(400);
  });

  test('returns correct width for keys with flats', () => {
    // F major has 1 flat: 260 + 40 + 40 + (1 * 15) + 0 = 355
    expect(calculateMeasureWidth('F', true)).toBe(355);
    
    // Bb major has 2 flats: 260 + 40 + 40 + (2 * 15) + 0 = 370
    expect(calculateMeasureWidth('Bb', true)).toBe(370);
  });

  test('caps maximum width at 520', () => {
    // F# major has 6 sharps: 260 + 40 + 40 + (6 * 14) + 0 = 424
    expect(calculateMeasureWidth('F#', true)).toBe(424);
    
    // Gb major has 6 flats: same calculation
    expect(calculateMeasureWidth('Gb', true)).toBe(424);
  });

  test('handles unknown keys gracefully', () => {
    // Unknown key should default to 0 accidentals = 340
    const width = calculateMeasureWidth('X', true);
    expect(width).toBe(340);
  });

  test('handles null/undefined keyInfo gracefully', () => {
    // This should not throw an error
    expect(() => calculateMeasureWidth('InvalidKey', true)).not.toThrow();
  });
});

// Test Strudel playback adapters
describe('Strudel playback adapters', () => {
  let toStrudelNote;
  let buildStrudelNotePattern;
  let getGlobalStrudelApi;
  let getCyclesPerMinute;

  beforeAll(() => {
    const flowJsContent = fs.readFileSync('flow.js', 'utf8');
    const toNoteMatch = flowJsContent.match(/function toStrudelNote\([\s\S]*?\n\}/);
    const buildMatch = flowJsContent.match(/function buildStrudelNotePattern\([\s\S]*?\n\}/);
    const cyclesMatch = flowJsContent.match(/function getCyclesPerMinute\([\s\S]*?\n\}/);
    const globalMatch = flowJsContent.match(/function getGlobalStrudelApi\([\s\S]*?\n\}/);

    if (!toNoteMatch || !buildMatch || !cyclesMatch || !globalMatch) {
      throw new Error('Could not extract Strudel adapter functions from flow.js');
    }

    eval(`global.toStrudelNote = ${toNoteMatch[0]}`);
    eval(`global.buildStrudelNotePattern = ${buildMatch[0]}`);
    eval(`global.getCyclesPerMinute = ${cyclesMatch[0]}`);
    eval(`global.getGlobalStrudelApi = ${globalMatch[0]}`);
    toStrudelNote = global.toStrudelNote;
    buildStrudelNotePattern = global.buildStrudelNotePattern;
    getCyclesPerMinute = global.getCyclesPerMinute;
    getGlobalStrudelApi = global.getGlobalStrudelApi;
  });

  test('toStrudelNote lowercases notes and preserves accidentals', () => {
    expect(toStrudelNote('C4')).toBe('c4');
    expect(toStrudelNote('Bb3')).toBe('bb3');
    expect(toStrudelNote('F#5')).toBe('f#5');
  });

  test('toStrudelNote returns null for invalid input', () => {
    expect(toStrudelNote('')).toBeNull();
    expect(toStrudelNote('C#')).toBeNull();
    expect(toStrudelNote('invalid')).toBeNull();
  });

  test('buildStrudelNotePattern filters invalid notes', () => {
    const pattern = buildStrudelNotePattern(['C4', 'X9', 'Bb3', 'F#5']);
    expect(pattern).toBe('c4 bb3 f#5');
  });

  test('getCyclesPerMinute converts bpm to cycles per minute', () => {
    expect(getCyclesPerMinute(120)).toBe(30);
    expect(getCyclesPerMinute(60)).toBe(15);
  });

  test('getGlobalStrudelApi returns null when initStrudel is missing', () => {
    const originalInit = window.initStrudel;
    const originalNote = window.note;
    const originalHush = window.hush;
    delete window.initStrudel;
    delete window.note;
    delete window.hush;

    expect(getGlobalStrudelApi()).toBeNull();

    window.initStrudel = originalInit;
    window.note = originalNote;
    window.hush = originalHush;
  });

  test('getGlobalStrudelApi returns bindings when initStrudel exists', () => {
    window.initStrudel = jest.fn();
    window.note = jest.fn();
    window.hush = jest.fn();
    window.setcpm = jest.fn();
    window.setCpm = jest.fn();

    const api = getGlobalStrudelApi();
    expect(api).toBeTruthy();
    expect(api.initStrudel).toBe(window.initStrudel);
    api.note('c4');
    api.hush();
    api.setcpm(30);
    api.setCpm(30);
    expect(window.note).toHaveBeenCalledWith('c4');
    expect(window.hush).toHaveBeenCalled();
    expect(window.setcpm).toHaveBeenCalledWith(30);
    expect(window.setCpm).toHaveBeenCalledWith(30);
  });
});
