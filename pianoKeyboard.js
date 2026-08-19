/**
 * pianoKeyboard.js
 *
 * SVG piano keyboard renderer for piano mode. Pure geometry and DOM - all
 * music theory (which midis are in scale, labels, colors) stays in flow.js,
 * mirroring how fretboard.umd.js draws and flow.js colors.
 *
 * Keys are <rect class="piano-key piano-key--white|--black" data-midi="60">.
 * Markers are <g class="piano-marker" data-midi data-chroma> holding a
 * <circle class="piano-marker-circle"> plus a <text> label. Marker cx/cy are
 * numeric viewBox units (unlike fretboard.js's percentage strings), so the
 * shared ring/label helpers in flow.js can offset from them directly.
 *
 * Loaded as a plain script / side-effect module (same dual-export pattern
 * as noteFlow.js) so it works in the browser and in Jest.
 */

(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const WHITE_KEY_WIDTH = 40;
  const WHITE_KEY_HEIGHT = 200;
  const BLACK_KEY_WIDTH = WHITE_KEY_WIDTH * 0.6;
  const BLACK_KEY_HEIGHT = WHITE_KEY_HEIGHT * 0.62;
  const MARKER_RADIUS = 13;
  const OCTAVE_LABEL_BAND = 22;

  const WHITE_CHROMAS = new Set([0, 2, 4, 5, 7, 9, 11]);

  function isWhite(midi) {
    return WHITE_CHROMAS.has(((midi % 12) + 12) % 12);
  }

  function midiToNoteName(midi) {
    const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
  }

  /**
   * Parse a register value like 'C3-C5' into midi bounds. Falls back to the
   * default mid-low register on anything malformed.
   */
  function parsePianoRange(value) {
    const match = /^C(\d)-C(\d)$/.exec(typeof value === 'string' ? value.trim() : '');
    if (match) {
      const lowOct = parseInt(match[1], 10);
      const highOct = parseInt(match[2], 10);
      if (highOct > lowOct) {
        return {
          minMidi: (lowOct + 1) * 12,
          maxMidi: (highOct + 1) * 12,
          label: `C${lowOct}–C${highOct}`,
        };
      }
    }
    return { minMidi: 48, maxMidi: 72, label: 'C3–C5' };
  }

  function assertRange(minMidi, maxMidi) {
    if (!Number.isInteger(minMidi) || !Number.isInteger(maxMidi)) {
      throw new Error('pianoKeyboard: minMidi/maxMidi must be integers');
    }
    if (minMidi % 12 !== 0) {
      throw new Error('pianoKeyboard: range must start on a C');
    }
    const endChroma = maxMidi % 12;
    if (endChroma !== 0 && endChroma !== 11) {
      throw new Error('pianoKeyboard: range must end on a B or C');
    }
    if (maxMidi - minMidi < 11) {
      throw new Error('pianoKeyboard: range must span at least one octave');
    }
  }

  /** Number of white keys strictly below `midi`, counted from minMidi. */
  function whiteCountBelow(minMidi, midi) {
    let count = 0;
    for (let m = minMidi; m < midi; m += 1) {
      if (isWhite(m)) count += 1;
    }
    return count;
  }

  /** Center-x and center-y of a marker on the key for `midi`, in viewBox units. */
  function markerPosition(geom, midi) {
    if (isWhite(midi)) {
      return {
        cx: whiteCountBelow(geom.minMidi, midi) * WHITE_KEY_WIDTH + WHITE_KEY_WIDTH / 2,
        cy: WHITE_KEY_HEIGHT - MARKER_RADIUS - 8,
        onBlack: false,
      };
    }
    // A black key sits on the boundary between its neighbouring whites.
    return {
      cx: whiteCountBelow(geom.minMidi, midi + 1) * WHITE_KEY_WIDTH,
      cy: BLACK_KEY_HEIGHT - MARKER_RADIUS - 8,
      onBlack: true,
    };
  }

  function createMarkerElement(geom, { midi, label, className, opacity }) {
    const pos = markerPosition(geom, midi);
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', `piano-marker${pos.onBlack ? ' piano-marker--on-black' : ''}${className ? ` ${className}` : ''}`);
    g.setAttribute('data-midi', String(midi));
    g.setAttribute('data-chroma', String(midi % 12));
    if (opacity !== undefined) {
      g.style.opacity = String(opacity);
    }
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('class', 'piano-marker-circle');
    circle.setAttribute('cx', String(pos.cx));
    circle.setAttribute('cy', String(pos.cy));
    circle.setAttribute('r', String(MARKER_RADIUS));
    g.appendChild(circle);
    if (label) {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('class', 'piano-marker-text');
      text.setAttribute('x', String(pos.cx));
      text.setAttribute('y', String(pos.cy));
      text.setAttribute('dy', '4');
      text.setAttribute('text-anchor', 'middle');
      text.textContent = label;
      g.appendChild(text);
    }
    return g;
  }

  /**
   * Draw a keyboard covering minMidi..maxMidi (inclusive) into `container`,
   * replacing its contents. `markers` is [{ midi, label, className, opacity }].
   */
  function render(container, options) {
    const { minMidi, maxMidi, markers = [], showOctaveLabels = true } = options || {};
    assertRange(minMidi, maxMidi);

    const whiteTotal = whiteCountBelow(minMidi, maxMidi + 1);
    const width = whiteTotal * WHITE_KEY_WIDTH;
    const height = WHITE_KEY_HEIGHT + (showOctaveLabels ? OCTAVE_LABEL_BAND : 0);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'piano-keyboard');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', '100%');

    const whiteGroup = document.createElementNS(SVG_NS, 'g');
    const blackGroup = document.createElementNS(SVG_NS, 'g');
    const markerGroup = document.createElementNS(SVG_NS, 'g');
    markerGroup.setAttribute('class', 'piano-markers');

    const geom = { minMidi, maxMidi };

    for (let midi = minMidi; midi <= maxMidi; midi += 1) {
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('data-midi', String(midi));
      if (isWhite(midi)) {
        const x = whiteCountBelow(minMidi, midi) * WHITE_KEY_WIDTH;
        rect.setAttribute('class', 'piano-key piano-key--white');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', '0');
        rect.setAttribute('width', String(WHITE_KEY_WIDTH));
        rect.setAttribute('height', String(WHITE_KEY_HEIGHT));
        whiteGroup.appendChild(rect);
        if (showOctaveLabels && midi % 12 === 0) {
          const text = document.createElementNS(SVG_NS, 'text');
          text.setAttribute('class', 'piano-octave-label');
          text.setAttribute('x', String(x + WHITE_KEY_WIDTH / 2));
          text.setAttribute('y', String(WHITE_KEY_HEIGHT + OCTAVE_LABEL_BAND - 6));
          text.setAttribute('text-anchor', 'middle');
          text.textContent = midiToNoteName(midi);
          whiteGroup.appendChild(text);
        }
      } else {
        const cx = whiteCountBelow(minMidi, midi + 1) * WHITE_KEY_WIDTH;
        rect.setAttribute('class', 'piano-key piano-key--black');
        rect.setAttribute('x', String(cx - BLACK_KEY_WIDTH / 2));
        rect.setAttribute('y', '0');
        rect.setAttribute('width', String(BLACK_KEY_WIDTH));
        rect.setAttribute('height', String(BLACK_KEY_HEIGHT));
        blackGroup.appendChild(rect);
      }
    }

    markers.forEach((marker) => {
      if (marker.midi < minMidi || marker.midi > maxMidi) return;
      markerGroup.appendChild(createMarkerElement(geom, marker));
    });

    svg.appendChild(whiteGroup);
    svg.appendChild(blackGroup);
    svg.appendChild(markerGroup);

    container.innerHTML = '';
    container.appendChild(svg);
    container.__pianoGeom = geom;
    return svg;
  }

  function markerAt(container, midi) {
    return container.querySelector(`.piano-marker[data-midi="${midi}"]`);
  }

  function keyAt(container, midi) {
    return container.querySelector(`.piano-key[data-midi="${midi}"]`);
  }

  /**
   * Add a marker after render (e.g. a next-loop preview on an out-of-scale
   * key). Returns the element, or null when midi falls outside the drawn range.
   */
  function addMarker(container, marker) {
    const geom = container.__pianoGeom;
    if (!geom || marker.midi < geom.minMidi || marker.midi > geom.maxMidi) return null;
    const group = container.querySelector('.piano-markers');
    if (!group) return null;
    const el = createMarkerElement(geom, marker);
    group.appendChild(el);
    return el;
  }

  const api = {
    render,
    markerAt,
    keyAt,
    addMarker,
    parsePianoRange,
    midiToNoteName,
    MARKER_RADIUS,
    WHITE_KEY_WIDTH,
    WHITE_KEY_HEIGHT,
  };

  // Export for Node.js/Jest testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  // Export to window for browser usage
  if (typeof window !== 'undefined') {
    window.pianoKeyboard = api;
  }
})();
