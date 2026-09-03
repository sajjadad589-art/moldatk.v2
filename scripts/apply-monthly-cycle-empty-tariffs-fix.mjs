import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

const replaceBlock = (source, startNeedle, endNeedle, replacement, label) => {
  const start = source.indexOf(startNeedle);
  const end = start >= 0 ? source.indexOf(endNeedle, start) : -1;
  if (start < 0 || end < 0) throw new Error(`Monthly cycle final patch: ${label} block not found`);
  return source.slice(0, start) + replacement + source.slice(end);
};

// -----------------------------------------------------------------------------
// 1) Pricing editor: a tariff list may be completely empty, every tariff may be
// deleted, and creating a month starts that monthly billing cycle immediately.
// -----------------------------------------------------------------------------
{
  const p = 'src/components/PricingModal.tsx';
  let c = read(p);

  // Never silently recreate August 2026 after the owner intentionally deletes all tariffs.
  if (c.includes('const defaultRecord: MonthlyTariffRecord = {')) {
    const emptyFallback = /      } else \{\n        const defaultRecord: MonthlyTariffRecord = \{[\s\S]*?\n        setSelectedMonthId\(defaultRecord\.id\);\n      \}/;
    if (!emptyFallback.test(c)) throw new Error('PricingModal empty-tariff fallback block not found');
    c = c.replace(
      emptyFallback,
      `      } else {\n        setTariffs([]);\n        setSelectedMonthId('');\n      }`
    );
  }

  // If the list is empty, preserve the known tier structure only as a zero-price template
  // so the owner can create the next month without re-creating tier names manually.
  c = c.replace(
    "    const baseTiers = normalizeTierNames(currentTiers).map(t => ({ ...t, fixedFee: 0, description: '' }));",
    "    const sourceTiers = currentTiers.length > 0 ? currentTiers : pricingTiers;\n    const baseTiers = normalizeTierNames(sourceTiers).map(t => ({ ...t, fixedFee: 0, description: '' }));"
  );
  if (!c.includes('const sourceTiers = currentTiers.length > 0 ? currentTiers : pricingTiers;')) {
    throw new Error('PricingModal new-month tier source was not patched');
  }

  const deleteHandler = `  const handleDeleteMonth = (monthId: string) => {\n    const target = tariffs.find(m => m.id === monthId);\n    if (!target) return;\n\n    const warning = target.isCurrentActive\n      ? 'تحذير: هذه هي التسعيرة النشطة. سيتم إيقاف هذه الدورة الشهرية. سجل الفواتير والتسديدات والديون السابقة سيبقى محفوظاً. هل تريد المتابعة؟'\n      : 'هل تريد حذف تسعيرة ' + (target.monthNameAr || target.id) + '؟ سجل الفواتير والتسديدات والديون السابقة سيبقى محفوظاً.';\n    if (!window.confirm(warning)) return;\n\n    const remaining = tariffs.filter(m => m.id !== monthId);\n    if (remaining.length === 0) {\n      setTariffs([]);\n      setSelectedMonthId('');\n      onSaveMonthlyTariffs([], '', false);\n      return;\n    }\n\n    const existingActive = remaining.find(m => m.isCurrentActive);\n    const nextActive = target.isCurrentActive\n      ? [...remaining].sort((a, b) => b.id.localeCompare(a.id))[0]\n      : (existingActive || [...remaining].sort((a, b) => b.id.localeCompare(a.id))[0]);\n    const updated = remaining.map(m => ({ ...m, isCurrentActive: m.id === nextActive.id }));\n    setTariffs(updated);\n    setSelectedMonthId(nextActive.id);\n    onSaveMonthlyTariffs(updated, nextActive.id, false);\n  };\n`;
  c = replaceBlock(
    c,
    '  const handleDeleteMonth = (monthId: string) => {',
    '\n\n  const handleSave =',
    deleteHandler,
    'PricingModal.handleDeleteMonth'
  );

  // Show the delete action even when this is the only/active tariff.
  const monthMapStart = c.indexOf('{tariffs.map(month => {');
  if (monthMapStart >= 0) {
    const deleteCondition = c.indexOf('{tariffs.length > 1 && (', monthMapStart);
    if (deleteCondition >= 0) {
      c = c.slice(0, deleteCondition) + '{true && (' + c.slice(deleteCondition + '{tariffs.length > 1 && ('.length);
    }
  }

  if (!c.includes('لا توجد تسعيرة معتمدة حالياً')) {
    const listMarker = '            <div className="flex items-center gap-2 overflow-x-auto pb-1">';
    if (!c.includes(listMarker)) throw new Error('PricingModal tariff-list marker not found');
    c = c.replace(
      listMarker,
      `${listMarker}\n              {tariffs.length === 0 && (\n                <div className="w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-800/60 px-4 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-400">\n                  لا توجد تسعيرة معتمدة حالياً — أضف تسعيرة شهر جديد لبدء دورة شهرية جديدة.\n                </div>\n              )}`
    );
  }

  c = c.replace(
    '<span>تسعيرة: {currentMonthRecord?.monthNameAr}</span>',
    "<span>تسعيرة: {currentMonthRecord?.monthNameAr || 'لا توجد تسعيرة'}</span>"
  );
  c = c.replace(
    `{isEditable\n                    ? 'هذا هو الشهر النشط حالياً لإصدار فواتير المشتركين وقابل للتعديل'\n                    : 'هذا الشهر يعتبر أرشيفاً سابقاً، الأسعار هنا للقراءة فقط ولا يمكن تعديلها.'}`,
    `{!currentMonthRecord\n                    ? 'لا توجد دورة شهرية نشطة حالياً. مبالغ المشتركين الحالية تكون صفراً لحين اعتماد شهر جديد.'\n                    : isEditable\n                    ? 'هذا هو الشهر النشط حالياً لإصدار فواتير المشتركين وقابل للتعديل'\n                    : 'هذا الشهر يعتبر أرشيفاً سابقاً، الأسعار هنا للقراءة فقط ولا يمكن تعديلها.'}`
  );

  if (!c.includes("onSaveMonthlyTariffs(updatedTariffs, monthId, true);")) {
    throw new Error('PricingModal must activate the newly-created month immediately');
  }
  if (!c.includes("onSaveMonthlyTariffs([], '', false);")) {
    throw new Error('PricingModal final tariff deletion was not enabled');
  }

  write(p, c);
}

