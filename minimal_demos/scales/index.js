// index.js

import { Fretboard, Systems } from '@moonwave99/fretboard.js';
import { Scale, Note } from 'tonal';
console.log('Systems:', Systems);

// Define the tuning
const tuning = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

// Define CAGED shapes and their corresponding fret ranges
const shapeFretRanges = {
  C: { startFret: 0, endFret: 4 },
  A: { startFret: 5, endFret: 9 },
  G: { startFret: 3, endFret: 7 },
  E: { startFret: 0, endFret: 4 },
  D: { startFret: 7, endFret: 11 },
};

// Function to render the scale diagram
function renderScaleDiagram(key, scaleType, shape = 'C') {
  const fretboardContainer = document.getElementById('fretboard');
  fretboardContainer.innerHTML = ''; // Clear previous content

  const fretRange = shapeFretRanges[shape];
  console.log('Selected Shape:', shape, 'Fret Range:', fretRange);

  // Set a fixed fretCount (e.g., 15) to accommodate all CAGED shapes
  const fretCount = 15;

  // Create a new Fretboard instance with fixed fretCount
  const fretboard = new Fretboard({
    el: '#fretboard',
    fretCount: fretCount, // Fixed fret count
    tuning: tuning,
    dotText: ({ note, degree }) => {
      return degree === 1 ? '1' : note;
    }, // Display '1' for root notes
    dotFill: ({ degree }) => (degree === 1 ? '#00BCD4' : '#FF7043'), // Teal for root notes, Coral for others
    dotStrokeColor: '#FFFFFF', // White for stroke color
    dotStrokeWidth: 1,
    showFretNumbers: true,
  });

  console.log('Fretboard Instance:', fretboard);

  // Render the scale on the fretboard with the CAGED system and selected shape
  fretboard.renderScale({
    type: scaleType,
    root: key,
    box: {
      system: Systems.CAGED, // Use the Systems enumeration
      box: shape,            // Specify the CAGED shape
    },
  });

  // Highlight the selected CAGED shape's fret range
  // Define start and end positions for highlighting
  const highlightStart = { string: 6, fret: fretRange.startFret }; // 6th string (low E)
  const highlightEnd = { string: 1, fret: fretRange.endFret };     // 1st string (high E)

  // Correctly invoke highlightAreas without nested arrays
  fretboard.highlightAreas([highlightStart, highlightEnd]);

  console.log('Highlighted Areas:', [highlightStart, highlightEnd]);

  // Apply custom styles to the highlighted areas
  fretboard.style({
    filter: (position) => {
      // Check if the position's fret is within the highlighted range
      return position.fret >= highlightStart.fret && position.fret <= highlightEnd.fret;
    },
    fill: 'rgba(0, 123, 255, 0.2)', // Semi-transparent blue
    stroke: '#007BFF',               // Blue border
    strokeWidth: 2,
  });
}

// Initial rendering with default values
const initialKey = 'C';
const initialScaleType = 'major';
const initialShape = 'C';
renderScaleDiagram(initialKey, initialScaleType, initialShape);

// Add event listener to the Generate button
document.getElementById('generateButton').addEventListener('click', () => {
  const key = document.getElementById('key').value;
  const scaleType = document.getElementById('scaleType').value;
  const shape = document.getElementById('shape').value;
  console.log('User Selection - Key:', key, 'Scale Type:', scaleType, 'Shape:', shape);
  renderScaleDiagram(key, scaleType, shape);
});
