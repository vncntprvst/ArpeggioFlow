window.onload = function() {
    const statusDiv = document.getElementById('status');
  
    // Check if VexFlow loaded
    let vexflowLoaded = typeof Vex !== 'undefined';
    
    // Check if Tonal loaded
    let tonalLoaded = typeof Tonal !== 'undefined';
  
    // Show error message if either library failed to load
    if (!vexflowLoaded || !tonalLoaded) {
      let message = "";
      
      if (!vexflowLoaded) {
        message += "Failed to load VexFlow.<br>";
      }
      
      if (!tonalLoaded) {
        message += "Failed to load Tonal.";
      }
  
      // Update the status message with the errors
      statusDiv.innerHTML = message;
    } else {
      statusDiv.style.display = "none";  // Hide the status div if both libraries are loaded
    }
  
    if (vexflowLoaded && tonalLoaded) {
      // Use Tonal to get the D Major scale notes
      const dMajorScale = Tonal.Scale.get("D major").notes;
  
      // Use VexFlow to render the scale
      const VF = Vex.Flow;
      const div = document.getElementById("output");
      const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);
      renderer.resize(500, 200);
      const context = renderer.getContext();
      const stave = new VF.Stave(10, 40, 400);
      stave.addClef("treble").addTimeSignature("4/4");
      stave.setContext(context).draw();
  
      const notes = dMajorScale.map(note => new VF.StaveNote({
        clef: "treble",
        keys: [note.toLowerCase() + "/4"],
        duration: "q"
      }));
  
      const voice = new VF.Voice({ num_beats: dMajorScale.length, beat_value: 4 });
      voice.addTickables(notes);
  
      const formatter = new VF.Formatter().joinVoices([voice]).format([voice], 400);
      voice.draw(context, stave);
    }
  };
  