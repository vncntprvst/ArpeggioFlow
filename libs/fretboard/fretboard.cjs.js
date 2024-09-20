'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var d3Selection = require('d3-selection');
var throttleDebounce = require('throttle-debounce');
var changeCase = require('change-case');
var note = require('@tonaljs/note');
var interval = require('@tonaljs/interval');
var scale = require('@tonaljs/scale');
var mode = require('@tonaljs/mode');

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __rest(s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
}

function getStringThickness({ stringWidth, stringIndex }) {
    if (typeof stringWidth === 'number') {
        return stringWidth;
    }
    return stringWidth[stringIndex] || 1;
}
function generateStrings({ stringCount, stringWidth, height }) {
    const strings = [];
    let currentStringWidth = 0;
    for (let i = 0; i < stringCount; i++) {
        currentStringWidth = getStringThickness({ stringWidth, stringIndex: i });
        let y = (height / (stringCount - 1)) * i;
        if (i === 0) {
            y += currentStringWidth / 2;
        }
        if (i === stringCount - 1) {
            y -= currentStringWidth / 2;
        }
        strings.push(y);
    }
    return strings;
}
function generateFrets({ scaleFrets, fretCount }) {
    const fretRatio = Math.pow(2, 1 / 12);
    const frets = [0];
    for (let i = 1; i <= fretCount; i++) {
        let x = (100 / fretCount) * i;
        if (scaleFrets) {
            x = 100 - 100 / Math.pow(fretRatio, i);
        }
        frets.push(x);
    }
    return frets.map(x => x / frets[frets.length - 1] * 100);
}
const accidentalMap = [{
        symbol: '##',
        replacement: 'double-sharp'
    }, {
        symbol: 'bb',
        replacement: 'double-flat'
    }, {
        symbol: '#',
        replacement: 'sharp'
    }, {
        symbol: 'b',
        replacement: 'flat'
    }];
function valueRenderer(key, value) {
    if (typeof value === 'boolean') {
        return !value ? 'false' : null;
    }
    if (key === 'note') {
        for (let i = 0; i < accidentalMap.length; i++) {
            const { symbol, replacement } = accidentalMap[i];
            if (`${value}`.endsWith(symbol)) {
                return `${`${value}`[0]}-${replacement}`;
            }
        }
        return `${value}`;
    }
    return `${value}`;
}
function classRenderer(prefix, key, value) {
    return [
        'dot',
        prefix,
        changeCase.paramCase(key),
        valueRenderer(key, value),
    ].filter(x => !!x).join('-');
}
function dotClasses(dot, prefix = '') {
    return [
        prefix ? `dot-${prefix}` : null,
        `dot-id-s${dot.string}:f${dot.fret}`,
        ...Object.entries(dot)
            .map(([key, value]) => {
            let valArray;
            if (!(value instanceof Array)) {
                valArray = [value];
            }
            else {
                valArray = value;
            }
            return valArray.map(value => classRenderer(prefix, key, value)).join(' ');
        })
    ].filter(x => !!x).join(' ');
}
function getDimensions({ topPadding, bottomPadding, leftPadding, rightPadding, width, height, showFretNumbers, fretNumbersHeight }) {
    const totalWidth = width + leftPadding + rightPadding;
    let totalHeight = height + topPadding + bottomPadding;
    if (showFretNumbers) {
        totalHeight += fretNumbersHeight;
    }
    return { totalWidth, totalHeight };
}
const getPositionFromMouseCoords = ({ event, stringsGroup, leftPadding, nutWidth, strings, frets, dots }) => {
    const { width: stringsGroupWidth, height: stringsGroupHeight } = stringsGroup.node().getBoundingClientRect();
    const bounds = event.target.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    let foundString = 0;
    const stringDistance = stringsGroupHeight / (strings.length - 1);
    for (let i = 0; i < strings.length; i++) {
        if (y < stringDistance * (i + 1)) {
            foundString = i;
            break;
        }
    }
    let foundFret = -1;
    const percentX = (Math.max(0, x - leftPadding) / stringsGroupWidth) * 100;
    for (let i = 0; i < frets.length; i++) {
        if (percentX < frets[i]) {
            foundFret = i;
            break;
        }
        foundFret = i;
    }
    if (x < leftPadding + nutWidth) {
        foundFret = 0;
    }
    const foundDot = dots.find(({ fret, string }) => fret === foundFret && string === foundString + 1);
    return foundDot || {
        string: foundString + 1,
        fret: foundFret
    };
};
function createHoverDiv({ bottomPadding, showFretNumbers, fretNumbersHeight }) {
    const hoverDiv = document.createElement('div');
    const bottom = bottomPadding
        + (showFretNumbers ? fretNumbersHeight : 0);
    hoverDiv.className = 'hoverDiv';
    hoverDiv.style.position = 'absolute';
    hoverDiv.style.top = '0';
    hoverDiv.style.bottom = `${bottom}px`;
    hoverDiv.style.left = '0';
    hoverDiv.style.right = '0';
    return hoverDiv;
}

