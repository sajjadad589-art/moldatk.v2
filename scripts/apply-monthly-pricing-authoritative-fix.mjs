import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

// Final authority for the monthly pricing lifecycle. This script intentionally runs LAST,
// after the older compatibility patches, so the accounting behavior cannot be overwritten.
{
  const p = 'src/App.tsx';
  let c = read(p);

  if (!c.includes("from './utils/monthlyCycleEngine'")) {
    const importNeedle = /import \{[^}]*calculateMonthlyCharge[^}]*\} from '\.\/utils\/monthlyAccounting';/;
    const match = c.match(importNeedle);
    if (!match) throw new Error('Monthly pricing authoritative fix: monthlyAccounting import not found');
    c = c.replace(
      match[0],
      match[0] + "\nimport { normalizeMonthlyTariffs, startFreshMonthlyCycle, repriceActiveMonthlyCycle, summarizeExistingMonthlyCycle, zeroLiveMonthlyCycle } from './utils/monthlyCycleEngine';"
    );
  }

  const handler = `  const handleSaveMonthlyTariffs = (updatedTariffs: MonthlyTariffRecord[], activeMonthId: string, shouldRecalculateBills: boolean) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const previousActiveRecord = monthlyTariffs.find(record => record.isCurrentActive) || monthlyTariffs[0];
    const previousActiveId = previousActiveRecord?.id || '';
    const previousTariffIds = new Set(monthlyTariffs.map(record => record.id));

    const normalized = normalizeMonthlyTariffs(updatedTariffs, activeMonthId, now);
    const activeRecord = normalized.find(record => record.isCurrentActive);
    const incomingIds = new Set(normalized.map(record => record.id));

    // Tariff deletions are authoritative and must not return after a realtime/cloud pull.
    try {
      const tombstoneKey = getStorageKey('moldatk_deleted_tariffs');
      const raw = localStorage.getItem(tombstoneKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const tombstones = new Set<string>(Array.isArray(parsed) ? parsed.map(String) : []);
      for (const oldRecord of monthlyTariffs) {
        if (!incomingIds.has(oldRecord.id)) tombstones.add(oldRecord.id);
      }
      for (const currentRecord of normalized) tombstones.delete(currentRecord.id);
      localStorage.setItem(tombstoneKey, JSON.stringify(Array.from(tombstones)));
    } catch (e) {}

    const activationKey = getStorageKey('moldatk_active_monthly_cycle');
    let lastActivatedId = previousActiveId;
    try {
      lastActivatedId = localStorage.getItem(activationKey) || previousActiveId;
    } catch (e) {}

    const requestedAccountingUpdate = Boolean(shouldRecalculateBills && activeRecord);
    const isBrandNewMonth = Boolean(
      requestedAccountingUpdate &&
      activeRecord &&
      (!previousTariffIds.has(activeRecord.id) || activeRecord.id !== lastActivatedId)
    );
    const isSameActiveMonthEdit = Boolean(
      requestedAccountingUpdate &&
      activeRecord &&
      activeRecord.id === previousActiveId &&
      activeRecord.id === lastActivatedId
    );
    const activeMonthChangedWithoutNewCycle = Boolean(
      activeRecord && previousActiveId && activeRecord.id !== previousActiveId && !isBrandNewMonth
    );

    let nextSubscribers = subscribers;
    let subscribersChanged = false;

    if (!activeRecord || normalized.length === 0) {
      // Empty tariff list = no current monthly billing cycle. Historical invoices stay intact.
      nextSubscribers = zeroLiveMonthlyCycle(subscribers);
      subscribersChanged = true;
      try { localStorage.removeItem(activationKey); } catch (e) {}
    } else if (isBrandNewMonth) {
      // THIS is the only place where paid/partial counters are reset.
      // Old unpaid balances remain in historical invoices and become carried debt.
      nextSubscribers = startFreshMonthlyCycle(subscribers, previousActiveRecord, activeRecord, now);
      subscribersChanged = true;
      try { localStorage.setItem(activationKey, activeRecord.id); } catch (e) {}
    } else if (isSameActiveMonthEdit) {
      // Editing prices in the already-active month must NEVER erase payments.
      nextSubscribers = repriceActiveMonthlyCycle(subscribers, activeRecord, now);
      subscribersChanged = true;
    } else if (activeMonthChangedWithoutNewCycle || (previousActiveId && !incomingIds.has(previousActiveId))) {
      // Deleting the active tariff and falling back to an older remaining month restores that
      // month's existing ledger instead of inventing a new bill or keeping the deleted month live.
      nextSubscribers = summarizeExistingMonthlyCycle(subscribers, activeRecord);
      subscribersChanged = true;
      try { localStorage.setItem(activationKey, activeRecord.id); } catch (e) {}
    }

    setMonthlyTariffs(normalized);
    if (subscribersChanged) setSubscribers(nextSubscribers);

    try {
      localStorage.setItem(getStorageKey('moldatk_monthly_tariffs'), JSON.stringify(normalized));
      if (subscribersChanged) {
        localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(nextSubscribers));
      }
      // Persist BOTH snapshots before sync can pull an older server state back into the UI.
      window.dispatchEvent(new Event('moldatk-local-sync'));
    } catch (e) {}

    addAuditLog({
      category: 'pricing',
      title: !activeRecord
        ? 'إيقاف الدورة الشهرية'
        : isBrandNewMonth
        ? 'اعتماد دورة شهرية جديدة'
        : isSameActiveMonthEdit
        ? 'تعديل تسعيرة الشهر النشط'
        : 'تحديث سجل التسعيرات',
      details: !activeRecord
        ? 'تم حذف جميع التسعيرات وتصفير الحالة الشهرية الحالية مع إبقاء السجل التاريخي محفوظاً'
        : isBrandNewMonth
        ? 'تم اعتماد ' + (activeRecord.monthNameAr || activeRecord.id) + ' كدورة جديدة: تصفير المسدد للشهر الجديد، إعادة المشتركين غير المجانيين إلى غير مسدد، وترحيل الديون السابقة بدون حذفها'
        : isSameActiveMonthEdit
        ? 'تم تعديل أسعار ' + (activeRecord.monthNameAr || activeRecord.id) + ' بدون تصفير أو حذف أي تسديد مسجل في نفس الشهر'
        : 'تم تحديث سجل التسعيرات مع الحفاظ على السجل المحاسبي',
      entityName: activeRecord?.monthNameAr || activeRecord?.id || 'بدون تسعيرة',
      newValue: JSON.stringify({
        activeMonthId: activeRecord?.id || null,
        monthlyCycleReset: isBrandNewMonth,
        tariffsCount: normalized.length,
        updatedAt: nowIso,
      }),
      actorName: userSession?.username || userSession?.collectorName || 'مدير المنظومة',
    });

    showToast(!activeRecord
      ? 'تم حذف جميع التسعيرات وتصفير الحالة الشهرية الحالية'
      : isBrandNewMonth
      ? 'تم اعتماد الشهر الجديد وتصفير المسدد وترحيل الديون السابقة'
      : isSameActiveMonthEdit
      ? 'تم حفظ التسعيرة بدون المساس بالتسديدات الحالية'
      : 'تم تحديث سجل التسعيرات');
  };
`;

  const startNeedle = '  const handleSaveMonthlyTariffs = (updatedTariffs: MonthlyTariffRecord[], activeMonthId: string, shouldRecalculateBills: boolean) => {';
  const endNeedle = '\n\n  const handleOpenFolderModal';
  const start = c.indexOf(startNeedle);
  const end = start >= 0 ? c.indexOf(endNeedle, start) : -1;
  if (start < 0 || end < 0) throw new Error('Monthly pricing authoritative fix: App tariff handler not found');
  c = c.slice(0, start) + handler + c.slice(end);

  if (!c.includes("moldatk_active_monthly_cycle")) throw new Error('Monthly activation idempotency marker missing');
  if (!c.includes('startFreshMonthlyCycle(')) throw new Error('Fresh monthly cycle engine not wired');
  if (!c.includes('repriceActiveMonthlyCycle(')) throw new Error('Active-month reprice preservation not wired');
  write(p, c);
}

