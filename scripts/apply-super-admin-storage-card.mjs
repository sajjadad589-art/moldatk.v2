import fs from 'node:fs';

const path = 'src/components/SuperAdminDashboard.tsx';
if (!fs.existsSync(path)) throw new Error('SuperAdminDashboard.tsx not found');

let src = fs.readFileSync(path, 'utf8');

if (!src.includes("import { SuperAdminStorageCard } from './SuperAdminStorageCard';")) {
  const anchor = "import { supabase } from '../lib/supabase';";
  if (!src.includes(anchor)) throw new Error('Super Admin import anchor missing');
  src = src.replace(anchor, `${anchor}\nimport { SuperAdminStorageCard } from './SuperAdminStorageCard';`);
}

if (!src.includes('<SuperAdminStorageCard />')) {
  const anchor = "          {tab === 'overview' && <>\n";
  if (!src.includes(anchor)) throw new Error('Super Admin overview anchor missing');
  src = src.replace(anchor, `${anchor}            <SuperAdminStorageCard />\n`);
}

fs.writeFileSync(path, src);

const finalSource = fs.readFileSync(path, 'utf8');
if (!finalSource.includes("import { SuperAdminStorageCard } from './SuperAdminStorageCard';")) throw new Error('Storage card import missing');
if (!finalSource.includes('<SuperAdminStorageCard />')) throw new Error('Storage card mount missing');

console.log('Applied live Supabase storage card to Super Admin dashboard');
