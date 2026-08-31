import fs from 'node:fs';

const appPath = 'src/App.tsx';
let source = fs.readFileSync(appPath, 'utf8');
let changed = false;

const syncImport = "import { useGeneratorCloudSync } from './lib/useGeneratorCloudSync';";
if (!source.includes(syncImport)) {
  const importMarker = "import { supabase } from './lib/supabase';";
  if (!source.includes(importMarker)) throw new Error('Supabase import marker not found in src/App.tsx');
  source = source.replace(importMarker, `${importMarker}\n${syncImport}`);
  changed = true;
}

// Remove an older unsafe placement if a previous patch inserted the hook before userSession exists.
source = source.replace(
  /export default function App\(\{ forceSuperAdmin = false \}: AppProps\) \{\n\s*\/\/ تشغيل مزامنة Supabase المركزية[^\n]*\n\s*\/\/ أي إضافة\/تعديل\/حذف[^\n]*\n\s*useGeneratorCloudSync\(userSession\);/,
  'export default function App({ forceSuperAdmin = false }: AppProps) {'
);

if (!source.includes('useGeneratorCloudSync(userSession);')) {
  const hookMarker = "\n\n  const getStorageKey = (baseKey: string, session: ActiveUserSession | null = userSession) => {";
  if (!source.includes(hookMarker)) throw new Error('Safe sync hook marker not found in src/App.tsx');
  source = source.replace(
    hookMarker,
    `\n\n  // مزامنة مركزية: أي إضافة/تعديل/حذف للمشتركين تنتقل بين كل الأجهزة التابعة لنفس المولدة.\n  useGeneratorCloudSync(userSession);${hookMarker}`
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(appPath, source);
  console.log('Applied safe realtime subscriber/cloud sync hook to src/App.tsx');
} else {
  console.log('Realtime subscriber/cloud sync hook already applied');
}
