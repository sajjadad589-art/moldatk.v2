import fs from 'node:fs';
const read = p => fs.readFileSync(p, 'utf8').replaceAll('\r\n','\n');
const write = (p,s) => fs.writeFileSync(p,s,'utf8');
const must = (ok,msg) => { if(!ok) throw new Error('Production financial type repair: '+msg); };

for (const p of ['src/utils/monthlyAccounting.ts','src/utils/monthlyTariffDeletion.ts']) {
  let s = read(p);
  s = s.replace(/^\s*invoice\.remainingAfterPayment = 0;\n/gm, '');
  s = s.replace(/^\s*current\.remainingAfterPayment = 0;\n/gm, '');
  s = s.replace(/^\s*inv\.remainingAfterPayment = 0;\n/gm, '');
  write(p,s);
}

{
  const p='src/App.tsx';
  let s=read(p);
  if (!s.includes('extinguishDeletedTariffLiabilities')) {
    throw new Error('tariff-debt cleanup call disappeared');
  }
  if (!/import\s*\{[^}]*extinguishDeletedTariffLiabilities[^}]*\}\s*from\s*['"]\.\/utils\/monthlyTariffDeletion['"]/.test(s)) {
    const existing=/import\s*\{([^}]*)\}\s*from\s*['"]\.\/utils\/monthlyTariffDeletion['"];?/;
    if (existing.test(s)) {
      s=s.replace(existing,(full,names)=>`import { ${String(names).trim().replace(/,\s*$/,'')}, extinguishDeletedTariffLiabilities } from './utils/monthlyTariffDeletion';`);
    } else {
      const anchor="import { normalizeMonthlyTariffs, startFreshMonthlyCycle, repriceActiveMonthlyCycle, summarizeExistingMonthlyCycle, zeroLiveMonthlyCycle } from './utils/monthlyCycleEngine';";
      must(s.includes(anchor),'monthly cycle import anchor missing');
      s=s.replace(anchor,anchor+"\nimport { extinguishDeletedTariffLiabilities } from './utils/monthlyTariffDeletion';");
    }
  }
  must(/import\s*\{[^}]*extinguishDeletedTariffLiabilities[^}]*\}\s*from\s*['"]\.\/utils\/monthlyTariffDeletion['"]/.test(s),'tariff cleanup import missing');
  write(p,s);
}
console.log('Production financial type/import repair applied.');
