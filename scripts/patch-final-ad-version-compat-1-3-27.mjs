import fs from 'node:fs';

const path = 'scripts/apply-final-ad-box-and-crash-fix.mjs';
let s = fs.readFileSync(path, 'utf8');
const anchor = ".replaceAll('1.3.26', '1.3.18'))";
if (!s.includes(".replaceAll('1.3.27', '1.3.18')")) {
  if (!s.includes(anchor)) throw new Error('Final ad version compatibility anchor missing');
  s = s.replace(anchor, ".replaceAll('1.3.26', '1.3.18')\n    .replaceAll('1.3.27', '1.3.18'))");
  fs.writeFileSync(path, s, 'utf8');
}
if (!fs.readFileSync(path, 'utf8').includes(".replaceAll('1.3.27', '1.3.18')")) throw new Error('1.3.27 legacy compatibility patch missing');
console.log('Legacy final release guard now accepts 1.3.27 before absolute final versioning.');
