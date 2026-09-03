import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

const replaceBlock = (source, startNeedle, endNeedle, replacement, label) => {
  const start = source.indexOf(startNeedle);
  const end = start >= 0 ? source.indexOf(endNeedle, start) : -1;
  if (start < 0 || end < 0) throw new Error(`Monthly ledger finalization: ${label} block not found`);
  return source.slice(0, start) + replacement + source.slice(end);
};

// -----------------------------------------------------------------------------
// 1) App: immutable month history, debt carry-forward, current-month wiring.
// -----------------------------------------------------------------------------
{
  const p = 'src/App.tsx';
  let c = read(p);

  // The month-activation patch runs immediately before this file and guarantees these helpers.
  if (!c.includes("calculateMonthlyCharge, getInvoiceRemaining")) {
    if (c.includes("from './utils/monthlyAccounting'")) {
      c = c.replace(
        /import \{([^}]*)\} from '\.\/utils\/monthlyAccounting';/,
        (m, names) => `import { ${String(names).trim()}, calculateMonthlyCharge, getInvoiceRemaining } from './utils/monthlyAccounting';`
      );
    } else {
      c = c.replace(
        "import { calculateSubscriberBill } from './utils/formatters';",
        "import { calculateSubscriberBill } from './utils/formatters';\nimport { calculateMonthlyCharge, getInvoiceRemaining } from './utils/monthlyAccounting';"
      );
    }
  }

  const finalTariffHandler = `  const handleSaveMonthlyTariffs = (updatedTariffs: MonthlyTariffRecord[], activeMonthId: string, shouldRecalculateBills: boolean) => {
    const nowIso = new Date().toISOString();
    const canonicalActiveId = (() => {
      const match = updatedTariffs.find(r => r.id === activeMonthId);
      if (!match) return activeMonthId;
      return String(match.year) + '-' + String(match.month).padStart(2, '0');
    })();

    // Every month is an immutable accounting identity (YYYY-MM). A new month can never
    // overwrite another month merely because the active flag changed.
    const tariffMap = new Map<string, MonthlyTariffRecord>();
    for (const rawRecord of updatedTariffs) {
      const month = Math.min(12, Math.max(1, Number(rawRecord.month || 1)));
      const year = Math.max(2000, Number(rawRecord.year || new Date().getFullYear()));
      const id = String(year) + '-' + String(month).padStart(2, '0');
      tariffMap.set(id, {
        ...rawRecord,
        id,
        month,
        year,
        monthNameAr: rawRecord.monthNameAr || ('شهر ' + month + '/' + year),
        tiers: (rawRecord.tiers || []).map(t => ({ ...t })),
        createdAt: rawRecord.createdAt || nowIso.slice(0, 10),
        updatedAt: nowIso,
        isCurrentActive: id === canonicalActiveId,
      });
    }

    let normalized = Array.from(tariffMap.values())
      .sort((a, b) => (b.year - a.year) || (b.month - a.month));
    let activeRecord = normalized.find(m => m.id === canonicalActiveId) || normalized.find(m => m.isCurrentActive) || normalized[0];
    if (activeRecord && !normalized.some(m => m.isCurrentActive)) {
      normalized = normalized.map(m => ({ ...m, isCurrentActive: m.id === activeRecord!.id }));
      activeRecord = normalized.find(m => m.id === activeRecord!.id) || activeRecord;
    }

    setMonthlyTariffs(normalized);
    try {
      localStorage.setItem(getStorageKey('moldatk_monthly_tariffs'), JSON.stringify(normalized));
      window.dispatchEvent(new Event('moldatk-local-sync'));
    } catch (e) {}

    if (shouldRecalculateBills && activeRecord) {
      // Even when creation immediately activated the new month before final Save, we can still
      // locate the chronological month before it and snapshot it without touching its prices later.
      const previousRecord = [...normalized]
        .filter(m => m.id < activeRecord!.id)
        .sort((a, b) => b.id.localeCompare(a.id))[0];

      setSubscribers(prev => {
        const recalculated = prev.map(sub => {
          const history = [...(sub.invoicesHistory || [])].map(inv => ({ ...inv }));
          const isPermanentFree = sub.tier === 'free' || Boolean(sub.isExempted);

          // Backward-compatible migration: if the app predates monthly ledgers, freeze the
          // immediately previous month using its OWN historical tariff and the legacy payment state.
          if (previousRecord && !history.some(inv => inv.monthId === previousRecord.id && inv.status !== 'cancelled')) {
            const previousCharge = calculateMonthlyCharge(sub, previousRecord.tiers);
            const previousTotal = isPermanentFree ? 0 : previousCharge.total;
            const previousPaid = isPermanentFree
              ? 0
              : sub.paymentStatus === 'paid'
              ? previousTotal
              : sub.paymentStatus === 'partial'
              ? Math.min(previousTotal, Math.max(0, Number(sub.amountPaid || 0)))
              : 0;
            const previousRemaining = Math.max(0, previousTotal - previousPaid);
            history.push({
              id: 'inv-' + previousRecord.id + '-' + sub.id,
              subscriberId: sub.id,
              receiptNumber: 'ACC-' + previousRecord.id + '-' + (sub.code || sub.subscriberCode || sub.id),
              monthId: previousRecord.id,
              monthNameAr: previousRecord.monthNameAr,
              issueDate: previousRecord.createdAt || nowIso.slice(0, 10),
              paymentDate: previousPaid > 0 ? (sub.lastPaymentDate || nowIso) : undefined,
              amperes: sub.amperes,
              tier: sub.tier,
              pricePerAmpere: isPermanentFree ? 0 : previousCharge.pricePerAmpere,
              fixedFee: isPermanentFree ? 0 : previousCharge.fixedFee,
              totalAmount: previousTotal,
              paidAmount: previousPaid,
              remainingAmount: previousRemaining,
              status: isPermanentFree ? 'free' : previousRemaining === 0 ? 'paid' : previousPaid > 0 ? 'partial' : 'unpaid',
            });
          }

          const charge = calculateMonthlyCharge(sub, activeRecord!.tiers);
          let currentInvoice = history.find(inv => inv.monthId === activeRecord!.id && inv.status !== 'cancelled');

          if (!currentInvoice) {
            const previousDebt = history
              .filter(inv => inv.monthId < activeRecord!.id)
              .reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
            currentInvoice = {
              id: 'inv-' + activeRecord!.id + '-' + sub.id,
              subscriberId: sub.id,
              receiptNumber: 'ACC-' + activeRecord!.id + '-' + (sub.code || sub.subscriberCode || sub.id),
              monthId: activeRecord!.id,
              monthNameAr: activeRecord!.monthNameAr,
              issueDate: nowIso.slice(0, 10),
              amperes: sub.amperes,
              tier: sub.tier,
              pricePerAmpere: isPermanentFree ? 0 : charge.pricePerAmpere,
              fixedFee: isPermanentFree ? 0 : charge.fixedFee,
              totalAmount: isPermanentFree ? 0 : charge.total,
              paidAmount: 0,
              remainingAmount: isPermanentFree ? 0 : charge.total,
              status: isPermanentFree ? 'free' : 'unpaid',
              notes: previousDebt > 0 ? ('دين مرحل من أشهر سابقة: ' + previousDebt) : undefined,
            };
            history.push(currentInvoice);
          } else if (currentInvoice.status !== 'paid' && currentInvoice.status !== 'free') {
            // Only the ACTIVE month can change while its tariff is being finalized.
            // Historical invoices are never recalculated by a later month's tariff.
            const alreadyPaid = Math.max(0, Number(currentInvoice.paidAmount || 0));
            currentInvoice.amperes = sub.amperes;
            currentInvoice.tier = sub.tier;
            currentInvoice.pricePerAmpere = isPermanentFree ? 0 : charge.pricePerAmpere;
            currentInvoice.fixedFee = isPermanentFree ? 0 : charge.fixedFee;
            currentInvoice.totalAmount = isPermanentFree ? 0 : charge.total;
            currentInvoice.paidAmount = isPermanentFree ? 0 : Math.min(alreadyPaid, charge.total);
            currentInvoice.remainingAmount = isPermanentFree ? 0 : Math.max(0, charge.total - currentInvoice.paidAmount);
            currentInvoice.status = isPermanentFree
              ? 'free'
              : currentInvoice.remainingAmount === 0
              ? 'paid'
              : currentInvoice.paidAmount > 0
              ? 'partial'
              : 'unpaid';
          }

          const sortedHistory = history.sort((a, b) => b.monthId.localeCompare(a.monthId));
          const totalOutstanding = sortedHistory.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
          const currentRemaining = getInvoiceRemaining(currentInvoice);
          const currentPaid = Number(currentInvoice.paidAmount || 0);
          const anyPartialPayment = sortedHistory.some(inv => Number(inv.paidAmount || 0) > 0 && getInvoiceRemaining(inv) > 0);
          const currentIsFree = currentInvoice.status === 'free';

          return {
            ...sub,
            invoicesHistory: sortedHistory,
            amountDue: totalOutstanding,
            amountPaid: currentPaid,
            paymentStatus: totalOutstanding === 0
              ? (currentIsFree ? 'free' : 'paid')
              : (currentPaid > 0 || anyPartialPayment ? 'partial' : 'unpaid'),
            lastPaymentDate: currentPaid > 0 ? (currentInvoice.paymentDate || sub.lastPaymentDate) : sub.lastPaymentDate,
          };
        });

        try {
          localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(recalculated));
          window.dispatchEvent(new Event('moldatk-local-sync'));
        } catch (e) {}
        return recalculated;
      });
    }

    addAuditLog({
      category: 'pricing',
      title: 'حفظ تسعيرة شهرية مستقلة',
      details: 'تم حفظ ' + (activeRecord?.monthNameAr || 'التسعيرة') + ' كسجل مستقل مع الحفاظ على ديون وأسعار الأشهر السابقة',
      entityName: activeRecord?.monthNameAr || 'تسعيرة الشهر',
      actorName: userSession?.username || userSession?.collectorName || 'مدير المنظومة',
    });

    showToast(shouldRecalculateBills
      ? 'تم تفعيل الشهر الجديد مع ترحيل الديون وحفظ الأرشيف السابق'
      : 'تم إنشاء الشهر وحفظه؛ عدّل الأسعار ثم اضغط حفظ');
  };

`;

  c = replaceBlock(
    c,
    '  const handleSaveMonthlyTariffs = (updatedTariffs: MonthlyTariffRecord[], activeMonthId: string, shouldRecalculateBills: boolean) => {',
    '  const handleOpenFolderModal',
    finalTariffHandler,
    'App.handleSaveMonthlyTariffs'
  );

  // Collector payments must know the accounting month selected by the owner tariff.
  if (!c.includes('activeMonthId={activeMonthRecord?.id}')) {
    c = c.replace(
      '          collectorName={userSession.collectorName || \'جابي ميداني\'}',
      "          collectorName={userSession.collectorName || 'جابي ميداني'}\n          activeMonthId={activeMonthRecord?.id}\n          activeMonthNameAr={activeMonthRecord?.monthNameAr}"
    );
  }

  // Mobile dashboard/reports use the same active tariff and complete tariff history.
  if (!c.includes('monthlyTariffs={monthlyTariffs}')) {
    c = c.replace(
      '          subscribers={subscribers}\n          pricingTiers={pricingTiers}',
      '          subscribers={subscribers}\n          pricingTiers={pricingTiers}\n          monthlyTariffs={monthlyTariffs}\n          activeMonthId={activeMonthRecord?.id}'
    );
  }

  // Admin subscriber modal uses the same active month for edits and payments.
  c = c.replaceAll(
    '          pricingTiers={pricingTiers}\n          lines={lines}',
    '          pricingTiers={pricingTiers}\n          activeMonthId={activeMonthRecord?.id}\n          activeMonthNameAr={activeMonthRecord?.monthNameAr}\n          lines={lines}'
  );

  write(p, c);
}

