import fs from 'node:fs';

const p = 'src/components/PricingModal.tsx';
let c = fs.readFileSync(p, 'utf8');

if (!c.includes('const sourceTiers = currentTiers.length > 0 ? currentTiers : pricingTiers;')) {
  const re = /^    const baseTiers = .*currentTiers.*;$/m;
  if (!re.test(c)) throw new Error('PricingModal current tier source line not found');
  c = c.replace(
    re,
    "    const sourceTiers = currentTiers.length > 0 ? currentTiers : pricingTiers;\n    const baseTiers = normalizeTierNames(sourceTiers).map(t => ({ ...t, fixedFee: 0, description: '' }));"
  );
  fs.writeFileSync(p, c);
}

console.log('Prepared pricing editor to create a new month even when the tariff list is empty');