function parseChord(chord) {
    const positions = [];
    const mutedStrings = [];
    const splitter = chord.indexOf('-') > -1 ? '-' : '';
    chord.split(splitter).reverse().forEach((fret, string) => {
        if (fret === '0') {
            return;
        }
        if (fret === 'x') {
            mutedStrings.push(string + 1);
            return;
        }
        positions.push({
            fret: +fret,
            string: string + 1
        });
    });
    return {
        positions,
        mutedStrings
    };
}

const MIDDLE_FRET = 11;
const THROTTLE_INTERVAL = 50;
const DEFAULT_FRET_COUNT = 15;
const DEFAULT_COLORS = {
    line: '#666',
    highlight: '#ff636c',
    dotStroke: '#555',
    dotFill: 'white',
    fretNumber: '#00000099',
    mutedString: '#333',
    dotText: '#111',
    barres: '#666',
    highlightStroke: 'transparent',
    highlightFill: 'dodgerblue'
};
const DEFAULT_DIMENSIONS = {
    width: 960,
    height: 150,
    unit: 20,
    line: 1,
    nut: 7
};
const DEFAULT_FONT_FAMILY = 'Arial';
const DEFAULT_FONT_SIZE = 12;
const GUITAR_TUNINGS = {
    default: ["E2", "A2", "D3", "G3", "B3", "E4"],
    halfStepDown: ["Eb2", "Ab2", "Db3", "Gb3", "Bb3", "Eb4"],
    dropD: ["D2", "A2", "D3", "G3", "B3", "E4"],
    openG: ["D2", "G2", "D3", "G3", "B3", "D4"],
    DADGAD: ["D2", "A2", "D3", "G3", "A3", "D4"]
};
const DEFAULT_HIGHLIGHT_BLEND_MODE = 'color-burn';

exports.Systems = void 0;
(function (Systems) {
    Systems["pentatonic"] = "pentatonic";
    Systems["CAGED"] = "CAGED";
    Systems["TNPS"] = "TNPS";
})(exports.Systems || (exports.Systems = {}));
const DEFAULT_MODE = 0;
const DEFAULT_PENTATONIC_MODE = 5;
const CAGED_ORDER = 'GEDCA';
const CAGEDDefinition = [
    {
        box: [
            '-6-71',
            '-34-5',
            '71-2-',
            '-5-6-',
            '-2-34',
            '-6-71'
        ],
        baseChroma: note.chroma('G#'),
        baseOctave: 2
    },
    {
        box: [
            '71-2',
            '-5-6',
            '2-34',
            '6-71',
            '34-5',
            '71-2'
        ],
        baseChroma: note.chroma('E#'),
        baseOctave: 2
    },
    {
        box: [
            '-2-34',
            '-6-71',
            '34-5',
            '71-2-',
            '-5-6-',
            '-2-34'
        ],
        baseChroma: note.chroma('D#'),
        baseOctave: 3
    },
    {
        box: [
            '34-5',
            '71-2',
            '5-6-',
            '2-34',
            '6-71',
            '34-5'
        ],
        baseChroma: note.chroma('C'),
        baseOctave: 3
    },
    {
        box: [
            '-5-6-',
            '-2-34',
            '6-71-',
            '34-5-',
            '71-2-',
            '-5-6-'
        ],
        baseChroma: note.chroma('A#'),
        baseOctave: 2
    }
];
const TNPSDefinition = [
    {
        box: [
            '--2-34',
            '--6-71',
            '-34-5-',
            '-71-2-',
            '4-5-6-',
            '1-2-3-'
        ],
        baseChroma: note.chroma('E'),
        baseOctave: 2
    },
    {
        box: [
            '--34-5',
            '--71-2',
            '4-5-6-',
            '1-2-3-',
            '5-6-7-',
            '2-34--'
        ],
        baseChroma: note.chroma('D'),
        baseOctave: 3
    },
    {
        box: [
            '-4-5-6',
            '-1-2-3',
            '5-6-7-',
            '2-34--',
            '6-71--',
            '34-5--'
        ],
        baseChroma: note.chroma('C'),
        baseOctave: 3
    },
    {
        box: [
            '--5-6-7',
            '--2-34-',
            '-6-71--',
            '-34-5--',
            '-71-2--',
            '4-5-6--'
        ],
        baseChroma: note.chroma('B'),
        baseOctave: 2
    },
    {
        box: [
            '--6-71',
            '--34-5',
            '-71-2-',
            '4-5-6-',
            '1-2-3-',
            '5-6-7-'
        ],
        baseChroma: note.chroma('A'),
        baseOctave: 2
    },
    {
        box: [
            '--71-2',
            '-4-5-6',
            '1-2-3-',
            '5-6-7-',
            '2-34--',
            '6-71--'
        ],
        baseChroma: note.chroma('G'),
        baseOctave: 2
    },
    {
        box: [
            '-1-2-3',
            '-5-6-7',
            '2-34--',
            '6-71--',
            '34-5--',
            '71-2--'
        ],
        baseChroma: note.chroma('F'),
        baseOctave: 2
    }
];
function getModeFromScaleType(type) {
    const { modeNum } = mode.get(type.replace('pentatonic', '').trim());
    return modeNum;
}
function getModeOffset(mode) {
    return note.chroma('CDEFGAB'.split('')[mode]);
}
function getPentatonicBoxIndex(box, mode) {
    if (mode === DEFAULT_PENTATONIC_MODE) {
        return box - 1;
    }
    return box % 5;
}
function getBoxPositions({ root, box, modeOffset = 0, baseChroma }) {
    let delta = note.chroma(root) - baseChroma - modeOffset;
    while (delta < -1) {
        delta += 12;
    }
    return box.reduce((memo, item, string) => ([
        ...memo,
        ...item.split('').map((x, i) => x !== '-'
            ? { string: string + 1, fret: i + delta }
            : null).filter(x => !!x)
    ]), []);
}
function getBox({ root, mode = -1, system, box }) {
    let foundBox;
    let modeNumber = system === exports.Systems.pentatonic
        ? DEFAULT_PENTATONIC_MODE
        : DEFAULT_MODE;
    if (typeof mode === 'string') {
        modeNumber = getModeFromScaleType(mode);
    }
    else if (mode > -1) {
        modeNumber = mode;
    }
    switch (system) {
        case exports.Systems.pentatonic:
            foundBox = CAGEDDefinition[getPentatonicBoxIndex(+box, modeNumber)];
            break;
        case exports.Systems.CAGED:
            foundBox = CAGEDDefinition[CAGED_ORDER.indexOf(`${box}`)];
            break;
        case exports.Systems.TNPS:
            foundBox = TNPSDefinition[+box - 1];
            break;
    }
    if (!foundBox) {
        throw new Error(`Cannot find box ${box} in the ${exports.Systems[system]} scale system`);
    }
    const { baseChroma, box: boxDefinition } = foundBox;
    return getBoxPositions({
        root,
        modeOffset: getModeOffset(modeNumber),
        baseChroma,
        box: system === exports.Systems.pentatonic
            ? boxDefinition.slice().map(x => x.replace('4', '-').replace('7', '-'))
            : boxDefinition
    });
}