// -----------------------------------------------------------------------------
// 2) App: every newly activated tariff starts a fresh monthly collection cycle.
// Paid/partial counters reset for the NEW month, prior unpaid balances stay in
// historical invoices as carried debt. With no tariff, the live account is zero.
// -----------------------------------------------------------------------------
{
  const p = 'src/App.tsx';
  let c = read(p);

  c = c.replace(
    '  const pricingTiers: SubscriptionTierPricing[] = activeMonthRecord?.tiers || INITIAL_PRICING_TIERS;',
    '  const pricingTiers: SubscriptionTierPricing[] = activeMonthRecord?.tiers || INITIAL_PRICING_TIERS.map(t => ({ ...t, pricePerAmpere: 0, fixedFee: 0 }));'
  );

  const handler = `  const handleSaveMonthlyTariffs = (updatedTariffs: MonthlyTariffRecord[], activeMonthId: string, shouldRecalculateBills: boolean) => {\n    const nowIso = new Date().toISOString();\n    const previousActiveId = monthlyTariffs.find(m => m.isCurrentActive)?.id || monthlyTariffs[0]?.id || '';\n    const incomingIds = new Set(updatedTariffs.map(record => record.id));\n\n    // Deletion tombstones make tariff deletion authoritative across offline/realtime sync.\n    try {\n      const tombstoneKey = getStorageKey('moldatk_deleted_tariffs');\n      const raw = localStorage.getItem(tombstoneKey);\n      const parsed = raw ? JSON.parse(raw) : [];\n      const tombstones = new Set<string>(Array.isArray(parsed) ? parsed.map(String) : []);\n      for (const oldRecord of monthlyTariffs) {\n        if (!incomingIds.has(oldRecord.id)) tombstones.add(oldRecord.id);\n      }\n      for (const incoming of updatedTariffs) tombstones.delete(incoming.id);\n      localStorage.setItem(tombstoneKey, JSON.stringify(Array.from(tombstones)));\n    } catch (e) {}\n\n    const canonicalActiveId = (() => {\n      const match = updatedTariffs.find(r => r.id === activeMonthId);\n      if (!match) return activeMonthId || '';\n      return String(match.year) + '-' + String(match.month).padStart(2, '0');\n    })();\n\n    const tariffMap = new Map<string, MonthlyTariffRecord>();\n    for (const rawRecord of updatedTariffs) {\n      const month = Math.min(12, Math.max(1, Number(rawRecord.month || 1)));\n      const year = Math.max(2000, Number(rawRecord.year || new Date().getFullYear()));\n      const id = String(year) + '-' + String(month).padStart(2, '0');\n      tariffMap.set(id, {\n        ...rawRecord,\n        id,\n        month,\n        year,\n        monthNameAr: rawRecord.monthNameAr || (String(month) + '-' + String(year)),\n        tiers: (rawRecord.tiers || []).map(t => ({ ...t })),\n        createdAt: rawRecord.createdAt || nowIso.slice(0, 10),\n        updatedAt: nowIso,\n        isCurrentActive: id === canonicalActiveId,\n      });\n    }\n\n    let normalized = Array.from(tariffMap.values())\n      .sort((a, b) => (b.year - a.year) || (b.month - a.month));\n    let activeRecord = normalized.find(m => m.id === canonicalActiveId) || normalized.find(m => m.isCurrentActive) || normalized[0];\n    if (activeRecord && !normalized.some(m => m.isCurrentActive)) {\n      normalized = normalized.map(m => ({ ...m, isCurrentActive: m.id === activeRecord!.id }));\n      activeRecord = normalized.find(m => m.id === activeRecord!.id) || activeRecord;\n    }\n\n    let nextSubscribers = subscribers;\n    let subscriberStateChanged = false;\n\n    if (normalized.length === 0) {\n      // No monthly tariff means no live billing cycle. Historical invoices remain untouched\n      // for reports/audit and can be carried again when a future month is created.\n      nextSubscribers = subscribers.map(sub => ({\n        ...sub,\n        amountDue: 0,\n        amountPaid: 0,\n        paymentStatus: (sub.tier === 'free' || Boolean(sub.isExempted)) ? 'free' : 'unpaid',\n      }));\n      subscriberStateChanged = true;\n    } else if (shouldRecalculateBills && activeRecord) {\n      // Activating/saving a month is the monthly rollover point. The NEW month always\n      // starts with paidAmount=0 and unpaid status for billable subscribers.\n      nextSubscribers = subscribers.map(sub => {\n        const history = [...(sub.invoicesHistory || [])].map(inv => ({ ...inv }));\n        const isPermanentFree = sub.tier === 'free' || Boolean(sub.isExempted);\n        const previousRecord = [...normalized]\n          .filter(m => m.id < activeRecord!.id)\n          .sort((a, b) => b.id.localeCompare(a.id))[0];\n\n        // Freeze the immediately previous month for legacy accounts that did not yet have\n        // invoice history. Paid stays paid historically; unpaid/partial remains debt.\n        if (previousRecord && !history.some(inv => inv.monthId === previousRecord.id && inv.status !== 'cancelled')) {\n          const previousCharge = calculateMonthlyCharge(sub, previousRecord.tiers);\n          const previousTotal = isPermanentFree ? 0 : previousCharge.total;\n          const previousPaid = isPermanentFree\n            ? 0\n            : sub.paymentStatus === 'paid'\n            ? previousTotal\n            : sub.paymentStatus === 'partial'\n            ? Math.min(previousTotal, Math.max(0, Number(sub.amountPaid || 0)))\n            : 0;\n          const previousRemaining = Math.max(0, previousTotal - previousPaid);\n          history.push({\n            id: 'inv-' + previousRecord.id + '-' + sub.id,\n            subscriberId: sub.id,\n            receiptNumber: 'ACC-' + previousRecord.id + '-' + (sub.code || sub.subscriberCode || sub.id),\n            monthId: previousRecord.id,\n            monthNameAr: previousRecord.monthNameAr,\n            issueDate: previousRecord.createdAt || nowIso.slice(0, 10),\n            paymentDate: previousPaid > 0 ? (sub.lastPaymentDate || nowIso) : undefined,\n            amperes: sub.amperes,\n            tier: sub.tier,\n            pricePerAmpere: isPermanentFree ? 0 : previousCharge.pricePerAmpere,\n            fixedFee: isPermanentFree ? 0 : previousCharge.fixedFee,\n            totalAmount: previousTotal,\n            paidAmount: previousPaid,\n            remainingAmount: previousRemaining,\n            status: isPermanentFree ? 'free' : previousRemaining === 0 ? 'paid' : previousPaid > 0 ? 'partial' : 'unpaid',\n          });\n        }\n\n        const charge = calculateMonthlyCharge(sub, activeRecord!.tiers);\n        let currentInvoice = history.find(inv => inv.monthId === activeRecord!.id && inv.status !== 'cancelled');\n\n        if (!currentInvoice) {\n          const previousDebt = history\n            .filter(inv => inv.monthId < activeRecord!.id && inv.status !== 'cancelled')\n            .reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);\n          currentInvoice = {\n            id: 'inv-' + activeRecord!.id + '-' + sub.id,\n            subscriberId: sub.id,\n            receiptNumber: 'ACC-' + activeRecord!.id + '-' + (sub.code || sub.subscriberCode || sub.id),\n            monthId: activeRecord!.id,\n            monthNameAr: activeRecord!.monthNameAr,\n            issueDate: nowIso.slice(0, 10),\n            amperes: sub.amperes,\n            tier: sub.tier,\n            pricePerAmpere: isPermanentFree ? 0 : charge.pricePerAmpere,\n            fixedFee: isPermanentFree ? 0 : charge.fixedFee,\n            totalAmount: isPermanentFree ? 0 : charge.total,\n            paidAmount: 0,\n            remainingAmount: isPermanentFree ? 0 : charge.total,\n            status: isPermanentFree ? 'free' : 'unpaid',\n            notes: previousDebt > 0 ? ('دين سابق مرحل: ' + previousDebt) : undefined,\n          };\n          history.push(currentInvoice);\n        } else if (currentInvoice.status !== 'paid' && currentInvoice.status !== 'free') {\n          // Editing the active tariff can reprice only its own unpaid/partial invoice.\n          const alreadyPaid = Math.max(0, Number(currentInvoice.paidAmount || 0));\n          currentInvoice.amperes = sub.amperes;\n          currentInvoice.tier = sub.tier;\n          currentInvoice.pricePerAmpere = isPermanentFree ? 0 : charge.pricePerAmpere;\n          currentInvoice.fixedFee = isPermanentFree ? 0 : charge.fixedFee;\n          currentInvoice.totalAmount = isPermanentFree ? 0 : charge.total;\n          currentInvoice.paidAmount = isPermanentFree ? 0 : Math.min(alreadyPaid, charge.total);\n          currentInvoice.remainingAmount = isPermanentFree ? 0 : Math.max(0, charge.total - currentInvoice.paidAmount);\n          currentInvoice.status = isPermanentFree\n            ? 'free'\n            : currentInvoice.paidAmount <= 0\n            ? 'unpaid'\n            : currentInvoice.remainingAmount <= 0\n            ? 'paid'\n            : 'partial';\n        }\n\n        const sortedHistory = history.sort((a, b) => b.monthId.localeCompare(a.monthId));\n        const totalOutstanding = sortedHistory\n          .filter(inv => inv.status !== 'cancelled')\n          .reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);\n        const currentRemaining = getInvoiceRemaining(currentInvoice);\n        const currentPaid = Math.max(0, Number(currentInvoice.paidAmount || 0));\n        const currentIsFree = currentInvoice.status === 'free';\n\n        // IMPORTANT: card/filter status belongs to the ACTIVE month only. Old debt is included\n        // in amountDue, but it must not make the brand-new month appear partial/paid.\n        const liveStatus: Subscriber['paymentStatus'] = currentIsFree\n          ? 'free'\n          : currentPaid <= 0\n          ? 'unpaid'\n          : currentRemaining <= 0\n          ? 'paid'\n          : 'partial';\n\n        return {\n          ...sub,\n          invoicesHistory: sortedHistory,\n          amountDue: totalOutstanding,\n          amountPaid: currentPaid,\n          paymentStatus: liveStatus,\n          lastPaymentDate: currentPaid > 0 ? (currentInvoice.paymentDate || sub.lastPaymentDate) : sub.lastPaymentDate,\n        };\n      });\n      subscriberStateChanged = true;\n    } else if (activeRecord && previousActiveId && !incomingIds.has(previousActiveId)) {\n      // If the active tariff itself was deleted while another tariff remains, restore the\n      // live status from the newly-selected active month's frozen invoice without deleting debt.\n      nextSubscribers = subscribers.map(sub => {\n        const history = [...(sub.invoicesHistory || [])];\n        const currentInvoice = history.find(inv => inv.monthId === activeRecord!.id && inv.status !== 'cancelled');\n        if (!currentInvoice) {\n          return { ...sub, amountPaid: 0, paymentStatus: (sub.tier === 'free' || Boolean(sub.isExempted)) ? 'free' : 'unpaid' };\n        }\n        const totalOutstanding = history\n          .filter(inv => inv.status !== 'cancelled')\n          .reduce((sum, inv) => sum + getInvoiceRemaining(inv), 0);\n        const currentRemaining = getInvoiceRemaining(currentInvoice);\n        const currentPaid = Math.max(0, Number(currentInvoice.paidAmount || 0));\n        const liveStatus: Subscriber['paymentStatus'] = currentInvoice.status === 'free'\n          ? 'free'\n          : currentPaid <= 0\n          ? 'unpaid'\n          : currentRemaining <= 0\n          ? 'paid'\n          : 'partial';\n        return { ...sub, amountDue: totalOutstanding, amountPaid: currentPaid, paymentStatus: liveStatus };\n      });\n      subscriberStateChanged = true;\n    }\n\n    setMonthlyTariffs(normalized);\n    if (subscriberStateChanged) setSubscribers(nextSubscribers);\n\n    try {\n      localStorage.setItem(getStorageKey('moldatk_monthly_tariffs'), JSON.stringify(normalized));\n      if (subscriberStateChanged) {\n        localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(nextSubscribers));\n      }\n      window.dispatchEvent(new Event('moldatk-local-sync'));\n    } catch (e) {}\n\n    addAuditLog({\n      category: 'pricing',\n      title: normalized.length === 0 ? 'إيقاف الدورة الشهرية' : 'حفظ تسعيرة شهرية مستقلة',\n      details: normalized.length === 0\n        ? 'تم حذف جميع التسعيرات وتصفير الحالة الحية للمشتركين مع إبقاء السجل المحاسبي التاريخي محفوظاً'\n        : 'تم حفظ ' + (activeRecord?.monthNameAr || 'التسعيرة') + ' كسجل مستقل مع بدء دورة الشهر الجديد وترحيل الديون السابقة',\n      entityName: activeRecord?.monthNameAr || 'التسعيرات الشهرية',\n      actorName: userSession?.username || userSession?.collectorName || 'مدير المنظومة',\n    });\n\n    showToast(normalized.length === 0\n      ? 'تم حذف جميع التسعيرات وتصفير الحالة الحالية للمشتركين'\n      : shouldRecalculateBills\n      ? 'تم اعتماد الشهر الجديد: عاد المشتركين غير المجانيين إلى غير مسدد مع ترحيل الدين السابق'\n      : 'تم تحديث سجل التسعيرات مع الحفاظ على الحسابات التاريخية');\n  };\n\n`;

  c = replaceBlock(
    c,
    '  const handleSaveMonthlyTariffs = (updatedTariffs: MonthlyTariffRecord[], activeMonthId: string, shouldRecalculateBills: boolean) => {',
    '  const handleOpenFolderModal',
    handler,
    'App.handleSaveMonthlyTariffs'
  );

  if (!c.includes("getStorageKey('moldatk_deleted_tariffs')")) {
    throw new Error('App tariff tombstone persistence missing');
  }
  if (!c.includes("const liveStatus: Subscriber['paymentStatus']")) {
    throw new Error('App active-month payment status reset missing');
  }

  write(p, c);
}

