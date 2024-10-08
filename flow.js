// Purpose: Main script file for the CAGED Chords Exercise Generator.

// flow.js

// Define the tuning
const tuning = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
const colors = {
    defaultFill: "white",
    defaultActiveFill: "#ff636c",
    defaultStroke: "black",
    defaultActiveStroke: "#ff636c",
    disabled: "#aaa",
    primaryFill: "#3273dc",
    intervals: {
      "1P": "#F25116",
      "2M": "#FCFF6C",
      "2m": "#FCFF6C",
      "3m": "#F29727",
      "3M": "#F29727",
      "4P": "#2FABEE",
      "4A": "#2FABEE",
      "5P": "#D89D6A",
      "5A": "#D89D6A",
      "6M": "#D7FFAB",
      "6m": "#D7FFAB",
      "7M": "#96ADC8",
      "7m": "#96ADC8"
    }
};


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
function renderScaleDiagram(cagedShape) {
    // Clear previous content
    document.getElementById('fretboard-container').innerHTML = '';

    // Select the container directly
    const scaleDiagram = document.getElementById('fretboard-container'); 
    scaleDiagram.className = 'fretboard-diagram';

    // Create a new Fretboard instance
    const fretboardInstance = new fretboard.Fretboard({
        el: scaleDiagram,
        height: 200,
        stringsWidth: 1.5,
        dotSize: 25,
        fretCount: 16,
        fretsWidth: 1.2,
        font: 'Futura',
        tuning: tuning,
        dotText: ({ note, degree }) => degree === 1 ? '1' : note,
        dotFill: ({ note, degree, inScale }) => {
            if (inScale) {
                return degree === 1 ? '#00BCD4' : '#FF7043';  // Teal for root, Coral for others
            } else {
                return "rgba(200, 200, 200, 0.4)";  // Dull grey for notes out of scale
            }
        },
        dotStrokeColor: '#FFFFFF',
        dotStrokeWidth: 1,
        showFretNumbers: true,
    });

    // Render the scale and retrieve the scale data
    let scaleData = fretboardInstance.renderScale({
        type: cagedShape.scaleType,
        root: cagedShape.key,
        box: {
            system: fretboard.Systems.CAGED,
            box: cagedShape.baseKey,
        },
    });
    console.log('Scale Data:', scaleData);

    // Query all dot elements that are in the scale's chord box
    const boxDots = document.querySelectorAll('.dot.dot-in-box');

    // Extract fret numbers and string information
    const combinedFrets = Array.from(boxDots).map(dot => {
        const fretClass = Array.from(dot.classList).find(cls => cls.startsWith('dot-fret-'));
        return parseInt(fretClass.split('-')[2], 10); // Parse the fret number from the class
    });

    // Filter valid frets and calculate range for highlighting
    let validFrets = combinedFrets.filter(fret => fret >= 0);
    console.log('Adjusted combined frets:', validFrets);

    let startFret = Math.min(...validFrets);
    let endFret = Math.max(...validFrets);
    console.log('Computed Fret Range: Start:', startFret, 'End:', endFret);

    // Set up highlight coordinates for the scale shape
    const highlightStart = { string: 6, fret: startFret };
    const highlightEnd = { string: 1, fret: endFret };

    console.log('Highlighted Area Coordinates:', highlightStart, highlightEnd);

    // Apply the highlighting area based on the scale data
    fretboardInstance.highlightAreas([highlightStart, highlightEnd]);

    // Style the highlighted area
    fretboardInstance.style({
        filter: (position) => {
            return position.fret >= startFret && position.fret <= endFret;
        },
        fill: 'rgba(200, 200, 200, 0.2)',  
        stroke: '#AAAAAA',  
        strokeWidth: 2      
    });

    // Apply dull color class for out-of-scale notes
    document.querySelectorAll('.dot').forEach(dot => {
        if (!dot.classList.contains('dot-in-box')) {
            dot.classList.add('dot-out-of-scale');
        }
    }); 
}