// -----------------------------------------------------------------------------
// 2) Mobile layout: current-month dashboard + historical monthly reports.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/mobile/MobileLayout.tsx';
  let c = read(p);

  if (!c.includes('MonthlyTariffRecord,')) {
    c = c.replace('  DeviceViewMode,', '  DeviceViewMode,\n  MonthlyTariffRecord,');
  }
  if (!c.includes('monthlyTariffs?: MonthlyTariffRecord[];')) {
    c = c.replace(
      '  pricingTiers: SubscriptionTierPricing[];',
      '  pricingTiers: SubscriptionTierPricing[];\n  monthlyTariffs?: MonthlyTariffRecord[];\n  activeMonthId?: string;'
    );
  }
  if (!c.includes('monthlyTariffs = [],')) {
    c = c.replace(
      '  pricingTiers,\n  generatorSpecs,',
      '  pricingTiers,\n  monthlyTariffs = [],\n  activeMonthId,\n  generatorSpecs,'
    );
  }
  if (!c.includes('activeMonthId={activeMonthId}')) {
    c = c.replace(
      '            onNavigateToTab={onTabChange}',
      '            onNavigateToTab={onTabChange}\n            activeMonthId={activeMonthId}'
    );
  }
  if (!c.includes('monthlyTariffs={monthlyTariffs}')) {
    c = c.replace(
      '            currency={generatorSpecs.currency || \'د.ع\'}',
      "            currency={generatorSpecs.currency || 'د.ع'}\n            monthlyTariffs={monthlyTariffs}"
    );
  }
  write(p, c);
}

