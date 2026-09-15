import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8').replaceAll('\r\n', '\n');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');
const must = (ok, msg) => { if (!ok) throw new Error(`Production financial operations: ${msg}`); };

// -----------------------------------------------------------------------------
// 1) One canonical lump-settlement engine: the entered cash amount closes the
//    subscriber's ENTIRE outstanding ledger. Any difference is an explicit
//    negotiated settlement/waiver. Normal full/partial payments are untouched.
// -----------------------------------------------------------------------------
{
  const p = 'src/utils/monthlyAccounting.ts';
  let s = read(p);
  if (!s.includes('export function applyLumpSettlementAllDebt(')) {
    s += `

export interface LumpSettlementAllDebtResult {
  invoices: SubscriberInvoice[];
  totalDebtBefore: number;
  receivedAmount: number;
  waivedAmount: number;
  allocations: PaymentAllocationEntry[];
}

/**
 * Negotiated/lump settlement semantics:
 * - cash actually received is exactly the owner's entered amount;
 * - EVERY outstanding invoice is closed;
 * - the unpaid difference is waived, never carried to another month;
 * - cash allocation is oldest-first only for audit/receipt attribution.
 */
export function applyLumpSettlementAllDebt(
  subscriber: Subscriber,
  pricingTiers: SubscriptionTierPricing[],
  paymentAmount: number,
  date = new Date(),
  activeMonthId = getMonthId(date),
  activeMonthNameAr = getMonthNameAr(monthIdToDate(activeMonthId)),
): LumpSettlementAllDebtResult {
  if (!hasMonthlyPricing(pricingTiers)) throw new Error('NO_MONTHLY_TARIFF');
  const ensured = ensureMonthInvoice(
    subscriber,
    pricingTiers,
    activeMonthId,
    activeMonthNameAr,
    date.toISOString().slice(0, 10),
  );
  const invoices = ensured.invoices.map(inv => ({ ...inv }));
  const payable = invoices
    .filter(inv => inv.status !== 'cancelled' && inv.status !== 'free' && getInvoiceRemaining(inv) > 0)
    .sort((a, b) => \`${'${a.monthId}-${a.issueDate}-${a.id}'}\`.localeCompare(\`${'${b.monthId}-${b.issueDate}-${b.id}'}\`));
  const ledgerDebt = payable.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
  const totalDebtBefore = Math.max(ledgerDebt, Math.max(0, Number(subscriber.amountDue || 0)));
  const requested = Math.max(0, Math.round(Number(paymentAmount) || 0));
  if (totalDebtBefore <= 0) throw new Error('NO_OUTSTANDING_DEBT');
  if (requested < 1 || requested > totalDebtBefore) throw new Error('INVALID_LUMP_AMOUNT');

  let cashLeft = requested;
  let waivedAmount = 0;
  const allocations: PaymentAllocationEntry[] = [];
  for (const invoice of payable) {
    const due = getInvoiceRemaining(invoice);
    if (due <= 0) continue;
    const cashApplied = Math.min(due, cashLeft);
    const paidBefore = Math.max(0, Number(invoice.paidAmount || 0));
    const paidAfter = paidBefore + cashApplied;
    const waivedHere = Math.max(0, due - cashApplied);
    const originalTotal = Math.max(0, Number(invoice.totalAmount || 0));
    const marker = 'MOLDATK_LUMP_SETTLEMENT_ALL_DEBT'
      + '|original=' + originalTotal
      + '|paidBefore=' + paidBefore
      + '|received=' + cashApplied
      + '|waived=' + waivedHere
      + '|settlementCash=' + requested
      + '|totalDebtBefore=' + totalDebtBefore;
    const cleanNotes = String(invoice.notes || '')
      .split(' | ')
      .filter(x => x && !x.includes('MOLDATK_LUMP_SETTLEMENT_ALL_DEBT'))
      .join(' | ');

    invoice.totalAmount = paidAfter;
    invoice.paidAmount = paidAfter;
    invoice.remainingAmount = 0;
    invoice.status = 'paid';
    invoice.remainingAfterPayment = 0;
    if (cashApplied > 0) invoice.paymentDate = date.toISOString();
    invoice.notes = [cleanNotes, marker].filter(Boolean).join(' | ');
    waivedAmount += waivedHere;
    if (cashApplied > 0) {
      allocations.push({ monthId: invoice.monthId, monthNameAr: invoice.monthNameAr, amount: cashApplied });
      cashLeft -= cashApplied;
    }
  }

  // A legacy summary balance can theoretically be larger than the invoice ledger.
  // The lump agreement still extinguishes that stale summary debt. If cash exceeds
  // reconstructed invoice debt, record the difference on the active invoice so the
  // receipt/cashbox remains equal to the actual money received.
  if (cashLeft > 0) {
    const current = invoices.find(inv => inv.monthId === activeMonthId && inv.status !== 'cancelled' && inv.status !== 'free');
    if (current) {
      current.totalAmount = Math.max(0, Number(current.totalAmount || 0)) + cashLeft;
      current.paidAmount = Math.max(0, Number(current.paidAmount || 0)) + cashLeft;
      current.remainingAmount = 0;
      current.status = 'paid';
      current.remainingAfterPayment = 0;
      current.paymentDate = date.toISOString();
      current.notes = [String(current.notes || ''), 'MOLDATK_LUMP_SETTLEMENT_ALL_DEBT|legacyCash=' + cashLeft].filter(Boolean).join(' | ');
      allocations.push({ monthId: current.monthId, monthNameAr: current.monthNameAr, amount: cashLeft });
      cashLeft = 0;
    }
  }

  waivedAmount = Math.max(0, totalDebtBefore - requested);
  return {
    invoices,
    totalDebtBefore,
    receivedAmount: requested,
    waivedAmount,
    allocations,
  };
}
`;
  }
  must(s.includes('MOLDATK_LUMP_SETTLEMENT_ALL_DEBT'), 'all-debt lump engine missing');
  write(p, s);
}