function generateExercise() {
    const key = document.getElementById('key').value;
    const progression = document.getElementById('progression').value;
    const bars = parseInt(document.getElementById('bars').value);
    const shape = document.getElementById('shape').value;

    // Debugging outputs
    console.log('Selected Key:', key);
    console.log('Selected Progression:', progression);
    console.log('Number of Bars:', bars);
    console.log('Selected Shape:', shape);

    // Validate selections
    if (!key || !progression || !bars || !shape) {
        alert('Please select a key, progression, number of bars, and chord shape.');
        return;
    }

    // Clear previous notation
    document.getElementById('notation').innerHTML = '';

    // Initialize VexFlow Renderer
    const VF = Vex.Flow;
    const { Renderer, Stave, StaveNote, Voice, Formatter, Annotation } = VF;
    const div = document.getElementById('notation');

    // Set the width and height of the renderer to allow wrapping
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    const width = 1200;
    const height = 500;
    renderer.resize(width, height);
    const context = renderer.getContext();

    // Define some constants for positioning
    const staveWidth = 250;
    const staveHeight = 150;
    let xStart = 50;
    let yStart = 40;

    // Set a maximum width before wrapping to a new line
    const maxStaveWidth = width - 20;

    // Parse the progression and adjust for the number of bars
    let chordsInProgression = progression.replace(/\s/g, '').split('-');
    console.log('Initial Chords in Progression:', chordsInProgression);

    // Adjust the progression to fit the number of bars
    let adjustedProgression = [];
    const totalChords = chordsInProgression.length;
    let fullCycles = Math.floor(bars / totalChords);
    let remainingBars = bars % totalChords;

    // Add full cycles of the progression
    for (let i = 0; i < fullCycles; i++) {
        adjustedProgression = adjustedProgression.concat(chordsInProgression);
    }

    // Handle the remaining bars
    if (remainingBars > 0) {
        if (remainingBars === 1) {
            // Add the "I" chord to end the progression
            adjustedProgression.push(chordsInProgression[totalChords - 1]);
        } else {
            // Add the necessary chords from the progression
            adjustedProgression = adjustedProgression.concat(chordsInProgression.slice(0, remainingBars));
        }
    }

    console.log('Adjusted Progression:', adjustedProgression);

    // Generate measures based on the adjusted progression
    const measures = [];

    adjustedProgression.forEach(function(chordSymbol) {
        // Map chord numerals to scale degrees and qualities
        const chordMap = {
            'I': { degree: 1, quality: 'maj7' },
            'ii': { degree: 2, quality: 'm7' },
            'iii': { degree: 3, quality: 'm7' },
            'IV': { degree: 4, quality: 'maj7' },
            'V': { degree: 5, quality: '7' },
            'vi': { degree: 6, quality: 'm7' },
            'vii°': { degree: 7, quality: 'm7b5' }
        };

        const chordInfo = chordMap[chordSymbol];

        if (!chordInfo) {
            alert(`Unknown chord symbol: ${chordSymbol}`);
            return;
        }

        // Get the chord root note
        const scale = Tonal.Scale.get(`${key} major`).notes;
        console.log(`Scale for ${key} major:`, scale);

        const rootNote = scale[chordInfo.degree - 1];
        console.log(`Chord Root Note for ${chordSymbol}:`, rootNote);

        // Get chord notes using Tonal.js
        const chordName = `${rootNote}${chordInfo.quality}`;
        console.log(`Chord Name:`, chordName);

        const chordData = Tonal.Chord.get(chordName);
        const chordNotes = chordData.notes;
        console.log(`Chord Notes for ${chordName}:`, chordNotes);

        if (!chordNotes || chordNotes.length === 0) {
            console.error(`No notes found for chord: ${chordName}`);
            return;
        }

        // Generate random notes from the chord notes to fill the measure
        let measureNotes = [];

        // Assume 4/4 time, so we need to fill 4 beats
        // For simplicity, let's generate 4 quarter notes
        for (let i = 0; i < 4; i++) {
            // Randomly pick a note from chordNotes
            const randomNote = chordNotes[Math.floor(Math.random() * chordNotes.length)];
            // Adjust octave to fit within a reasonable range
            const octaveAdjustedNote = `${randomNote}/${4}`;
            // console.log(`Adding note: ${octaveAdjustedNote}`);
            measureNotes.push(new StaveNote({
                clef: 'treble',
                keys: [octaveAdjustedNote],
                duration: 'q'
            }));
        }

        // Create the measure data
        measures.push({
            chordSymbol: chordSymbol,
            chordName: chordName,
            notes: measureNotes
        });
    });

    // Render the measures
    measures.forEach(function(measureData, index) {
        // Wrap to next line if necessary
        if (xStart + staveWidth > maxStaveWidth) {
            xStart = 50;
            yStart += staveHeight;
        }

        const currentStaveWidth = index === 0 ? staveWidth + 70 : staveWidth;

        // Create a stave for each measure
        const stave = new Stave(xStart, yStart, currentStaveWidth);
        if (index === 0) {
            stave.addClef('treble').addKeySignature(key).addTimeSignature('4/4');
        }
        stave.setContext(context).draw();

        // Attach the chord symbol as an annotation
        const firstNote = measureData.notes[0];
        const chordAnnotation = new Annotation(measureData.chordName)
            .setFont('Arial', 12, 'normal')
            .setVerticalJustification(Annotation.VerticalJustify.TOP);
        firstNote.addModifier(chordAnnotation, 0);

        // Create a voice and add the notes
        const voice = new Voice({ num_beats: 4, beat_value: 4 }).addTickables(measureData.notes);

        // Format and justify the notes
        new Formatter().joinVoices([voice]).format([voice], currentStaveWidth - 50);

        // Draw the voice
        voice.draw(context, stave);

        // Move xStart for the next stave
        xStart += stave.width;
    });
}

// Initialize the application after DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    const statusDiv = document.getElementById('status');

    // Check if VexFlow and Tonal.js are loaded
    let vexflowLoaded = typeof Vex !== 'undefined';
    let tonalLoaded = typeof Tonal !== 'undefined';
    let vexchordsLoaded = typeof vexchords !== 'undefined';

    if (!vexflowLoaded || !tonalLoaded || !vexchordsLoaded) {
        statusDiv.innerHTML = "Failed to load VexFlow, Tonal, or VexChords.";
    } else {
        statusDiv.style.display = "none";  // Hide the status div if everything is loaded

        // Attach event listener to the Generate Exercise button
        document.getElementById('generateButton').addEventListener('click', () => {
            const key = document.getElementById('key').value;
            const progression = document.getElementById('progression').value;
            const bars = document.getElementById('bars').value;
            const shape = document.getElementById('shape').value;

            // Validate selections
            if (!key || !progression || !bars || !shape) {
                alert('Please select a key, progression, number of bars, and chord shape.');
                return;
            }

            // Generate CAGED shape (ensure getCAGEDShape is working)
            const cagedShape = getCAGEDShape(shape, key);
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
