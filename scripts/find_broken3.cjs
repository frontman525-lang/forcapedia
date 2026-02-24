const fs = require('fs');
const src = fs.readFileSync('c:/Users/shaik/Desktop/forcapedia/scripts/seed.mjs', 'utf8');
const lines = src.split('\n');
lines.forEach((l, i) => {
  if (l.trim().startsWith('//')) return;
  const q = (l.match(/'/g) || []).length;
  if (q > 0 && q % 2 \!== 0) console.log('L' + (i+1) + ': ' + l.trim());
});
