import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c, 'utf8');
const must = (v, m) => { if (!v) throw new Error(`Onboarding/lump finalizer: ${m}`); };

// -----------------------------------------------------------------------------
// 1) Subscriber modal: explicit onboarding debt choice + owner lump settlement.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/SubscriberModal.tsx';
  let s = read(p);

  // Monthly tariff history is required only while adding a new subscriber with prior debt.
  s = s.replace(
    'import { Subscriber, SubscriptionTierPricing, LineDistribution, AuditLogEntry, SubscriberInvoice } from \'../types\';',
    'import { Subscriber, SubscriptionTierPricing, LineDistribution, AuditLogEntry, SubscriberInvoice, MonthlyTariffRecord } from \'../types\';'
  );
  if (!s.includes('  monthlyTariffs?: MonthlyTariffRecord[];')) {
    s = s.replace(
      '  pricingTiers: SubscriptionTierPricing[];\n',
      '  pricingTiers: SubscriptionTierPricing[];\n  monthlyTariffs?: MonthlyTariffRecord[];\n'
    );
  }
  if (!s.includes('  monthlyTariffs = [],')) {
    s = s.replace(
      '  pricingTiers,\n  activeMonthId = getMonthId(),',
      '  pricingTiers,\n  monthlyTariffs = [],\n  activeMonthId = getMonthId(),'
    );
  }

  if (!s.includes('const [newDebtMode,')) {
    const stateAnchor = "  const [customError, setCustomError] = useState('');";
    must(s.includes(stateAnchor), 'custom payment state anchor missing');
    s = s.replace(stateAnchor, `${stateAnchor}\n  const [newDebtMode, setNewDebtMode] = useState<'none' | 'prior' | null>(null);\n  const [priorDebtMonthId, setPriorDebtMonthId] = useState('');\n  const [newDebtError, setNewDebtError] = useState('');\n  const [customPaymentMode, setCustomPaymentMode] = useState<'partial' | 'lump'>('partial');`);
  }

  // Reset transient onboarding/payment choices whenever the modal opens for another subscriber.
  const resetAnchor = "    setCustomError('');";
  if (!s.includes("    setNewDebtMode(null);")) {
    must(s.includes(resetAnchor), 'modal reset anchor missing');
    s = s.replace(resetAnchor, `${resetAnchor}\n    setNewDebtMode(null);\n    setPriorDebtMonthId('');\n    setNewDebtError('');\n    setCustomPaymentMode('partial');`);
  }

  // Tariff preview for the selected historical month.
  if (!s.includes('const availableDebtTariffs = useMemo')) {
    const calcEnd = "  }, [amperes, currentTierObj]);";
    must(s.includes(calcEnd), 'current calculation memo anchor missing');
    s = s.replace(calcEnd, `${calcEnd}\n\n  const availableDebtTariffs = useMemo(\n    () => [...monthlyTariffs].filter(m => Array.isArray(m.tiers) && m.tiers.length > 0).sort((a, b) => b.id.localeCompare(a.id)),\n    [monthlyTariffs]\n  );\n  const selectedPriorTariff = useMemo(\n    () => availableDebtTariffs.find(m => m.id === priorDebtMonthId),\n    [availableDebtTariffs, priorDebtMonthId]\n  );\n  const selectedPriorTier = useMemo(\n    () => selectedPriorTariff?.tiers.find(t => t.id === tier || t.type === tier || t.type === currentTierObj?.type),\n    [selectedPriorTariff, tier, currentTierObj]\n  );\n  const selectedPriorDebtAmount = useMemo(() => {\n    if (!selectedPriorTier) return 0;\n    return Math.max(0, (Number(amperes) || 0) * Number(selectedPriorTier.pricePerAmpere || 0) + Number(selectedPriorTier.fixedFee || 0));\n  }, [amperes, selectedPriorTier]);`);
  }

  // Replace the final monthly-ledger submit handler. Existing-subscriber edit behavior is
  // preserved; only the NEW-subscriber branch gets the explicit debt decision.
  const submitStart = s.indexOf('  const handleSubmit = (e: React.FormEvent) => {');
  const submitEnd = submitStart >= 0 ? s.indexOf('\n\n  const executeUnpaidAction', submitStart) : -1;
  must(submitStart >= 0 && submitEnd > submitStart, 'handleSubmit bounds missing');
  const submitHandler = `  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    const monthId = activeMonthId || getMonthId();
    const monthName = activeMonthNameAr || getMonthNameAr(monthIdToDate(monthId));
    const selectedLine = lines.find(l => l.name === line);
    const selectedTierType = (currentTierObj?.type || tier) as Subscriber['tier'];
    const isPermanentFree = selectedTierType === 'free';

    if (!subscriberToEdit) {
      if (!isPermanentFree && newDebtMode === null) {
        setNewDebtError('حدد أولاً هل على المشترك دين سابق أم لا.');
        return;
      }
      if (!isPermanentFree && newDebtMode === 'prior' && !priorDebtMonthId) {
        setNewDebtError(availableDebtTariffs.length ? 'اختر الشهر الذي يعود له الدين السابق.' : 'لا توجد تسعيرة شهرية محفوظة. أضف تسعيرة الشهر أولاً ثم أعد إضافة المشترك.');
        return;
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const id = 'sub-' + Date.now();
      const base: Subscriber = {
        id,
        code: code || ('MW-' + Math.floor(1000 + Math.random() * 9000)),
        subscriberCode: code || undefined,
        fullName: fullName.trim(),
        phone: phone.trim(),
        amperes,
        tier: selectedTierType,
        lineId: selectedLine?.id,
        lineName: line || lines[0]?.name || 'الخط الرئيسي',
        line: line || lines[0]?.name || 'الخط الرئيسي',
        paymentStatus: isPermanentFree ? 'free' : 'paid',
        amountDue: 0,
        amountPaid: 0,
        invoicesHistory: [],
        createdAt: nowIso,
        joiningDate: nowIso.slice(0, 10),
      };

      if (isPermanentFree) {
        const freeInvoice: SubscriberInvoice = {
          id: 'inv-' + monthId + '-' + id,
          subscriberId: id,
          monthId,
          monthNameAr: monthName,
          issueDate: nowIso.slice(0, 10),
          amperes,
          tier: selectedTierType,
          pricePerAmpere: 0,
          fixedFee: 0,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
          status: 'free',
          notes: 'MOLDATK_ONBOARDING_FREE',
        };
        onSaveSubscriber({ ...base, paymentStatus: 'free', invoicesHistory: [freeInvoice] });
        setIsEditing(false);
        onClose();
        return;
      }

      // No prior debt means NO charge is created for the month in which the subscriber
      // was added. A hidden zero marker prevents older tariff logic from billing this month.
      if (newDebtMode === 'none') {
        const markerInvoice: SubscriberInvoice = {
          id: 'onboarding-zero-' + monthId + '-' + id,
          subscriberId: id,
          monthId,
          monthNameAr: monthName,
          issueDate: nowIso.slice(0, 10),
          amperes,
          tier: selectedTierType,
          pricePerAmpere: 0,
          fixedFee: 0,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
          status: 'paid',
          notes: 'MOLDATK_ONBOARDING_NO_CURRENT_CHARGE|reason=no_prior_debt',
        };
        onSaveSubscriber({ ...base, paymentStatus: 'paid', amountDue: 0, amountPaid: 0, invoicesHistory: [markerInvoice] });
        setIsEditing(false);
        onClose();
        return;
      }

      const tariff = availableDebtTariffs.find(m => m.id === priorDebtMonthId);
      const tariffTier = tariff?.tiers.find(t => t.id === tier || t.type === tier || t.type === selectedTierType);
      if (!tariff || !tariffTier) {
        setNewDebtError('التسعيرة المختارة لا تحتوي فئة الاشتراك المطلوبة. عدّل التسعيرة أولاً.');
        return;
      }
      const debt = Math.max(0, (Number(amperes) || 0) * Number(tariffTier.pricePerAmpere || 0) + Number(tariffTier.fixedFee || 0));
      if (debt <= 0) {
        setNewDebtError('قيمة تسعيرة الشهر المختار صفر. يجب إضافة تسعيرة صحيحة قبل تسجيل الدين.');
        return;
      }

      const debtInvoice: SubscriberInvoice = {
        id: 'inv-' + tariff.id + '-' + id,
        subscriberId: id,
        monthId: tariff.id,
        monthNameAr: tariff.monthNameAr,
        issueDate: nowIso.slice(0, 10),
        amperes,
        tier: selectedTierType,
        pricePerAmpere: Number(tariffTier.pricePerAmpere || 0),
        fixedFee: Number(tariffTier.fixedFee || 0),
        totalAmount: debt,
        paidAmount: 0,
        remainingAmount: debt,
        status: 'unpaid',
        notes: 'MOLDATK_PRIOR_DEBT_ONBOARDING|month=' + tariff.id,
      };
      const invoices: SubscriberInvoice[] = [debtInvoice];

      // If the historical debt belongs to an older month, the subscriber still must not
      // receive a second automatic charge for the current onboarding month.
      if (tariff.id !== monthId) {
        invoices.push({
          id: 'onboarding-zero-' + monthId + '-' + id,
          subscriberId: id,
          monthId,
          monthNameAr: monthName,
          issueDate: nowIso.slice(0, 10),
          amperes,
          tier: selectedTierType,
          pricePerAmpere: 0,
          fixedFee: 0,
          totalAmount: 0,
          paidAmount: 0,
          remainingAmount: 0,
          status: 'paid',
          notes: 'MOLDATK_ONBOARDING_NO_CURRENT_CHARGE|reason=prior_debt_other_month',
        });
      }

      onSaveSubscriber({
        ...base,
        paymentStatus: 'unpaid',
        amountDue: debt,
        amountPaid: 0,
        invoicesHistory: invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      });
      setIsEditing(false);
      onClose();
      return;
    }

    // Existing subscriber edit: preserve every historical invoice and only re-price the
    // active unpaid month, exactly like the monthly-ledger finalizer did before this pass.
    const changes: string[] = [];
    if (subscriberToEdit.amperes !== amperes) changes.push('الأمبيرات: من (' + subscriberToEdit.amperes + ') إلى (' + amperes + ')');
    if (subscriberToEdit.tier !== selectedTierType) changes.push('تم تغيير فئة الاشتراك');
    if (subscriberToEdit.lineName !== line) changes.push('تم تغيير الكابينة');
    if (subscriberToEdit.phone !== phone) changes.push('تم تغيير الهاتف');
    const changesDetails = changes.length ? ('تم التعديل: ' + changes.join(' | ')) : ('حفظ التعديلات للمشترك "' + fullName + '"');

    const draft: Subscriber = {
      ...subscriberToEdit,
      code,
      subscriberCode: code,
      fullName: fullName.trim(),
      phone: phone.trim(),
      amperes,
      tier: selectedTierType,
      lineId: selectedLine?.id || subscriberToEdit.lineId,
      lineName: line || subscriberToEdit.lineName,
      line: line || subscriberToEdit.line,
    };
    const ensured = ensureMonthInvoice(draft, pricingTiers, monthId, monthName);
    const invoices = ensured.invoices.map(inv => ({ ...inv }));
    const current = invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled');
    const internalNoCharge = Boolean(current?.notes?.includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE'));
    const lumpSettled = Boolean(current?.notes?.includes('MOLDATK_LUMP_SETTLEMENT'));
    if (current && current.status !== 'paid' && current.status !== 'free' && !internalNoCharge && !lumpSettled) {
      const alreadyPaid = Math.max(0, Number(current.paidAmount || 0));
      current.amperes = amperes;
      current.tier = selectedTierType;
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
    if (onAddAuditLog) onAddAuditLog({
      category: 'update',
      title: 'تعديل بيانات',
      details: changesDetails,
      entityId: updatedSubscriber.id,
      entityName: fullName + ' (' + updatedSubscriber.code + ')',
      actorName: 'الإدارة العامة',
    });
    setIsEditing(false);
  };`;
  s = s.slice(0, submitStart) + submitHandler + s.slice(submitEnd);

  // Replace custom payment handler and add the negotiated/lump settlement operation.
  const customStart = s.indexOf("  const handleCustomPayment = (status: 'paid' | 'partial' | 'free', paidAmount: number = 0) => {");
  const customEnd = customStart >= 0 ? s.indexOf('\n\n  const formatNum =', customStart) : -1;
  must(customStart >= 0 && customEnd > customStart, 'custom payment handler bounds missing');
  const customHandlers = `  const handleCustomPayment = (status: 'paid' | 'partial' | 'free', paidAmount: number = 0) => {
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
    if (finalPaid <= 0) return;
    const allocation = applyPaymentOldestFirst(subscriberToEdit, pricingTiers, finalPaid, now, monthId, monthName);
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
      receiptNumber: 'REC-' + (subscriberToEdit.code || subscriberToEdit.subscriberCode || subscriberToEdit.id) + '-' + Date.now().toString().slice(-6),
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
    if (onOpenReceiptModal) window.setTimeout(() => onOpenReceiptModal(updated, receipt, true), 120); else onClose();
    setIsAdvancedOpen(false);
  };

  const handleLumpSettlement = (paidAmount: number) => {
    if (!subscriberToEdit) return;
    const finalPaid = Math.max(0, Number(paidAmount || 0));
    if (finalPaid <= 0) return;

    const monthId = activeMonthId || getMonthId();
    const monthName = activeMonthNameAr || getMonthNameAr(monthIdToDate(monthId));
    const now = new Date();
    const ensured = ensureMonthInvoice(subscriberToEdit, pricingTiers, monthId, monthName);
    const current = ensured.invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled' && inv.status !== 'free');
    if (!current || String(current.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE')) {
      setCustomError('لا يوجد استحقاق للشهر الحالي يمكن إغلاقه بتسديد مقطوع.');
      return;
    }

    const originalTotal = Math.max(0, Number(current.totalAmount || 0));
    const alreadyPaid = Math.max(0, Number(current.paidAmount || 0));
    const remainingBefore = getInvoiceRemaining(current);
    if (remainingBefore <= 0) {
      setCustomError('اشتراك الشهر الحالي مسدد بالكامل مسبقاً.');
      return;
    }
    if (finalPaid > remainingBefore) {
      setCustomError('مبلغ التسديد المقطوع لا يمكن أن يتجاوز المتبقي للشهر الحالي: ' + formatNum(remainingBefore) + ' د.ع');
      return;
    }

    const effectiveTotal = alreadyPaid + finalPaid;
    const discount = Math.max(0, originalTotal - effectiveTotal);
    const marker = 'MOLDATK_LUMP_SETTLEMENT|original=' + originalTotal + '|settled=' + effectiveTotal + '|discount=' + discount + '|received=' + finalPaid;
    const preservedNotes = String(current.notes || '').split(' | ').filter(x => x && !x.includes('MOLDATK_LUMP_SETTLEMENT')).join(' | ');
    const settledCurrent: SubscriberInvoice = {
      ...current,
      totalAmount: effectiveTotal,
      paidAmount: effectiveTotal,
      remainingAmount: 0,
      status: 'paid',
      paymentDate: now.toISOString(),
      notes: [preservedNotes, marker].filter(Boolean).join(' | '),
    };
    const invoices = ensured.invoices.map(inv => inv.id === current.id ? settledCurrent : inv);
    const totalOutstandingAfter = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
    const updated: Subscriber = {
      ...subscriberToEdit,
      invoicesHistory: invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)),
      amountDue: totalOutstandingAfter,
      amountPaid: effectiveTotal,
      paymentStatus: totalOutstandingAfter === 0 ? 'paid' : 'partial',
      lastPaymentDate: now.toISOString(),
    };
    const receipt: SubscriberInvoice = {
      ...settledCurrent,
      id: 'receipt-lump-' + subscriberToEdit.id + '-' + Date.now(),
      receiptNumber: 'REC-' + (subscriberToEdit.code || subscriberToEdit.subscriberCode || subscriberToEdit.id) + '-' + Date.now().toString().slice(-6),
      totalAmount: finalPaid,
      paidAmount: finalPaid,
      remainingAmount: totalOutstandingAfter,
      status: totalOutstandingAfter === 0 ? 'paid' : 'partial',
      previousDebtBefore: Math.max(0, Number(subscriberToEdit.amountDue || 0) - remainingBefore),
      currentCharge: effectiveTotal,
      totalBeforePayment: originalTotal,
      appliedToPreviousDebt: 0,
      appliedToCurrentMonth: finalPaid,
      totalOutstandingAfter,
      paymentDate: now.toISOString(),
      notes: marker,
    };

    onSaveSubscriber(updated);
    if (onAddAuditLog) onAddAuditLog({
      category: 'payment',
      title: 'تسديد مقطوع',
      details: 'الاستحقاق الأصلي ' + originalTotal.toLocaleString('en-US') + ' | المستلم فعلياً ' + finalPaid.toLocaleString('en-US') + ' | فرق التسوية ' + discount.toLocaleString('en-US') + ' | تم إغلاق اشتراك الشهر الحالي بالكامل',
      entityId: subscriberToEdit.id,
      entityName: subscriberToEdit.fullName + ' (' + (subscriberToEdit.code || subscriberToEdit.subscriberCode || '') + ')',
      actorName: 'الإدارة العامة',
      amount: finalPaid,
    });
    setIsAdvancedOpen(false);
    if (onOpenReceiptModal) window.setTimeout(() => onOpenReceiptModal(updated, receipt, true), 120); else onClose();
  };`;
  s = s.slice(0, customStart) + customHandlers + s.slice(customEnd);

  // Financial UI helpers for the custom-payment sheet and hidden onboarding invoices.
  const outstandingAnchor = "  const outstanding = Math.max(0, Number(subscriberToEdit?.amountDue || 0));";
  must(s.includes(outstandingAnchor), 'outstanding UI anchor missing');
  if (!s.includes('const visibleInvoices =')) {
    s = s.replace(outstandingAnchor, `${outstandingAnchor}\n  const visibleInvoices = (subscriberToEdit?.invoicesHistory || []).filter(inv => !String(inv.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE'));\n  const settlementMonthId = activeMonthId || getMonthId();\n  const settlementCurrentInvoice = (subscriberToEdit?.invoicesHistory || []).find(inv => inv.monthId === settlementMonthId && inv.status !== 'cancelled' && inv.status !== 'free');\n  const settlementCurrentRemaining = settlementCurrentInvoice && !String(settlementCurrentInvoice.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE')\n    ? getInvoiceRemaining(settlementCurrentInvoice)\n    : 0;`);
  }

  // Hide internal zero-charge onboarding markers from user-visible invoice history/counts.
  s = s.replaceAll('(subscriberToEdit.invoicesHistory?.length || 0)', 'visibleInvoices.length');
  s = s.replace('!subscriberToEdit.invoicesHistory?.length ?', '!visibleInvoices.length ?');
  s = s.replace('subscriberToEdit.invoicesHistory.map(inv => (', 'visibleInvoices.map(inv => (');

  // Explicit debt choice UI for NEW subscribers only.
  const oldSubmit = '<button type="submit" className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md">{subscriberToEdit ? \'حفظ التعديلات\' : \'إضافة المشترك\'}</button>';
  must(s.includes(oldSubmit), 'subscriber submit button missing');
  const onboardingUi = `{!subscriberToEdit && currentTierObj?.type !== 'free' && (\n              <div className="bg-white dark:bg-[#101a33] border border-slate-200 dark:border-slate-800 rounded-3xl p-4 space-y-3">\n                <div><h3 className="text-xs font-black text-slate-900 dark:text-white">حالة المديونية عند التسجيل</h3><p className="text-[10px] text-slate-500 mt-1">حدد هل يبدأ المشترك بدين سابق أم يبدأ بدون أي استحقاق لهذا الشهر.</p></div>\n                <div className="grid grid-cols-2 gap-2">\n                  <button type="button" onClick={() => { setNewDebtMode('none'); setPriorDebtMonthId(''); setNewDebtError(''); }} className={\`py-3 px-2 rounded-2xl border text-xs font-black transition-all \${newDebtMode === 'none' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}\`}>بدون دين سابق</button>\n                  <button type="button" onClick={() => { setNewDebtMode('prior'); setNewDebtError(''); }} className={\`py-3 px-2 rounded-2xl border text-xs font-black transition-all \${newDebtMode === 'prior' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}\`}>عليه دين سابق</button>\n                </div>\n                {newDebtMode === 'none' && <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-3 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">سيتم إضافة المشترك الآن بدين 0 د.ع، وتبدأ جبايته من دورة الشهر القادمة.</div>}\n                {newDebtMode === 'prior' && (\n                  <div className="space-y-2">\n                    {availableDebtTariffs.length === 0 ? (\n                      <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 p-3 text-[11px] font-black text-rose-600 dark:text-rose-300">لا توجد تسعيرة شهرية محفوظة. يجب إضافة تسعيرة الشهر أولاً، ولا يمكن تسجيل دين بدون تسعيرة.</div>\n                    ) : (<>\n                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">اختر الشهر الذي يعود له الدين</label>\n                      <select value={priorDebtMonthId} onChange={e => { setPriorDebtMonthId(e.target.value); setNewDebtError(''); }} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 dark:text-white outline-none">\n                        <option value="">اختر تسعيرة الشهر</option>\n                        {availableDebtTariffs.map(m => <option key={m.id} value={m.id}>{m.monthNameAr}</option>)}\n                      </select>\n                      {selectedPriorTariff && <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-3 flex items-center justify-between gap-2"><span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">الدين حسب {selectedPriorTariff.monthNameAr}</span><strong className="text-sm text-amber-700 dark:text-amber-300">{formatCurrency(selectedPriorDebtAmount)}</strong></div>}\n                    </>)}\n                  </div>\n                )}\n                {newDebtError && <p className="text-[11px] font-black text-rose-500">{newDebtError}</p>}\n              </div>\n            )}\n            `;
  const newSubmit = '<button type="submit" disabled={!subscriberToEdit && currentTierObj?.type !== \'free\' && (!newDebtMode || (newDebtMode === \'prior\' && !priorDebtMonthId))} className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-black shadow-md">{subscriberToEdit ? \'حفظ التعديلات\' : \'إضافة المشترك\'}</button>';
  s = s.replace(oldSubmit, onboardingUi + newSubmit);

  // Replace the advanced custom-payment sheet with two distinct accounting semantics.
  const advancedStart = s.indexOf('        {isAdvancedOpen && subscriberToEdit && (');
  const confirmStart = advancedStart >= 0 ? s.indexOf('\n\n        {isConfirmUnpaidOpen', advancedStart) : -1;
  must(advancedStart >= 0 && confirmStart > advancedStart, 'advanced payment sheet bounds missing');
  const advancedBlock = `        {isAdvancedOpen && subscriberToEdit && (
          <div className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" dir="rtl">
            <div className="w-full max-w-md bg-white dark:bg-[#101a33] rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-black text-slate-950 dark:text-white">التسديد المخصص</h3><p className="text-[10px] text-slate-400 mt-1">إجمالي المتبقي حالياً: {formatCurrency(outstanding)}</p></div><button type="button" onClick={() => setIsAdvancedOpen(false)} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><X className="w-4 h-4" /></button></div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <button type="button" onClick={() => { setCustomPaymentMode('partial'); setCustomAmount(String(outstanding)); setCustomError(''); }} className={\`py-3 rounded-2xl border text-xs font-black \${customPaymentMode === 'partial' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}\`}>تسديد جزئي</button>
                <button type="button" onClick={() => { setCustomPaymentMode('lump'); setCustomAmount(String(settlementCurrentRemaining || '')); setCustomError(''); }} className={\`py-3 rounded-2xl border text-xs font-black \${customPaymentMode === 'lump' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}\`}>تسديد مقطوع</button>
              </div>

              {customPaymentMode === 'lump' && <div className="mb-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-3 text-[10px] leading-5 font-bold text-amber-800 dark:text-amber-300">يغلق اشتراك الشهر الحالي بالكامل بالمبلغ الذي تحدده. فرق التسوية لا يبقى ديناً، والقاصة والداشبورد يحتسبان المبلغ المستلم فعلياً فقط. أي دين من شهر أقدم يبقى محفوظاً.</div>}
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">{customPaymentMode === 'lump' ? 'المبلغ المتفق على استلامه' : 'مبلغ الدفعة'}</label>
              <input type="number" min="1" value={customAmount} onChange={e => { setCustomAmount(e.target.value); setCustomError(''); }} className="mt-1.5 w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-lg font-black text-slate-950 dark:text-white outline-none focus:border-blue-500" dir="ltr" />
              {customPaymentMode === 'lump' && <p className="mt-1.5 text-[10px] font-bold text-slate-500">المتبقي للشهر الحالي قبل التسوية: {formatCurrency(settlementCurrentRemaining)}</p>}
              {customError && <p className="text-[11px] font-bold text-rose-500 mt-2">{customError}</p>}
              <button type="button" onClick={() => {
                const amount = Number(customAmount);
                const maxAmount = customPaymentMode === 'lump' ? settlementCurrentRemaining : outstanding;
                if (!Number.isFinite(amount) || amount <= 0 || amount > maxAmount) { setCustomError('أدخل مبلغاً بين 1 و ' + formatNum(maxAmount) + ' د.ع'); return; }
                if (customPaymentMode === 'lump') handleLumpSettlement(amount); else handleCustomPayment('partial', amount);
              }} className="mt-4 w-full py-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-black">{customPaymentMode === 'lump' ? 'اعتماد التسديد المقطوع وإغلاق الشهر' : 'تسديد المبلغ وإصدار الوصل'}</button>
              <button type="button" onClick={() => handleCustomPayment('free', 0)} className="mt-2 w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black border border-slate-200 dark:border-slate-700">إعفاء الشهر الحالي</button>
            </div>
          </div>
        )}`;
  s = s.slice(0, advancedStart) + advancedBlock + s.slice(confirmStart);

  write(p, s);
}

