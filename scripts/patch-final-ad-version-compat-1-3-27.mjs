import fs from 'node:fs';

const path = 'scripts/apply-final-ad-box-and-crash-fix.mjs';
let s = fs.readFileSync(path, 'utf8');

const ensureCompat = (version, previousVersion) => {
  const wanted = `.replaceAll('${version}', '1.3.18')`;
  if (s.includes(wanted)) return;
  const previous = `.replaceAll('${previousVersion}', '1.3.18')`;
  if (!s.includes(previous)) throw new Error(`Final ad version compatibility anchor missing for ${version}`);
  s = s.replace(previous, `${previous}\n    ${wanted}`);
};

ensureCompat('1.3.27', '1.3.26');
ensureCompat('1.3.28', '1.3.27');
fs.writeFileSync(path, s, 'utf8');

const final = fs.readFileSync(path, 'utf8');
if (!final.includes(".replaceAll('1.3.27', '1.3.18')")) throw new Error('1.3.27 legacy compatibility patch missing');
if (!final.includes(".replaceAll('1.3.28', '1.3.18')")) throw new Error('1.3.28 legacy compatibility patch missing');
console.log('Legacy final release guard accepts 1.3.27 and 1.3.28 before absolute final versioning.');