const CHROMATIC_SCALE = scale.get('C chromatic').notes;
function parseNote(note) {
    let octave = +note.slice(-1);
    let parsedNote = note;
    if (isNaN(octave)) {
        octave = 2;
    }
    else {
        parsedNote = note.slice(0, -1);
    }
    return {
        octave,
        note: parsedNote
    };
}
function getOctaveInScale({ root, note: note$1, octave, baseOctave }) {
    const noteChroma = note.chroma(note$1) || 0;
    const rootChroma = note.chroma(root) || 0;
    if (rootChroma > noteChroma) {
        return octave - 1 - baseOctave;
    }
    return octave - baseOctave;
}
function isPositionInBox({ fret, string }, systemPositions) {
    return !!systemPositions.find(x => x.fret === fret && x.string === string);
}
class FretboardSystem {
    constructor(params) {
        this.tuning = GUITAR_TUNINGS.default;
        this.fretCount = DEFAULT_FRET_COUNT;
        Object.assign(this, params);
        const { note: baseNote, octave: baseOctave } = parseNote(this.tuning[0]);
        this.baseNote = baseNote;
        this.baseOctave = baseOctave;
        this.populate();
    }
    getTuning() {
        return this.tuning;
    }
    getFretCount() {
        return this.fretCount;
    }
    getNoteAtPosition(position) {
        const { chroma } = this.positions.find(x => x.string === position.string && x.fret === position.fret);
        const note = CHROMATIC_SCALE[chroma];
        const octave = this.getOctave(Object.assign(Object.assign({}, position), { chroma,
            note }));
        return { chroma, note, octave };
    }
    getScale({ type = 'major', root: paramsRoot = 'C', box }) {
        const { baseOctave } = this;
        const { note: root } = parseNote(paramsRoot);
        const scaleName = `${root} ${type}`;
        const { notes, empty, intervals } = scale.get(scaleName);
        if (empty) {
            throw new Error(`Cannot find scale: ${scaleName}`);
        }
        const mode = getModeFromScaleType(type);
        const boxPositions = box ? this.adjustOctave(getBox(Object.assign({ root, mode }, box)), paramsRoot) : [];
        const reverseMap = notes.map((note$1, index) => ({
            chroma: note.chroma(note$1),
            note: note$1,
            interval: intervals[index],
            degree: +intervals[index][0]
        }));
        return this.positions
            .filter(({ chroma }) => reverseMap.find(x => x.chroma === chroma))
            .map((_a) => {
            var { chroma } = _a, rest = __rest(_a, ["chroma"]);
            return (Object.assign(Object.assign({}, reverseMap.find(x => x.chroma === chroma)), rest));
        })
            .map(x => {
            const octave = this.getOctave(x);
            const position = Object.assign({ octave, octaveInScale: getOctaveInScale(Object.assign({ root, octave, baseOctave }, x)) }, x);
            if (boxPositions.length && isPositionInBox(x, boxPositions)) {
                position.inBox = true;
            }
            return position;
        });
    }
    adjustOctave(positions, root) {
        const { tuning } = this;
        const rootOffset = interval.semitones(interval.distance(tuning[0], root)) >= 12;
        const negativeFrets = positions.filter(x => x.fret < 0).length > 0;
        return positions.map(({ string, fret }) => ({
            string,
            fret: rootOffset || negativeFrets ? fret + 12 : fret
        }));
    }
    populate() {
        const { tuning, fretCount } = this;
        this.positions = tuning
            .slice().reverse()
            .reduce((memo, note$1, index) => {
            const string = index + 1;
            const { chroma } = note.get(note$1);
            const filledString = Array.from({ length: fretCount + 1 }, (_, fret) => ({
                string,
                fret,
                chroma: (chroma + fret) % 12
            }));
            return [...memo, ...filledString];
        }, []);
    }
    getOctave({ fret, string, chroma, note: note$1 }) {
        const { tuning } = this;
        const baseNoteWithOctave = tuning[tuning.length - string];
        const { note: baseNote, octave: baseOctave } = parseNote(baseNoteWithOctave);
        const baseChroma = note.chroma(baseNote);
        let octaveIncrement = chroma < baseChroma ? 1 : 0;
        if (note$1 === 'B#' && octaveIncrement > 0) {
            octaveIncrement--;
        }
        else if (note$1 === 'Cb' && octaveIncrement === 0) {
            octaveIncrement++;
        }
        octaveIncrement += Math.floor(fret / 12);
        return baseOctave + octaveIncrement;
    }
}