// -----------------------------------------------------------------------------
// 2) Collector payment modal: distinguish partial from true lump settlement.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/PaymentMethodModal.tsx';
  let s = read(p);
  s = s.replace("export type PaymentExecutionMethod = 'full' | 'partial' | 'free' | 'unpaid';", "export type PaymentExecutionMethod = 'full' | 'partial' | 'lump' | 'free' | 'unpaid';");
  s = s.replace("type CustomPaymentMethod = '' | 'partial' | 'free';", "type CustomPaymentMethod = '' | 'partial' | 'lump' | 'free';");

  // Computed amount: partial leaves a debt; lump closes the current subscription by agreement.
  const partialComputed = `  } else if (selectedMethod === 'partial') {\n    computedAmountPaid = Math.min(totalAmountDue, Math.max(0, Number(partialAmount) || 0));\n    computedRemaining = Math.max(0, totalAmountDue - computedAmountPaid);`;
  if (s.includes(partialComputed) && !s.includes("selectedMethod === 'lump'")) {
    s = s.replace(partialComputed, `${partialComputed}\n  } else if (selectedMethod === 'lump') {\n    computedAmountPaid = Math.min(totalAmountDue, Math.max(0, Number(partialAmount) || 0));\n    computedRemaining = 0;`);
  }

  const methodPartial = `    if (value === 'partial') {\n      setSelectedMethod('partial');\n      const defaultPartial = Math.max(1000, Math.min(totalAmountDue, Math.round(totalAmountDue / 2 / 1000) * 1000));\n      setPartialAmount(defaultPartial);`;
  if (s.includes(methodPartial) && !s.includes("value === 'lump'")) {
    s = s.replace(methodPartial, `${methodPartial}\n    } else if (value === 'lump') {\n      setSelectedMethod('lump');\n      setPartialAmount(totalAmountDue);`);
  }

  s = s.replace(
    "    if (selectedMethod === 'partial' && computedAmountPaid <= 0) return;",
    "    if ((selectedMethod === 'partial' || selectedMethod === 'lump') && computedAmountPaid <= 0) return;"
  );
  s = s.replace(
    `    : selectedMethod === 'partial'\n      ? \`تأكيد التسديد المقطوع \${formatCurrency(computedAmountPaid, currency)}\`\n      : 'تأكيد التسديد المجاني';`,
    `    : selectedMethod === 'partial'\n      ? \`تأكيد التسديد الجزئي \${formatCurrency(computedAmountPaid, currency)}\`\n      : selectedMethod === 'lump'\n        ? \`تأكيد التسديد المقطوع \${formatCurrency(computedAmountPaid, currency)}\`\n        : 'تأكيد التسديد المجاني';`
  );
  s = s.replace('<div className="text-[11px] text-slate-500 dark:text-slate-400">تسديد مقطوع أو تسديد مجاني</div>', '<div className="text-[11px] text-slate-500 dark:text-slate-400">جزئي، مقطوع، أو مجاني</div>');
  s = s.replace('<option value="partial">تسديد مقطوع</option>\n                  <option value="free">تسديد مجاني</option>', '<option value="partial">تسديد جزئي</option>\n                  <option value="lump">تسديد مقطوع — إغلاق الاشتراك بالمبلغ المتفق عليه</option>\n                  <option value="free">تسديد مجاني</option>');
  s = s.replace("{selectedMethod === 'partial' && customPaymentOpen && (", "{(selectedMethod === 'partial' || selectedMethod === 'lump') && customPaymentOpen && (");
  s = s.replace('<span>مبلغ التسديد المقطوع:</span>', "<span>{selectedMethod === 'lump' ? 'المبلغ المتفق عليه:' : 'مبلغ التسديد الجزئي:'}</span>");
  s = s.replace('<span className="text-[10px] text-rose-700 dark:text-rose-300 block font-bold">المتبقي</span>\n                  <span className="text-xs font-black text-rose-800 dark:text-rose-200 tabular-nums">{formatCurrency(computedRemaining, currency)}</span>', '<span className="text-[10px] text-rose-700 dark:text-rose-300 block font-bold">{selectedMethod === \'lump\' ? \'المتبقي بعد التسوية\' : \'المتبقي\'}</span>\n                  <span className="text-xs font-black text-rose-800 dark:text-rose-200 tabular-nums">{formatCurrency(computedRemaining, currency)}</span>');
  write(p, s);
}

