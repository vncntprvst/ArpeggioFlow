/**
 * pianoKeyboard.test.js
 *
 * Unit tests for the SVG piano keyboard renderer used in piano mode.
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;

const pianoKeyboard = require('../pianoKeyboard.js');

function freshContainer() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

describe('parsePianoRange', () => {
  test('parses a register value into midi bounds', () => {
    expect(pianoKeyboard.parsePianoRange('C3-C5')).toEqual({
      minMidi: 48,
      maxMidi: 72,
      label: 'C3–C5',
    });
    expect(pianoKeyboard.parsePianoRange('C2-C4')).toEqual({
      minMidi: 36,
      maxMidi: 60,
      label: 'C2–C4',
    });
  });

  test('falls back to the default register on malformed input', () => {
    const fallback = { minMidi: 48, maxMidi: 72, label: 'C3–C5' };
    expect(pianoKeyboard.parsePianoRange('')).toEqual(fallback);
    expect(pianoKeyboard.parsePianoRange(undefined)).toEqual(fallback);
    expect(pianoKeyboard.parsePianoRange('D3-D5')).toEqual(fallback);
    expect(pianoKeyboard.parsePianoRange('C5-C3')).toEqual(fallback);
  });
});

describe('render', () => {
  test('draws the right key counts for a two-octave register', () => {
    const container = freshContainer();
    pianoKeyboard.render(container, { minMidi: 48, maxMidi: 72 });
    // C3..C5 inclusive: 2 octaves of 7 white keys plus the closing C.
    expect(container.querySelectorAll('.piano-key--white').length).toBe(15);
    expect(container.querySelectorAll('.piano-key--black').length).toBe(10);
  });

  test('gives every midi in range a key element', () => {
    const container = freshContainer();
    pianoKeyboard.render(container, { minMidi: 48, maxMidi: 72 });
    for (let midi = 48; midi <= 72; midi += 1) {
      expect(pianoKeyboard.keyAt(container, midi)).not.toBeNull();
    }
    expect(pianoKeyboard.keyAt(container, 47)).toBeNull();
    expect(pianoKeyboard.keyAt(container, 73)).toBeNull();
  });

  test('supports a single C..B octave for chord diagrams', () => {
    const container = freshContainer();
    pianoKeyboard.render(container, { minMidi: 60, maxMidi: 71, showOctaveLabels: false });
    expect(container.querySelectorAll('.piano-key--white').length).toBe(7);
    expect(container.querySelectorAll('.piano-key--black').length).toBe(5);
    expect(container.querySelectorAll('.piano-octave-label').length).toBe(0);
  });

  test('places markers on the requested midis with numeric coordinates', () => {
    const container = freshContainer();
    pianoKeyboard.render(container, {
      minMidi: 48,
      maxMidi: 72,
      markers: [
        { midi: 60, label: 'C', className: 'piano-degree-1' },
        { midi: 61, label: 'Db', className: 'piano-degree-2' },
        { midi: 100, label: 'X' }, // outside the range: silently skipped
      ],
    });
    const onWhite = pianoKeyboard.markerAt(container, 60);
    const onBlack = pianoKeyboard.markerAt(container, 61);
    expect(onWhite).not.toBeNull();
    expect(onBlack).not.toBeNull();
    expect(pianoKeyboard.markerAt(container, 100)).toBeNull();
    expect(onWhite.getAttribute('class')).toContain('piano-degree-1');
    expect(onBlack.getAttribute('class')).toContain('piano-marker--on-black');
    const circle = onWhite.querySelector('.piano-marker-circle');
    expect(Number.isFinite(parseFloat(circle.getAttribute('cx')))).toBe(true);
    expect(Number.isFinite(parseFloat(circle.getAttribute('cy')))).toBe(true);
    expect(onWhite.dataset.chroma).toBe('0');
  });

  test('rejects ranges that do not start on a C or end on a B/C', () => {
    const container = freshContainer();
    expect(() => pianoKeyboard.render(container, { minMidi: 50, maxMidi: 72 })).toThrow();
    expect(() => pianoKeyboard.render(container, { minMidi: 48, maxMidi: 70 })).toThrow();
    expect(() => pianoKeyboard.render(container, { minMidi: 48, maxMidi: 50 })).toThrow();
  });

  test('replaces previous content on re-render', () => {
    const container = freshContainer();
    pianoKeyboard.render(container, { minMidi: 48, maxMidi: 72 });
    pianoKeyboard.render(container, { minMidi: 60, maxMidi: 72 });
    expect(container.querySelectorAll('svg').length).toBe(1);
    expect(container.querySelectorAll('.piano-key--white').length).toBe(8);
  });
});

describe('addMarker', () => {
  test('adds a marker after render and skips out-of-range midis', () => {
    const container = freshContainer();
    pianoKeyboard.render(container, { minMidi: 48, maxMidi: 72 });
    const added = pianoKeyboard.addMarker(container, {
      midi: 50,
      label: 'D',
      className: 'piano-marker--next-loop',
      opacity: 0.6,
    });
    expect(added).not.toBeNull();
    expect(pianoKeyboard.markerAt(container, 50)).toBe(added);
    expect(added.style.opacity).toBe('0.6');
    expect(pianoKeyboard.addMarker(container, { midi: 90, label: 'X' })).toBeNull();
  });
});
