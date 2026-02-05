const fs = require('fs');
let content = fs.readFileSync('c:/Users/ADN/Desktop/projet oncle/server/index.js', 'utf8');

// Global replaces to tighten the layout
content = content.replace(/dateLineY = 220/g, 'dateLineY = 195');

// Date dots and year alignment
const oldDateLine = "doc.text('Dassa-Zoumè, le ....................', 230, dateLineY, { align: 'left' });";
const newDateLine = "doc.text('Dassa-Zoumè, le ....................', 230, dateLineY);";
content = content.replace(new RegExp(oldDateLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newDateLine);

const oldYearLine = "doc.text(`${currentYear}`, 505, dateLineY, { align: 'left' });";
const newYearLine = "doc.text(`${currentYear}`, 425, dateLineY);";
content = content.replace(new RegExp(oldYearLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newYearLine);

const oldNLine = "doc.text(`N°_______ / DDESTFP-COL /MESTFP/SPAF/DAA`, 50, 255);";
const newNLine = "doc.text(`N°_______ / DDESTFP-COL /MESTFP/SPAF/DAA`, 50, 222);";
content = content.replace(new RegExp(oldNLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newNLine);

// One more fix for the Ministry block if it wasn't already moved (double check)
content = content.replace(/125, 35\)/, '95, 35)');
content = content.replace(/125, 46\)/, '95, 46)');
content = content.replace(/125, 57\)/, '95, 57)');
content = content.replace(/125, 80\)/, '95, 80)');

fs.writeFileSync('c:/Users/ADN/Desktop/projet oncle/server/index.js', content, 'utf8');
console.log('Layout updated successfully via script.');
