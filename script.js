// script.js

window.onload = function() {
    const statusDiv = document.getElementById('status');

    // Check if VexFlow and Tonal.js are loaded
    let vexflowLoaded = typeof Vex !== 'undefined';
    let tonalLoaded = typeof Tonal !== 'undefined';

    if (!vexflowLoaded || !tonalLoaded) {
        statusDiv.innerHTML = "Failed to load VexFlow or Tonal.js.";
    } else {
        statusDiv.style.display = "none";  // Hide the status div if VexFlow and Tonal.js are loaded

        // Attach event listener to the Generate Exercise button
        document.getElementById('generateButton').addEventListener('click', generateExercise);
    }
};

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
    const width = 1200;  // Set a reasonable width for your SVG area
    const height = 500;  // Set the height based on expected content
    renderer.resize(width, height);
    const context = renderer.getContext();

    // Define some constants for positioning
    const staveWidth = 250;  // Adjust the width of each stave
    const staveHeight = 150; // Spacing between lines of staves
    let xStart = 50;         // Initial x-position
    let yStart = 40;         // Initial y-position

    // Set a maximum width before wrapping to a new line
    const maxStaveWidth = width - 20;  // Leave some margin on the right

    // Parse the progression and adjust for the number of bars
    let chordsInProgression = progression.replace(/\s/g, '').split('-');
    console.log('Initial Chords in Progression:', chordsInProgression);

    // Adjust the progression to fit the number of bars
    let adjustedProgression = [];
    let barCount = 0;
    const totalChords = chordsInProgression.length;

    while (barCount < bars) {
        for (let i = 0; i < totalChords && barCount < bars; i++) {
            adjustedProgression.push(chordsInProgression[i]);
            barCount++;

            // Special case: Repeat the last chord if needed
            if (barCount === bars) {
                break;
            }
        }
    }

    console.log('Adjusted Progression:', adjustedProgression);

    // Now, for each chord in the adjustedProgression, generate notes
    const measures = [];  // Array to store measure data

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
            const octaveAdjustedNote = `${randomNote}/${4}`; // Corrected format
            console.log(`Adding note: ${octaveAdjustedNote}`);
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

    // Now, render the measures
    measures.forEach(function(measureData, index) {
        // If the next stave would exceed the maximum width, wrap to the next line
        if (xStart + staveWidth > maxStaveWidth) {
            xStart = 50;  // Reset x to the start of the next line
            yStart += staveHeight;  // Move y down to the next line
        }

        // Increase the width of the first stave to accommodate the clef, key signature, and time signature
        const currentStaveWidth = index === 0 ? staveWidth + 70 : staveWidth;

        // Create a stave for each measure
        const stave = new Stave(xStart, yStart, currentStaveWidth);
        if (index === 0) {
            stave.addClef('treble').addKeySignature(key).addTimeSignature('4/4');
        }
        stave.setContext(context).draw();

        // Attach the chord symbol as an annotation to the first note of the measure
        const firstNote = measureData.notes[0];
        const chordAnnotation = new Annotation(measureData.chordName)
            .setFont('Arial', 12, 'normal')
            .setVerticalJustification(Annotation.VerticalJustify.TOP);
        firstNote.addModifier(chordAnnotation, 0);

        // Create a voice in 4/4 and add the notes for this measure
        const voice = new Voice({ num_beats: 4, beat_value: 4 }).addTickables(measureData.notes);

        // Format and justify the notes to fit within the stave width
        new Formatter().joinVoices([voice]).format([voice], currentStaveWidth - 50);

        // Draw the voice (notes) on the stave
        voice.draw(context, stave);

        // Move the xStart for the next stave
        xStart += stave.width;  // Shift the next stave to the right
    });
}