// -----------------------------------------------------------------------------
// 3) Bottom navigation: settings/services live under "المزيد".
// -----------------------------------------------------------------------------
{
  const p = 'src/components/MobileBottomNav.tsx';
  let c = read(p);
  c = c.replace("{ id: 'settings', label: 'الإعدادات', icon: FolderKanban }", "{ id: 'settings', label: 'المزيد', icon: FolderKanban }");
  write(p, c);
}

// -----------------------------------------------------------------------------
// 4) Pricing modal: clean month names, durable creation, no history deletion UI.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/PricingModal.tsx';
  let c = read(p);

  c = c.replace(
`  const monthNamesArabic = [
    'كانون الثاني (شهر 1)',
    'شباط (شهر 2)',
    'آذار (شهر 3)',
    'نيسان (شهر 4)',
    'أيار (شهر 5)',
    'حزيران (شهر 6)',
    'تموز (شهر 7)',
    'آب (شهر 8)',
    'أيلول (شهر 9)',
    'تشرين الأول (شهر 10)',
    'تشرين الثاني (شهر 11)',
    'كانون الأول (شهر 12)',
  ];`,
`  const monthNamesArabic = [
    'كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران',
    'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول',
  ];`
  );

  c = c.replace(
    '    const monthLabel = `شهر ${newMonthNumber} (${monthNamesArabic[newMonthNumber - 1]} ${newYearNumber})`;',
    "    const monthLabel = 'شهر ' + newMonthNumber + ' (' + monthNamesArabic[newMonthNumber - 1] + ' ' + newYearNumber + ')';"
  );
  c = c.replace(
    '    const baseTiers = currentTiers.map(t => ({ ...t, fixedFee: 0, description: \'\' }));',
    "    const baseTiers = currentTiers.map(t => ({ ...t, fixedFee: Number(t.fixedFee || 0), description: t.description || '' }));"
  );

  // Historical accounting months must not be accidentally deleted from the UI.
  c = c.replace(
    '{tariffs.length > 1 && !month.isCurrentActive && (',
    '{false && tariffs.length > 1 && !month.isCurrentActive && ('
  );

  // The persistence patch normally adds this; keep the final invariant explicit/idempotent.
  const createTail = '    setTariffs(updatedTariffs);\n    setSelectedMonthId(monthId);\n    setIsAddingNewMonth(false);';
  if (c.includes(createTail)) {
    c = c.replace(
      createTail,
      "    setTariffs(updatedTariffs);\n    setSelectedMonthId(monthId);\n    onSaveMonthlyTariffs(updatedTariffs, monthId, false);\n    setIsAddingNewMonth(false);"
    );
  }

  write(p, c);
}