// -----------------------------------------------------------------------------
// 2) Collector payment UI: lump ceiling is TOTAL debt, and remaining after lump is zero.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/PaymentMethodModal.tsx';
  let s = read(p);
  s = s.replace(
    /  const activeInvoice = \(subscriber\.invoicesHistory \|\| \[\]\)[\s\S]*?  const lumpMaximum = Math\.max\(0, currentInvoiceRemaining\);\n/,
    '  const lumpMaximum = Math.max(0, totalAmountDue);\n'
  );
  s = s.replace(
    `  } else if (selectedMethod === 'lump') {\n    computedAmountPaid = Math.min(lumpMaximum, Math.max(0, Math.round(Number(partialAmount) || 0)));\n    computedRemaining = Math.max(0, totalAmountDue - computedAmountPaid);`,
    `  } else if (selectedMethod === 'lump') {\n    computedAmountPaid = Math.min(lumpMaximum, Math.max(0, Math.round(Number(partialAmount) || 0)));\n    computedRemaining = 0;`
  );
  s = s.replace('مخصص: يبقى المتبقي ديناً • مقطوع: يغلق الشهر بالمبلغ المتفق عليه', 'مخصص: يبقى المتبقي ديناً • مقطوع: يغلق كامل ذمة المشترك بالمبلغ المتفق عليه');
  s = s.replace('تسديد مقطوع — إغلاق الاشتراك بالمبلغ المتفق عليه', 'تسديد مقطوع — تصفية كامل الذمة بالمبلغ المتفق عليه');
  must(s.includes('const lumpMaximum = Math.max(0, totalAmountDue);'), 'lump maximum is not total debt');
  must(s.includes("computedRemaining = 0;"), 'lump remaining is not zero');
  write(p, s);
}

