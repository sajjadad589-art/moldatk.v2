import fs from 'node:fs';

const path = 'src/components/SuperAdminDashboard.tsx';
if (!fs.existsSync(path)) process.exit(0);
let src = fs.readFileSync(path, 'utf8');
const staticImport = "import * as XLSX from 'xlsx';";
const typeImport = "import type * as XLSXTypes from 'xlsx';";
if (src.includes(staticImport)) src = src.replace(staticImport, typeImport);
if (!src.includes(typeImport)) throw new Error('XLSX type import missing from SuperAdminDashboard');

src = src.replaceAll('XLSX.WorkSheet', 'XLSXTypes.WorkSheet');
if (!src.includes("const XLSX = await import('xlsx');")) {
  const bufferRead = '      const buffer = await excelImportForm.file.arrayBuffer();';
  if (!src.includes(bufferRead)) throw new Error('Super Admin Excel import buffer read not found');
  src = src.replace(bufferRead, "      const XLSX = await import('xlsx');\n" + bufferRead);
}

fs.writeFileSync(path, src);
console.log('Super Admin XLSX parser is loaded only when importing an Excel file.');
