import fs from 'node:fs';

const p = 'src/components/mobile/MobileLayout.tsx';
let c = fs.readFileSync(p, 'utf8');

const startToken = 'export const MobileLayout: React.FC<MobileLayoutProps> = ({';
const start = c.indexOf(startToken);
const end = start >= 0 ? c.indexOf('\n}) => {', start) : -1;
if (start < 0 || end < 0) throw new Error('MobileLayout destructuring block not found');

const prefix = c.slice(start, start + startToken.length);
const rawBody = c.slice(start + startToken.length, end);
const names = rawBody
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

const required = ['monthlyTariffs', 'reportResetMarkers', 'onResetReportYear', 'isOwner', 'onSecureReset'];
const ordered = [];
const seen = new Set();
for (const name of [...names, ...required]) {
  if (seen.has(name)) continue;
  seen.add(name);
  ordered.push(name);
}

const rebuilt = prefix + '\n' + ordered.map(name => `  ${name},`).join('\n');
c = c.slice(0, start) + rebuilt + c.slice(end);

fs.writeFileSync(p, c);
console.log('Ensured secure reset/report props are destructured exactly once in MobileLayout');