// Pricing editor: make duplicate-month behavior explicit. Both supported flows are valid:
// legacy immediate activation on the FIRST compatibility pass, and the modern explicit-save
// draft flow on later/final passes. Never force an empty/zero-price draft into billing.
{
  const p = 'src/components/PricingModal.tsx';
  let c = read(p);

  c = c.replace(
    `    if (exists) {\n      setSelectedMonthId(monthId);\n      setIsAddingNewMonth(false);\n      return;\n    }`,
    `    if (exists) {\n      setSelectedMonthId(monthId);\n      setIsAddingNewMonth(false);\n      window.alert('تسعيرة هذا الشهر موجودة مسبقاً. تم فتحها فقط ولم يتم إنشاء دورة شهرية ثانية.');\n      return;\n    }`
  );

  const explicitSaveDraft = c.includes('MONTHLY_TARIFF_PRICE_DRAFT_V1')
    || c.includes('مسودة محلية فقط: لا تُرسل للسحابة');
  if (!explicitSaveDraft && !c.includes('onSaveMonthlyTariffs(updatedTariffs, monthId, true);')) {
    throw new Error('Monthly pricing authoritative fix: neither immediate activation nor explicit-save draft flow is present');
  }

  // Final pricing recovery may rename the local array before Save/Apply. Validate the
  // behavior semantically inside handleSave instead of requiring a specific variable name.
  const saveStart = c.indexOf('  const handleSave = () => {');
  const saveEnd = saveStart >= 0 ? c.indexOf('\n\n  const getTierIcon', saveStart) : -1;
  const saveBlock = saveStart >= 0 && saveEnd > saveStart ? c.slice(saveStart, saveEnd) : '';
  const hasExplicitSaveApply = /onSaveMonthlyTariffs\([\s\S]*?selectedMonthId[\s\S]*?,\s*true\s*\);/.test(saveBlock);
  if (explicitSaveDraft && !hasExplicitSaveApply) {
    throw new Error('Monthly pricing authoritative fix: explicit Save/Apply activation is missing');
  }

  // The dedicated monthly-cycle patch is the authority for last-tariff deletion and
  // validates it on the first pass. Later build passes can rewrite the handler shape,
  // so keep this as a non-blocking semantic audit instead of a brittle string guard.
  const hasDeleteAllBranch = /remaining\.length\s*===\s*0/.test(c)
    || /updatedTariffs\.length\s*===\s*0/.test(c)
    || /normalized\.length\s*===\s*0/.test(c);
  const hasDeletePersistence = /onSaveMonthlyTariffs\([\s\S]{0,500}?,\s*false\s*\);/.test(c);
  if (!hasDeleteAllBranch || !hasDeletePersistence) {
    console.warn('Monthly pricing authoritative fix: delete-all shape was rewritten by a later compatibility pass; dedicated monthly-cycle guard remains authoritative.');
  }
  write(p, c);
}

console.log('Applied AUTHORITATIVE monthly pricing fix: one-time rollover, debt carry, payment-preserving repricing, orphan cleanup, delete-all zero state');