// -----------------------------------------------------------------------------
// 3) Collector POS: true lump settlement closes CURRENT month only and logs cash received.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/POSQuickView.tsx';
  let s = read(p);
  if (!s.includes('COLLECTOR_LUMP_SETTLEMENT_V1')) {
    const anchor = '    // COLLECTOR_FULL_PAYMENT_EXACT_OUTSTANDING_V2';
    must(s.includes(anchor), 'collector full-payment final marker missing');
    const branch = `    // COLLECTOR_LUMP_SETTLEMENT_V1\n    if (data.method === 'lump') {\n      const current = ensured.invoices.find(inv => inv.monthId === monthId && inv.status !== 'cancelled' && inv.status !== 'free');\n      if (!current || String(current.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE')) return;\n      const originalTotal = Math.max(0, Number(current.totalAmount || 0));\n      const alreadyPaid = Math.max(0, Number(current.paidAmount || 0));\n      const remainingBefore = getInvoiceRemaining(current);\n      const received = Math.min(remainingBefore, Math.max(0, Number(data.amountPaid || 0)));\n      if (remainingBefore <= 0 || received <= 0) return;\n      const effectiveTotal = alreadyPaid + received;\n      const discount = Math.max(0, originalTotal - effectiveTotal);\n      const marker = 'MOLDATK_LUMP_SETTLEMENT|original=' + originalTotal + '|settled=' + effectiveTotal + '|discount=' + discount + '|received=' + received;\n      const settledCurrent: SubscriberInvoice = { ...current, totalAmount: effectiveTotal, paidAmount: effectiveTotal, remainingAmount: 0, status: 'paid', paymentDate: now.toISOString(), notes: marker };\n      const invoices = ensured.invoices.map(inv => inv.id === current.id ? settledCurrent : inv);\n      const totalDebtAfter = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);\n      const updated: Subscriber = { ...sub, invoicesHistory: invoices.sort((a, b) => b.monthId.localeCompare(a.monthId)), paymentStatus: totalDebtAfter === 0 ? 'paid' : 'partial', amountDue: totalDebtAfter, amountPaid: effectiveTotal, lastPaymentDate: now.toISOString() };\n      const receiptInvoice: SubscriberInvoice = { ...settledCurrent, id: 'receipt-lump-' + sub.id + '-' + Date.now(), receiptNumber: 'REC-' + (sub.code || sub.subscriberCode || 'MW') + '-' + Date.now().toString().slice(-6), totalAmount: received, paidAmount: received, remainingAmount: totalDebtAfter, status: totalDebtAfter === 0 ? 'paid' : 'partial', collectorName: data.collectorName || collectorName || 'المحاسب', previousDebtBefore: Math.max(0, Number(sub.amountDue || 0) - remainingBefore), currentCharge: effectiveTotal, totalBeforePayment: originalTotal, appliedToPreviousDebt: 0, appliedToCurrentMonth: received, totalOutstandingAfter: totalDebtAfter, paymentDate: now.toISOString(), notes: marker };\n      onSaveSubscriber(updated);\n      onAddAuditLog({ category: 'payment', title: 'تسديد مقطوع', details: 'الاستحقاق الأصلي ' + originalTotal.toLocaleString('en-US') + ' | المستلم ' + received.toLocaleString('en-US') + ' | فرق التسوية ' + discount.toLocaleString('en-US'), entityId: sub.id, entityName: sub.fullName + ' (' + (sub.code || sub.subscriberCode) + ')', actorName: data.collectorName || collectorName || 'المحاسب', amount: received });\n      setPaymentSubscriber(null);\n      setPaymentSuccess({ name: sub.fullName, amount: received, method: data.method });\n      if (data.autoPrintReceipt) window.setTimeout(() => onOpenReceiptModal(updated, receiptInvoice, true), 650);\n      window.setTimeout(() => setPaymentSuccess(null), 1800);\n      return;\n    }\n\n`;
    s = s.replace(anchor, branch + anchor);
  }
  write(p, s);
}