// -----------------------------------------------------------------------------
// 5) Collector POS: one monthly invoice per month, oldest-debt-first allocation.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/POSQuickView.tsx';
  let c = read(p);

  if (!c.includes("from '../utils/monthlyAccounting'")) {
    c = c.replace(
      "import { calculateSubscriberBill } from '../utils/formatters';",
      "import { calculateSubscriberBill } from '../utils/formatters';\nimport { applyPaymentOldestFirst, ensureMonthInvoice, getInvoiceRemaining, getMonthId, getMonthNameAr, monthIdToDate } from '../utils/monthlyAccounting';"
    );
  } else if (!c.includes('applyPaymentOldestFirst')) {
    c = c.replace(
      /import \{([^}]*)\} from '\.\.\/utils\/monthlyAccounting';/,
      (m, names) => `import { ${String(names).trim()}, applyPaymentOldestFirst, ensureMonthInvoice, getInvoiceRemaining, getMonthId, getMonthNameAr, monthIdToDate } from '../utils/monthlyAccounting';`
    );
  }

  if (!c.includes('activeMonthId?: string;')) {
    c = c.replace(
      '  collectorName: string;',
      '  collectorName: string;\n  activeMonthId?: string;\n  activeMonthNameAr?: string;'
    );
  }
  if (!c.includes('activeMonthId = getMonthId(),')) {
    c = c.replace(
      '  collectorName,\n  collectors = [],',
      '  collectorName,\n  activeMonthId = getMonthId(),\n  activeMonthNameAr,\n  collectors = [],'
    );
  }

  const posHandler = `  const handleConfirmPayment = (data: PaymentExecutionData) => {
    const sub = subscribers.find(s => s.id === data.subscriberId);
    if (!sub) return;

    const now = new Date();
    const monthId = activeMonthId || getMonthId(now);
    const monthName = activeMonthNameAr || getMonthNameAr(monthIdToDate(monthId));
    const ensured = ensureMonthInvoice(sub, pricingTiers, monthId, monthName, now.toISOString().slice(0, 10));

    if (data.method === 'unpaid') {
      const invoices = ensured.invoices.map(inv => inv.monthId === monthId && inv.status !== 'cancelled' && inv.status !== 'free'
        ? { ...inv, paidAmount: 0, remainingAmount: Number(inv.totalAmount || 0), status: 'unpaid' as const, paymentDate: undefined }
        : inv);
      const totalDebtAfter = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
      const current = invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled');
      const updated: Subscriber = {
        ...sub,
        invoicesHistory: invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
        paymentStatus: totalDebtAfter === 0 ? 'paid' : 'unpaid',
        amountDue: totalDebtAfter,
        amountPaid: Number(current?.paidAmount || 0),
      };
      onSaveSubscriber(updated);
      onAddAuditLog({
        category: 'cancellation',
        title: 'إلغاء تسديد الشهر الحالي',
        details: 'تم إرجاع حساب الشهر الحالي للمشترك "' + sub.fullName + '" إلى غير مسدد مع إبقاء سجل الديون التاريخي',
        entityId: sub.id,
        entityName: sub.fullName + ' (' + (sub.code || sub.subscriberCode) + ')',
        actorName: data.collectorName || collectorName || 'المحاسب',
        cancellationReason: data.cancellationReason,
      });
      setPaymentSubscriber(null);
      return;
    }

    if (data.method === 'free') {
      const invoices = ensured.invoices.map(inv => inv.monthId === monthId && inv.status !== 'cancelled'
        ? {
            ...inv,
            totalAmount: 0,
            paidAmount: 0,
            remainingAmount: 0,
            status: 'free' as const,
            paymentDate: undefined,
            notes: data.freeReason ? ('إعفاء الشهر الحالي: ' + data.freeReason) : 'إعفاء الشهر الحالي',
          }
        : inv);
      const totalDebtAfter = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
      const updated: Subscriber = {
        ...sub,
        invoicesHistory: invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
        paymentStatus: totalDebtAfter === 0 ? 'free' : 'unpaid',
        amountDue: totalDebtAfter,
        amountPaid: 0,
        exemptReason: data.freeReason || sub.exemptReason,
      };
      onSaveSubscriber(updated);
      onAddAuditLog({
        category: 'payment',
        title: 'إعفاء مجاني للشهر الحالي',
        details: 'تم إعفاء شهر ' + monthId + ' للمشترك "' + sub.fullName + '" بدون حذف أي دين سابق',
        entityId: sub.id,
        entityName: sub.fullName + ' (' + (sub.code || sub.subscriberCode) + ')',
        actorName: data.collectorName || collectorName || 'المحاسب',
        amount: 0,
      });
      setPaymentSubscriber(null);
      setPaymentSuccess({ name: sub.fullName, amount: 0, method: data.method });
      window.setTimeout(() => setPaymentSuccess(null), 1500);
      return;
    }

    const paymentAmount = Math.max(0, Number(data.amountPaid || 0));
    if (paymentAmount <= 0) return;

    const allocation = applyPaymentOldestFirst(sub, pricingTiers, paymentAmount, now, monthId, monthName);
    const currentInvoice = allocation.invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled');
    const anyPartial = allocation.invoices.some(inv => Number(inv.paidAmount || 0) > 0 && getInvoiceRemaining(inv) > 0);
    const updated: Subscriber = {
      ...sub,
      invoicesHistory: allocation.invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      paymentStatus: allocation.totalDebtAfter === 0 ? 'paid' : (anyPartial || paymentAmount > 0 ? 'partial' : 'unpaid'),
      amountDue: allocation.totalDebtAfter,
      amountPaid: Number(currentInvoice?.paidAmount || 0),
      lastPaymentDate: now.toISOString(),
    };

    const receiptInvoice: SubscriberInvoice = {
      ...(currentInvoice || ensured.currentInvoice),
      id: 'receipt-' + sub.id + '-' + Date.now(),
      receiptNumber: 'REC-' + (sub.code || sub.subscriberCode || 'MW') + '-' + Date.now().toString().slice(-6),
      paymentDate: now.toISOString(),
      paidAmount: paymentAmount,
      remainingAmount: allocation.totalDebtAfter,
      status: allocation.totalDebtAfter === 0 ? 'paid' : 'partial',
      collectorName: data.collectorName || collectorName || 'المحاسب',
      previousDebtBefore: allocation.carriedDebtBefore,
      currentCharge: allocation.currentMonthCharge,
      totalBeforePayment: allocation.totalDebtBefore,
      appliedToPreviousDebt: allocation.appliedToPreviousDebt,
      appliedToCurrentMonth: allocation.appliedToCurrentMonth,
      totalOutstandingAfter: allocation.totalDebtAfter,
      paymentAllocations: allocation.allocations,
      notes: data.notes,
    };

    // Save first; receipt is a snapshot only and is NOT inserted as another monthly charge.
    onSaveSubscriber(updated);
    onAddAuditLog({
      category: 'payment',
      title: allocation.totalDebtAfter === 0 ? 'تسديد كامل' : 'تسديد جزئي',
      details: 'استلام ' + paymentAmount.toLocaleString('en-US') + ' ' + (generatorSpecs.currency || 'د.ع')
        + ' من "' + sub.fullName + '" | دين سابق: ' + allocation.appliedToPreviousDebt.toLocaleString('en-US')
        + ' | الشهر الحالي: ' + allocation.appliedToCurrentMonth.toLocaleString('en-US')
        + ' | المتبقي: ' + allocation.totalDebtAfter.toLocaleString('en-US'),
      entityId: sub.id,
      entityName: sub.fullName + ' (' + (sub.code || sub.subscriberCode) + ')',
      actorName: data.collectorName || collectorName || 'المحاسب',
      amount: paymentAmount,
    });

    setPaymentSubscriber(null);
    setPaymentSuccess({ name: sub.fullName, amount: paymentAmount, method: data.method });

    if (data.autoPrintReceipt) {
      window.setTimeout(() => onOpenReceiptModal(updated, receiptInvoice, true), 650);
    }
    window.setTimeout(() => setPaymentSuccess(null), 1800);
  };

`;

  c = replaceBlock(c, '  const handleConfirmPayment = (data: PaymentExecutionData) => {', '  useEffect(() => {', posHandler, 'POSQuickView.handleConfirmPayment');

  // Fix legacy debt summation that referenced a non-existent invoice.amount field.
  c = c.replace(
    'return acc + unpaidInvoices.reduce((s, inv) => s + Math.max(0, inv.amount - (inv.paidAmount || 0)), 0);',
    'return acc + unpaidInvoices.reduce((s, inv) => s + getInvoiceRemaining(inv), 0);'
  );

  write(p, c);
}

