import fs from 'node:fs';

const appPath = 'src/App.tsx';
let app = fs.readFileSync(appPath, 'utf8');

if (!app.includes("import { useGeneratorCloudSync } from './lib/useGeneratorCloudSync';")) {
  app = app.replace(
    "import { supabase } from './lib/supabase';",
    "import { supabase } from './lib/supabase';\nimport { useGeneratorCloudSync } from './lib/useGeneratorCloudSync';"
  );
}

const hookAnchor = "export default function App({ forceSuperAdmin = false }: AppProps) {";
if (app.includes(hookAnchor) && !app.includes('useGeneratorCloudSync(userSession);')) {
  app = app.replace(
    hookAnchor,
    `${hookAnchor}\n  // تشغيل مزامنة Supabase المركزية لكل حساب مولدة/جابي.\n  // أي إضافة/تعديل/حذف محلي يتم دفعه للسحابة، وأي تغيير من جهاز آخر يتم سحبه فوراً.\n  useGeneratorCloudSync(userSession);`
  );
}

fs.writeFileSync(appPath, app);
console.log('Realtime subscriber sync hook connected to App.tsx');
