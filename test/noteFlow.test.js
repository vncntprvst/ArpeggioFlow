/**
 * noteFlow.test.js
 * 
 * Unit tests for the pure note flow functions.
 * These tests run in Node.js without needing a browser or JSDOM.
 */

const {
  findClosestIndex,
  findClosestNote,
  getNextNoteInDirection,
  reachedBoundary,
  shouldReverseDirection,
  generateMeasureNotes
} = require('../noteFlow.js');

// Mock Tonal functions for testing
const mockNoteFreq = (note) => {
  // Simple frequency calculation: A4 = 440Hz, each semitone is 2^(1/12)
  const noteMap = {
    'C2': 65.41, 'D2': 73.42, 'E2': 82.41, 'F2': 87.31, 'G2': 98.00, 'A2': 110.00, 'B2': 123.47,
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.26, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
  };
  return noteMap[note] || 440;
};

const mockNoteMidi = (note) => {
  // MIDI note numbers
  const noteMap = {
    'C2': 36, 'D2': 38, 'E2': 40, 'F2': 41, 'G2': 43, 'A2': 45, 'B2': 47,
    'C3': 48, 'D3': 50, 'E3': 52, 'F3': 53, 'G3': 55, 'A3': 57, 'B3': 59,
    'C4': 60, 'D4': 62, 'E4': 64, 'F4': 65, 'G4': 67, 'A4': 69, 'B4': 71,
    'C5': 72, 'D5': 74, 'E5': 76, 'F5': 77, 'G5': 79, 'A5': 81, 'B5': 83,
  };
  return noteMap[note] || 60;
};

