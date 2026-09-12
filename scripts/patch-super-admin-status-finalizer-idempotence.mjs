import fs from 'node:fs';

const path = 'scripts/apply-super-admin-status-responsive-final.mjs';
let s = fs.readFileSync(path, 'utf8');
const from = '  if (remainingStart === end) {';
const to = '  if (remainingStart >= end) {';
if (s.includes(from)) {
  s = s.replace(from, to);
  fs.writeFileSync(path, s, 'utf8');
}
if (!fs.readFileSync(path, 'utf8').includes(to)) {
  throw new Error('Super Admin status finalizer repeat-build guard missing');
}
console.log('Super Admin status finalizer made repeat-build safe.');
