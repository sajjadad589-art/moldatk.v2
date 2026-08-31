import fs from 'node:fs';
const p='src/App.tsx';
let s=fs.readFileSync(p,'utf8');
if(!s.includes("import { useGeneratorCloudSync } from './lib/useGeneratorCloudSync';")) s=s.replace("import { supabase } from './lib/supabase';", "import { supabase } from './lib/supabase';\nimport { useGeneratorCloudSync } from './lib/useGeneratorCloudSync';");
if(!s.includes('useGeneratorCloudSync(userSession);')) {
  const m="  });\n\n\n  const getStorageKey";
  if(!s.includes(m)) throw new Error('App.tsx marker not found');
  s=s.replace(m,"  });\n\n  useGeneratorCloudSync(userSession);\n\n\n  const getStorageKey");
}
fs.writeFileSync(p,s);
console.log('Realtime subscriber sync connected');
