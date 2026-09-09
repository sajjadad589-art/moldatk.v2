import fs from 'node:fs';

const path = 'scripts/apply-recurring-ampere-discount-final.mjs';
let source = fs.readFileSync(path, 'utf8');

// The historical-debt replacement was authored with a double-escaped newline in the
// finalizer source. Convert only that exact replacement value to real JS newline escapes
// before importing the finalizer. This keeps lint -> build repeat execution safe.
const bad = String.raw`'    const original = Math.max(0, Number(amperes) || 0);\\n    const discounted = Math.min(original, Math.max(0, Number(ampereDiscount) || 0));\\n    return Math.max(0, (original - discounted) * Number(selectedPriorTier.pricePerAmpere || 0) + Number(selectedPriorTier.fixedFee || 0));'`;
const good = String.raw`'    const original = Math.max(0, Number(amperes) || 0);\n    const discounted = Math.min(original, Math.max(0, Number(ampereDiscount) || 0));\n    return Math.max(0, (original - discounted) * Number(selectedPriorTier.pricePerAmpere || 0) + Number(selectedPriorTier.fixedFee || 0));'`;

if (source.includes(bad)) {
  source = source.replace(bad, good);
  fs.writeFileSync(path, source, 'utf8');
  console.log('Recurring ampere discount finalizer newline escape repaired.');
} else if (source.includes(good)) {
  console.log('Recurring ampere discount finalizer newline escape already repaired.');
} else {
  throw new Error('Recurring ampere discount finalizer historical debt replacement was not found.');
}
