import fs from 'node:fs';

const read = path => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(`Owner audit fix: ${message}`); };

// 1) Receipt state must be derived from the saved amounts, not a stale invoice status label.
{
  const path = 'src/components/InvoiceReceiptModal.tsx';
  let src = read(path);
  must(src, 'InvoiceReceiptModal source missing');

  const start = src.indexOf('  const currentTierType = subscriber?.tier || invoice?.tier;');
  const end = src.indexOf('  const paymentMonth =', start);
  must(start >= 0 && end > start, 'receipt summary block missing');

  const replacement = `  const currentTierType = subscriber?.tier || invoice?.tier;\n  const currentTier = currentTierType ? pricingTiers.find(t => t.type === currentTierType || t.id === currentTierType) : undefined;\n  const invoiceCancelled = invoice?.status === 'cancelled';\n  const isFree = invoice?.status === 'free' || subscriber?.paymentStatus === 'free' || currentTierType === 'free';\n  const amperes = Number(invoice?.amperes ?? subscriber?.amperes ?? 0);\n  const pricePerAmpere = Number(invoice?.pricePerAmpere ?? currentTier?.pricePerAmpere ?? 0);\n  const fixedFee = Number(invoice?.fixedFee ?? currentTier?.fixedFee ?? 0);\n  const totalAmount = Number(invoice?.totalAmount ?? (amperes * pricePerAmpere + fixedFee));\n  const paidAmount = Number(invoice?.paidAmount ?? subscriber?.amountPaid ?? 0);\n  const remainingAmount = Math.max(0, Number(invoice?.remainingAmount ?? Math.max(0, totalAmount - paidAmount)));\n  // MOLDATK_CANONICAL_RECEIPT_STATUS_V1\n  const invoiceFullyPaidByAmounts = Boolean(invoice && !invoiceCancelled && !isFree && totalAmount > 0 && paidAmount >= totalAmount && remainingAmount === 0);\n  const isPaid = !invoiceCancelled && !isFree && (invoice?.status === 'paid' || invoiceFullyPaidByAmounts || (!invoice && subscriber?.paymentStatus === 'paid'));\n  const isPartial = !invoiceCancelled && !isFree && !isPaid && (invoice ? (invoice.status === 'partial' || (paidAmount > 0 && remainingAmount > 0)) : subscriber?.paymentStatus === 'partial');\n  const paymentAmount = isFree ? 0 : paidAmount;\n`;

  src = src.slice(0, start) + replacement + src.slice(end);
  src = src.replace('  const finalized = Boolean(invoice && (isPaid || isPartial || isFree));', '  const finalized = Boolean(!invoiceCancelled && (isPaid || isPartial || isFree));');
  src = src.replace("  const receiptKey = invoice?.id || invoice?.receiptNumber || '';", "  const receiptKey = invoice?.id || invoice?.receiptNumber || (subscriber ? `${subscriber.id}:${statusText}:${paymentAmount}:${remainingAmount}` : '');");
  src = src.replaceAll('*مولدتي*', '*مولدتك*').replaceAll('>مولدتي</div>', '>مولدتك</div>');
  must(src.includes('MOLDATK_CANONICAL_RECEIPT_STATUS_V1'), 'canonical receipt marker missing');
  must(src.includes('const finalized = Boolean(!invoiceCancelled'), 'receipt finalization still requires invoice object');
  write(path, src);
}