// -----------------------------------------------------------------------------
// 3) Collector execution: use the same all-debt engine and force receipt remaining = 0.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/POSQuickView.tsx';
  let s = read(p);
  if (!s.includes('applyLumpSettlementAllDebt')) {
    s = s.replace('import { applyPaymentOldestFirst,', 'import { applyLumpSettlementAllDebt, applyPaymentOldestFirst,');
  }
  const start = s.indexOf('    // COLLECTOR_LUMP_SETTLEMENT_V1');
  const end = start >= 0 ? s.indexOf('    // COLLECTOR_FULL_PAYMENT_EXACT_OUTSTANDING_V2', start) : -1;
  must(start >= 0 && end > start, 'collector lump branch bounds missing');
  const branch = `    // COLLECTOR_LUMP_SETTLEMENT_V2_ALL_DEBT
    if (data.method === 'lump') {
      try {
        const settlement = applyLumpSettlementAllDebt(sub, pricingTiers, data.amountPaid, now, monthId, monthName);
        const received = settlement.receivedAmount;
        const currentBefore = ensured.invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled' && inv.status !== 'free');
        const receiptBase = settlement.invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled' && inv.status !== 'free')
          || settlement.invoices.find(inv => inv.status === 'paid')
          || ensured.currentInvoice;
        const updated: Subscriber = {
          ...sub,
          invoicesHistory: settlement.invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
          paymentStatus: 'paid',
          amountDue: 0,
          amountPaid: received,
          lastPaymentDate: now.toISOString(),
        };
        const previousDebtBefore = Math.max(0, settlement.totalDebtBefore - getInvoiceRemaining(currentBefore || ensured.currentInvoice));
        const appliedToPreviousDebt = settlement.allocations.filter(x => x.monthId < monthId).reduce((sum, x) => sum + x.amount, 0);
        const appliedToCurrentMonth = settlement.allocations.filter(x => x.monthId === monthId).reduce((sum, x) => sum + x.amount, 0);
        const receiptInvoice: SubscriberInvoice = {
          ...receiptBase,
          id: 'receipt-lump-' + sub.id + '-' + Date.now(),
          receiptNumber: 'REC-' + (sub.code || sub.subscriberCode || 'MW') + '-' + Date.now().toString().slice(-6),
          totalAmount: received,
          paidAmount: received,
          remainingAmount: 0,
          status: 'paid',
          collectorName: data.collectorName || collectorName || 'المحاسب',
          previousDebtBefore,
          currentCharge: Math.max(0, Number(currentBefore?.totalAmount || 0)),
          totalBeforePayment: settlement.totalDebtBefore,
          appliedToPreviousDebt,
          appliedToCurrentMonth,
          totalOutstandingAfter: 0,
          paymentDate: now.toISOString(),
          notes: 'MOLDATK_LUMP_SETTLEMENT_ALL_DEBT_RECEIPT|received=' + received + '|waived=' + settlement.waivedAmount,
        };
        onSaveSubscriber(updated);
        onAddAuditLog({
          category: 'payment',
          title: 'تسديد مقطوع — تصفية كاملة',
          details: 'إجمالي الذمة قبل التسوية ' + settlement.totalDebtBefore.toLocaleString('en-US') + ' | المستلم فعلياً ' + received.toLocaleString('en-US') + ' | فرق التسوية ' + settlement.waivedAmount.toLocaleString('en-US') + ' | الرصيد المتبقي 0',
          entityId: sub.id,
          entityName: sub.fullName + ' (' + (sub.code || sub.subscriberCode) + ')',
          actorName: data.collectorName || collectorName || 'المحاسب',
          amount: received,
        });
        setPaymentSubscriber(null);
        setPaymentSuccess({ name: sub.fullName, amount: received, method: data.method });
        if (data.autoPrintReceipt) window.setTimeout(() => onOpenReceiptModal(updated, receiptInvoice, true), 650);
        window.setTimeout(() => setPaymentSuccess(null), 1800);
      } catch (error) {
        console.error('Lump settlement failed:', error);
      }
      return;
    }

`;
  s = s.slice(0, start) + branch + s.slice(end);
  must(s.includes('COLLECTOR_LUMP_SETTLEMENT_V2_ALL_DEBT'), 'collector all-debt lump branch missing');
  must(s.includes('totalOutstandingAfter: 0'), 'collector lump receipt can show debt');
  write(p, s);
}

