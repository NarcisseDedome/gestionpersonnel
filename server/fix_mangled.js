const fs = require('fs');
let content = fs.readFileSync('c:/Users/ADN/Desktop/projet oncle/server/index.js', 'utf8');

// The mangled char seems to be appearing as  (U+FFFD) or similar in the tools
// but it might be a specific byte sequence.
// I will use direct string replacement for known mangled parts.

content = content.replace(/Ministre/g, 'Ministère');
content = content.replace(/MINISTRE/g, 'MINISTÈRE');
content = content.replace(/Rpublique/g, 'République');
content = content.replace(/RPUBLIQUE/g, 'RÉPUBLIQUE');
content = content.replace(/Bnin/g, 'Bénin');
content = content.replace(/BNIN/g, 'BÉNIN');
content = content.replace(/Dpartementale/g, 'Départementale');
content = content.replace(/DPARTEMENTALE/g, 'DÉPARTEMENTALE');
content = content.replace(/aroport/g, 'aéroport');
content = content.replace(/prfecture/g, 'préfecture');
content = content.replace(/Dassa-Zoum/g, 'Dassa-Zoumè');
content = content.replace(/pouse/g, 'épouse');
content = content.replace(//g, 'e'); // Fallback for any other mangled character (usually 'e')

    fs.writeFileSync('c:/Users/ADN/Desktop/projet oncle/server/index.js', content, 'utf8');
console.log('File sanitized.');