// 2) Subscriber payments must never create a receipt for a hard-coded historical month.
{
  const path = 'src/components/SubscriberModal.tsx';
  let src = read(path);
  must(src, 'SubscriberModal source missing');

  if (!src.includes('activeMonthId?: string;')) {
    src = src.replace('  pricingTiers: SubscriptionTierPricing[];', '  pricingTiers: SubscriptionTierPricing[];\n  activeMonthId?: string;\n  activeMonthNameAr?: string;');
  }
  if (!src.includes('activeMonthId,') && src.includes('  pricingTiers,')) {
    src = src.replace('  pricingTiers,', '  pricingTiers,\n  activeMonthId,\n  activeMonthNameAr,');
  }
  if (!src.includes('MOLDATK_EFFECTIVE_PAYMENT_MONTH_V1')) {
    const anchor = '  const currentCalc = subscriberToEdit ? calculateSubscriberBill(subscriberToEdit.amperes, subscriberToEdit.tier, pricingTiers) : null;';
    must(src.includes(anchor), 'subscriber calculation anchor missing');
    src = src.replace(anchor, `${anchor}\n  // MOLDATK_EFFECTIVE_PAYMENT_MONTH_V1\n  const paymentMonthDate = new Date();\n  const effectivePaymentMonthId = activeMonthId || \`${'${paymentMonthDate.getFullYear()}'}-${'${String(paymentMonthDate.getMonth() + 1).padStart(2, \'0\')}'}\`;\n  const effectivePaymentMonthNameAr = activeMonthNameAr || \`شهر ${'${paymentMonthDate.getMonth() + 1}'} (${'${paymentMonthDate.getFullYear()}'} )\`;`);
  }
  src = src.replaceAll("monthId: '2026-08'", 'monthId: effectivePaymentMonthId');
  src = src.replaceAll("monthNameAr: 'شهر 8 (آب 2026)'", 'monthNameAr: effectivePaymentMonthNameAr');
  must(!src.includes("monthId: '2026-08'"), 'hard-coded 2026-08 payment month remains');
  write(path, src);

  const appPath = 'src/App.tsx';
  let app = read(appPath);
  if (app.includes('activeMonthRecord') && !app.includes('activeMonthId={activeMonthRecord?.id}')) {
    app = app.replaceAll(
      '          pricingTiers={pricingTiers}\n          lines={lines}',
      '          pricingTiers={pricingTiers}\n          activeMonthId={activeMonthRecord?.id}\n          activeMonthNameAr={activeMonthRecord?.monthNameAr}\n          lines={lines}'
    );
  }
  write(appPath, app);
}

// 3) Phone and desktop subscriber counters use the same canonical current-month invoice status.
{
  const path = 'src/utils/monthlyAccounting.ts';
  let src = read(path);
  if (!src.includes('export function getCanonicalSubscriberPaymentStatus')) {
    const anchor = 'export function activateMonthlyTariffForSubscribers(';
    must(src.includes(anchor), 'monthly accounting activation anchor missing');
    const helper = `export function getCanonicalSubscriberPaymentStatus(subscriber: Subscriber): Subscriber['paymentStatus'] {\n  const invoices = (subscriber.invoicesHistory || []).filter(inv => inv.status !== 'cancelled');\n  if (!invoices.length) return subscriber.tier === 'free' || subscriber.isExempted ? 'free' : subscriber.paymentStatus;\n  const latestMonthId = invoices.reduce((latest, inv) => inv.monthId > latest ? inv.monthId : latest, '');\n  const currentInvoice = canonicalInvoiceForMonth(invoices.filter(inv => inv.monthId === latestMonthId));\n  if (!currentInvoice) return subscriber.paymentStatus;\n  if (currentInvoice.status === 'free' || subscriber.tier === 'free' || subscriber.isExempted) return 'free';\n  const remaining = getInvoiceRemaining(currentInvoice);\n  const paid = Math.max(0, Number(currentInvoice.paidAmount || 0));\n  if (remaining === 0) return 'paid';\n  if (paid > 0) return 'partial';\n  return 'unpaid';\n}\n\n`;
    src = src.replace(anchor, helper + anchor);
  }
  write(path, src);
}

