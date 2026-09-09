import fs from 'node:fs';

const path = 'scripts/apply-discount-dashboard-boxes-final.mjs';
let source = fs.readFileSync(path, 'utf8');

const bad = "  return \\`${year}-\\${String(month).padStart(2, '0')}\\`;";
const good = "  return year + '-' + String(month).padStart(2, '0');";

if (source.includes(bad)) {
  source = source.replace(bad, good);
  fs.writeFileSync(path, source, 'utf8');
  console.log('Discount dashboard code generator nested template repaired.');
} else if (source.includes(good)) {
  console.log('Discount dashboard code generator already repaired.');
} else {
  throw new Error('Discount dashboard previousMonthId generator line was not found.');
}
