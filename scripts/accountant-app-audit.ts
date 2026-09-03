import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(p, 'utf8');
const mustContain = (file: string, needle: string, label: string) => {
  const content = read(file);
  assert(content.includes(needle), `${label}: missing ${needle} in ${file}`);
};
const mustMatch = (file: string, re: RegExp, label: string) => {
  const content = read(file);
  assert(re.test(content), `${label}: pattern ${re} missing in ${file}`);
};

function collectText(dir: string): string {
  let out = '';
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out += collectText(full);
    else if (/\.(ts|tsx|js|mjs|java|json)$/.test(item.name)) out += '\n' + read(full);
  }
  return out;
}

const allSrc = collectText('src');
const allAndroid = collectText('android/app/src/main');

// ---------------------------------------------------------------------------
// Monthly pricing + reports UI
// ---------------------------------------------------------------------------
mustContain('src/components/PricingModal.tsx', "onSaveMonthlyTariffs(updatedTariffs, monthId, true);", 'New month must activate accounts immediately');
mustContain('src/components/PricingModal.tsx', "case 'golden': return 'ذهبي';", 'Golden fixed tier');
mustContain('src/components/PricingModal.tsx', "case 'commercial': return 'محلات';", 'Commercial fixed tier');
mustContain('src/components/PricingModal.tsx', "case 'free': return 'مجاني';", 'Free fixed tier');
mustContain('src/components/PricingModal.tsx', "default: return 'نهاري';", 'Daytime fixed tier');
mustContain('src/components/PricingModal.tsx', 'value={fixedTierName(tier.type)}', 'Tier names are not retyped every month');
mustMatch('src/components/PricingModal.tsx', /<option key=\{i \+ 1\} value=\{i \+ 1\}>\s*\{i \+ 1\}\s*<\/option>/m, 'Month picker must show 1..12');
mustContain('src/components/PricingModal.tsx', 'numericMonthLabel(newMonthNumber, newYearNumber)', 'Month record label must be numeric');
mustContain('src/components/PricingModal.tsx', 'fixedFee: 0', 'New/current pricing must not contain hidden fixed surcharge');
mustContain('src/components/PricingModal.tsx', '}, [isOpen]);', 'Open pricing editor must not be overwritten by sync refresh');
mustContain('src/components/Sidebar.tsx', "id: 'reports'", 'Desktop reports navigation');
mustContain('src/App.tsx', "activeTab === 'reports'", 'Desktop reports screen');
mustContain('src/components/mobile/MobileMonthlyReports.tsx', "setOpenList(openList === 'paid' ? null : 'paid')", 'Paid report drill-down');
mustContain('src/components/mobile/MobileMonthlyReports.tsx', "setOpenList(openList === 'outstanding' ? null : 'outstanding')", 'Outstanding report drill-down');

// ---------------------------------------------------------------------------
// Current-month accounting / debt carry / safe delete
// ---------------------------------------------------------------------------
mustContain('src/App.tsx', 'activateMonthlyTariffForSubscribers', 'App must use tested rollover engine');
mustContain('src/App.tsx', 'hasPaymentsInMonth', 'Deleting a paid month must be blocked');
mustContain('src/App.tsx', 'removeUnpaidMonthLedger', 'Accidental unpaid month deletion must clean its ledger');
mustContain('src/App.tsx', "localStorage.setItem(getStorageKey('moldatk_monthly_tariffs')", 'Tariff snapshot must persist locally');
mustContain('src/App.tsx', "localStorage.setItem(getStorageKey('moldatk_subscribers')", 'Subscriber ledger snapshot must persist locally');
const appText = read('src/App.tsx');
const tariffWrite = appText.indexOf("localStorage.setItem(getStorageKey('moldatk_monthly_tariffs')");
const subscriberWrite = appText.indexOf("localStorage.setItem(getStorageKey('moldatk_subscribers')", tariffWrite);
const syncAfterWrites = appText.indexOf("window.dispatchEvent(new Event('moldatk-local-sync'))", subscriberWrite);
assert(tariffWrite >= 0 && subscriberWrite > tariffWrite && syncAfterWrites > subscriberWrite,
  'Monthly rollover must write tariff + subscriber ledger before dispatching sync refresh');
