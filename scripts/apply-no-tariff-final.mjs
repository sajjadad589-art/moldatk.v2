import fs from 'node:fs';

// Run after every legacy generator. Known already-normalized shapes are skipped
// so lint and build can safely run more than once on the same checkout.
const patch = (path, transform) => {
  let source = fs.readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
  const replace = (before, after) => {
    if (source.includes(after)) return;
    if (!source.includes(before)) { console.warn(`skip no-tariff anchor: ${path}: ${before.slice(0, 90)}`); return; }
    source = source.replace(before, after);
  };
  const addImport = (relative, names = 'hasMonthlyPricing, NO_TARIFF_LABEL') => {
    const line = `import { ${names} } from '${relative}utils/pricingAvailability';`;
    if (!source.includes(line)) source = line + '\n' + source;
  };
  transform(replace, addImport);
  source = source.replace(/(import \{ hasMonthlyPricing \} from ['"][^'"]+pricingAvailability['"];\n)\1+/g, '$1');
  source = source.replace(/(  const hasPricing = hasMonthlyPricing\(pricingTiers\);\n)\1+/g, '$1');
  fs.writeFileSync(path, source);
};

patch('src/App.tsx', (replace, addImport) => {
  addImport('./', 'hasMonthlyPricing, suspendSubscriberBilling');
  replace('activeMonthRecord?.tiers || INITIAL_PRICING_TIERS.map(t => ({ ...t, pricePerAmpere: 0, fixedFee: 0 }))', 'activeMonthRecord?.tiers || []');
  replace('    const normalizedSub: Subscriber = {', '    let normalizedSub: Subscriber = {');
  replace('    // Local-first: payment/status changes', `    // No active tariff: profile edits preserve the historical ledger, including
    // when an old payment dialog was open while pricing was removed remotely.
    if (!hasMonthlyPricing(pricingTiers)) {
      const previous = subscribers.find(s => s.id === normalizedSub.id);
      normalizedSub = suspendSubscriberBilling({ ...normalizedSub,
        invoicesHistory: previous?.invoicesHistory || [],
        paymentStatus: previous?.paymentStatus || normalizedSub.paymentStatus,
        lastPaymentDate: previous?.lastPaymentDate,
      });
    }

    // Local-first: payment/status changes`);
  replace('  const addAuditLog = (entry: any) => {', `  const addAuditLog = (entry: any) => {
    if (!hasMonthlyPricing(pricingTiers) && ['payment', 'cancellation'].includes(entry.category)) return;`);
});

patch('src/utils/authoritativeAccounting.ts', (replace, addImport) => {
  addImport('../', 'hasMonthlyPricing');
  replace('  const isFree = sub.tier', `  // Historical invoices never reopen a deleted monthly billing cycle.
  if (!hasMonthlyPricing(tiers)) return { sub, isFree: false, bill: 0, paid: 0, outstanding: 0, status: 'no_tariff' as const };
  const isFree = sub.tier`);
});

patch('src/utils/monthlyAccounting.ts', (replace, addImport) => {
  addImport('../', 'hasMonthlyPricing');
  replace('): OldestFirstPaymentResult {', `): OldestFirstPaymentResult {
  if (!hasMonthlyPricing(pricingTiers)) throw new Error('NO_MONTHLY_TARIFF');`);
});

patch('src/components/SubscribersView.tsx', (replace, addImport) => {
  addImport('../');
  replace("(status: Subscriber['paymentStatus']) => {", `(status: Subscriber['paymentStatus'] | 'no_tariff') => {
  if (status === 'no_tariff') return { cardBg: 'bg-white dark:bg-white', cardBorderAccent: 'border border-slate-300', avatarBg: 'bg-slate-100 text-slate-700', nameText: 'text-slate-900', badgeBg: 'bg-slate-100 text-slate-700', innerSubBox: 'bg-slate-50' };`);
  replace("  const [searchTerm, setSearchTerm] = useState('');", "  const hasPricing = hasMonthlyPricing(pricingTiers);\n  const [searchTerm, setSearchTerm] = useState('');");
  for (const status of ['paid', 'unpaid', 'partial', 'free']) {
    replace(`subscribers.filter(s => s.paymentStatus === '${status}').length`, `hasPricing ? subscribers.filter(s => s.paymentStatus === '${status}').length : 0`);
    replace(`if (filterStatus === '${status}'`, `if (hasPricing && filterStatus === '${status}'`);
    replace(`const is${status[0].toUpperCase() + status.slice(1)} = sub.paymentStatus`, `const is${status[0].toUpperCase() + status.slice(1)} = hasPricing && sub.paymentStatus`);
  }
  replace('const codeBoxClass = isUnpaid', "const codeBoxClass = !hasPricing ? 'bg-white text-slate-900 border border-slate-300' : isUnpaid");
  replace('{sub.fullName}\n                        </span>', '{sub.fullName}\n                        </span>\n                        {!hasPricing && <span className="block text-xs text-slate-600 mt-1">{NO_TARIFF_LABEL} · المطلوب: 0 د.ع</span>}');
});