for (const path of ['src/components/mobile/MobileSubscribers.tsx', 'src/components/SubscribersView.tsx']) {
  let src = read(path);
  must(src, `${path} missing`);
  const importPath = path.includes('/mobile/') ? '../../utils/monthlyAccounting' : '../utils/monthlyAccounting';
  if (!src.includes('getCanonicalSubscriberPaymentStatus')) {
    const firstImportEnd = src.indexOf('\n', src.indexOf("from 'lucide-react';"));
    if (firstImportEnd >= 0) {
      src = src.slice(0, firstImportEnd + 1) + `import { getCanonicalSubscriberPaymentStatus } from '${importPath}';\n` + src.slice(firstImportEnd + 1);
    }
  }

  if (path.includes('/mobile/')) {
    src = src.replace("    const isFree = sub.paymentStatus === 'free' || sub.tier === 'free';", "    const canonicalStatus = getCanonicalSubscriberPaymentStatus(sub);\n    const isFree = canonicalStatus === 'free' || sub.tier === 'free';");
    src = src.replace('      : sub.paymentStatus === statusFilter;', '      : canonicalStatus === statusFilter;');
    src = src.replace("  const paidCount = subscribers.filter(s => s.paymentStatus === 'paid').length;\n  const partialCount = subscribers.filter(s => s.paymentStatus === 'partial').length;\n  const unpaidCount = subscribers.filter(s => s.paymentStatus === 'unpaid').length;\n  const freeCount = subscribers.filter(s => s.paymentStatus === 'free' || s.tier === 'free').length;", "  const paidCount = subscribers.filter(s => getCanonicalSubscriberPaymentStatus(s) === 'paid').length;\n  const partialCount = subscribers.filter(s => getCanonicalSubscriberPaymentStatus(s) === 'partial').length;\n  const unpaidCount = subscribers.filter(s => getCanonicalSubscriberPaymentStatus(s) === 'unpaid').length;\n  const freeCount = subscribers.filter(s => getCanonicalSubscriberPaymentStatus(s) === 'free').length;");
  } else {
    src = src.replace("  const countPaid = subscribers.filter(s => s.paymentStatus === 'paid').length;\n  const countUnpaid = subscribers.filter(s => s.paymentStatus === 'unpaid').length;\n  const countPartial = subscribers.filter(s => s.paymentStatus === 'partial').length;\n  const countFree = subscribers.filter(s => s.paymentStatus === 'free').length;", "  const countPaid = subscribers.filter(s => getCanonicalSubscriberPaymentStatus(s) === 'paid').length;\n  const countUnpaid = subscribers.filter(s => getCanonicalSubscriberPaymentStatus(s) === 'unpaid').length;\n  const countPartial = subscribers.filter(s => getCanonicalSubscriberPaymentStatus(s) === 'partial').length;\n  const countFree = subscribers.filter(s => getCanonicalSubscriberPaymentStatus(s) === 'free').length;");
    src = src.replace("    if (filterStatus === 'paid' && sub.paymentStatus !== 'paid') return false;\n    if (filterStatus === 'unpaid' && sub.paymentStatus !== 'unpaid') return false;\n    if (filterStatus === 'partial' && sub.paymentStatus !== 'partial') return false;\n    if (filterStatus === 'free' && sub.paymentStatus !== 'free') return false;", "    const canonicalStatus = getCanonicalSubscriberPaymentStatus(sub);\n    if (filterStatus === 'paid' && canonicalStatus !== 'paid') return false;\n    if (filterStatus === 'unpaid' && canonicalStatus !== 'unpaid') return false;\n    if (filterStatus === 'partial' && canonicalStatus !== 'partial') return false;\n    if (filterStatus === 'free' && canonicalStatus !== 'free') return false;");
  }
  must(src.includes('getCanonicalSubscriberPaymentStatus'), `${path} canonical status wiring missing`);
  write(path, src);
}

// 4) Remove the non-functional settings category/search controls requested by the owner.
{
  const path = 'src/components/SettingsFolderView.tsx';
  let src = read(path);
  must(src, 'SettingsFolderView source missing');
  const start = src.indexOf('      {/* شريط البحث والتصنيفات */}');
  const end = src.indexOf('      {/* شبكة الإعدادات */}', start);
  if (start >= 0 && end > start) src = src.slice(0, start) + src.slice(end);
  src = src.replace("  const [searchTerm, setSearchTerm] = useState('');\n", '').replace("  const [activeCategory, setActiveCategory] = useState<string>('all');\n", '');
  src = src.replace(/\n  const categories = \[[\s\S]*?\n  \];\n/, '\n');
  src = src.replace("    if (!textInputVal || !textInputVal.trim()) return;", "    if (!textInputVal || !textInputVal.trim()) {\n      alert('اكتب اسم الكابينة أولاً ثم اضغط إضافة.');\n      return;\n    }");
  must(!src.includes('بحث في المجلدات والإعدادات...'), 'settings search control remains');
  must(!src.includes('كافة المجلدات'), 'settings categories remain');
  must(src.includes('اكتب اسم الكابينة أولاً'), 'empty cabinet validation missing');
  write(path, src);
}

// 5) Remove stale static folder badges on mobile (e.g. old collector count / 500KVA seed values).
{
  const path = 'src/components/mobile/MobileSettings.tsx';
  let src = read(path);
  must(src, 'MobileSettings source missing');
  src = src.replace(/\n\s*\{f\.badge && \(\s*<span[\s\S]*?\{f\.badge\}[\s\S]*?<\/span>\s*\)\}/g, '');
  must(!src.includes('{f.badge}'), 'stale mobile folder badge remains');
  write(path, src);
}

console.log('Applied owner audit fixes: canonical receipt/payment state, unified subscriber counters, removed unused settings filters/search, explicit empty-cabinet validation, and removed stale mobile badges.');
