// cagedShapes.js

export const CAGED_SHAPES = {
    C: { frets: [[3, 1, 0, 0, 1, 0]], name: "C Shape" },  // Example C shape frets
    A: { frets: [[0, 2, 2, 2, 0, -1]], name: "A Shape" }, // Example A shape frets
    G: { frets: [[3, 2, 0, 0, 0, 3]], name: "G Shape" },  // Example G shape frets
    E: { frets: [[0, 2, 2, 1, 0, 0]], name: "E Shape" },  // Example E shape frets
    D: { frets: [[-1, -1, 0, 2, 3, 2]], name: "D Shape" } // Example D shape frets
};

/**
 * Get the fretting positions for the given shape and key
 * @param {string} shape - CAGED shape selected
 * @param {string} key - The musical key selected
 * @returns {object} - Fretting positions and chord data
 */
export function getCAGEDShape(shape, key) {
    const shapeInfo = CAGED_SHAPES[shape];
    
    // Transpose the shape based on the selected key (this is a simple transposition logic)
    const transposedShape = transposeShape(shapeInfo, key);

    return {
        shape: shapeInfo.name,
        frets: transposedShape.frets,
        key
    };
}

/**
 * Transpose the chord shape to match the selected key
 * @param {object} shapeInfo - The shape data from CAGED_SHAPES
 * @param {string} key - The key to transpose to
 * @returns {object} - Transposed shape
 */
function transposeShape(shapeInfo, key) {
    // You may use a library like Tonal.js to calculate the correct transposition
    // Example: transpose each fret in shapeInfo.frets by the number of semitones from the shape's root to the selected key

    // Assuming `tonal` is already loaded as a library
    // const transposedFrets = shapeInfo.frets.map(fret => tonal.transpose(fret, key));
    // For now, return the shape as is
    return shapeInfo; // Replace with actual transposition logic
}