// -----------------------------------------------------------------------------
// 4) One accounting source of truth that understands onboarding and settlement markers.
// -----------------------------------------------------------------------------
write('src/utils/authoritativeAccounting.ts', `import type { AuditLogEntry, Subscriber, SubscriberInvoice, SubscriptionTierPricing } from '../types';
import { calculateSubscriberBill } from './formatters';
import { getInvoiceRemaining, getMonthId } from './monthlyAccounting';

const n = (v: unknown) => Math.max(0, Number(v) || 0);
const notes = (inv?: SubscriberInvoice) => String(inv?.notes || '');
const isNoCurrentCharge = (inv?: SubscriberInvoice) => notes(inv).includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE');
const isLumpSettlement = (inv?: SubscriberInvoice) => notes(inv).includes('MOLDATK_LUMP_SETTLEMENT');

function newest(list: SubscriberInvoice[]): SubscriberInvoice | undefined {
  return [...list].sort((a, b) => {
    const ad = a.paymentDate || a.issueDate || '';
    const bd = b.paymentDate || b.issueDate || '';
    if (ad !== bd) return bd.localeCompare(ad);
    const ap = n(a.paidAmount), bp = n(b.paidAmount);
    if (ap !== bp) return bp - ap;
    const ar = getInvoiceRemaining(a), br = getInvoiceRemaining(b);
    if (ar !== br) return ar - br;
    return String(b.id || '').localeCompare(String(a.id || ''));
  })[0];
}

function canonicalInvoices(sub: Subscriber): SubscriberInvoice[] {
  const grouped = new Map<string, SubscriberInvoice[]>();
  for (const inv of sub.invoicesHistory || []) {
    if (inv.status === 'cancelled' || inv.status === 'free') continue;
    const key = String(inv.monthId || 'legacy');
    const list = grouped.get(key) || [];
    list.push(inv);
    grouped.set(key, list);
  }
  return Array.from(grouped.values()).map(x => newest(x)).filter(Boolean) as SubscriberInvoice[];
}

export function getSubscriberFinancialRow(sub: Subscriber, tiers: SubscriptionTierPricing[], activeMonthId = getMonthId()) {
  const isFree = sub.tier === 'free' || sub.isExempted === true || sub.paymentStatus === 'free';
  if (isFree) return { sub, isFree, bill: 0, paid: 0, outstanding: 0, status: 'free' as const };

  const invoices = canonicalInvoices(sub);
  const current = newest(invoices.filter(i => i.monthId === activeMonthId));
  const ledgerOutstanding = invoices.reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
  const legacyDue = n(sub.amountDue);
  const legacyPaid = n(sub.amountPaid);

  // New subscriber added without a current-month charge: do not let the tariff engine
  // invent a debt. Older explicitly-linked debt remains visible and collectible.
  if (isNoCurrentCharge(current)) {
    const oldOutstanding = invoices.filter(inv => inv.monthId !== activeMonthId).reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);
    const outstanding = Math.max(oldOutstanding, legacyDue);
    return { sub, isFree: false, bill: 0, paid: 0, outstanding, status: outstanding > 0 ? 'unpaid' as const : 'not_due' as const };
  }

  const tariffBill = n(calculateSubscriberBill(sub.amperes, sub.tier, tiers).total);
  const invoiceBill = n(current?.totalAmount);
  const invoicePaid = n(current?.paidAmount);

  // Lump settlement is an owner-approved effective charge. Never expand it back to the
  // tariff amount: dashboard/month total/cashbox must reflect actual agreed money.
  if (isLumpSettlement(current)) {
    const bill = invoiceBill;
    const paid = Math.min(bill, invoicePaid);
    const outstanding = Math.max(ledgerOutstanding, legacyDue);
    return { sub, isFree: false, bill, paid, outstanding, status: outstanding > 0 ? 'partial' as const : 'paid' as const };
  }

  let bill = Math.max(tariffBill, invoiceBill);
  if (sub.paymentStatus === 'paid') bill = Math.max(bill, legacyDue, legacyPaid);
  else if (sub.paymentStatus === 'partial') {
    const legacyGross = legacyDue >= bill && legacyPaid > 0 ? legacyDue : legacyDue + legacyPaid;
    bill = Math.max(bill, legacyGross);
  } else if (bill <= 0) bill = legacyDue;

  let status: 'paid' | 'partial' | 'unpaid' = 'unpaid';
  if (sub.paymentStatus === 'paid' || current?.status === 'paid') status = 'paid';
  else if (sub.paymentStatus === 'partial' || current?.status === 'partial' || invoicePaid > 0 || legacyPaid > 0) status = 'partial';

  const paid = status === 'paid' ? bill : status === 'partial' ? Math.min(bill, Math.max(invoicePaid, legacyPaid)) : 0;
  let outstanding = 0;
  if (status === 'partial') {
    const legacyRemaining = legacyDue >= bill && legacyPaid > 0 ? Math.max(0, legacyDue - legacyPaid) : legacyDue;
    outstanding = Math.max(ledgerOutstanding, Math.max(0, bill - paid), legacyRemaining);
  } else if (status === 'unpaid') {
    outstanding = Math.max(ledgerOutstanding, legacyDue, bill);
  }
  return { sub, isFree: false, bill, paid, outstanding, status };
}

export function summarizeSubscribers(subscribers: Subscriber[], tiers: SubscriptionTierPricing[], activeMonthId = getMonthId()) {
  const rows = subscribers.map(sub => getSubscriberFinancialRow(sub, tiers, activeMonthId));
  const billable = rows.filter(r => !r.isFree);
  const paidRows = billable.filter(r => r.status === 'paid' && r.outstanding === 0 && r.bill > 0);
  const unpaidRows = billable.filter(r => r.outstanding > 0 || r.status === 'unpaid' || r.status === 'partial');
  return {
    rows,
    totalSubscribers: subscribers.length,
    paidSubscribers: paidRows.map(r => r.sub),
    unpaidSubscribers: unpaidRows.map(r => r.sub),
    collected: billable.reduce((sum, r) => sum + r.paid, 0),
    outstanding: billable.reduce((sum, r) => sum + r.outstanding, 0),
    monthTotal: billable.reduce((sum, r) => sum + r.bill, 0),
  };
}

function net(logs: AuditLogEntry[]) {
  const ordered = [...logs].sort((a,b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
  const stacks = new Map<string, number[]>();
  let result = 0;
  for (const log of ordered) {
    const key = String(log.entityId || 'unknown');
    if (log.category === 'payment') {
      const amount = n(log.amount); result += amount;
      if (amount > 0) { const stack = stacks.get(key) || []; stack.push(amount); stacks.set(key, stack); }
    } else if (log.category === 'cancellation') {
      const stack = stacks.get(key) || [];
      let amount = n(log.amount);
      if (!amount && stack.length) amount = stack.pop() || 0; else if (amount && stack.length) stack.pop();
      stacks.set(key, stack); result -= amount;
    }
  }
  return Math.max(0, result);
}

export function reconciledCashbox(collected: number, logs: AuditLogEntry[] = [], resetAt?: string, activeMonthId = getMonthId()) {
  const ledger = n(collected);
  if (!resetAt) return ledger;
  const monthLogs = logs.filter(log => {
    if ((log.category !== 'payment' && log.category !== 'cancellation') || !log.timestamp) return false;
    const d = new Date(log.timestamp);
    return !Number.isNaN(d.getTime()) && getMonthId(d) === activeMonthId;
  });
  const whole = net(monthLogs);
  if (Math.abs(whole - ledger) > 1) return ledger;
  const resetMs = new Date(resetAt).getTime();
  if (!Number.isFinite(resetMs)) return ledger;
  return net(monthLogs.filter(log => new Date(log.timestamp || 0).getTime() >= resetMs));
}
`);

