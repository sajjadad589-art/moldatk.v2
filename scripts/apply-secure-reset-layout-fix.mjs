import fs from 'node:fs';

const p = 'src/components/mobile/MobileLayout.tsx';
let c = fs.readFileSync(p, 'utf8');

// Dedupe interface properties because older build-time patches can add monthlyTariffs/finance props too.
const ifaceStartToken = 'interface MobileLayoutProps {';
const ifaceStart = c.indexOf(ifaceStartToken);
const ifaceEnd = ifaceStart >= 0 ? c.indexOf('\n}', ifaceStart) : -1;
if (ifaceStart < 0 || ifaceEnd < 0) throw new Error('MobileLayoutProps block not found');
const ifacePrefix = c.slice(ifaceStart, ifaceStart + ifaceStartToken.length);
const ifaceLines = c.slice(ifaceStart + ifaceStartToken.length, ifaceEnd).split('\n');
const ifaceSeen = new Set();
const ifaceClean = [];
for (const line of ifaceLines) {
  const match = line.match(/^\s*([A-Za-z_$][\w$]*)\??\s*:/);
  if (!match) {
    if (line.trim()) ifaceClean.push(line);
    continue;
  }
  const name = match[1];
  if (ifaceSeen.has(name)) continue;
  ifaceSeen.add(name);
  ifaceClean.push(line);
}
c = c.slice(0, ifaceStart) + ifacePrefix + '\n' + ifaceClean.join('\n') + c.slice(ifaceEnd);

// Dedupe the React props destructuring and guarantee all new props are available exactly once.
const startToken = 'export const MobileLayout: React.FC<MobileLayoutProps> = ({';
const start = c.indexOf(startToken);
const end = start >= 0 ? c.indexOf('\n}) => {', start) : -1;
if (start < 0 || end < 0) throw new Error('MobileLayout destructuring block not found');
const prefix = c.slice(start, start + startToken.length);
const rawBody = c.slice(start + startToken.length, end);
const names = rawBody.split(',').map(item => item.trim()).filter(Boolean);
const required = ['monthlyTariffs', 'reportResetMarkers', 'onResetReportYear', 'isOwner', 'onSecureReset'];
const ordered = [];
const seen = new Set();
for (const name of [...names, ...required]) {
  const key = name.split('=')[0].trim();
  if (seen.has(key)) continue;
  seen.add(key);
  ordered.push(name);
}
const rebuilt = prefix + '\n' + ordered.map(name => `  ${name},`).join('\n');
c = c.slice(0, start) + rebuilt + c.slice(end);

fs.writeFileSync(p, c);
console.log('Deduplicated MobileLayout interface and props; secure reset/report props are present exactly once');