// -----------------------------------------------------------------------------
// 6) Owner/admin subscriber modal: preserve old invoices and allocate oldest first.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/SubscriberModal.tsx';
  let c = read(p);

  if (!c.includes("from '../utils/monthlyAccounting'")) {
    c = c.replace(
      "import { formatCurrency } from '../utils/formatters';",
      "import { formatCurrency } from '../utils/formatters';\nimport { applyPaymentOldestFirst, ensureMonthInvoice, getInvoiceRemaining, getMonthId, getMonthNameAr, monthIdToDate } from '../utils/monthlyAccounting';"
    );
  }
  if (!c.includes('activeMonthId?: string;')) {
    c = c.replace(
      '  pricingTiers: SubscriptionTierPricing[];',
      '  pricingTiers: SubscriptionTierPricing[];\n  activeMonthId?: string;\n  activeMonthNameAr?: string;'
    );
  }
  if (!c.includes('activeMonthId = getMonthId(),')) {
    c = c.replace(
      '  pricingTiers,\n  lines,',
      '  pricingTiers,\n  activeMonthId = getMonthId(),\n  activeMonthNameAr,\n  lines,'
    );
  }

  const submitStart = c.indexOf('  const handleSubmit = (e: React.FormEvent) => {');
  const submitEnd = submitStart >= 0 ? c.indexOf('\n\n  const executeUnpaidAction', submitStart) : -1;
  if (submitStart < 0 || submitEnd < 0) throw new Error('Monthly ledger finalization: SubscriberModal.handleSubmit block not found');

  const submitHandler = `  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    const monthId = activeMonthId || getMonthId();
    const monthName = activeMonthNameAr || getMonthNameAr(monthIdToDate(monthId));
    let changesDetails = 'تعديل بيانات المشترك "' + fullName + '" (' + code + ')';

    if (subscriberToEdit) {
      const changes: string[] = [];
      if (subscriberToEdit.amperes !== amperes) changes.push('الأمبيرات: من (' + subscriberToEdit.amperes + ') إلى (' + amperes + ')');
      if (subscriberToEdit.tier !== tier) changes.push('تم تغيير فئة الاشتراك');
      if (subscriberToEdit.lineName !== line) changes.push('تم تغيير الكابينة');
      if (subscriberToEdit.phone !== phone) changes.push('تم تغيير الهاتف');
      changesDetails = changes.length ? ('تم التعديل: ' + changes.join(' | ')) : ('حفظ التعديلات للمشترك "' + fullName + '"');
    }

    const draft: Subscriber = {
      ...(subscriberToEdit || {} as Subscriber),
      id: subscriberToEdit ? subscriberToEdit.id : ('sub-' + Date.now()),
      code: code || ('MW-' + Math.floor(1000 + Math.random() * 9000)),
      fullName,
      phone,
      amperes,
      tier: tier as Subscriber['tier'],
      lineName: line || lines[0]?.name || 'الخط الرئيسي',
      line: line || lines[0]?.name || 'الخط الرئيسي',
      notes: subscriberToEdit?.notes || '',
      paymentStatus: subscriberToEdit?.paymentStatus || 'unpaid',
      amountDue: subscriberToEdit?.amountDue || 0,
      amountPaid: subscriberToEdit?.amountPaid || 0,
      invoicesHistory: subscriberToEdit?.invoicesHistory || [],
    };

    const ensured = ensureMonthInvoice(draft, pricingTiers, monthId, monthName);
    const invoices = ensured.invoices.map(inv => ({ ...inv }));
    const current = invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled');
    if (current && current.status !== 'paid' && current.status !== 'free') {
      const alreadyPaid = Math.max(0, Number(current.paidAmount || 0));
      current.amperes = amperes;
      current.tier = tier as Subscriber['tier'];
      current.pricePerAmpere = currentCalc.pricePerAmpere;
      current.fixedFee = currentCalc.fixedFee;
      current.totalAmount = currentCalc.total;
      current.paidAmount = Math.min(alreadyPaid, currentCalc.total);
      current.remainingAmount = Math.max(0, currentCalc.total - current.paidAmount);
      current.status = current.remainingAmount === 0 ? 'paid' : current.paidAmount > 0 ? 'partial' : 'unpaid';
    }

    const totalOutstanding = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
    const currentPaid = Number(current?.paidAmount || 0);
    const anyPartial = invoices.some(inv => Number(inv.paidAmount || 0) > 0 && getInvoiceRemaining(inv) > 0);
    const updatedSubscriber: Subscriber = {
      ...draft,
      invoicesHistory: invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      amountDue: totalOutstanding,
      amountPaid: currentPaid,
      paymentStatus: totalOutstanding === 0
        ? (current?.status === 'free' ? 'free' : 'paid')
        : (currentPaid > 0 || anyPartial ? 'partial' : 'unpaid'),
    };

    onSaveSubscriber(updatedSubscriber);
    if (subscriberToEdit && onAddAuditLog) {
      onAddAuditLog({
        category: 'update',
        title: 'تعديل بيانات',
        details: changesDetails,
        entityId: updatedSubscriber.id,
        entityName: fullName + ' (' + updatedSubscriber.code + ')',
        actorName: 'الإدارة العامة',
      });
    }

    setIsEditing(false);
    if (!subscriberToEdit) onClose();
  };`;

  c = c.slice(0, submitStart) + submitHandler + c.slice(submitEnd);

  const unpaidStart = c.indexOf('  const executeUnpaidAction = () => {');
  const unpaidEnd = unpaidStart >= 0 ? c.indexOf('\n\n  const handleQuickPayment', unpaidStart) : -1;
  if (unpaidStart < 0 || unpaidEnd < 0) throw new Error('Monthly ledger finalization: SubscriberModal.executeUnpaidAction block not found');
  const unpaidHandler = `  const executeUnpaidAction = () => {
    if (!subscriberToEdit) return;
    const monthId = activeMonthId || getMonthId();
    const monthName = activeMonthNameAr || getMonthNameAr(monthIdToDate(monthId));
    const ensured = ensureMonthInvoice(subscriberToEdit, pricingTiers, monthId, monthName);
    const invoices = ensured.invoices.map(inv => inv.monthId === monthId && inv.status !== 'cancelled' && inv.status !== 'free'
      ? { ...inv, paidAmount: 0, remainingAmount: Number(inv.totalAmount || 0), status: 'unpaid' as const, paymentDate: undefined }
      : inv);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
    const updated: Subscriber = {
      ...subscriberToEdit,
      invoicesHistory: invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      amountDue: totalOutstanding,
      amountPaid: 0,
      paymentStatus: totalOutstanding === 0 ? 'paid' : 'unpaid',
    };
    onSaveSubscriber(updated);
    if (onAddAuditLog) onAddAuditLog({
      category: 'cancellation', title: 'إلغاء تسديد الشهر الحالي',
      details: 'إلغاء تسديد الشهر الحالي مع الاحتفاظ بالديون والأشهر السابقة',
      entityId: subscriberToEdit.id, entityName: subscriberToEdit.fullName + ' (' + subscriberToEdit.code + ')', actorName: 'الإدارة العامة',
    });
    setIsConfirmUnpaidOpen(false);
    onClose();
  };`;
  c = c.slice(0, unpaidStart) + unpaidHandler + c.slice(unpaidEnd);

  const quickStart = c.indexOf('  const handleQuickPayment = () => {');
  const quickEnd = quickStart >= 0 ? c.indexOf('\n\n  const handleCustomPayment', quickStart) : -1;
  if (quickStart < 0 || quickEnd < 0) throw new Error('Monthly ledger finalization: SubscriberModal.handleQuickPayment block not found');
  const quickHandler = `  const handleQuickPayment = () => {
    if (!subscriberToEdit) return;
    const monthId = activeMonthId || getMonthId();
    const monthName = activeMonthNameAr || getMonthNameAr(monthIdToDate(monthId));
    const ensured = ensureMonthInvoice(subscriberToEdit, pricingTiers, monthId, monthName);
    const totalOutstanding = ensured.invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
    if (totalOutstanding <= 0) { setIsConfirmUnpaidOpen(true); return; }

    const now = new Date();
    const allocation = applyPaymentOldestFirst(subscriberToEdit, pricingTiers, totalOutstanding, now, monthId, monthName);
    const current = allocation.invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled') || ensured.currentInvoice;
    const updated: Subscriber = {
      ...subscriberToEdit,
      invoicesHistory: allocation.invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      amountDue: allocation.totalDebtAfter,
      amountPaid: Number(current.paidAmount || 0),
      paymentStatus: allocation.totalDebtAfter === 0 ? 'paid' : 'partial',
      lastPaymentDate: now.toISOString(),
    };
    const receipt: SubscriberInvoice = {
      ...current,
      id: 'receipt-' + subscriberToEdit.id + '-' + Date.now(),
      receiptNumber: 'REC-' + subscriberToEdit.code + '-' + Date.now().toString().slice(-6),
      paymentDate: now.toISOString(),
      paidAmount: totalOutstanding,
      remainingAmount: allocation.totalDebtAfter,
      status: allocation.totalDebtAfter === 0 ? 'paid' : 'partial',
      previousDebtBefore: allocation.carriedDebtBefore,
      currentCharge: allocation.currentMonthCharge,
      totalBeforePayment: allocation.totalDebtBefore,
      appliedToPreviousDebt: allocation.appliedToPreviousDebt,
      appliedToCurrentMonth: allocation.appliedToCurrentMonth,
      totalOutstandingAfter: allocation.totalDebtAfter,
      paymentAllocations: allocation.allocations,
    };
    onSaveSubscriber(updated);
    if (onAddAuditLog) onAddAuditLog({
      category: 'payment', title: 'تسديد كامل مع ترحيل الديون',
      details: 'تم تسديد الأقدم أولاً بمبلغ ' + totalOutstanding,
      entityId: subscriberToEdit.id, entityName: subscriberToEdit.fullName + ' (' + subscriberToEdit.code + ')', actorName: 'الإدارة العامة', amount: totalOutstanding,
    });
    if (onOpenReceiptModal) onOpenReceiptModal(updated, receipt); else onClose();
  };`;
  c = c.slice(0, quickStart) + quickHandler + c.slice(quickEnd);

  const customStart = c.indexOf("  const handleCustomPayment = (status: 'paid' | 'partial' | 'free', paidAmount: number = 0) => {");
  const customEnd = customStart >= 0 ? c.indexOf('\n\n  const formatNum =', customStart) : -1;
  if (customStart < 0 || customEnd < 0) throw new Error('Monthly ledger finalization: SubscriberModal.handleCustomPayment block not found');
  const customHandler = `  const handleCustomPayment = (status: 'paid' | 'partial' | 'free', paidAmount: number = 0) => {
    if (!subscriberToEdit) return;
    const monthId = activeMonthId || getMonthId();
    const monthName = activeMonthNameAr || getMonthNameAr(monthIdToDate(monthId));
    const now = new Date();
    const ensured = ensureMonthInvoice(subscriberToEdit, pricingTiers, monthId, monthName);

    if (status === 'free') {
      const invoices = ensured.invoices.map(inv => inv.monthId === monthId && inv.status !== 'cancelled'
        ? { ...inv, totalAmount: 0, paidAmount: 0, remainingAmount: 0, status: 'free' as const, notes: 'إعفاء الشهر الحالي' }
        : inv);
      const totalOutstanding = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
      const updated: Subscriber = {
        ...subscriberToEdit,
        invoicesHistory: invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
        amountDue: totalOutstanding,
        amountPaid: 0,
        paymentStatus: totalOutstanding === 0 ? 'free' : 'unpaid',
      };
      onSaveSubscriber(updated);
      if (onAddAuditLog) onAddAuditLog({
        category: 'payment', title: 'إعفاء مجاني للشهر الحالي', details: 'تم إعفاء الشهر الحالي بدون حذف الديون السابقة',
        entityId: subscriberToEdit.id, entityName: subscriberToEdit.fullName + ' (' + subscriberToEdit.code + ')', actorName: 'الإدارة العامة', amount: 0,
      });
      onClose();
      return;
    }

    const finalPaid = Math.max(0, Number(paidAmount || 0));
    const allocation = applyPaymentOldestFirst(subscriberToEdit, pricingTiers, finalPaid, now, monthId, monthName);
    const current = allocation.invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled') || ensured.currentInvoice;
    const updated: Subscriber = {
      ...subscriberToEdit,
      invoicesHistory: allocation.invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      amountDue: allocation.totalDebtAfter,
      amountPaid: Number(current.paidAmount || 0),
      paymentStatus: allocation.totalDebtAfter === 0 ? 'paid' : finalPaid > 0 ? 'partial' : 'unpaid',
      lastPaymentDate: finalPaid > 0 ? now.toISOString() : subscriberToEdit.lastPaymentDate,
    };
    const receipt: SubscriberInvoice = {
      ...current,
      id: 'receipt-' + subscriberToEdit.id + '-' + Date.now(),
      receiptNumber: 'REC-' + subscriberToEdit.code + '-' + Date.now().toString().slice(-6),
      paymentDate: now.toISOString(),
      paidAmount: finalPaid,
      remainingAmount: allocation.totalDebtAfter,
      status: allocation.totalDebtAfter === 0 ? 'paid' : 'partial',
      previousDebtBefore: allocation.carriedDebtBefore,
      currentCharge: allocation.currentMonthCharge,
      totalBeforePayment: allocation.totalDebtBefore,
      appliedToPreviousDebt: allocation.appliedToPreviousDebt,
      appliedToCurrentMonth: allocation.appliedToCurrentMonth,
      totalOutstandingAfter: allocation.totalDebtAfter,
      paymentAllocations: allocation.allocations,
    };
    onSaveSubscriber(updated);
    if (onAddAuditLog) onAddAuditLog({
      category: 'payment', title: allocation.totalDebtAfter === 0 ? 'تسديد كامل' : 'تسديد جزئي',
      details: 'تم توزيع الدفعة على الديون الأقدم أولاً ثم الشهر الحالي',
      entityId: subscriberToEdit.id, entityName: subscriberToEdit.fullName + ' (' + subscriberToEdit.code + ')', actorName: 'الإدارة العامة', amount: finalPaid,
    });
    if (onOpenReceiptModal && finalPaid > 0) onOpenReceiptModal(updated, receipt); else onClose();
  };`;
  c = c.slice(0, customStart) + customHandler + c.slice(customEnd);

  write(p, c);
}

