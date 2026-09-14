import fs from 'node:fs';

const pricingPath = 'src/components/PricingModal.tsx';
const syncPath = 'src/lib/useGeneratorCloudSync.ts';

let pricing = fs.readFileSync(pricingPath, 'utf8');

// A new month must be a LOCAL DRAFT first. Persisting it immediately used to
// send zero/stale prices to Supabase, then realtime/cloud sync pulled those
// values back over the editor. The owner must explicitly save/apply after the
// per-tier prices are finished.
const createStart = pricing.indexOf('  const handleCreateNewMonthTariff = () => {');
const createEnd = createStart >= 0 ? pricing.indexOf('\n\n  const handleDeleteMonth =', createStart) : -1;
if (createStart < 0 || createEnd < 0) {
  throw new Error('Tariff draft restoration: create-month handler not found');
}

let createBlock = pricing.slice(createStart, createEnd);
createBlock = createBlock
  .replace(/\n\s*\/\/ ثبّت الشهر الجديد فوراً[^\n]*\n\s*onSaveMonthlyTariffs\(updatedTariffs, monthId, true\);/g,
    "\n    // مسودة محلية فقط: لا تُرسل للسحابة ولا تُصدر فواتير قبل إدخال الأسعار والضغط على حفظ وتطبيق.")
  .replace(/\n\s*onSaveMonthlyTariffs\(updatedTariffs, monthId, true\);/g,
    "\n    // MONTHLY_TARIFF_PRICE_DRAFT_V1 — explicit save below is the only activation point.")
  .replace(/\n\s*onSaveMonthlyTariffs\(updatedTariffs, monthId, false\);/g,
    "\n    // MONTHLY_TARIFF_PRICE_DRAFT_V1 — explicit save below is the only activation point.");

pricing = pricing.slice(0, createStart) + createBlock + pricing.slice(createEnd);

// Make the flow explicit in the UI so creating a month cannot be mistaken for
// financially activating it.
pricing = pricing.replace(
  'اعتماد وإضافة كشهر نشط جديد',
  'إنشاء ملف الشهر وإدخال الأسعار'
);
pricing = pricing.replace(
  "? 'هذا هو الشهر النشط حالياً لإصدار فواتير المشتركين وقابل للتعديل'",
  "? 'أدخل أسعار فئات هذا الشهر ثم اضغط حفظ وتطبيق لاعتمادها وإصدار الاستحقاقات'"
);

// Hard guards: monthly prices remain editable on the active/draft month and
// are persisted only by the explicit Save button.
if (!pricing.includes('const handlePriceChange =')) {
  throw new Error('Tariff draft restoration: per-tier price editor is missing');
}
if (!pricing.includes('disabled={!isEditable || isFree}')) {
  throw new Error('Tariff draft restoration: active-month price input is not editable');
}
if (!pricing.includes('onSaveMonthlyTariffs(tariffs, selectedMonthId, true);')) {
  throw new Error('Tariff draft restoration: explicit save/apply activation is missing');
}
const verifyCreateStart = pricing.indexOf('  const handleCreateNewMonthTariff = () => {');
const verifyCreateEnd = pricing.indexOf('\n\n  const handleDeleteMonth =', verifyCreateStart);
const verifyCreate = pricing.slice(verifyCreateStart, verifyCreateEnd);
if (verifyCreate.includes('onSaveMonthlyTariffs(')) {
  throw new Error('Tariff draft restoration: new month still persists before prices are confirmed');
}

fs.writeFileSync(pricingPath, pricing, 'utf8');

// Cloud persistence must keep the complete independent tiers JSON for each
// MonthlyTariffRecord. Never derive active-month prices from global defaults.
const sync = fs.readFileSync(syncPath, 'utf8');
if (!sync.includes('tiers: t.tiers')) {
  throw new Error('Tariff draft restoration: cloud tariff row no longer persists month tiers');
}
if (!sync.includes("supabase.from('generator_monthly_tariffs').upsert")) {
  throw new Error('Tariff draft restoration: monthly tariff cloud upsert is missing');
}

console.log('Restored monthly tariff draft pricing: create locally, edit per-tier prices, then explicitly save/apply to cloud and billing.');