const defaultOptions = {
    el: '#fretboard',
    tuning: GUITAR_TUNINGS.default,
    stringCount: 6,
    stringWidth: DEFAULT_DIMENSIONS.line,
    stringColor: DEFAULT_COLORS.line,
    fretCount: DEFAULT_FRET_COUNT,
    fretWidth: DEFAULT_DIMENSIONS.line,
    fretColor: DEFAULT_COLORS.line,
    nutWidth: DEFAULT_DIMENSIONS.nut,
    nutColor: DEFAULT_COLORS.line,
    middleFretColor: DEFAULT_COLORS.highlight,
    middleFretWidth: 3 * DEFAULT_DIMENSIONS.line,
    scaleFrets: true,
    crop: false,
    fretLeftPadding: 0,
    topPadding: DEFAULT_DIMENSIONS.unit,
    bottomPadding: DEFAULT_DIMENSIONS.unit * .75,
    leftPadding: DEFAULT_DIMENSIONS.unit,
    rightPadding: DEFAULT_DIMENSIONS.unit,
    height: DEFAULT_DIMENSIONS.height,
    width: DEFAULT_DIMENSIONS.width,
    dotSize: DEFAULT_DIMENSIONS.unit,
    dotStrokeColor: DEFAULT_COLORS.dotStroke,
    dotStrokeWidth: 2 * DEFAULT_DIMENSIONS.line,
    dotTextSize: DEFAULT_FONT_SIZE,
    dotFill: DEFAULT_COLORS.dotFill,
    dotText: () => '',
    disabledOpacity: 0.9,
    showFretNumbers: true,
    fretNumbersHeight: 2 * DEFAULT_DIMENSIONS.unit,
    fretNumbersMargin: DEFAULT_DIMENSIONS.unit,
    fretNumbersColor: DEFAULT_COLORS.line,
    font: DEFAULT_FONT_FAMILY,
    barresColor: DEFAULT_COLORS.barres,
    highlightPadding: DEFAULT_DIMENSIONS.unit * .5,
    highlightRadius: DEFAULT_DIMENSIONS.unit * .5,
    highlightStroke: DEFAULT_COLORS.highlightStroke,
    highlightFill: DEFAULT_COLORS.highlightFill,
    highlightBlendMode: DEFAULT_HIGHLIGHT_BLEND_MODE
};
const defaultMuteStringsParams = {
    strings: [],
    width: 15,
    strokeWidth: 5,
    stroke: DEFAULT_COLORS.mutedString
};
function getDotCoords({ fret, string, frets, strings }) {
    let x = 0;
    if (fret === 0) {
        x = frets[0] / 2;
    }
    else {
        x = frets[fret] - (frets[fret] - frets[fret - 1]) / 2;
    }
    return { x, y: strings[string - 1] };
}
function generatePositions({ fretCount, stringCount, frets, strings }) {
    const positions = [];
    for (let string = 1; string <= stringCount; string++) {
        const currentString = [];
        for (let fret = 0; fret <= fretCount; fret++) {
            currentString.push(getDotCoords({ fret, string, frets, strings }));
        }
        positions.push(currentString);
    }
    return positions;
}
function validateOptions(options) {
    const { stringCount, tuning } = options;
    if (stringCount !== tuning.length) {
        throw new Error(`stringCount (${stringCount}) and tuning size (${tuning.length}) do not match`);
    }
}
function getBounds(area) {
    const getMinMax = (what) => [
        Math.min(...area.map(x => x[what])),
        Math.max(...area.map(x => x[what])),
    ];
    const [minString, maxString] = getMinMax('string');
    const [minFret, maxFret] = getMinMax('fret');
    return {
        bottomLeft: { string: maxString, fret: minFret },
        bottomRight: { string: maxString, fret: maxFret },
        topRight: { string: minString, fret: maxFret },
        topLeft: { string: minString, fret: minFret }
    };
}
class Fretboard {
    constructor(options = {}) {
        this.handlers = {};
        this.dots = [];
        this.options = Object.assign({}, defaultOptions, options);
        validateOptions(this.options);
        const { el, height, width, leftPadding, topPadding, stringCount, stringWidth, fretCount, scaleFrets, tuning } = this.options;
        this.strings = generateStrings({ stringCount, height, stringWidth });
        this.frets = generateFrets({ fretCount, scaleFrets });
        const { totalWidth, totalHeight } = getDimensions(this.options);
        this.system = new FretboardSystem({
            fretCount,
            tuning
        });
        this.positions = generatePositions(Object.assign(Object.assign({}, this), this.options));
        this.svg = (typeof el === 'string'
            ? d3Selection.select(el)
            : d3Selection.select(el))
            .append('div')
            .attr('class', 'fretboard-html-wrapper')
            .attr('style', 'position: relative')
            .append('svg')
            .attr('viewBox', `0 0 ${totalWidth} ${totalHeight}`);
        this.wrapper = this.svg
            .append('g')
            .attr('class', 'fretboard-wrapper')
            .attr('transform', `translate(${leftPadding}, ${topPadding}) scale(${width / totalWidth})`);
    }
    render() {
        const { wrapper, positions, options } = this;
        const { font, dotStrokeColor, dotStrokeWidth, dotFill, dotSize, dotText, dotTextSize, disabledOpacity } = this.options;
        const dotOffset = this.getDotOffset();
        this.baseRender(dotOffset);
        wrapper.select('.dots').remove();
        const dots = this.dots.filter(dot => dot.fret <= options.fretCount + dotOffset);
        if (!dots.length) {
            return this;
        }
        const dotGroup = wrapper
            .append('g')
            .attr('class', 'dots')
            .attr('font-family', font);
        const dotsNodes = dotGroup.selectAll('g')
            .data(dots)
            .enter()
            .filter(({ fret }) => fret >= 0)
            .append('g')
            .attr('class', dot => ['dot', dotClasses(dot, '')].join(' '))
            .attr('opacity', ({ disabled }) => disabled ? disabledOpacity : 1);
        dotsNodes.append('circle')
            .attr('class', 'dot-circle')
            .attr('cx', ({ string, fret }) => `${positions[string - 1][fret - dotOffset].x}%`)
            .attr('cy', ({ string, fret }) => positions[string - 1][fret - dotOffset].y)
            .attr('r', dotSize * 0.5)
            .attr('stroke', dotStrokeColor)
            .attr('stroke-width', dotStrokeWidth)
            .attr('fill', dotFill);
        dotsNodes.append('text')
            .attr('class', 'dot-text')
            .attr('x', ({ string, fret }) => `${positions[string - 1][fret - dotOffset].x}%`)
            .attr('y', ({ string, fret }) => positions[string - 1][fret - dotOffset].y)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .attr('font-size', dotTextSize)
            .text(dotText);
        return this;
    }
    setDots(dots) {
        this.dots = dots;
        return this;
    }
    clear() {
        this.setDots([]);
        this.wrapper.select('.dots').remove();
        return this;
    }
    style(_a) {
        var { filter = () => true, text, fontSize, fontFill } = _a, opts = __rest(_a, ["filter", "text", "fontSize", "fontFill"]);
        const { wrapper } = this;
        const { dotTextSize } = this.options;
        const filterFunction = filter instanceof Function
            ? filter
            : (dot) => {
                const [key, value] = Object.entries(filter)[0];
                return dot[key] === value;
            };
        const dots = wrapper.selectAll('.dot-circle')
            .filter(filterFunction);
        Object.keys(opts).forEach(key => dots.attr(key, opts[key]));
        if (text) {
            wrapper.selectAll('.dot-text')
                .filter(filterFunction)
                .text(text)
                .attr('font-size', fontSize || dotTextSize)
                .attr('fill', fontFill || DEFAULT_COLORS.dotText);
        }
        return this;
    }
    muteStrings(params) {
        const { wrapper, positions } = this;
        const { strings, stroke, strokeWidth, width } = Object.assign(Object.assign({}, defaultMuteStringsParams), params);
        wrapper
            .append('g')
            .attr('class', 'muted-strings')
            .attr('transform', `translate(${-width / 2}, ${-width / 2})`)
            .selectAll('path')
            .data(strings)
            .enter()
            .append('path')
            .attr('d', d => {
            const { y } = positions[d - 1][0];
            return [
                `M 0 ${y}`,
                `L ${width} ${y + width}`,
                `M ${width} ${y}`,
                `L 0 ${y + width}`
            ].join(' ');
        })
            .attr('stroke', stroke)
            .attr('stroke-width', strokeWidth)
            .attr('class', 'muted-string');
        return this;
    }
    renderChord(chord, barres) {
        const { positions, mutedStrings: strings } = parseChord(chord);
        this.setDots(positions);
        if (barres) {
            this.renderBarres([].concat(barres));
        }
        this.render();
        this.muteStrings({ strings });
        return this;
    }
    renderScale({ type, root, box }) {
        if (box && this.options.tuning.toString() !== GUITAR_TUNINGS.default.toString()) {
            console.warn('Selected scale system works for standard tuning. Wrong notes may be highlighted.');
        }
        const dots = this.system.getScale({ type, root, box });
        return this.setDots(dots).render();
    }
    renderBox({ type, root, box }) {
        if (this.options.tuning.toString() !== GUITAR_TUNINGS.default.toString()) {
            console.warn('Selected scale system works for standard tuning. Wrong notes may be highlighted.');
        }
        const dots = this.system.getScale({ type, root, box }).filter(({ inBox }) => inBox);
        return this.setDots(dots).render();
    }
    highlightAreas(...areas) {
        const { wrapper, options, positions } = this;
        const { width, dotSize, highlightPadding, highlightFill, highlightStroke, highlightBlendMode, highlightRadius } = options;
        const highlightGroup = wrapper
            .append('g')
            .attr('class', 'highlight-areas');
        const dotPercentSize = dotSize / width * 100;
        const highlightPaddingPercentSize = highlightPadding / width * 100;
        const dotOffset = this.getDotOffset();
        const bounds = areas.map(getBounds);
        highlightGroup
            .selectAll('rect')
            .data(bounds)
            .enter()
            .append('rect')
            .attr('class', 'area')
            .attr('y', ({ topLeft }) => positions[topLeft.string - 1][topLeft.fret - dotOffset].y - dotSize * 0.5 - highlightPadding)
            .attr('x', ({ topLeft }) => `${positions[topLeft.string - 1][topLeft.fret - dotOffset].x - dotPercentSize / 2 - highlightPaddingPercentSize}%`)
            .attr('rx', highlightRadius)
            .attr('width', ({ topLeft, topRight }) => {
            const from = positions[topLeft.string - 1][topLeft.fret].x;
            const to = positions[topRight.string - 1][topRight.fret].x;
            return `${to - from + dotPercentSize + 2 * highlightPaddingPercentSize}%`;
        })
            .attr('height', ({ topLeft, bottomLeft }) => {
            const from = positions[topLeft.string - 1][topLeft.fret].y;
            const to = positions[bottomLeft.string - 1][bottomLeft.fret].y;
            return to - from + dotSize + 2 * highlightPadding;
        })
            .attr('stroke', highlightStroke)
            .attr('fill', highlightFill)
            .attr('style', `mix-blend-mode: ${highlightBlendMode}`);
        return this;
    }
    clearHighlightAreas() {
        this.wrapper.select('.highlight-areas').remove();
        return this;
    }
    on(eventName, handler) {
        const { svg, options, strings, frets, hoverDiv, dots, system } = this;
        const stringsGroup = svg.select('.strings');
        if (!hoverDiv) {
            this.hoverDiv = createHoverDiv(options);
            svg.node().parentNode.appendChild(this.hoverDiv);
        }
        if (this.handlers[eventName]) {
            this.hoverDiv.removeEventListener(eventName, this.handlers[eventName]);
        }
        this.handlers[eventName] = throttleDebounce.throttle(THROTTLE_INTERVAL, (event) => {
            const position = getPositionFromMouseCoords(Object.assign({ event,
                stringsGroup,
                strings,
                frets,
                dots }, options));
            const { note, chroma } = system.getNoteAtPosition(position);
            handler(Object.assign(Object.assign({}, position), { note, chroma }), event);
        });
        this.hoverDiv.addEventListener(eventName, this.handlers[eventName]);
        return this;
    }
    removeEventListeners() {
        const { hoverDiv, handlers } = this;
        if (!hoverDiv) {
            return this;
        }
        Object
            .entries(handlers)
            .map(([eventName, handler]) => hoverDiv.removeEventListener(eventName, handler));
        return this;
    }
    renderBarres(barres) {
        const { wrapper, strings, options, positions } = this;
        const normalisedBarres = barres.map(({ fret, stringFrom, stringTo }) => ({
            fret,
            stringFrom: stringFrom
                ? Math.min(stringFrom, strings.length)
                : strings.length,
            stringTo: stringTo
                ? Math.max(stringTo, 1)
                : 1
        }));
        const { dotSize, barresColor } = options;
        const dotOffset = this.getDotOffset();
        const barreWidth = dotSize * .8;
        const barresGroup = wrapper
            .append('g')
            .attr('class', 'barres')
            .attr('transform', `translate(-${barreWidth * .5}, 0)`);
        barresGroup
            .selectAll('rect')
            .data(normalisedBarres)
            .enter()
            .append('rect')
            .attr('y', ({ fret, stringTo }) => positions[stringTo - 1][fret - dotOffset].y - dotSize * .75)
            .attr('x', ({ fret, stringFrom }) => `${positions[stringFrom - 1][fret - dotOffset].x}%`)
            .attr('rx', 7.5)
            .attr('width', barreWidth)
            .attr('height', ({ stringFrom, stringTo }) => strings[stringFrom - 1] - strings[stringTo - 1] + 1.5 * dotSize)
            .attr('fill', barresColor);
    }
    baseRender(dotOffset) {
        if (this.baseRendered) {
            return;
        }
        const { wrapper, frets, strings } = this;
        const { height, font, nutColor, nutWidth, stringColor, stringWidth, fretColor, fretWidth, middleFretWidth, middleFretColor, showFretNumbers, fretNumbersMargin, fretNumbersColor, topPadding } = this.options;
        const { totalWidth } = getDimensions(this.options);
        const stringGroup = wrapper
            .append('g')
            .attr('class', 'strings');
        stringGroup
            .selectAll('line')
            .data(strings)
            .enter()
            .append('line')
            .attr('x1', 0)
            .attr('y1', d => d)
            .attr('x2', '100%')
            .attr('y2', d => d)
            .attr('stroke', stringColor)
            .attr('stroke-width', (_d, i) => getStringThickness({ stringWidth, stringIndex: i }));
        const fretsGroup = wrapper
            .append('g')
            .attr('class', 'frets');
        fretsGroup
            .selectAll('line')
            .data(frets)
            .enter()
            .append('line')
            .attr('x1', d => `${d}%`)
            .attr('y1', 1)
            .attr('x2', d => `${d}%`)
            .attr('y2', height - 1)
            .attr('stroke', (_d, i) => {
            switch (i) {
                case 0:
                    return nutColor;
                case MIDDLE_FRET + 1:
                    return middleFretColor;
                default:
                    return fretColor;
            }
        })
            .attr('stroke-width', (_d, i) => {
            switch (i) {
                case 0:
                    return nutWidth;
                case MIDDLE_FRET + 1:
                    return middleFretWidth;
                default:
                    return fretWidth;
            }
        });
        if (showFretNumbers) {
            const fretNumbersGroup = wrapper
                .append('g')
                .attr('class', 'fret-numbers')
                .attr('font-family', font)
                .attr('transform', `translate(0 ${fretNumbersMargin + topPadding + strings[strings.length - 1]})`);
            fretNumbersGroup
                .selectAll('text')
                .data(frets.slice(1))
                .enter()
                .append('text')
                .attr('text-anchor', 'middle')
                .attr('x', (d, i) => totalWidth / 100 * (d - (d - frets[i]) / 2))
                .attr('fill', (_d, i) => i === MIDDLE_FRET ? middleFretColor : fretNumbersColor)
                .text((_d, i) => `${i + 1 + dotOffset}`);
        }
        this.baseRendered = true;
    }
    getDotOffset() {
        const { dots } = this;
        const { crop, fretLeftPadding } = this.options;
        return crop
            ? Math.max(0, Math.min(...dots.map(({ fret }) => fret)) - 1 - fretLeftPadding)
            : 0;
    }
}