patch('src/components/mobile/MobileSubscribers.tsx', (replace, addImport) => {
  addImport('../../');
  replace('  subscribers,\n  lines,', '  subscribers,\n  pricingTiers,\n  lines,');
  replace('  const readInitialStatusFilter', '  const hasPricing = hasMonthlyPricing(pricingTiers);\n  const readInitialStatusFilter');
  replace("const matchesStatus = statusFilter === 'all'", "const matchesStatus = !hasPricing || statusFilter === 'all'");
  for (const name of ['Free', 'Paid', 'Unpaid']) {
    replace(`const is${name}Subscriber = (sub: Subscriber) => `, `const is${name}Subscriber = (sub: Subscriber) => hasPricing && (`);
  }
  replace("sub.paymentStatus === 'free' || sub.tier === 'free';", "sub.paymentStatus === 'free' || sub.tier === 'free');");
  replace("(sub.paymentStatus === 'paid' || getRemainingAmount(sub) === 0);", "(sub.paymentStatus === 'paid' || getRemainingAmount(sub) === 0));");
  replace("(sub.paymentStatus === 'unpaid' || sub.paymentStatus === 'partial' || getRemainingAmount(sub) > 0);", "(sub.paymentStatus === 'unpaid' || sub.paymentStatus === 'partial' || getRemainingAmount(sub) > 0));");
  replace("const partialCount = subscribers.filter(s => s.paymentStatus === 'partial').length;", "const partialCount = hasPricing ? subscribers.filter(s => s.paymentStatus === 'partial').length : 0;");
  replace("getSubscriberStyleByStatus(isFree ? 'free' : sub.paymentStatus)", "getSubscriberStyleByStatus(!hasPricing ? 'no_tariff' : isFree ? 'free' : sub.paymentStatus)");
  replace('const visibleAmount = isFree', 'const visibleAmount = !hasPricing ? formatCurrency(0) : isFree');
  replace('className={`w-full rounded-xl', 'data-billing-state={hasPricing ? sub.paymentStatus : \'no_tariff\'}\n                className={`w-full rounded-xl');
  // Fixed white text in the legacy card is unreadable on a white no-tariff card.
  for (const label of ['اسم المشترك', 'الأمبير', 'المبلغ']) {
    replace(`className="block text-[9px] font-bold text-white/75 leading-3">${label}`, `className={\`block text-[9px] font-bold leading-3 \${hasPricing ? 'text-white/75' : 'text-slate-600'}\`}>${label}`);
  }
  replace('className="block text-[15px] font-black text-cyan-300 tabular-nums leading-6 whitespace-nowrap"', 'className={`block text-[15px] font-black tabular-nums leading-6 whitespace-nowrap ${hasPricing ? \'text-cyan-300\' : \'text-slate-900\'}`}');
  replace('className="block text-[15px] font-black text-white tabular-nums truncate leading-6"', 'className={`block text-[15px] font-black tabular-nums truncate leading-6 ${styles.nameText}`}');
  replace('{visibleAmount}\n                    </span>', '{visibleAmount}\n                    </span>\n                    {!hasPricing && <span className="block text-[10px] text-slate-600 font-bold">{NO_TARIFF_LABEL}</span>}');
});