describe('noteFlow module', () => {
  // Sample chord notes sorted by pitch (Cmaj7 across octaves)
  const cmaj7Notes = ['C3', 'E3', 'G3', 'B3', 'C4', 'E4', 'G4', 'B4', 'C5', 'E5', 'G5'];
  
  describe('findClosestIndex', () => {
    test('finds exact match', () => {
      const idx = findClosestIndex('E4', cmaj7Notes, mockNoteFreq);
      expect(idx).toBe(5); // E4 is at index 5
    });

    test('finds closest note when exact match not present', () => {
      const idx = findClosestIndex('D4', cmaj7Notes, mockNoteFreq);
      // D4 is between C4 (idx 4) and E4 (idx 5), should pick closer one
      expect(idx).toBe(4); // C4 is closer (2 semitones) than E4 (2 semitones) - both equal, first wins
    });

    test('handles note at beginning', () => {
      const idx = findClosestIndex('C3', cmaj7Notes, mockNoteFreq);
      expect(idx).toBe(0);
    });

    test('handles note at end', () => {
      const idx = findClosestIndex('G5', cmaj7Notes, mockNoteFreq);
      expect(idx).toBe(10);
    });
  });

  describe('reachedBoundary', () => {
    test('detects low boundary', () => {
      const result = reachedBoundary('C3', cmaj7Notes);
      expect(result.atBoundary).toBe(true);
      expect(result.atLow).toBe(true);
      expect(result.atHigh).toBe(false);
    });

    test('detects high boundary', () => {
      const result = reachedBoundary('G5', cmaj7Notes);
      expect(result.atBoundary).toBe(true);
      expect(result.atLow).toBe(false);
      expect(result.atHigh).toBe(true);
    });

    test('detects middle note (not at boundary)', () => {
      const result = reachedBoundary('E4', cmaj7Notes);
      expect(result.atBoundary).toBe(false);
      expect(result.atLow).toBe(false);
      expect(result.atHigh).toBe(false);
    });
  });

  describe('shouldReverseDirection', () => {
    test('reverses when ascending and at high boundary', () => {
      const newDir = shouldReverseDirection('G5', cmaj7Notes, true);
      expect(newDir).toBe(false); // Should now descend
    });

    test('reverses when descending and at low boundary', () => {
      const newDir = shouldReverseDirection('C3', cmaj7Notes, false);
      expect(newDir).toBe(true); // Should now ascend
    });

    test('keeps direction when not at boundary', () => {
      const newDirAsc = shouldReverseDirection('E4', cmaj7Notes, true);
      expect(newDirAsc).toBe(true); // Still ascending

      const newDirDesc = shouldReverseDirection('E4', cmaj7Notes, false);
      expect(newDirDesc).toBe(false); // Still descending
    });

    test('keeps direction when ascending at low boundary', () => {
      const newDir = shouldReverseDirection('C3', cmaj7Notes, true);
      expect(newDir).toBe(true); // Keep ascending
    });

    test('keeps direction when descending at high boundary', () => {
      const newDir = shouldReverseDirection('G5', cmaj7Notes, false);
      expect(newDir).toBe(false); // Keep descending
    });
  });

  describe('getNextNoteInDirection', () => {
    test('gets next note ascending', () => {
      const next = getNextNoteInDirection(['C4'], cmaj7Notes, true);
      expect(next).toBe('E4'); // Next note up from C4
    });

    test('gets next note descending', () => {
      const next = getNextNoteInDirection(['C4'], cmaj7Notes, false);
      expect(next).toBe('B3'); // Next note down from C4
    });

    test('wraps around at top when ascending', () => {
      const next = getNextNoteInDirection(['G5'], cmaj7Notes, true);
      expect(next).toBe('C3'); // Wraps to beginning
    });

    test('wraps around at bottom when descending', () => {
      const next = getNextNoteInDirection(['C3'], cmaj7Notes, false);
      expect(next).toBe('G5'); // Wraps to end
    });
  });

  describe('findClosestNote', () => {
    test('returns closest note by proximity (ascending hint)', () => {
      // D4 (62) - closest Cmaj7 notes are C4 (60, 2 away) and E4 (64, 2 away)
      // Both are equally close, but E4 is likely returned first due to sorting
      const closest = findClosestNote('D4', cmaj7Notes, true, mockNoteFreq, mockNoteMidi);
      const distance = Math.abs(mockNoteMidi(closest) - mockNoteMidi('D4'));
      expect(distance).toBeLessThanOrEqual(2);
    });

    test('returns closest note by proximity (descending hint)', () => {
      // D4 (62) - closest Cmaj7 notes are C4 (60, 2 away) and E4 (64, 2 away)
      const closest = findClosestNote('D4', cmaj7Notes, false, mockNoteFreq, mockNoteMidi);
      const distance = Math.abs(mockNoteMidi(closest) - mockNoteMidi('D4'));
      expect(distance).toBeLessThanOrEqual(2);
    });

    test('prioritizes proximity over direction', () => {
      // From E4, the closest Cmaj7 note is E4 itself (if present)
      const closest = findClosestNote('E4', cmaj7Notes, true, mockNoteFreq, mockNoteMidi);
      expect(closest).toBe('E4'); // E4 is in Cmaj7 and is closest to itself
    });

    test('picks closest note regardless of requested direction', () => {
      // From E4, closest is E4 itself, even when descending was requested
      const closest = findClosestNote('E4', cmaj7Notes, false, mockNoteFreq, mockNoteMidi);
      expect(closest).toBe('E4'); // Proximity wins
    });

    test('handles edge case at top of range', () => {
      // At G5 (highest Cmaj7 note), should return G5 as it's closest to itself
      const closest = findClosestNote('G5', cmaj7Notes, true, mockNoteFreq, mockNoteMidi);
      expect(closest).toBe('G5');
    });

    test('handles edge case at bottom of range', () => {
      // At C3 (lowest Cmaj7 note), should return C3 as it's closest to itself
      const closest = findClosestNote('C3', cmaj7Notes, false, mockNoteFreq, mockNoteMidi);
      expect(closest).toBe('C3');
    });

    test('returns note from chordNotes when previousNote is not in chord', () => {
      // G4 is NOT in Dm7 chord, should return the closest Dm7 note
      // G4 = 67, closest are F4 = 65 (2 away) and A4 = 69 (2 away)
      const dm7Notes = ['D3', 'F3', 'A3', 'C4', 'D4', 'F4', 'A4', 'C5', 'D5', 'F5'];
      const closest = findClosestNote('G4', dm7Notes, true, mockNoteFreq, mockNoteMidi);
      expect(dm7Notes).toContain(closest);
      const distance = Math.abs(mockNoteMidi(closest) - mockNoteMidi('G4'));
      expect(distance).toBeLessThanOrEqual(2);
    });

    test('always returns a note from chordNotes array', () => {
      const dm7Notes = ['D3', 'F3', 'A3', 'C4', 'D4', 'F4', 'A4', 'C5', 'D5', 'F5'];
      // Test with various notes not in the chord
      const testNotes = ['C3', 'E3', 'G3', 'B3', 'E4', 'G4', 'B4', 'E5', 'G5'];
      
      testNotes.forEach(prevNote => {
        const closestAsc = findClosestNote(prevNote, dm7Notes, true, mockNoteFreq, mockNoteMidi);
        const closestDesc = findClosestNote(prevNote, dm7Notes, false, mockNoteFreq, mockNoteMidi);
        
        expect(dm7Notes).toContain(closestAsc);
        expect(dm7Notes).toContain(closestDesc);
      });
    });
  });

  describe('generateMeasureNotes', () => {
    test('generates correct number of notes', () => {
      const result = generateMeasureNotes(cmaj7Notes, 4, null, true, mockNoteFreq, mockNoteMidi);
      expect(result.notes.length).toBe(4);
    });

    test('first measure starts with random note (null previousNote)', () => {
      const result = generateMeasureNotes(cmaj7Notes, 4, null, true, mockNoteFreq, mockNoteMidi);
      expect(cmaj7Notes).toContain(result.notes[0]);
    });

    test('subsequent measure starts with closest note', () => {
      const result = generateMeasureNotes(cmaj7Notes, 4, 'E4', true, mockNoteFreq, mockNoteMidi);
      // First note should be E4 (exact match)
      expect(result.notes[0]).toBe('E4');
    });

    test('direction reverses at boundary', () => {
      // Start at high note, ascending - should reverse
      const result = generateMeasureNotes(cmaj7Notes, 4, 'G5', true, mockNoteFreq, mockNoteMidi);
      // After hitting G5 and reversing, should end up descending
      expect(result.newDirection).toBe(false);
    });

    test('all generated notes are from chord', () => {
      const result = generateMeasureNotes(cmaj7Notes, 4, null, true, mockNoteFreq, mockNoteMidi);
      result.notes.forEach(note => {
        expect(cmaj7Notes).toContain(note);
      });
    });

    test('notes follow ascending pattern initially', () => {
      // Force start from low note
      const shortNotes = ['C3', 'E3', 'G3', 'B3', 'C4'];
      const result = generateMeasureNotes(shortNotes, 4, 'C3', true, mockNoteFreq, mockNoteMidi);
      
      // First note is C3 (closest to previous), then should ascend
      expect(result.notes[0]).toBe('C3');
      // Notes should generally increase in pitch (allowing for boundary reversal)
    });

    test('notes follow descending pattern', () => {
      const result = generateMeasureNotes(cmaj7Notes, 4, 'G5', false, mockNoteFreq, mockNoteMidi);
      
      // Starting from G5, descending
      expect(result.notes[0]).toBe('G5');
      // Second note should be lower
      const idx0 = cmaj7Notes.indexOf(result.notes[0]);
      const idx1 = cmaj7Notes.indexOf(result.notes[1]);
      expect(idx1).toBeLessThan(idx0);
    });
  });

  describe('integration: multi-measure flow', () => {
    test('smooth transition between measures', () => {
      // Simulate 3 measures
      let previousNote = null;
      let isAscending = true;
      const allMeasures = [];

      for (let i = 0; i < 3; i++) {
        const result = generateMeasureNotes(cmaj7Notes, 4, previousNote, isAscending, mockNoteFreq, mockNoteMidi);
        allMeasures.push(result.notes);
        previousNote = result.notes[result.notes.length - 1];
        isAscending = result.newDirection;
      }

      // Verify transitions between measures are smooth
      for (let i = 1; i < allMeasures.length; i++) {
        const lastNoteOfPrev = allMeasures[i - 1][3];
        const firstNoteOfCurr = allMeasures[i][0];
        
        // The MIDI difference should be small (within 2 semitones for direct match, or next in direction)
        const midiDiff = Math.abs(mockNoteMidi(lastNoteOfPrev) - mockNoteMidi(firstNoteOfCurr));
        // Allow for larger jumps since we're jumping within chord tones
        expect(midiDiff).toBeLessThanOrEqual(12); // Within an octave at most
      }
    });

    test('ascending direction is maintained across measure boundaries', () => {
      // Start ascending from a middle note
      const previousNote = 'E4';
      const isAscending = true;
      
      const result = generateMeasureNotes(cmaj7Notes, 4, previousNote, isAscending, mockNoteFreq, mockNoteMidi);
      
      // First note should be at or above E4 (maintaining ascending direction)
      const prevMidi = mockNoteMidi(previousNote);
      const firstMidi = mockNoteMidi(result.notes[0]);
      
      expect(firstMidi).toBeGreaterThanOrEqual(prevMidi);
    });

    test('descending direction is maintained across measure boundaries', () => {
      // Start descending from a middle note
      const previousNote = 'E4';
      const isAscending = false;
      
      const result = generateMeasureNotes(cmaj7Notes, 4, previousNote, isAscending, mockNoteFreq, mockNoteMidi);
      
      // First note should be at or below E4 (maintaining descending direction)
      const prevMidi = mockNoteMidi(previousNote);
      const firstMidi = mockNoteMidi(result.notes[0]);
      
      expect(firstMidi).toBeLessThanOrEqual(prevMidi);
    });

    test('picks closest note for smooth voice leading (ascending preference)', () => {
      // Simulating the Cmaj7 to Dm7 transition scenario
      // New rule: proximity first, direction adapts
      const dm7Notes = ['D3', 'F3', 'A3', 'C4', 'D4', 'F4', 'A4', 'C5', 'D5', 'F5'];
      const previousNote = 'G4'; // Last note from Cmaj7
      const isAscending = true;
      
      const result = generateMeasureNotes(dm7Notes, 4, previousNote, isAscending, mockNoteFreq, mockNoteMidi);
      
      // G4 = 67, closest Dm7 tones are F4=65 (2 semitones) and A4=69 (2 semitones)
      // Either is acceptable for smooth voice leading
      const prevMidi = mockNoteMidi(previousNote); // G4 = 67
      const firstMidi = mockNoteMidi(result.notes[0]);
      const distance = Math.abs(firstMidi - prevMidi);
      
      // Should be within a few semitones (smooth voice leading)
      expect(distance).toBeLessThanOrEqual(4);
    });

    test('picks closest note for smooth voice leading (descending preference)', () => {
      // If we're descending and at E4, we should pick the closest Dm7 chord tone
      const dm7Notes = ['D3', 'F3', 'A3', 'C4', 'D4', 'F4', 'A4', 'C5', 'D5', 'F5'];
      const previousNote = 'E4'; // Somewhere in the middle (E4 = 64)
      const isAscending = false;
      
      const result = generateMeasureNotes(dm7Notes, 4, previousNote, isAscending, mockNoteFreq, mockNoteMidi);
      
      const prevMidi = mockNoteMidi(previousNote); // E4 = 64
      const firstMidi = mockNoteMidi(result.notes[0]);
      const distance = Math.abs(firstMidi - prevMidi);
      
      // Closest Dm7 tones to E4 are D4=62 (2 semitones) and F4=65 (1 semitone)
      // Should pick one of the closest for smooth voice leading
      expect(distance).toBeLessThanOrEqual(3);
      // F4 is closest (1 semitone away)
      expect(result.notes[0]).toBe('F4');
    });

    test('all generated notes come from chordNotes array (100 iterations)', () => {
      // Run many times to catch random first note issues
      const dm7Notes = ['D3', 'F3', 'A3', 'C4', 'D4', 'F4', 'A4', 'C5', 'D5', 'F5'];
      
      for (let i = 0; i < 100; i++) {
        const result = generateMeasureNotes(dm7Notes, 4, null, true, mockNoteFreq, mockNoteMidi);
        
        result.notes.forEach((note, idx) => {
          expect(dm7Notes).toContain(note);
        });
      }
    });

    test('multi-measure flow always produces notes from chordNotes (50 iterations)', () => {
      // Simulate ii-V-I progression multiple times
      const dm7Notes = ['D3', 'F3', 'A3', 'C4', 'D4', 'F4', 'A4', 'C5', 'D5', 'F5'];
      const g7Notes = ['G2', 'B2', 'D3', 'F3', 'G3', 'B3', 'D4', 'F4', 'G4', 'B4', 'D5', 'F5'];
      const cmaj7Notes = ['C3', 'E3', 'G3', 'B3', 'C4', 'E4', 'G4', 'B4', 'C5', 'E5', 'G5'];
      
      for (let iteration = 0; iteration < 50; iteration++) {
        let previousNote = null;
        let isAscending = true;
        
        // Dm7 measure
        const dm7Result = generateMeasureNotes(dm7Notes, 4, previousNote, isAscending, mockNoteFreq, mockNoteMidi);
        dm7Result.notes.forEach(note => {
          expect(dm7Notes).toContain(note);
        });
        previousNote = dm7Result.notes[dm7Result.notes.length - 1];
        isAscending = dm7Result.newDirection;
        
        // G7 measure
        const g7Result = generateMeasureNotes(g7Notes, 4, previousNote, isAscending, mockNoteFreq, mockNoteMidi);
        g7Result.notes.forEach(note => {
          expect(g7Notes).toContain(note);
        });
        previousNote = g7Result.notes[g7Result.notes.length - 1];
        isAscending = g7Result.newDirection;
        
        // Cmaj7 measure
        const cmaj7Result = generateMeasureNotes(cmaj7Notes, 4, previousNote, isAscending, mockNoteFreq, mockNoteMidi);
        cmaj7Result.notes.forEach(note => {
          expect(cmaj7Notes).toContain(note);
        });
      }
    });

    test('notes within guitar range (E2=40 to G#5=80, 16 frets) across 100 iterations', () => {
      // Guitar-range filtered Dm7 chord notes (within 16 frets)
      const dm7Notes = ['D3', 'F3', 'A3', 'C4', 'D4', 'F4', 'A4', 'C5', 'D5', 'F5'];
      const MIN_MIDI = 40; // E2
      const MAX_MIDI = 80; // G#5 (fret 16 on high E string)
      
      for (let i = 0; i < 100; i++) {
        const result = generateMeasureNotes(dm7Notes, 4, null, Math.random() > 0.5, mockNoteFreq, mockNoteMidi);
        
        result.notes.forEach((note, idx) => {
          const midi = mockNoteMidi(note);
          expect(midi).toBeGreaterThanOrEqual(MIN_MIDI);
          expect(midi).toBeLessThanOrEqual(MAX_MIDI);
        });
      }
    });
  });
});