exports.TetrachordTypes = void 0;
(function (TetrachordTypes) {
    TetrachordTypes["Major"] = "Major";
    TetrachordTypes["Minor"] = "Minor";
    TetrachordTypes["Phrygian"] = "Phrygian";
    TetrachordTypes["Harmonic"] = "Harmonic";
    TetrachordTypes["Lydian"] = "Lydian";
})(exports.TetrachordTypes || (exports.TetrachordTypes = {}));
exports.TetrachordLayouts = void 0;
(function (TetrachordLayouts) {
    TetrachordLayouts[TetrachordLayouts["Linear"] = 0] = "Linear";
    TetrachordLayouts[TetrachordLayouts["ThreePlusOne"] = 1] = "ThreePlusOne";
    TetrachordLayouts[TetrachordLayouts["TwoPlusTwo"] = 2] = "TwoPlusTwo";
    TetrachordLayouts[TetrachordLayouts["OnePlusThree"] = 3] = "OnePlusThree";
})(exports.TetrachordLayouts || (exports.TetrachordLayouts = {}));
const Tetrachords = {
    [exports.TetrachordTypes.Major]: ['M2', 'M2', 'm2'],
    [exports.TetrachordTypes.Minor]: ['M2', 'm2', 'M2'],
    [exports.TetrachordTypes.Phrygian]: ['m2', 'M2', 'M2'],
    [exports.TetrachordTypes.Harmonic]: ['m2', 'A2', 'm2'],
    [exports.TetrachordTypes.Lydian]: ['M2', 'M2', 'M2']
};
function tetrachord({ root, type, layout, string, fret } = {
    root: 'E',
    type: exports.TetrachordTypes.Major,
    layout: exports.TetrachordLayouts.Linear,
    string: 6,
    fret: 0
}) {
    const tetrachord = Tetrachords[type];
    const pattern = [{
            string,
            fret,
            note: root
        }];
    let partial = 0;
    let currentNote = root;
    if (layout === exports.TetrachordLayouts.Linear) {
        tetrachord.forEach(x => {
            const { semitones } = interval.get(x);
            currentNote = note.transpose(currentNote, x);
            partial += semitones;
            pattern.push({
                string,
                fret: fret + partial,
                note: currentNote
            });
        });
        return pattern;
    }
    if (string === 1) {
        throw new Error('Cannot split a tetrachord over two strings if starting on the first one');
    }
    let currentString = string;
    const splitIndex = (() => {
        switch (layout) {
            case exports.TetrachordLayouts.ThreePlusOne:
                return 2;
            case exports.TetrachordLayouts.TwoPlusTwo:
                return 1;
            case exports.TetrachordLayouts.OnePlusThree:
                return 0;
        }
    })();
    tetrachord.forEach((x, i) => {
        const { semitones } = interval.get(x);
        currentNote = note.transpose(currentNote, x);
        if (i === splitIndex) {
            currentString -= 1;
            partial = currentString === 2
                ? partial - 4
                : partial - 5;
        }
        partial += semitones;
        const currentFret = fret + partial;
        if (currentFret < 0) {
            throw new Error('Cannot use this layout from this starting fret');
        }
        pattern.push({
            string: currentString,
            fret: currentFret,
            note: currentNote
        });
    });
    return pattern;
}

