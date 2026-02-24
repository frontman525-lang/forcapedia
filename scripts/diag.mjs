import { readFileSync } from 'fs';
const src = readFileSync('c:/Users/shaik/Desktop/forcapedia/scripts/seed.mjs', 'utf8');
const lines = src.split('\n');

// Track parser state: are we currently inside a single-quoted string?
let inSingleQuote = false;
let stringStartLine = -1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    // Skip escaped chars
    if (ch === '\') { j++; continue; }
    if (!inSingleQuote) {
      // Skip template literals and double-quoted strings crudely
      if (ch === '`' || ch === '"') {
        // skip to matching close - simplified, good enough for TOPICS array
        const close = ch;
        j++;
        while (j < line.length && line[j] !== close) j++;
        continue;
      }
      if (ch === "'") {
        inSingleQuote = true;
        stringStartLine = i + 1;
      }
    } else {
      if (ch === "'") {
        inSingleQuote = false;
        stringStartLine = -1;
      }
    }
  }
  // If still in single quote at end of line, that's suspicious (multiline string = parse error)
  if (inSingleQuote) {
    console.log('UNTERMINATED single-quote string starting at line', stringStartLine, ':', lines[stringStartLine-1].trim());
    break;
  }
}

if (!inSingleQuote) {
  console.log('No unterminated single-quoted strings found (string state is clean).');
}

// Also: report any line within lines 86-1989 that has an odd quote count and is not blank
let oddLines = [];
for (let i = 85; i < 1989; i++) {
  const l = lines[i];
  if (l.trim() === '' || l.trim().startsWith('//')) continue;
  const count = (l.split("'").length - 1);
  if (count % 2 !== 0) {
    oddLines.push('  L' + (i+1) + ': ' + l.trim());
  }
}
if (oddLines.length > 0) {
  console.log('\nLines with odd single-quote count:');
  oddLines.forEach(l => console.log(l));
} else {
  console.log('All non-blank, non-comment lines have even quote counts.');
}
