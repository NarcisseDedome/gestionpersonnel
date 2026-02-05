const fs = require('fs');
const content = fs.readFileSync('c:/Users/ADN/Desktop/projet oncle/server/index.js', 'utf8');
const lines = content.split('\n');
console.log('LINE 210:', JSON.stringify(lines[209]));
console.log('LINE 211:', JSON.stringify(lines[210]));
console.log('LINE 212:', JSON.stringify(lines[211]));
console.log('LINE 213:', JSON.stringify(lines[212]));
console.log('LINE 214:', JSON.stringify(lines[213]));
console.log('LINE 216:', JSON.stringify(lines[215]));
