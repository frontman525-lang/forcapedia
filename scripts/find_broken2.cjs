const fs = require('fs');
const lines = fs.readFileSync('c:/Users/shaik/Desktop/forcapedia/scripts/seed.mjs', 'utf8').split('\n');

// Find ALL lines (not just those starting with ') that have an odd number of single quotes
// but skip lines where the quote is inside a template literal or escaped
lines.forEach((l, i) => {
  // Skip comment lines
  if (l.trim().startsWith('//')) return;
  // Count unescaped single quotes
  const count = (l.match(/(?<!\)'/g) || []).length;
  if (count % 2 !== 0) {
    console.log('LINE ' + (i + 1) + ': ' + l.trim());
  }
});
