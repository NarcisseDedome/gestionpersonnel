const fs = require('fs');
const content = fs.readFileSync('c:/Users/ADN/Desktop/projet oncle/server/index.js');
fs.writeFileSync('c:/Users/ADN/Desktop/projet oncle/server/index.js', content, { encoding: 'utf8' });
console.log('File encoding rewritten to UTF-8');
