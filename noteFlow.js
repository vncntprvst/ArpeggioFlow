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
 * Find the closest chord tone that respects smooth voice leading.
 * Constraints: 
 *  - proximity
    * For each measure except the first, the first note should be
    * the closest chord tone to the last note of the previous measure, as long
    * as it is within defined fret and guitar range.
    * (ideally unison, 1/2 step, or whole step - up to 4 semitones acceptable).
 *  - direction
    * When hitting the highest note (in pitch), reverse direction, and vice-versa.
    * When hitting the highest note (in pitch), reverse direction, and vice-versa for lowest note.
*   - continuity: 
    * Keep in direction from one measure to the next: keep ascending or descending.
 
 * 
 * @param {string} previousNote - The previous note
 * @param {string[]} chordNotes - Array of available chord notes (sorted by pitch)
 * @param {boolean} isAscending - Current direction (used to break ties)
 * @param {function} noteFreq - Function to get frequency from note name
 * @param {function} noteMidi - Function to get MIDI number from note name
 * @returns {{ note: string, newDirection: boolean }} - The closest note and updated direction
 */
function findClosestNote(previousNote, chordNotes, isAscending, noteFreq, noteMidi) {
  const previousMidi = noteMidi(previousNote);
  
  // Sort all notes by distance from previous note
  const sortedByDistance = [...chordNotes].map(note => ({
    note,
    midi: noteMidi(note),
    distance: Math.abs(noteMidi(note) - previousMidi)
  })).sort((a, b) => a.distance - b.distance);
  
  debugLog('findClosestNote - sorted by distance:', {
    previousNote,
    previousMidi,
    isAscending,
    top3: sortedByDistance.slice(0, 3).map(n => `${n.note} (dist: ${n.distance})`)
  });
  
  // The closest note is our primary choice for smooth voice leading
  const closest = sortedByDistance[0];
  
  // Determine the new direction based on where this note is relative to previous
  // If the closest note is above, we're now ascending; if below, descending
  // If same (unison), maintain current direction
  let newDirection = isAscending;
  if (closest.midi > previousMidi) {
    newDirection = true; // ascending
  } else if (closest.midi < previousMidi) {
    newDirection = false; // descending
  }
  // If unison (same MIDI), keep current direction
  
  debugLog('findClosestNote - result:', {
    closestNote: closest.note,
    distance: closest.distance,
    previousDirection: isAscending,
    newDirection
  });
  
  return closest.note;
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
        // This prioritizes proximity for smooth voice leading
        note = findClosestNote(previousNote, chordNotes, currentDirection, noteFreq, noteMidi);
        debugLog('First note (closest):', note);
        
        // Update direction based on the movement from previous note to this note
        const prevMidi = noteMidi(previousNote);
        const currMidi = noteMidi(note);
        if (currMidi > prevMidi) {
          currentDirection = true; // we moved up, so continue ascending
        } else if (currMidi < prevMidi) {
          currentDirection = false; // we moved down, so continue descending
        }
        // If same pitch (unison), keep the current direction
        
        debugLog('Direction updated after closest note:', {
          prevMidi,
          currMidi,
          newDirection: currentDirection
        });
      }
    } else {
      // Subsequent notes: follow direction
      note = getNextNoteInDirection(notes, chordNotes, currentDirection);
    }

    notes.push(note);

    // Check if we need to reverse direction (hit a boundary)
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