// -----------------------------------------------------------------------------
// 7) Receipt: debt-aware, no receipt for free/exempt, one payment snapshot.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/InvoiceReceiptModal.tsx';
  let c = read(p);

  // Free/exempt is not a payment and must never be printable.
  c = c.replace(
    '  const finalized = Boolean(invoice && (isPaid || isPartial || isFree));',
    '  const finalized = Boolean(invoice && !isFree && (isPaid || isPartial) && Number(invoice.paidAmount || 0) > 0);'
  );

  if (!c.includes('const previousDebtBefore =')) {
    c = c.replace(
      '  const generatorName = clean(generatorSpecs.generatorName) || \'المولدة\';',
      `  const previousDebtBefore = Math.max(0, Number(invoice?.previousDebtBefore || 0));
  const currentCharge = Math.max(0, Number(invoice?.currentCharge ?? invoice?.totalAmount ?? 0));
  const totalBeforePayment = Math.max(0, Number(invoice?.totalBeforePayment ?? (previousDebtBefore + currentCharge)));
  const appliedToPreviousDebt = Math.max(0, Number(invoice?.appliedToPreviousDebt || 0));
  const appliedToCurrentMonth = Math.max(0, Number(invoice?.appliedToCurrentMonth || 0));
  const totalOutstandingAfter = Math.max(0, Number(invoice?.totalOutstandingAfter ?? remainingAmount));
  const generatorName = clean(generatorSpecs.generatorName) || 'المولدة';`
    );
  }

  c = c.replace(
    "      window.alert('لا يمكن طباعة الوصل قبل إكمال عملية التسديد وحفظها.');",
    "      window.alert(isFree ? 'الحساب المجاني لا يصدر له وصل تسديد.' : 'لا يمكن طباعة الوصل قبل إكمال عملية التسديد وحفظها.');"
  );

  // Extend native SUNMI payload while preserving existing styling/printing behavior.
  if (!c.includes('previousDebt: previousDebtBefore > 0')) {
    c = c.replace(
      '          remainingAmount: remainingAmount > 0 ? formatCurrency(remainingAmount) : \'\',\n          note:',
      `          remainingAmount: totalOutstandingAfter > 0 ? formatCurrency(totalOutstandingAfter) : '',
          previousDebt: previousDebtBefore > 0 ? formatCurrency(previousDebtBefore) : '',
          currentCharge: formatCurrency(currentCharge),
          totalBeforePayment: formatCurrency(totalBeforePayment),
          appliedToPreviousDebt: appliedToPreviousDebt > 0 ? formatCurrency(appliedToPreviousDebt) : '',
          appliedToCurrentMonth: appliedToCurrentMonth > 0 ? formatCurrency(appliedToCurrentMonth) : '',
          totalOutstandingAfter: totalOutstandingAfter > 0 ? formatCurrency(totalOutstandingAfter) : '0 د.ع',
          note:`
    );
  }

  // WhatsApp is a receipt share too, so free accounts do not create a fake payment receipt.
  c = c.replace(
    '  const handleWhatsAppShare = () => {\n    const rows = [',
    "  const handleWhatsAppShare = () => {\n    if (!finalized || isFree) return;\n    const rows = ["
  );

  if (!c.includes('`دين سابق: ${formatCurrency(previousDebtBefore)}`')) {
    c = c.replace(
      "      pricePerAmp > 0 ? `سعر الأمبير الشهري: ${formatCurrency(pricePerAmp)}` : '',\n      `مبلغ التسديد: ${isFree ? 'مجاني' : formatCurrency(paymentAmount)}`,",
      "      pricePerAmp > 0 ? `سعر الأمبير الشهري: ${formatCurrency(pricePerAmp)}` : '',\n      previousDebtBefore > 0 ? `دين سابق: ${formatCurrency(previousDebtBefore)}` : '',\n      `استحقاق الشهر الحالي: ${formatCurrency(currentCharge)}`,\n      `الإجمالي قبل التسديد: ${formatCurrency(totalBeforePayment)}`,\n      `المبلغ المستلم: ${formatCurrency(paymentAmount)}`,\n      appliedToPreviousDebt > 0 ? `تسديد الدين السابق: ${formatCurrency(appliedToPreviousDebt)}` : '',\n      appliedToCurrentMonth > 0 ? `تسديد الشهر الحالي: ${formatCurrency(appliedToCurrentMonth)}` : '',\n      `المتبقي بعد التسديد: ${formatCurrency(totalOutstandingAfter)}` ,"
    );
  }

  // Add the accounting breakdown to the visible/HTML 58mm receipt.
  if (!c.includes('<Row label="الدين السابق"')) {
    c = c.replace(
      '            <Row label="حالة التسديد" value={statusText} />\n\n            <div className="receipt-divider',
      `            <Row label="حالة التسديد" value={statusText} />

            <div className="receipt-divider border-t border-dashed border-slate-500 my-2" />
            {previousDebtBefore > 0 && <Row label="الدين السابق" value={formatCurrency(previousDebtBefore)} strong />}
            <Row label="استحقاق الشهر الحالي" value={formatCurrency(currentCharge)} strong />
            <Row label="الإجمالي قبل التسديد" value={formatCurrency(totalBeforePayment)} strong />

            <div className="receipt-divider`
    );
  }

  c = c.replace(
    '              <div className="text-[10px] font-bold text-slate-500">مبلغ التسديد</div>',
    '              <div className="text-[10px] font-bold text-slate-500">المبلغ المستلم</div>'
  );

  if (!c.includes('<Row label="تسديد الدين السابق"')) {
    c = c.replace(
      '            {remainingAmount > 0 && <Row label="المتبقي" value={formatCurrency(remainingAmount)} />}\n',
      `            {appliedToPreviousDebt > 0 && <Row label="تسديد الدين السابق" value={formatCurrency(appliedToPreviousDebt)} />}
            {appliedToCurrentMonth > 0 && <Row label="تسديد الشهر الحالي" value={formatCurrency(appliedToCurrentMonth)} />}
            <Row label="المتبقي بعد التسديد" value={formatCurrency(totalOutstandingAfter)} strong />
`
    );
  }

  c = c.replace('المبلغ النهائي', 'المبلغ المستلم');
  c = c.replace(
    "{isFree ? 'مجاني' : formatCurrency(paymentAmount)}",
    '{formatCurrency(paymentAmount)}'
  );

  // Disable both print/share controls for free/non-finalized snapshots.
  c = c.replace(
    'onClick={handleWhatsAppShare} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600"',
    'onClick={handleWhatsAppShare} disabled={!finalized} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed"'
  );

  write(p, c);
}

