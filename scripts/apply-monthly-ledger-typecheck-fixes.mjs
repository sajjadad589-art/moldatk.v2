import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

// App: the collector cloud patch may replace callbacks with handleUpdateCollectors without
// inserting the handler on some newer App variants. Guarantee the cloud-backed handler exists.
{
  const p = 'src/App.tsx';
  let c = read(p);

  if (c.includes('onUpdateCollectors={handleUpdateCollectors}') && !c.includes('const handleUpdateCollectors = async (newCollectors: Collector[])')) {
    if (!c.includes("from './lib/collectorCloud'")) {
      c = c.replace(
        "import { supabase } from './lib/supabase';",
        "import { supabase } from './lib/supabase';\nimport { syncCloudCollectorRoster } from './lib/collectorCloud';"
      );
    }

    const marker = '  const handleOpenFolderModal = (folderKey: string) => setActiveSettingsFolderKey(folderKey);';
    const handler = `  const handleUpdateCollectors = async (newCollectors: Collector[]) => {
    const normalizePhone = (value: string) => String(value || '').replace(/\\D/g, '');
    const scopedCollectors = newCollectors.map(item => ({
      ...item,
      generatorId: userSession?.generatorId || item.generatorId || undefined,
      phone: normalizePhone(item.phone),
    }));

    const seen = new Set<string>();
    for (const collector of scopedCollectors) {
      if (collector.phone.length < 10) throw new Error('invalid_collector_phone');
      if (seen.has(collector.phone)) throw new Error('duplicate_collector_phone');
      seen.add(collector.phone);
      const pin = String(collector.passcode || '').trim();
      if (pin && !/^\\d{4,8}$/.test(pin)) throw new Error('invalid_collector_pin');
    }

    const previous = collectors;
    if (userSession?.role !== 'generator_admin' || !userSession.generatorId) {
      setCollectors(scopedCollectors);
      try {
        localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(scopedCollectors));
        window.dispatchEvent(new Event('moldatk-local-sync'));
      } catch (e) {}
      return;
    }

    try {
      const saved = await syncCloudCollectorRoster(scopedCollectors);
      setCollectors(saved);
      localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(saved));
      window.dispatchEvent(new Event('moldatk-local-sync'));
      showToast('تم حفظ بيانات الجباة وتحديث تسجيل الدخول');
    } catch (error) {
      setCollectors(previous);
      try { localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(previous)); } catch (e) {}
      throw error;
    }
  };

`;
    if (!c.includes(marker)) throw new Error('Collector handler insertion marker not found');
    c = c.replace(marker, handler + marker);
  }

  write(p, c);
}

// POS: older debt patches already import getMonthId/getMonthNameAr. Replace the whole helper
// import with one canonical list and guarantee active month props are destructured.
{
  const p = 'src/components/POSQuickView.tsx';
  let c = read(p);
  const canonical = "import { applyPaymentOldestFirst, ensureMonthInvoice, getInvoiceRemaining, getMonthId, getMonthNameAr, monthIdToDate } from '../utils/monthlyAccounting';";

  if (/import \{[^}]*\} from '\.\.\/utils\/monthlyAccounting';/.test(c)) {
    c = c.replace(/import \{[^}]*\} from '\.\.\/utils\/monthlyAccounting';/, canonical);
  } else {
    c = c.replace("import { calculateSubscriberBill } from '../utils/formatters';", "import { calculateSubscriberBill } from '../utils/formatters';\n" + canonical);
  }

  if (!c.includes('activeMonthId?: string;')) {
    c = c.replace('  collectorName: string;', '  collectorName: string;\n  activeMonthId?: string;\n  activeMonthNameAr?: string;');
  }

  if (!/\n\s*activeMonthId\s*=\s*getMonthId\(\),/.test(c)) {
    c = c.replace(
      /\n\s*collectorName,\n/,
      match => match + '  activeMonthId = getMonthId(),\n  activeMonthNameAr,\n'
    );
  }

  write(p, c);
}

// Subscriber modal: normalize the helper import too; earlier patches may have inserted only a
// subset, which made the final ledger functions unavailable to TypeScript.
{
  const p = 'src/components/SubscriberModal.tsx';
  let c = read(p);
  const canonical = "import { applyPaymentOldestFirst, ensureMonthInvoice, getInvoiceRemaining, getMonthId, getMonthNameAr, monthIdToDate } from '../utils/monthlyAccounting';";

  if (/import \{[^}]*\} from '\.\.\/utils\/monthlyAccounting';/.test(c)) {
    c = c.replace(/import \{[^}]*\} from '\.\.\/utils\/monthlyAccounting';/, canonical);
  } else {
    c = c.replace("import { formatCurrency } from '../utils/formatters';", "import { formatCurrency } from '../utils/formatters';\n" + canonical);
  }

  if (!c.includes('activeMonthId?: string;')) {
    c = c.replace('  pricingTiers: SubscriptionTierPricing[];', '  pricingTiers: SubscriptionTierPricing[];\n  activeMonthId?: string;\n  activeMonthNameAr?: string;');
  }
  if (!/\n\s*activeMonthId\s*=\s*getMonthId\(\),/.test(c)) {
    c = c.replace(
      /\n\s*pricingTiers,\n/,
      match => match + '  activeMonthId = getMonthId(),\n  activeMonthNameAr,\n'
    );
  }

  write(p, c);
}

console.log('Applied monthly ledger integration typecheck fixes');