// -----------------------------------------------------------------------------
// 5) Pass tariff history into every SubscriberModal instance without touching other UIs.
// -----------------------------------------------------------------------------
{
  const p = 'src/App.tsx';
  let s = read(p);
  let cursor = 0;
  while (true) {
    const start = s.indexOf('<SubscriberModal', cursor);
    if (start < 0) break;
    const end = s.indexOf('/>', start);
    must(end > start, 'SubscriberModal JSX close missing');
    let block = s.slice(start, end + 2);
    if (!block.includes('monthlyTariffs={monthlyTariffs}')) {
      block = block.replace('pricingTiers={pricingTiers}', 'pricingTiers={pricingTiers}\n          monthlyTariffs={monthlyTariffs}');
      s = s.slice(0, start) + block + s.slice(end + 2);
      cursor = start + block.length;
    } else {
      cursor = end + 2;
    }
  }
  write(p, s);
}

// Final invariants: these are intentionally build-breaking if any older mutation restores
// unsafe accounting behavior after this pass.
{
  const modal = read('src/components/SubscriberModal.tsx');
  const payModal = read('src/components/PaymentMethodModal.tsx');
  const pos = read('src/components/POSQuickView.tsx');
  const accounting = read('src/utils/authoritativeAccounting.ts');
  const app = read('src/App.tsx');
  must(modal.includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE'), 'new-subscriber zero-charge marker missing');
  must(modal.includes('MOLDATK_PRIOR_DEBT_ONBOARDING'), 'prior-debt invoice marker missing');
  must(modal.includes('handleLumpSettlement'), 'owner lump settlement missing');
  must(modal.includes('تسديد مقطوع'), 'owner lump UI missing');
  must(payModal.includes("'lump'"), 'collector payment union missing lump method');
  must(pos.includes('COLLECTOR_LUMP_SETTLEMENT_V1'), 'collector lump settlement branch missing');
  must(accounting.includes('isLumpSettlement'), 'authoritative accounting does not understand settlement marker');
  must(accounting.includes('isNoCurrentCharge'), 'authoritative accounting does not understand onboarding marker');
  must((app.match(/monthlyTariffs=\{monthlyTariffs\}/g) || []).length >= 3, 'tariff history not passed to all subscriber modals');
}

console.log('Onboarding debt choice + true lump settlement applied: zero-debt start, tariff-linked prior debt, actual-cash receipt, and settlement-aware dashboard totals.');