// -----------------------------------------------------------------------------
// 8) Native SUNMI bitmap: show the same debt allocation details.
// -----------------------------------------------------------------------------
{
  const p = 'android/app/src/main/java/com/mwaldatk/app/SunmiPrinterPlugin.java';
  let c = read(p);

  if (!c.includes('String previousDebt = raw(r, "previousDebt")')) {
    c = c.replace(
      '        String status = raw(r, "status");\n        if (!status.isEmpty()) addField(lines, "حالة التسديد", status, false);\n\n        lines.add(separatorLine());',
      `        String status = raw(r, "status");
        if (!status.isEmpty()) addField(lines, "حالة التسديد", status, false);

        lines.add(separatorLine());

        String previousDebt = raw(r, "previousDebt");
        if (!previousDebt.isEmpty()) addField(lines, "الدين السابق", previousDebt, true);
        String currentCharge = raw(r, "currentCharge");
        if (!currentCharge.isEmpty()) addField(lines, "استحقاق الشهر الحالي", currentCharge, true);
        String totalBeforePayment = raw(r, "totalBeforePayment");
        if (!totalBeforePayment.isEmpty()) addField(lines, "الإجمالي قبل التسديد", totalBeforePayment, true);

        lines.add(separatorLine());`
    );
  }

  c = c.replace('lines.add(new DrawLine("مبلغ التسديد", 19f, true, Layout.Alignment.ALIGN_NORMAL, 1));', 'lines.add(new DrawLine("المبلغ المستلم", 19f, true, Layout.Alignment.ALIGN_NORMAL, 1));');

  if (!c.includes('String appliedToPreviousDebt = raw(r, "appliedToPreviousDebt")')) {
    c = c.replace(
      '        String remainingAmount = raw(r, "remainingAmount");',
      `        String appliedToPreviousDebt = raw(r, "appliedToPreviousDebt");
        if (!appliedToPreviousDebt.isEmpty()) addField(lines, "تسديد الدين السابق", appliedToPreviousDebt, false);
        String appliedToCurrentMonth = raw(r, "appliedToCurrentMonth");
        if (!appliedToCurrentMonth.isEmpty()) addField(lines, "تسديد الشهر الحالي", appliedToCurrentMonth, false);

        String remainingAmount = raw(r, "totalOutstandingAfter");
        if (remainingAmount.isEmpty()) remainingAmount = raw(r, "remainingAmount");`
    );
  }
  c = c.replace('addField(lines, "المتبقي", remainingAmount, false);', 'addField(lines, "المتبقي بعد التسديد", remainingAmount, true);');
  c = c.replace('"المبلغ النهائي\\n" + finalAmount', '"المبلغ المستلم\\n" + finalAmount');

  write(p, c);
}

// -----------------------------------------------------------------------------
// 9) Defensive JSX cleanup for a known duplicate attribute from old build patches.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/FolderDetailModal.tsx';
  if (fs.existsSync(p)) {
    let c = read(p);
    c = c.replace(/(\s+type="button"\s*)\n\s*type="button"/g, '$1');
    write(p, c);
  }
}

console.log('Applied final monthly ledger: immutable tariffs, carried debt, reports, dashboard total, and debt-aware receipt');
