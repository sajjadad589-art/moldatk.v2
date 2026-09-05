import fs from 'node:fs';

const path = 'src/components/SuperAdminDashboard.tsx';
if (!fs.existsSync(path)) process.exit(0);
let src = fs.readFileSync(path, 'utf8');
src = src.replace("import * as XLSX from 'xlsx';\n", '');
const marker = `    try {\n      const generator = generators.find(g => g.id === excelImportForm.generator_id);`;
if (!src.includes("const XLSX = await import('xlsx');")) {
  src = src.replace(marker, `    try {\n      const XLSX = await import('xlsx');\n      const generator = generators.find(g => g.id === excelImportForm.generator_id);`);
}
fs.writeFileSync(path, src, 'utf8');
const final = fs.readFileSync(path, 'utf8');
if (final.includes("import * as XLSX from 'xlsx'")) throw new Error('Static XLSX import still exists');
if (!final.includes("const XLSX = await import('xlsx');")) throw new Error('Lazy XLSX loader missing');
console.log('XLSX parser moved behind user action.');
