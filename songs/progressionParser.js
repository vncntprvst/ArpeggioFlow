/**
 * progressionParser.js
 *
 * Parse iReal Pro-style progression strings into bars of chord symbols.
 * A chart is written as bars separated by '|', with one or two chord
 * symbols per bar separated by whitespace. '%' repeats the previous bar.
 *
 * Example:
 *   '| Am7 | D7 | Gmaj7 | % | Em7 A7 |'
 *   → [['Am7'], ['D7'], ['Gmaj7'], ['Gmaj7'], ['Em7', 'A7']]
 *
 * Loaded as a plain script / side-effect module (same dual-export pattern
 * as noteFlow.js) so it works in the browser and in Jest.
 */

function parseProgressionString(progression) {
  if (typeof progression !== 'string') {
    return [];
  }
  const bars = [];
  progression
    .split('|')
    .map((bar) => bar.trim())
    .filter((bar) => bar.length > 0)
    .forEach((bar) => {
      if (bar === '%') {
        bars.push(bars.length ? [...bars[bars.length - 1]] : []);
      } else {
        bars.push(bar.split(/[\s,]+/).filter(Boolean));
      }
    });
  return bars;
}

// Export for Node.js/Jest testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseProgressionString };
}

// Export to window for browser usage
if (typeof window !== 'undefined') {
  window.progressionParser = { parseProgressionString };
}