// -----------------------------------------------------------------------------
// 3) Cloud sync: deleted tariffs get tombstones just like deleted subscribers.
// A remote pull must never resurrect a tariff the owner deleted while offline.
// -----------------------------------------------------------------------------
{
  const p = 'src/lib/useGeneratorCloudSync.ts';
  let c = read(p);

  if (!c.includes("deletedTariffs: key('moldatk_deleted_tariffs', generatorId)")) {
    const localKeysMatch = c.match(/    const localKeys = \{[\s\S]*?\n    \};/);
    if (!localKeysMatch) throw new Error('Cloud sync localKeys block not found');
    const patched = localKeysMatch[0].replace(
      /\n    \};$/,
      "\n      deletedTariffs: key('moldatk_deleted_tariffs', generatorId),\n    };"
    );
    c = c.replace(localKeysMatch[0], patched);
  }

  if (!c.includes('deletedTariffs: readLocal<string[]>(localKeys.deletedTariffs, [])')) {
    c = c.replace(
      '      audit: readLocal<AuditLogEntry[]>(localKeys.audit, []),',
      '      audit: readLocal<AuditLogEntry[]>(localKeys.audit, []),\n      deletedTariffs: readLocal<string[]>(localKeys.deletedTariffs, []),'
    );
  }

  if (!c.includes('const deletedTariffIds = readLocal<string[]>(localKeys.deletedTariffs, []);')) {
    const pushStart = c.indexOf('    const push = async () => {');
    const specsNeedle = '        const specs = readLocal<GeneratorSpecs | null>(localKeys.specs, null);';
    const specsAt = c.indexOf(specsNeedle, pushStart);
    if (pushStart < 0 || specsAt < 0) throw new Error('Cloud sync push tariff read insertion point not found');
    c = c.slice(0, specsAt) + '        const deletedTariffIds = readLocal<string[]>(localKeys.deletedTariffs, []);\n' + c.slice(specsAt);
  }

  if (!c.includes("supabase.from('generator_monthly_tariffs').delete().eq('generator_id', generatorId).in('id', deletedTariffIds)")) {
    const adminStart = c.indexOf("        if (session?.role === 'generator_admin') {");
    const tariffsStart = c.indexOf('          if (tariffs.length) {', adminStart);
    if (adminStart < 0 || tariffsStart < 0) throw new Error('Cloud sync tariff push block not found');
    const deletion = `          if (deletedTariffIds.length) {\n            const { error } = await supabase.from('generator_monthly_tariffs').delete().eq('generator_id', generatorId).in('id', deletedTariffIds);\n            if (error) throw error;\n          }\n\n`;
    c = c.slice(0, tariffsStart) + deletion + c.slice(tariffsStart);
  }

  if (!c.includes('writeLocal(localKeys.deletedTariffs, []);')) {
    const pushStart = c.indexOf('    const push = async () => {');
    const pushEnd = c.indexOf('\n\n    const pull = async', pushStart);
    const clearPendingAt = c.indexOf('        clearPendingLocalChanges();', pushStart);
    const lastSnapshotAt = c.indexOf('        lastSnapshot.current = snapshot();', pushStart);
    const insertAt = clearPendingAt >= 0 && clearPendingAt < pushEnd ? clearPendingAt : lastSnapshotAt;
    if (insertAt < 0 || insertAt > pushEnd) throw new Error('Cloud sync tombstone clear insertion point not found');
    const clear = `        if (session?.role === 'generator_admin' && deletedTariffIds.length) {\n          writeLocal(localKeys.deletedTariffs, []);\n        }\n`;
    c = c.slice(0, insertAt) + clear + c.slice(insertAt);
  }

  if (!c.includes('const deletedTariffSet = new Set(readLocal<string[]>(localKeys.deletedTariffs, []));')) {
    const remoteTariffLine = '        const remoteTariffs = (tariffs.data || []).map(rowToTariff);';
    if (!c.includes(remoteTariffLine)) throw new Error('Cloud sync remote tariff merge block not found');
    c = c.replace(
      remoteTariffLine,
      "        const deletedTariffSet = new Set(readLocal<string[]>(localKeys.deletedTariffs, []));\n        const remoteTariffs = (tariffs.data || []).map(rowToTariff).filter(t => !deletedTariffSet.has(t.id));"
    );
  }

  if (!c.includes("deletedTariffs: key('moldatk_deleted_tariffs', generatorId)")) throw new Error('Cloud sync tariff tombstone key missing');
  if (!c.includes('.filter(t => !deletedTariffSet.has(t.id))')) throw new Error('Cloud pull tariff tombstone filter missing');

  write(p, c);
}

console.log('Applied final monthly cycle lifecycle: new-month reset, carried debt, delete-all tariffs, zero live state, and sync tombstones');
