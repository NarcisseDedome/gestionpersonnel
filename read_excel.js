const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'Fichier Personnel_1.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('Colonnes détectées :', data[0]);
console.log('Exemple de donnée (ligne 1) :', data[1]);
