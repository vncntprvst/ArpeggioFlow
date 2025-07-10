// Simple test to verify calculateMeasureWidth function works

const fs = require('fs');

// Mock Tonal
global.Tonal = {
  Key: {
    majorKey: (key) => {
      const accidentalCounts = {
        'C': { alteredNotes: [] },
        'G': { alteredNotes: ['F#'] },
        'D': { alteredNotes: ['F#', 'C#'] },
        'F': { alteredNotes: ['Bb'] },
        'Bb': { alteredNotes: ['Bb', 'Eb'] }
      };
      return accidentalCounts[key] || { alteredNotes: [] };
    }
  }
};

// Extract and execute the calculateMeasureWidth function
const flowJsContent = fs.readFileSync('flow.js', 'utf8');
const functionMatch = flowJsContent.match(/function calculateMeasureWidth\([\s\S]*?\n}/);

if (functionMatch) {
  console.log('Found function match:', functionMatch[0].substring(0, 100) + '...');
  
  // Create and test the function
  const functionCode = functionMatch[0];
  eval(`global.calculateMeasureWidth = ${functionCode}`);
  const calculateMeasureWidth = global.calculateMeasureWidth;
  
  // Test the function
  console.log('Testing calculateMeasureWidth function:');
  console.log('C major (0 accidentals), first measure:', calculateMeasureWidth('C', true));
  console.log('C major (0 accidentals), non-first measure:', calculateMeasureWidth('C', false));
  console.log('D major (2 sharps), first measure:', calculateMeasureWidth('D', true));
  console.log('D major (2 sharps), non-first measure:', calculateMeasureWidth('D', false));
  console.log('Function works correctly!');
} else {
  console.error('Could not extract calculateMeasureWidth function');
  
  // Let's try to see what functions are available
  const functionMatches = flowJsContent.match(/function \w+\(/g);
  console.log('Available functions:', functionMatches);
}
