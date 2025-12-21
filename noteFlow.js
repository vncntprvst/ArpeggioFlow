/**
 * noteFlow.js
 *
 * Pure functions for note flow logic in the Arpeggio Flow App.
 * These functions handle voice leading, direction changes, and note selection
 * between measures. Extracted for easier testing and debugging.
 */

// Debug flag - set to true for verbose logging
const DEBUG = true;

function debugLog(...args) {
  if (DEBUG) {
    console.log('[noteFlow]', ...args);
  }
}

/**
 * Find the index of the closest note to ensure smooth transitions
 * @param {string} previousNote - The previous note (e.g., "C4")
 * @param {string[]} chordNotes - Array of available chord notes
 * @param {function} noteFreq - Function to get frequency from note name
 * @returns {number} - Index of the closest note in chordNotes
 */
function findClosestIndex(previousNote, chordNotes, noteFreq) {
  const previousFreq = noteFreq(previousNote);
  let closestIndex = 0;
  let minDifference = Infinity;

  chordNotes.forEach((note, index) => {
    const freq = noteFreq(note);
    const difference = Math.abs(freq - previousFreq);
    if (difference < minDifference) {
      minDifference = difference;
      closestIndex = index;
    }
  });

  debugLog('findClosestIndex:', { previousNote, closestIndex, closestNote: chordNotes[closestIndex] });
  return closestIndex;
}

/**
 * Find the closest chord tone that respects the current direction.
 * Prefers notes within 2 semitones in the correct direction.
 * If ascending, prefer notes at or above the previous note.
 * If descending, prefer notes at or below the previous note.
 * 
 * @param {string} previousNote - The previous note
 * @param {string[]} chordNotes - Array of available chord notes (sorted by pitch)
 * @param {boolean} isAscending - Current direction
 * @param {function} noteFreq - Function to get frequency from note name
 * @param {function} noteMidi - Function to get MIDI number from note name
 * @returns {string} - The closest appropriate note that respects direction
 */
function findClosestNote(previousNote, chordNotes, isAscending, noteFreq, noteMidi) {
  const previousMidi = noteMidi(previousNote);
  
  // Filter notes based on direction
  // If ascending: prefer notes at or above previous note
  // If descending: prefer notes at or below previous note
  const notesInDirection = chordNotes.filter(note => {
    const midi = noteMidi(note);
    if (isAscending) {
      return midi >= previousMidi;
    } else {
      return midi <= previousMidi;
    }
  });

  debugLog('findClosestNote - filtering by direction:', {
    previousNote,
    previousMidi,
    isAscending,
    totalNotes: chordNotes.length,
    notesInDirection: notesInDirection.length
  });

  // If there are notes in the correct direction, find the closest one
  if (notesInDirection.length > 0) {
    // Sort by distance from previous note
    const sortedByDistance = [...notesInDirection].sort(
      (a, b) => Math.abs(noteMidi(a) - previousMidi) - Math.abs(noteMidi(b) - previousMidi)
    );
    
    const candidateNote = sortedByDistance[0];
    const stepDiff = Math.abs(noteMidi(candidateNote) - previousMidi);
    
    debugLog('findClosestNote - found note in direction:', {
      candidateNote,
      stepDiff,
      within2Semitones: stepDiff <= 2
    });
    
    // If closest note in direction is within 2 semitones, use it
    if (stepDiff <= 2) {
      return candidateNote;
    }
    
    // Otherwise, get the first note in the direction (closest by pitch order)
    if (isAscending) {
      // Return the lowest note that's >= previous (first in ascending order)
      return notesInDirection[0];
    } else {
      // Return the highest note that's <= previous (last in descending order) 
      return notesInDirection[notesInDirection.length - 1];
    }
  }
  
  // No notes in the desired direction - we've hit a boundary
  // This means we need to reverse direction and pick from the other side
  debugLog('findClosestNote - no notes in direction, reversing');
  
  // Find the closest note overall (will be in opposite direction)
  const sortedByDistance = [...chordNotes].sort(
    (a, b) => Math.abs(noteMidi(a) - previousMidi) - Math.abs(noteMidi(b) - previousMidi)
  );
  
  return sortedByDistance[0];
}

/**
 * Get the next note based on ascending/descending direction
 * @param {string[]} currentMeasureNotes - Notes already in the current measure
 * @param {string[]} chordNotes - Array of available chord notes (sorted by pitch)
 * @param {boolean} isAscending - Whether we're going up or down
 * @returns {string} - The next note to play
 */