// -----------------------------------------------------------------------------
// 4) Owner execution: identical all-debt semantics and zero receipt balance.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/SubscriberModal.tsx';
  let s = read(p);
  if (!s.includes('applyLumpSettlementAllDebt')) {
    s = s.replace('import { applyPaymentOldestFirst,', 'import { applyLumpSettlementAllDebt, applyPaymentOldestFirst,');
  }
  const start = s.indexOf('  const handleLumpSettlement = (paidAmount: number) => {');
  const end = start >= 0 ? s.indexOf('\n\n  const formatNum =', start) : -1;
  must(start >= 0 && end > start, 'owner lump handler bounds missing');
  const handler = `  const handleLumpSettlement = (paidAmount: number) => {
    if (!subscriberToEdit) return;
    const finalPaid = Math.max(0, Math.round(Number(paidAmount || 0)));
    if (finalPaid <= 0) return;
    const monthId = activeMonthId || getMonthId();
    const monthName = activeMonthNameAr || getMonthNameAr(monthIdToDate(monthId));
    const now = new Date();
    try {
      const ensured = ensureMonthInvoice(subscriberToEdit, pricingTiers, monthId, monthName);
      const currentBefore = ensured.invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled' && inv.status !== 'free');
      const settlement = applyLumpSettlementAllDebt(subscriberToEdit, pricingTiers, finalPaid, now, monthId, monthName);
      const receiptBase = settlement.invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled' && inv.status !== 'free')
        || settlement.invoices.find(inv => inv.status === 'paid')
        || ensured.currentInvoice;
      const updated: Subscriber = {
        ...subscriberToEdit,
        invoicesHistory: settlement.invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
        amountDue: 0,
        amountPaid: settlement.receivedAmount,
        paymentStatus: 'paid',
        lastPaymentDate: now.toISOString(),
      };
      const receipt: SubscriberInvoice = {
        ...receiptBase,
        id: 'receipt-lump-' + subscriberToEdit.id + '-' + Date.now(),
        receiptNumber: 'REC-' + (subscriberToEdit.code || subscriberToEdit.subscriberCode || subscriberToEdit.id) + '-' + Date.now().toString().slice(-6),
        totalAmount: settlement.receivedAmount,
        paidAmount: settlement.receivedAmount,
        remainingAmount: 0,
        status: 'paid',
        previousDebtBefore: Math.max(0, settlement.totalDebtBefore - getInvoiceRemaining(currentBefore || ensured.currentInvoice)),
        currentCharge: Math.max(0, Number(currentBefore?.totalAmount || 0)),
        totalBeforePayment: settlement.totalDebtBefore,
        appliedToPreviousDebt: settlement.allocations.filter(x => x.monthId < monthId).reduce((sum, x) => sum + x.amount, 0),
        appliedToCurrentMonth: settlement.allocations.filter(x => x.monthId === monthId).reduce((sum, x) => sum + x.amount, 0),
        totalOutstandingAfter: 0,
        paymentDate: now.toISOString(),
        notes: 'MOLDATK_LUMP_SETTLEMENT_ALL_DEBT_RECEIPT|received=' + settlement.receivedAmount + '|waived=' + settlement.waivedAmount,
      };
      onSaveSubscriber(updated);
      if (onAddAuditLog) onAddAuditLog({
        category: 'payment',
        title: 'تسديد مقطوع — تصفية كاملة',
        details: 'إجمالي الذمة قبل التسوية ' + settlement.totalDebtBefore.toLocaleString('en-US') + ' | المستلم فعلياً ' + settlement.receivedAmount.toLocaleString('en-US') + ' | فرق التسوية ' + settlement.waivedAmount.toLocaleString('en-US') + ' | الرصيد المتبقي 0',
        entityId: subscriberToEdit.id,
        entityName: subscriberToEdit.fullName + ' (' + (subscriberToEdit.code || subscriberToEdit.subscriberCode || '') + ')',
        actorName: 'الإدارة العامة',
        amount: settlement.receivedAmount,
      });
      setIsAdvancedOpen(false);
      if (onOpenReceiptModal) window.setTimeout(() => onOpenReceiptModal(updated, receipt, true), 120); else onClose();
    } catch (error) {
      const reason = String((error as any)?.message || error || '');
      setCustomError(reason.includes('INVALID_LUMP_AMOUNT')
        ? 'المبلغ يجب أن يكون بين 1 وإجمالي ذمة المشترك.'
        : reason.includes('NO_OUTSTANDING_DEBT')
        ? 'لا يوجد دين مستحق على المشترك.'
        : 'تعذر تنفيذ التسديد المقطوع. أعد المحاولة.');
    }
  };`;
  s = s.slice(0, start) + handler + s.slice(end);
  s = s.replace("max={customPaymentMode === 'lump' ? settlementCurrentRemaining : outstanding}", "max={outstanding}");
  s = s.replace("const maxAmount = customPaymentMode === 'lump' ? settlementCurrentRemaining : outstanding;", 'const maxAmount = outstanding;');
  s = s.replace('يغلق اشتراك الشهر الحالي بالكامل بالمبلغ الذي تحدده. فرق التسوية لا يبقى ديناً، والقاصة والداشبورد يحتسبان المبلغ المستلم فعلياً فقط. أي دين من شهر أقدم يبقى محفوظاً.', 'يغلق كامل ذمة المشترك بجميع الأشهر بالمبلغ الذي تحدده. فرق التسوية لا يبقى ديناً، والقاصة تحتسب المبلغ المستلم فعلياً فقط، ويصبح الرصيد المتبقي 0.');
  s = s.replace('المتبقي للشهر الحالي قبل التسوية:', 'إجمالي الذمة قبل التسوية:');
  s = s.replace('{formatCurrency(settlementCurrentRemaining)}', '{formatCurrency(outstanding)}');
  must(s.includes("paymentStatus: 'paid'"), 'owner lump does not force paid');
  must(s.includes('totalOutstandingAfter: 0'), 'owner lump receipt can show debt');
  write(p, s);
}

