import fs from 'node:fs';

const path = 'src/components/SuperAdminDashboard.tsx';
if (!fs.existsSync(path)) process.exit(0);
const src = fs.readFileSync(path, 'utf8');

// Keep the static XLSX import because SuperAdminDashboard uses XLSX both as a
// runtime value and as a TypeScript namespace/type. Removing only the import
// caused release typecheck failures after the build-time transforms ran.
if (!src.includes("import * as XLSX from 'xlsx';")) {
  throw new Error('Stable XLSX import missing from SuperAdminDashboard');
}

console.log('Stable XLSX import preserved for release builds.');