function getNextNoteInDirection(currentMeasureNotes, chordNotes, isAscending) {
  const lastNote = currentMeasureNotes[currentMeasureNotes.length - 1] || chordNotes[0];
  const idx = chordNotes.indexOf(lastNote);

  let nextIdx;
  if (idx === -1) {
    // Note not found in chord, start from beginning or end based on direction
    nextIdx = isAscending ? 0 : chordNotes.length - 1;
  } else {
    nextIdx = isAscending ? idx + 1 : idx - 1;
    // Wrap around if we go past the bounds
    nextIdx = (nextIdx + chordNotes.length) % chordNotes.length;
  }

  // Ensure we don't repeat the same note
  if (chordNotes[nextIdx] === lastNote && chordNotes.length > 1) {
    nextIdx = isAscending
      ? (idx + 2) % chordNotes.length
      : (idx - 2 + chordNotes.length) % chordNotes.length;
  }

  debugLog('getNextNoteInDirection:', {
    lastNote,
    idx,
    nextIdx,
    nextNote: chordNotes[nextIdx],
    isAscending
  });

  return chordNotes[nextIdx];
}

/**
 * Check if a note is at the boundary (first or last) of the chord notes array
 * @param {string} note - The note to check
 * @param {string[]} chordNotes - Array of available chord notes (sorted by pitch)
 * @returns {{ atBoundary: boolean, atLow: boolean, atHigh: boolean }} - Boundary info
 */
function reachedBoundary(note, chordNotes) {
  const idx = chordNotes.indexOf(note);
  const atLow = idx === 0;
  const atHigh = idx === chordNotes.length - 1;
  const atBoundary = atLow || atHigh;

  debugLog('reachedBoundary:', { note, idx, atLow, atHigh, atBoundary });

  return { atBoundary, atLow, atHigh };
}

/**
 * Determine if direction should reverse based on current note position
 * @param {string} note - Current note
 * @param {string[]} chordNotes - Array of chord notes sorted by pitch
 * @param {boolean} isAscending - Current direction
 * @returns {boolean} - New direction (true = ascending, false = descending)
 */
function shouldReverseDirection(note, chordNotes, isAscending) {
  const { atLow, atHigh } = reachedBoundary(note, chordNotes);

  // Reverse if we're ascending and hit the top, or descending and hit the bottom
  if (isAscending && atHigh) {
    debugLog('Reversing direction: was ascending, hit high boundary');
    return false;
  }
  if (!isAscending && atLow) {
    debugLog('Reversing direction: was descending, hit low boundary');
    return true;
  }

  return isAscending;
}

/**
 * Generate a sequence of notes for a measure following the arpeggio pattern
 * @param {string[]} chordNotes - Available chord notes sorted by pitch
 * @param {number} notesPerMeasure - How many notes to generate
 * @param {string|null} previousNote - Last note from previous measure (null for first measure)
 * @param {boolean} isAscending - Initial direction
 * @param {function} noteFreq - Function to get frequency
 * @param {function} noteMidi - Function to get MIDI number
 * @returns {{ notes: string[], newDirection: boolean }} - Generated notes and ending direction
 */
function generateMeasureNotes(chordNotes, notesPerMeasure, previousNote, isAscending, noteFreq, noteMidi) {
  const notes = [];
  let currentDirection = isAscending;

  debugLog('generateMeasureNotes START:', {
    chordNotes,
    notesPerMeasure,
    previousNote,
    isAscending
  });

  for (let i = 0; i < notesPerMeasure; i++) {
    let note;

    if (i === 0) {
      if (previousNote === null) {
        // First note of first measure: random selection
        const randomIdx = Math.floor(Math.random() * chordNotes.length);
        note = chordNotes[randomIdx];
        debugLog('First note (random):', note);
      } else {
        // First note of subsequent measure: find closest chord tone
        note = findClosestNote(previousNote, chordNotes, currentDirection, noteFreq, noteMidi);
        debugLog('First note (closest):', note);
      }
    } else {
      // Subsequent notes: follow direction
      note = getNextNoteInDirection(notes, chordNotes, currentDirection);
    }

    notes.push(note);

    // Check if we need to reverse direction
    currentDirection = shouldReverseDirection(note, chordNotes, currentDirection);
  }

  debugLog('generateMeasureNotes END:', { notes, newDirection: currentDirection });

  return { notes, newDirection: currentDirection };
}

// Export for Node.js/Jest testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEBUG,
    debugLog,
    findClosestIndex,
    findClosestNote,
    getNextNoteInDirection,
    reachedBoundary,
    shouldReverseDirection,
    generateMeasureNotes
  };
}

// Export to window for browser usage
if (typeof window !== 'undefined') {
  window.noteFlow = {
    DEBUG,
    debugLog,
    findClosestIndex,
    findClosestNote,
    getNextNoteInDirection,
    reachedBoundary,
    shouldReverseDirection,
    generateMeasureNotes
  };
}
