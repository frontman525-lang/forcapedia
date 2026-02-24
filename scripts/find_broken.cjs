const fs = require('fs');
const lines = fs.readFileSync('c:/Users/shaik/Desktop/forcapedia/scripts/seed.mjs', 'utf8').split('\n');
lines.forEach((l, i) => {
  const t = l.trim();
  if (t.startsWith("'")) {
    const count = (l.match(/'/g) || []).length;
    if (count % 2 !== 0) {
      console.log('LINE ' + (i + 1) + ': ' + t);
    }
  }
});
