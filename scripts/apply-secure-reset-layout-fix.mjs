import fs from 'node:fs';

const p = 'src/components/mobile/MobileLayout.tsx';
let c = fs.readFileSync(p, 'utf8');

const start = c.indexOf('export const MobileLayout: React.FC<MobileLayoutProps> = ({');
const end = start >= 0 ? c.indexOf('\n}) => {', start) : -1;
if (start < 0 || end < 0) throw new Error('MobileLayout destructuring block not found');

const block = c.slice(start, end);
const required = ['monthlyTariffs', 'reportResetMarkers', 'onResetReportYear', 'isOwner', 'onSecureReset'];
let patched = block;
for (const name of required) {
  if (!patched.includes(`\n  ${name},`)) patched += `\n  ${name},`;
}
c = c.slice(0, start) + patched + c.slice(end);

fs.writeFileSync(p, c);
console.log('Ensured secure reset/report props are destructured in MobileLayout');
