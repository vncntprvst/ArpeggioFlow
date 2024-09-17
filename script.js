// PLace imports here. e.g.:
// import { autumnLeavesData } from './autumn_leaves_melody.js';

window.onload = function() {
    const statusDiv = document.getElementById('status');

    // Check if VexFlow loaded
    let vexflowLoaded = typeof Vex !== 'undefined';

    if (!vexflowLoaded) {
        statusDiv.innerHTML = "Failed to load VexFlow.";
    } else {
        statusDiv.style.display = "none";  // Hide the status div if VexFlow is loaded
        
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
        const { Renderer, Stave, StaveNote, Voice, Formatter } = VF;
        const div = document.getElementById('notation');
        // Set the width and height of the renderer to allow wrapping
        const renderer = new Renderer(div, Renderer.Backends.SVG);
        const width = 1200;  // Set a reasonable width for your SVG area
        const height = 500;  // Set the height based on expected content
        renderer.resize(width, height);
        const context = renderer.getContext();
    
        // Define some constants for positioning
        const staveWidth = 250;  // Adjust the width of each stave (make them smaller to fit more)
        const staveHeight = 150; // Spacing between lines of staves (increased to allow for chord diagrams)
        let xStart = 50;         // Initial x-position
        let yStart = 40;         // Initial y-position
    
        // Set a maximum width before wrapping to a new line
        const maxStaveWidth = width - 20;  // Leave some margin on the right

        // Configure the rendering context
        const stave = new Stave(10, 40, 680);
        stave.addClef('treble').addTimeSignature('4/4');
        stave.setContext(context).draw();

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

        let notes = [];

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

            // Generate random notes from the chord notes
            chordNotes.forEach(note => {
            // Adjust octave to fit within a reasonable range
            const octaveAdjustedNote = `${note}4`;
            notes.push(new StaveNote({
                clef: 'treble',
                keys: [octaveAdjustedNote],
                duration: 'q'
            }));
            });
        });

        console.log('Total Notes Generated:', notes.length);
        console.log('Notes Array:', notes);

        if (notes.length === 0) {
            alert('No notes were generated. Please check your inputs.');
            return;
        }

        // Create a voice and add notes
        const voice = new Voice({ num_beats: bars * 4, beat_value: 4 });
        voice.addTickables(notes);

        // Format and justify the notes
        const formatter = new Formatter().joinVoices([voice]).format([voice], 650);

        // Render voice
        voice.draw(context, stave);
    }
};