// -----------------------------------------------------------------------------
// 5) Local tariff deletion must immediately extinguish that month's liability.
//    The server RPC remains the cloud authority; this prevents stale local debt
//    from appearing until the next pull.
// -----------------------------------------------------------------------------
{
  const p = 'src/utils/monthlyTariffDeletion.ts';
  let s = read(p);
  if (!s.includes('export function extinguishDeletedTariffLiabilities(')) {
    s += `

export function extinguishDeletedTariffLiabilities(
  subscribers: Subscriber[],
  deletedMonthIds: string[],
  activeMonthId = '',
): Subscriber[] {
  const deleted = new Set(deletedMonthIds.map(String));
  if (!deleted.size) return subscribers;
  return subscribers.map(sub => {
    const history: SubscriberInvoice[] = [];
    for (const source of sub.invoicesHistory || []) {
      const inv = { ...source };
      if (!deleted.has(inv.monthId) || inv.status === 'cancelled') {
        history.push(inv);
        continue;
      }
      const paid = Math.max(0, Number(inv.paidAmount || 0));
      if (paid > 0) {
        inv.totalAmount = paid;
        inv.paidAmount = paid;
        inv.remainingAmount = 0;
        inv.status = 'paid';
        inv.remainingAfterPayment = 0;
        inv.notes = [String(inv.notes || ''), 'MOLDATK_TARIFF_DELETED_SETTLED_HISTORY'].filter(Boolean).join(' | ');
        history.push(inv);
      }
      // A deleted tariff with zero actual payment leaves no invoice and no debt.
    }
    const totalOutstanding = history.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
    const current = activeMonthId ? canonicalForMonth(history, activeMonthId) : null;
    const currentPaid = Math.max(0, Number(current?.paidAmount || 0));
    const currentRemaining = current ? getInvoiceRemaining(current) : 0;
    const isFree = sub.tier === 'free' || Boolean(sub.isExempted) || current?.status === 'free';
    const paymentStatus: Subscriber['paymentStatus'] = isFree
      ? 'free'
      : current
      ? (currentRemaining === 0 ? 'paid' : currentPaid > 0 ? 'partial' : 'unpaid')
      : totalOutstanding === 0 ? 'paid' : 'unpaid';
    return {
      ...sub,
      invoicesHistory: history.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      amountDue: totalOutstanding,
      amountPaid: currentPaid,
      paymentStatus,
    };
  });
}
`;
  }
  write(p, s);
}

