const cases = [
  {
    title: 'Abs fret 5, no position',
    meta: 'Expect dot on row labeled 5 if absolute frets are honored.',
    chord: [[6, 5]],
    options: { width: 120, height: 160, numFrets: 5, showTuning: false }
  },
  {
    title: 'Rel fret 2, position=4, positionText=1',
    meta: 'Absolute 5 if position=4 uses relative frets.',
    chord: [[6, 2]],
    position: 4,
    positionText: 1,
    options: { width: 120, height: 160, numFrets: 5, showTuning: false }
  },
  {
    title: 'Rel fret 2, position=4, positionText=0',
    meta: 'Same as above, but no position label shift.',
    chord: [[6, 2]],
    position: 4,
    positionText: 0,
    options: { width: 120, height: 160, numFrets: 5, showTuning: false }
  },
  {
    title: 'Rel fret 1, position=5, positionText=1',
    meta: 'Absolute 5 with position=5.',
    chord: [[6, 1]],
    position: 5,
    positionText: 1,
    options: { width: 120, height: 160, numFrets: 5, showTuning: false }
  },
  {
    title: 'Absolute frets with position=4',
    meta: 'If VexChords expects relative frets, this should look wrong.',
    chord: [[6, 5]],
    position: 4,
    positionText: 1,
    options: { width: 120, height: 160, numFrets: 5, showTuning: false }
  },
  {
    title: 'Open string + fretted mix',
    meta: 'Check how open strings render relative to the nut.',
    chord: [[6, 0], [5, 2], [4, 2]],
    position: 1,
    positionText: 0,
    options: { width: 120, height: 160, numFrets: 5, showTuning: false }
  },
  {
    title: 'Rel fret 2, position=2, with open strings',
    meta: 'Same as the relative test but closer to the nut with open strings included.',
    chord: [[6, 2], [5, 2], [4, 0], [3, 0], [2, 0], [1, 0]],
    position: 2,
    positionText: 1,
    options: { width: 120, height: 160, numFrets: 5, showTuning: false }
  },
  {
    title: 'Abs fret 2, position=1, with open strings',
    meta: 'Same as previous but with position 1 and positionText 0.',
    chord: [[6, 2], [5, 2], [4, 0], [3, 0], [2, 0], [1, 0]],
    position: 1,
    positionText: 0,
    options: { width: 120, height: 160, numFrets: 5, showTuning: false }
  },
  {
    title: 'Abs fret 3, position=1',
    meta: 'Same as previous but moving down the neck.',
    chord: [[6, 3], [5, 4], [4, 1], [3, 1], [2, 1], [1, 1]],
    position: 1,
    positionText: 0,
    options: { width: 120, height: 160, numFrets: 5, showTuning: false }
  },
  {
    title: 'Abs fret 6, position=1',
    meta: 'Same as previous but moving further down the neck.',
    chord: [[6, 6], [5, 7], [4, 4], [3, 4], [2, 4], [1, 4]],
    position: 1,
    positionText: 0,
    options: { width: 120, height: 160, numFrets: 7, showTuning: false }
  },
  {
    title: 'Rel fret 3, position=6',
    meta: 'Same as previous but moving further down the neck.',
    chord: [[6, 3], [5, 4], [4, 1], [3, 1], [2, 1], [1, 1]],
    position: 6,
    positionText: 2,
    options: { width: 120, height: 160, numFrets: 5, showTuning: false }
  },
  {
    title: 'Rel fret 3, position=4',
    meta: 'Same as previous but moving further down the neck.',
    chord: [[6, 3], [5, 4], [4, 1], [3, 1], [2, 1], [1, 1]],
    position: 4,
    positionText: 0,
    options: { width: 120, height: 160, numFrets: 5, showTuning: false }
  }
];

function createCaseCard(caseData) {
  const card = document.createElement('div');
  card.className = 'case';

  const title = document.createElement('h2');
  title.textContent = caseData.title;
  card.appendChild(title);

  if (caseData.meta) {
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = caseData.meta;
    card.appendChild(meta);
  }

  const diagram = document.createElement('div');
  diagram.className = 'diagram';
  card.appendChild(diagram);

  const drawData = { chord: caseData.chord, tuning: [] };
  if (typeof caseData.position === 'number') {
    drawData.position = caseData.position;
  }
  if (typeof caseData.positionText === 'number') {
    drawData.positionText = caseData.positionText;
  }

  if (typeof vexchords !== 'undefined') {
    vexchords.draw(diagram, drawData, caseData.options || {});
  } else {
    const warn = document.createElement('div');
    warn.textContent = 'vexchords not loaded';
    card.appendChild(warn);
  }

  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify({ drawData, options: caseData.options }, null, 2);
  card.appendChild(pre);

  return card;
}

const container = document.getElementById('cases');
if (container) {
  cases.forEach((caseData) => {
    container.appendChild(createCaseCard(caseData));
  });
}
