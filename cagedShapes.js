// cagedShapes.js
// export const CAGED_SHAPES = {
const CAGED_SHAPES = {
    C: {
        name: "C Shape",
        baseKey: "C",
        scaleType: "major",
        frets: [-1, 3, 2, 0, 1, 0], // Frets for C major in open position, strings 6 to 1
        rootString: 5, // String 5 (A string)
        startFret: 0, 
        endFret: 4 
    },
    A: {
        name: "A Shape",
        baseKey: "A",
        scaleType: "major",
        frets: [-1, 0, 2, 2, 2, 0],
        rootString: 5, // String 5 (A string)
        startFret: 5,
        endFret: 9 
    },
    G: {
        name: "G Shape",
        baseKey: "G",
        scaleType: "major",
        frets: [3, 2, 0, 0, 0, 3],
        rootString: 6, // String 6 (low E string)
        startFret: 3, 
        endFret: 7
    },
    E: {
        name: "E Shape",
        baseKey: "E",
        scaleType: "major",
        frets: [0, 2, 2, 1, 0, 0],
        rootString: 6, // String 6 (low E string)
        startFret: 0, 
        endFret: 4
    },
    D: {
        name: "D Shape",
        baseKey: "D",
        scaleType: "major",
        frets: [-1, -1, 0, 2, 3, 2],
        rootString: 4, // String 4 (D string)
        startFret: 7,
        endFret: 11
    }
};

/**
 * Get the fretting positions for the given shape and key
 * @param {string} shape - CAGED shape selected ("C", "A", "G", "E", "D")
 * @param {string} key - The musical key selected (e.g., "C", "D", "E")
 * @returns {object} - Transposed chord data including frets, barres, and position
 */
// export function getCAGEDShape(shape, key) {
function getCAGEDShape(shape, key) {
    const shapeInfo = CAGED_SHAPES[shape];
    if (!shapeInfo) {
        console.error(`Unknown shape: ${shape}`);
        return null;
    }

    // Transpose the shape based on the selected key
    const transposedShape = transposeShape(shapeInfo, key);

    return transposedShape;
}

/**
 * Transpose the chord shape to match the selected key
 * @param {object} shapeInfo - The shape data from CAGED_SHAPES
 * @param {string} targetKey - The key to transpose to
 * @returns {object} - Transposed shape
 */
function transposeShape(shapeInfo, targetKey) {
    const baseKey = shapeInfo.baseKey;
    console.log(`Transposing ${shapeInfo.name} from ${baseKey} to ${targetKey}`);

    // Calculate the interval in semitones between baseKey and targetKey
    const baseChroma = Tonal.Note.chroma(baseKey);
    const targetChroma = Tonal.Note.chroma(targetKey);

    if (baseChroma === null || targetChroma === null) {
        console.error(`Invalid note names: ${baseKey} or ${targetKey}`);
        return shapeInfo; // Return the original shape if notes are invalid
    }

    let semitones = targetChroma - baseChroma;
    if (semitones < 0) {
        semitones += 12;
    }
    console.log(`Interval in semitones: ${semitones}`);

    // Shift the frets in the shape by the interval
    const originalFrets = shapeInfo.frets;
    console.log(`Original shape frets: ${originalFrets}`);

    const transposedFrets = originalFrets.map(fret => {
        if (typeof fret === 'number' && fret >= 0) {
            return fret + semitones;
        } else if (fret === -1 || fret === 'x') {
            return 'x'; // Muted strings remain muted
        } else {
            return fret; // For any other cases
        }
    });
    console.log(`Transposed shape frets: ${transposedFrets}`);

    // Determine the starting fret (position)
    const frettedNotes = transposedFrets.filter(f => typeof f === 'number' && f > 0);
    const position = Math.min(...frettedNotes);
    console.log(`Position (starting fret): ${position}`);

    // Adjust frets relative to position
    const adjustedFrets = transposedFrets.map(fret => {
        if (typeof fret === 'number') {
            if (fret === 0) {
                return 0; // Open strings remain 0
            } else if (fret > 0) {
                return fret - position + 1; // Adjust fret number
            }
        } else {
            return fret; // 'x' or other non-number values
        }
    });
    console.log(`Adjusted frets (relative to position): ${adjustedFrets}`);

    // Identify barres if needed
    const barreStrings = [];
    adjustedFrets.forEach((fret, index) => {
        if (fret === 1) { // Since frets are relative to position
            barreStrings.push(6 - index); // Strings are numbered from 6 (low E) to 1 (high E)
        }
    });
    console.log(`Barre strings: ${barreStrings}`);

    const barres = [];
    if (barreStrings.length > 1) {
        barres.push({
            fromString: Math.min(...barreStrings),
            toString: Math.max(...barreStrings),
            fret: 1
        });
    }
    console.log(`Barres:`, barres);

    return {
        shape: shapeInfo.name,
        frets: [adjustedFrets],
        barres: barres, // Include barres if any
        position: position,
        key: targetKey,
        scaleType: shapeInfo.scaleType,
        baseKey: shapeInfo.baseKey
    };
}

/**
 * Convert the frets of a CAGED shape to a chord array format
 * @param {object} cagedShape - The transposed CAGED shape object
 * @returns {array} - Chord array format
 */
function convertFretsToChordArray(cagedShape, numStrings = 6) {
    // Converts frets to chord array format

    // Use the adjusted frets from cagedShape
    let fretsArray = cagedShape.frets[0];

    // Convert to chord format, handling muted ('x') strings
    let chordArray = fretsArray.map((fret, index) => {
        let stringNumber = numStrings - index; // Default to strings 6 (low E) to 1 (high E)
        if (fret === 'x') {
            return [stringNumber, 'x'];
        } else {
            return [stringNumber, fret];
        }
    });

    return chordArray;
}

// Attach functions to the global window object
window.getCAGEDShape = getCAGEDShape;