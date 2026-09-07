import fs from 'node:fs';

const read = path => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

for (const path of ['public/sw.js', 'src/main.tsx', 'public/pwa-recovery-v6.js']) {
  const current = read(path);
  if (!current) continue;
  write(path, current.replaceAll('1.3.19', '1.3.20').replaceAll('1.3.18', '1.3.20'));
}

must(read('public/sw.js').includes('moldatk-shell-v4-1.3.20'), '1.3.20 service-worker cache version missing');
must(read('src/main.tsx').includes('/sw.js?v=1.3.20'), '1.3.20 service-worker registration missing');

console.log('Finalized Moldatk browser/PWA update delivery for 1.3.20.');
