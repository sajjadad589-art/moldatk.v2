import fs from 'node:fs';

const files = ['public/sw.js', 'src/main.tsx', 'public/pwa-recovery-v6.js'];
for (const path of files) {
  if (!fs.existsSync(path)) continue;
  let content = fs.readFileSync(path, 'utf8');
  content = content
    .replaceAll('1.3.17', '1.3.25')
    .replaceAll('1.3.18', '1.3.25')
    .replaceAll('1.3.19', '1.3.25')
    .replaceAll('1.3.20', '1.3.25')
    .replaceAll('1.3.21', '1.3.25')
    .replaceAll('1.3.22', '1.3.25')
    .replaceAll('1.3.23', '1.3.25')
    .replaceAll('1.3.24', '1.3.25');
  fs.writeFileSync(path, content, 'utf8');
}

const sw = fs.readFileSync('public/sw.js', 'utf8');
const main = fs.readFileSync('src/main.tsx', 'utf8');
if (!sw.includes('moldatk-shell-v4-1.3.25')) throw new Error('Release 1.3.25 service worker cache marker missing');
if (!main.includes('/sw.js?v=1.3.25')) throw new Error('Release 1.3.25 service worker registration missing');
console.log('Release 1.3.25 cache/update version finalized.');
