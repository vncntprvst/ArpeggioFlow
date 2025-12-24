Issue summary
- Arpeggio diagrams (VexChords) show chord tones within the selected scale shape, but several (all?) keys display dots one fret too low.
- Example: Key E, ii-V-I, C Shape: F#m7 low A shows at fret label 4 but should be 5 (6th string).
- Key C example: open string dots render above the nut (likely expected VexChords behavior), but fret labels still appear shifted.
- Cache busting applied to flow.js, but the labeling mismatch persists.

Debug harness
- Location: debug/fixit/index.html
- Purpose: render VexChords with multiple position/positionText combinations to verify absolute vs. relative fret expectations.
- How to run: open debug/fixit/index.html in the browser (static file works).
- Inputs tested are printed under each diagram so you can compare placement with the expected fret labels.

Where this happens
- Arpeggio diagrams rendered by VexChords via flow.js, using positions derived from cagedShapes.js scale_frets and Tonal.

Hypotheses
- The base position handed to VexChords is off by one for some shapes/keys.
- VexChords position + positionText rules differ from how we are mapping frets (bridge vs. nut offset).
- The fret labels in the diagram might be interpreted as absolute positions, while we are providing relative positions (or vice versa).
- The local VexChords build (libs/vexchords/vexchords.dev.js) may not match behavior in the repo/demo.

Things to try
- Verify VexChords positioning with a minimal HTML test harness:
  - draw a single chord with a known absolute position (e.g., position 5) and a single dot at fret 5 and see which label it lands under.
- Toggle VexChords inputs:
  - Try removing position entirely and provide absolute fret numbers.
  - Try position = minFret - 1 or position = minFret + 1 and compare with expected labels.
  - Try positionText = 0/1/2 and see how it affects dot placement/labeling.
- Compare against the official demo:
  - Rebuild or swap in the latest VexChords bundle from the repo and retest.
- Cross-check the chord mapping:
  - Print the string/fret pairs being passed to VexChords for a failing case (F#m7 in E, C Shape) and confirm they align with the expected low-string fret.
- Consider rendering the diagrams using Fretboard.js or a custom SVG for exact control over labeling and positioning.