patch('src/components/SubscriberModal.tsx', (replace, addImport) => {
  addImport('../', 'hasMonthlyPricing, NO_TARIFF_LABEL, suspendSubscriberBilling');
  replace('  if (!isOpen) return null;', '  const hasPricing = hasMonthlyPricing(pricingTiers);\n  if (!isOpen) return null;');
  for (const anchor of [
    '  const executeUnpaidAction = () => {',
    '  const handleQuickPayment = () => {',
    "  const handleCustomPayment = (status: 'paid' | 'partial' | 'free', paidAmount: number = 0) => {",
    '  const handleLumpSettlement = (paidAmount: number) => {',
  ]) replace(anchor, anchor + '\n    if (!hasMonthlyPricing(pricingTiers)) return;');
  replace('    const ensured = ensureMonthInvoice(draft,', `    if (!hasPricing) {
      onSaveSubscriber(suspendSubscriberBilling(draft));
      setIsEditing(false);
      return;
    }
    const ensured = ensureMonthInvoice(draft,`);
  replace('      if (isPermanentFree) {\n        const freeInvoice', `      if (!hasPricing) {
        onSaveSubscriber(suspendSubscriberBilling(base));
        onClose();
        return;
      }
      if (isPermanentFree) {\n        const freeInvoice`);
  replace('const outstanding = Math.max(0, Number(subscriberToEdit?.amountDue || 0));', 'const outstanding = hasPricing ? Math.max(0, Number(subscriberToEdit?.amountDue || 0)) : 0;');
  replace('const paid = Math.max(0, Number(subscriberToEdit?.amountPaid || 0));', 'const paid = hasPricing ? Math.max(0, Number(subscriberToEdit?.amountPaid || 0)) : 0;');
  replace('{paymentStatusLabel(subscriberToEdit.paymentStatus)}', '{hasPricing ? paymentStatusLabel(subscriberToEdit.paymentStatus) : NO_TARIFF_LABEL}');
  replace('${paymentStatusClass(subscriberToEdit.paymentStatus)}', "${hasPricing ? paymentStatusClass(subscriberToEdit.paymentStatus) : 'bg-white text-slate-700 border-slate-300'}");
  // Both quick and custom entry points use the same condition.
  replace('{!isPaid && !isFree && (\n              <button', '{hasPricing && !isPaid && !isFree && (\n              <button');
  replace('{!isPaid && !isFree && (\n                <button', '{hasPricing && !isPaid && !isFree && (\n                <button');
  replace('{isPaid && !isFree && !isOnboardingNoCurrentCharge && (', '{hasPricing && isPaid && !isFree && !isOnboardingNoCurrentCharge && (');
  replace('{/* PAYMENT_BUTTON_BELOW_DETAILS_V1 */}', `{/* PAYMENT_BUTTON_BELOW_DETAILS_V1 */}
            {!hasPricing && <button type="button" disabled className="w-full py-4 my-3 rounded-2xl bg-white border border-slate-300 text-slate-600 font-bold">لا يوجد مبلغ مطلوب — {NO_TARIFF_LABEL}</button>}`);
  replace('{isAdvancedOpen && subscriberToEdit && (', '{hasPricing && isAdvancedOpen && subscriberToEdit && (');
  replace('{isConfirmUnpaidOpen && subscriberToEdit && (', '{hasPricing && isConfirmUnpaidOpen && subscriberToEdit && (');
  replace('{pricingTiers.map(t => <option', '{!hasPricing && <option value={tier}>{({ normal: "اعتيادي", commercial: "تجاري", golden: "ذهبي", free: "مجاني" } as Record<string, string>)[tier] || tier}</option>}{pricingTiers.map(t => <option');
});

patch('src/components/POSQuickView.tsx', (replace, addImport) => {
  addImport('../');
  replace('  const handleConfirmPayment = (data: PaymentExecutionData) => {', '  const handleConfirmPayment = (data: PaymentExecutionData) => {\n    if (!hasMonthlyPricing(pricingTiers)) return;');
  replace('ممتاز! جميع المشتركين ضمن هذه التصفية قاموا بتسديد اشتراكاتهم بالكامل.', "{hasMonthlyPricing(pricingTiers) ? 'ممتاز! جميع المشتركين ضمن هذه التصفية قاموا بتسديد اشتراكاتهم بالكامل.' : NO_TARIFF_LABEL + ' — التسديد متوقف'}");
});

patch('src/components/PaymentMethodModal.tsx', (replace, addImport) => {
  addImport('../');
  replace('  if (!isOpen || !subscriber) return null;', '  if (!isOpen || !subscriber || !hasMonthlyPricing(pricingTiers)) return null;');
  replace('    e.preventDefault();', '    e.preventDefault();\n    if (!hasMonthlyPricing(pricingTiers)) return;');
});

console.log('No-tariff state installed: zero payable, neutral cards, payment guards and preserved history.');
