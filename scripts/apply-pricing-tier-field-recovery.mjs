import fs from 'node:fs';

const p = 'src/components/PricingModal.tsx';
let s = fs.readFileSync(p, 'utf8');

if (!s.includes("from '../utils/monthlyTariffTierTemplate'")) {
  s = s.replace(
    "import { formatCurrency, formatNumberArabic } from '../utils/formatters';",
    "import { formatCurrency, formatNumberArabic } from '../utils/formatters';\nimport { buildCanonicalMonthlyTiers } from '../utils/monthlyTariffTierTemplate';"
  );
}

// When cloud/local data contains a monthly record with an empty tiers array, the
// editor previously rendered an empty section. Restore the four canonical cards
// only for the active month, preserving any prices that already exist.
const oldOpen = "        setTariffs(monthlyTariffs.map(month => ({ ...month, monthNameAr: numericMonthLabel(month.month, month.year), tiers: normalizeTierNames(month.tiers || []).map(t => month.isCurrentActive ? ({ ...t, fixedFee: 0 }) : t) })));";
const newOpen = `        setTariffs(monthlyTariffs.map(month => {\n          const normalizedMonthTiers = normalizeTierNames(month.tiers || []);\n          return {\n            ...month,\n            monthNameAr: numericMonthLabel(month.month, month.year),\n            tiers: month.isCurrentActive\n              ? buildCanonicalMonthlyTiers(normalizedMonthTiers, pricingTiers)\n              : normalizedMonthTiers,\n          };\n        }));`;
if (s.includes(oldOpen)) {
  s = s.replace(oldOpen, newOpen);
} else if (!s.includes('buildCanonicalMonthlyTiers(normalizedMonthTiers, pricingTiers)')) {
  throw new Error('Pricing tier recovery: monthly open-state initializer not found');
}

s = s.replace(
  "  const currentTiers = currentMonthRecord?.tiers || [];",
  `  const currentTiers = currentMonthRecord\n    ? (currentMonthRecord.isCurrentActive\n        ? buildCanonicalMonthlyTiers(currentMonthRecord.tiers || [], pricingTiers)\n        : (currentMonthRecord.tiers || []))\n    : [];`
);

// Any change to an active month starts from a complete canonical tier set. This
// prevents an empty cloud snapshot from swallowing the user's first keystroke.
s = s.replace(
  '          tiers: month.tiers.map(t =>\n            t.id === tierId ? { ...t, pricePerAmpere: Math.max(0, fullValue), fixedFee: 0 } : t\n          ),',
  '          tiers: buildCanonicalMonthlyTiers(month.tiers || [], pricingTiers).map(t =>\n            t.id === tierId ? { ...t, pricePerAmpere: Math.max(0, fullValue), fixedFee: 0 } : t\n          ),'
);

s = s.replace(
  '          tiers: month.tiers.map(t =>\n            t.id === tierId ? { ...t, is24Hours: !t.is24Hours } : t\n          ),',
  '          tiers: buildCanonicalMonthlyTiers(month.tiers || [], pricingTiers).map(t =>\n            t.id === tierId ? { ...t, is24Hours: !t.is24Hours } : t\n          ),'
);

// New months always start with visible canonical tier cards. Existing values are
// copied as a template; nothing is written to cloud until explicit Save/Apply.
s = s.replace(
  "    const sourceTiers = currentTiers.length > 0 ? currentTiers : pricingTiers;\n    const baseTiers = normalizeTierNames(sourceTiers).map(t => ({ ...t, fixedFee: 0, description: '' }));",
  "    const sourceTiers = currentTiers.length > 0 ? currentTiers : pricingTiers;\n    const baseTiers = buildCanonicalMonthlyTiers(normalizeTierNames(sourceTiers), pricingTiers).map(t => ({ ...t, fixedFee: 0, description: '' }));"
);

// Save cannot persist a blank active tier array even if a stale sync snapshot was
// received while the modal was open.
const oldSave = `  const handleSave = () => {\n    if (!isEditable) {\n      onClose();\n      return;\n    }\n    // تفعيل الحماية تلقائياً (true)\n    onSaveMonthlyTariffs(tariffs, selectedMonthId, true);`;
const newSave = `  const handleSave = () => {\n    if (!isEditable) {\n      onClose();\n      return;\n    }\n    const completeTariffs = tariffs.map(month =>\n      month.id === selectedMonthId && month.isCurrentActive\n        ? { ...month, tiers: buildCanonicalMonthlyTiers(month.tiers || [], pricingTiers) }\n        : month\n    );\n    setTariffs(completeTariffs);\n    // تفعيل الحماية تلقائياً (true)\n    onSaveMonthlyTariffs(completeTariffs, selectedMonthId, true);`;
if (s.includes(oldSave)) {
  s = s.replace(oldSave, newSave);
} else if (!s.includes('onSaveMonthlyTariffs(completeTariffs, selectedMonthId, true);')) {
  throw new Error('Pricing tier recovery: explicit save handler not found');
}

const required = [
  "import { buildCanonicalMonthlyTiers } from '../utils/monthlyTariffTierTemplate';",
  'buildCanonicalMonthlyTiers(normalizedMonthTiers, pricingTiers)',
  'buildCanonicalMonthlyTiers(currentMonthRecord.tiers || [], pricingTiers)',
  'buildCanonicalMonthlyTiers(month.tiers || [], pricingTiers).map(t =>',
  'onSaveMonthlyTariffs(completeTariffs, selectedMonthId, true);',
];
for (const marker of required) {
  if (!s.includes(marker)) throw new Error(`Pricing tier recovery missing marker: ${marker}`);
}

fs.writeFileSync(p, s, 'utf8');
console.log('Recovered monthly pricing tier cards and price fields for empty/stale active tariff records.');
