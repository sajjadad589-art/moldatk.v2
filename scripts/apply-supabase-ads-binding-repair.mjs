import fs from 'node:fs';

{
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
}

// Final late guard: some old patch scripts can add recentWriteKey twice when lint then build run in the same job.
// Keep exactly one helper declaration after all patch scripts have finished.
{
  const path = 'src/lib/useGeneratorCloudSync.ts';
  if (fs.existsSync(path)) {
    let c = fs.readFileSync(path, 'utf8');
    const line = "const recentWriteKey = (generatorId: string) => key('moldatk_last_local_write', generatorId);\n";
    const count = c.split(line).length - 1;
    if (count > 1) {
      let seen = false;
      c = c.replaceAll(line, () => {
        if (seen) return '';
        seen = true;
        return line;
      });
      fs.writeFileSync(path, c);
      console.log(`Deduped recentWriteKey helper after patch chain (${count} -> 1)`);
    }
  }
}

console.log('Supabase ads binding repair applied.');