function transform({ box = [], from = { string: 6, fret: 0 }, to = { string: 1, fret: 100 }, action = (x) => x } = {}) {
    function inSelection({ string, fret }) {
        if (string > from.string || string < to.string) {
            return false;
        }
        if (string === from.string && fret < from.fret) {
            return false;
        }
        if (string === to.string && fret > to.fret) {
            return false;
        }
        return true;
    }
    return box.map(x => inSelection(x) ? action(x) : x);
}
function disableStrings({ box = [], strings = [] }) {
    return box.map((_a) => {
        var { string } = _a, dot = __rest(_a, ["string"]);
        return (Object.assign({ string, disabled: strings.indexOf(string) > -1 }, dot));
    });
}
function sliceBox({ box = [], from = { string: 6, fret: 0 }, to = { string: 1, fret: 100 } } = {}) {
    const sortedBox = box.slice().sort((a, b) => {
        if (a.string > b.string) {
            return -1;
        }
        if (a.fret > b.fret) {
            return 1;
        }
        return -1;
    });
    function findIndex(key) {
        return sortedBox.findIndex(({ string, fret }) => string === key.string && fret === key.fret);
    }
    let fromIndex = findIndex(from);
    if (fromIndex === -1) {
        fromIndex = 0;
    }
    let toIndex = findIndex(to);
    if (toIndex === -1) {
        toIndex = sortedBox.length;
    }
    return sortedBox.slice(fromIndex, toIndex);
}
function disableDots({ box = [], from = { string: 6, fret: 0 }, to = { string: 1, fret: 100 } } = {}) {
    const action = (dot) => {
        return Object.assign({ disabled: true }, dot);
    };
    return transform({ box, from, to, action });
}

exports.Fretboard = Fretboard;
exports.FretboardSystem = FretboardSystem;
exports.GUITAR_TUNINGS = GUITAR_TUNINGS;
exports.disableDots = disableDots;
exports.disableStrings = disableStrings;
exports.sliceBox = sliceBox;
exports.tetrachord = tetrachord;
//# sourceMappingURL=fretboard.cjs.js.map
