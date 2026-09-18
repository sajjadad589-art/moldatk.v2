import fs from 'node:fs';

const path = 'src/components/SuperAdminDashboard.tsx';
if (!fs.existsSync(path)) process.exit(0);
const src = fs.readFileSync(path, 'utf8');

// The import action loads XLSX only when the operator selects a spreadsheet.
if (!src.includes("await import('xlsx')") || src.includes("import * as XLSX from 'xlsx'")) {
  throw new Error('SuperAdminDashboard must load XLSX only during import');
}

console.log('Dynamic XLSX import verified.');