{
  const p = 'src/App.tsx';
  let s = read(p);
  if (!s.includes("from './utils/monthlyTariffDeletion'")) {
    const anchor = "import { normalizeMonthlyTariffs, startFreshMonthlyCycle, repriceActiveMonthlyCycle, summarizeExistingMonthlyCycle, zeroLiveMonthlyCycle } from './utils/monthlyCycleEngine';";
    must(s.includes(anchor), 'monthly cycle import anchor missing');
    s = s.replace(anchor, anchor + "\nimport { extinguishDeletedTariffLiabilities } from './utils/monthlyTariffDeletion';");
  }
  const handlerStart = s.indexOf('  const handleSaveMonthlyTariffs = (updatedTariffs: MonthlyTariffRecord[], activeMonthId: string, shouldRecalculateBills: boolean) => {');
  const handlerEnd = handlerStart >= 0 ? s.indexOf('\n\n  const handleOpenFolderModal', handlerStart) : -1;
  must(handlerStart >= 0 && handlerEnd > handlerStart, 'tariff handler bounds missing');
  let block = s.slice(handlerStart, handlerEnd);
  const stateAnchor = '    let nextSubscribers = subscribers;\n    let subscribersChanged = false;';
  if (!block.includes('FINANCIAL_DELETE_LOCAL_CLEANUP_V2')) {
    must(block.includes(stateAnchor), 'subscriber state anchor missing');
    block = block.replace(stateAnchor, `${stateAnchor}\n\n    // FINANCIAL_DELETE_LOCAL_CLEANUP_V2\n    const deletedTariffIds = monthlyTariffs.filter(record => !incomingIds.has(record.id)).map(record => record.id);\n    if (deletedTariffIds.length) {\n      nextSubscribers = extinguishDeletedTariffLiabilities(nextSubscribers, deletedTariffIds, activeRecord?.id || '');\n      subscribersChanged = true;\n    }`);
  }
  block = block.replaceAll('zeroLiveMonthlyCycle(subscribers)', 'zeroLiveMonthlyCycle(nextSubscribers)');
  block = block.replaceAll('startFreshMonthlyCycle(subscribers,', 'startFreshMonthlyCycle(nextSubscribers,');
  block = block.replaceAll('repriceActiveMonthlyCycle(subscribers,', 'repriceActiveMonthlyCycle(nextSubscribers,');
  block = block.replaceAll('summarizeExistingMonthlyCycle(subscribers,', 'summarizeExistingMonthlyCycle(nextSubscribers,');
  s = s.slice(0, handlerStart) + block + s.slice(handlerEnd);
  must(s.includes('FINANCIAL_DELETE_LOCAL_CLEANUP_V2'), 'local deleted-tariff debt cleanup missing');
  write(p, s);
}

console.log('Production financial operations finalized: lump closes all debt, tariff deletion clears debt locally/cloud, delete/reset backend hardened.');
