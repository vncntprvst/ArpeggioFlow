import { autumnLeavesData } from './autumn_leaves_melody.js';

window.onload = function() {
    const statusDiv = document.getElementById('status');
  
    // Check if VexFlow loaded
    let vexflowLoaded = typeof Vex !== 'undefined';
  
    if (!vexflowLoaded) {
      statusDiv.innerHTML = "Failed to load VexFlow.";
    } else {
      statusDiv.style.display = "none";  // Hide the status div if VexFlow is loaded
  
      const VF = Vex.Flow;
      const div = document.getElementById("output");
  
      // Set the width and height of the renderer to allow wrapping
      const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);
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
  
      // Loop through each measure and render it
      autumnLeavesData.forEach((measureData, index) => {
        // If the next stave would exceed the maximum width, wrap to the next line
        if (xStart + staveWidth > maxStaveWidth) {
          xStart = 50;  // Reset x to the start of the next line
          yStart += staveHeight;  // Move y down to the next line
        }
  
        // Increase the width of the first stave to accommodate the clef, key signature, and time signature
        const currentStaveWidth = index === 0 ? staveWidth + 70 : staveWidth;
  
        // Create a stave for each measure
        const stave = new VF.Stave(xStart, yStart + 60, currentStaveWidth);
        if (index === 0) {
          stave.addClef("treble").addKeySignature("G").addTimeSignature("4/4");  // Add clef, key signature (G major), and time signature
        }
        stave.setContext(context).draw();
  
        // Attach the chord symbol as an annotation to the first note of the measure
        const firstNote = measureData.notes[0];
        const chordAnnotation = new VF.Annotation(measureData.chords)
          .setFont("Arial", 12, "normal")
          .setVerticalJustification(VF.Annotation.VerticalJustify.TOP);  // Position the chord above the stave
  
        firstNote.addModifier(chordAnnotation, 0);  // Attach chord to the first note
  
        // // Draw the chord chart using VexChords
        // const chordDivId = `chordDiagram_${index}`;
        // const chordDiv = document.createElement('div');
        // chordDiv.setAttribute('id', chordDivId);
        // chordDiv.style.position = 'absolute';
        // chordDiv.style.left = `${xStart}px`;
        // chordDiv.style.top = `${yStart}px`;
        // div.appendChild(chordDiv);
  
        // // Draw the chord diagram for the current chord
        // vexchords.draw(`#${chordDivId}`, {
        //   chord: measureData.chordFretboard
        // }, { width: 80, height: 100 });  // Adjust chord diagram size as needed
  
        // Create a voice in 4/4 and add the notes for this measure
        const voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).addTickables(measureData.notes);
  
        // Format and justify the notes to fit within the stave width
        new VF.Formatter().joinVoices([voice]).format([voice], currentStaveWidth - 50);
  
        // Draw the voice (notes) on the stave
        voice.draw(context, stave);
  
        // Move the xStart for the next stave
        xStart += stave.width;  // Shift the next stave to the right
      });
    }
  };
  