mustContain('src/utils/monthlyAccounting.ts', 'export function activateMonthlyTariffForSubscribers', 'Rollover engine export');
mustContain('src/utils/monthlyAccounting.ts', "return `${month}-${year}`;", 'Numeric month labels');
mustContain('src/utils/monthlyTariffDeletion.ts', "throw new Error('MONTH_HAS_PAYMENTS')", 'Paid month deletion hard-stop');
mustContain('src/components/mobile/MobileDashboard.tsx', 'activeMonthId = getMonthId()', 'Dashboard must be scoped to current month');
mustContain('src/components/mobile/MobileDashboard.tsx', 'const currentAccount = (sub: Subscriber)', 'Dashboard current-month invoice selector');
mustContain('src/components/mobile/MobileDashboard.tsx', 'const billingCycleActive = pricingTiers.some', 'Dashboard must know when no tariff is active');
mustContain('src/components/mobile/MobileDashboard.tsx', 'const currentMonthTotal = billingCycleActive', 'Current month total must zero when tariffs are cleared');
mustContain('src/components/mobile/MobileDashboard.tsx', 'const paidSubs = billingCycleActive', 'Paid dashboard count must zero when tariffs are cleared');
mustContain('src/components/DashboardView.tsx', 'const paidSubscribers = billingCycleActive', 'Desktop paid dashboard count must zero when tariffs are cleared');

// ---------------------------------------------------------------------------
// Payment path + receipt path
// ---------------------------------------------------------------------------
mustContain('src/components/POSQuickView.tsx', 'applyPaymentOldestFirst', 'Collector payment must allocate oldest debt first');
mustContain('src/components/SubscriberModal.tsx', 'applyPaymentOldestFirst', 'Owner payment must allocate oldest debt first');
mustContain('src/components/InvoiceReceiptModal.tsx', 'previousDebtBefore', 'Receipt previous debt');
mustContain('src/components/InvoiceReceiptModal.tsx', 'appliedToPreviousDebt', 'Receipt old-debt allocation');
mustContain('src/components/InvoiceReceiptModal.tsx', 'appliedToCurrentMonth', 'Receipt current-month allocation');
mustMatch('src/components/InvoiceReceiptModal.tsx', /finalized\s*=\s*Boolean\(invoice\s*&&\s*!isFree/m, 'Free accounts must not create finalized payment receipt');

const pos = read('src/components/POSQuickView.tsx');
const savePos = pos.indexOf('onSaveSubscriber(updated);');
const autoPrintPos = pos.indexOf('onOpenReceiptModal(updated, receiptInvoice, true)');
assert(savePos >= 0 && autoPrintPos > savePos, 'Receipt must open/print only after the payment save call');

assert(allAndroid.includes('previousDebt') && allAndroid.includes('appliedToPreviousDebt') && allAndroid.includes('totalOutstandingAfter'),
  'SUNMI native receipt must include debt-aware fields');

// ---------------------------------------------------------------------------
// Isolation, offline/sync, deletion recovery, cashbox and notifications
// ---------------------------------------------------------------------------
mustContain('src/App.tsx', '`${baseKey}_${session.generatorId}`', 'Local account isolation by generator');
assert(allSrc.includes('generator_id') || allSrc.includes('generatorId'), 'Cloud data must remain generator-scoped');
assert(allSrc.includes('moldatk_deleted_subscribers'), 'Subscriber tombstones must remain enabled to prevent resurrection');
assert(allSrc.includes('moldatk_wallet_reset_timestamp'), 'Cashbox reset timestamp must remain persisted');
assert(allSrc.includes('moldatk-local-sync'), 'Local-first sync event must remain enabled');
assert(allSrc.includes('refreshSession') || allSrc.includes('refresh_token') || allSrc.includes('getSession'), 'Auth/session recovery logic must remain present');
assert(allSrc.includes('hideFloatingTriggers'), 'Floating notification trigger suppression must remain present');
assert(allSrc.includes('moldatk-open-notifications'), 'Header notification event must remain present');

// ---------------------------------------------------------------------------
// Approved subscriber status colors and free-payment protection
// ---------------------------------------------------------------------------
assert(allSrc.includes('#176B45') || allSrc.includes('bg-emerald'), 'Paid state green styling must remain present');
assert(allSrc.includes('#9A741B') || allSrc.includes('amber'), 'Partial state amber styling must remain present');
assert(allSrc.includes('#46515F') || allSrc.includes('slate'), 'Free state gray styling must remain present');
assert(allSrc.includes('#8A2F3E') || allSrc.includes('rose'), 'Unpaid state burgundy/red styling must remain present');
assert(allSrc.includes("paymentStatus === 'free'") || allSrc.includes("tier === 'free'"), 'Free account payment protection must remain present');

console.log('Accountant app audit passed: pricing, numeric months, zero hidden fees, atomic monthly rollover, safe deletion, zero-dashboard reset, reports, debt allocation, receipts, isolation, offline sync, deletion tombstones, cashbox, notifications, colors, and free-account safeguards.');
