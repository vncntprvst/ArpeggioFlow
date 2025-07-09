const fs = require('fs');
const { JSDOM } = require('jsdom');

test('index.html contains expected elements', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const dom = new JSDOM(html);
  const document = dom.window.document;
  expect(document.getElementById('generateButton')).not.toBeNull();
  expect(document.getElementById('notation')).not.toBeNull();
});
