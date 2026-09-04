import fs from 'node:fs';

const path = 'src/components/SuperAdminDashboard.tsx';
if (fs.existsSync(path)) {
  let c = fs.readFileSync(path, 'utf8');
  if (c.includes('notificationMediaFile') && !c.includes('const [notificationMediaFile')) {
    const stateDecl = "  const [notificationMediaFile, setNotificationMediaFile] = useState<File | null>(null);\n";
    const marker = "  const [notificationForm, setNotificationForm] = useState({";
    const idx = c.indexOf(marker);
    if (idx !== -1) {
      c = c.slice(0, idx) + stateDecl + c.slice(idx);
      fs.writeFileSync(path, c);
      console.log('Repaired Supabase ads media File state');
    } else {
      console.warn('ads repair skip: notificationForm anchor missing');
    }
  }
}

console.log('Supabase ads binding repair applied.');
