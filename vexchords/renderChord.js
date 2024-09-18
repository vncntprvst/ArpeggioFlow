// This worked in the console, but not from the script ...  
// Using <script src="vexchords/vexchords.dev.js"></script> in the HTML file

function renderChord(cagedShape) {
    if (!vexchords) {
        console.error('VexChords is not available. Please ensure it is loaded.');
        return;
    }

    // Convert frets to chord array format, handling muted (-1) strings as 'x'
    let chord = cagedShape.frets[0].map((fret, index) => {
        if (fret === -1) {
            return [index + 1, 'x'];  // Muted string
        } else {
            return [index + 1, fret]; // Regular fret number or 0 for open string
        }
    });

    // Calculate the position (starting fret) for this chord
    let minFret = Math.min(...cagedShape.frets[0].filter(f => f > 0));
    let position = minFret > 1 ? minFret : 1;

    console.log('Rendering chord with position:', position, 'and processed frets:', chord);

    // Clear previous diagram before drawing a new one
    const chordDiagram = document.getElementById('chord-diagram');
    chordDiagram.innerHTML = ''; // This will clear any previous diagrams

    // Render the chord diagram using VexChords
    vexchords.draw(chordDiagram, {
        chord: chord,    // Chord array in the format that VexChords expects
        strings: 6,      // Number of strings
        position: position, // Dynamically set the starting fret based on the chord
        barres: [],      // Any barres (optional)
        tuning: ['E', 'A', 'D', 'G', 'B', 'E'] // Standard tuning
    });
}

const aShapeChord = {
    shape: 'A Shape',
    frets: [[0, 2, 2, 2, 0, 'x']]
  };
  renderChord(aShapeChord);

const cShapeChord = {
    shape: 'C Shape',
    frets: [[0, 1, 0, 2, 3, 0]]
  };
  renderChord(cShapeChord);

const dShapeChord = {
    shape: 'D Shape',
    frets: [[2, 3, 2, 0, 'x', 'x']]
  };
  renderChord(dShapeChord);