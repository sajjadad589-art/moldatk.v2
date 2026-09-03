import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

// 1) Pricing: allow deleting any saved tariff record, with strong warning.
{
  const p = 'src/components/PricingModal.tsx';
  let c = read(p);
  const start = c.indexOf('  const handleDeleteMonth = (monthId: string) => {');
  const end = start >= 0 ? c.indexOf('\n\n  const handleSave =', start) : -1;
  if (start < 0 || end < 0) throw new Error('Pricing delete handler not found');
  const handler = `  const handleDeleteMonth = (monthId: string) => {\n    if (tariffs.length <= 1) {\n      window.alert('لا يمكن حذف آخر تسعيرة موجودة. أضف تسعيرة أخرى أولاً.');\n      return;\n    }\n    const target = tariffs.find(m => m.id === monthId);\n    if (!target) return;\n    const warning = target.isCurrentActive\n      ? 'تحذير: هذه هي التسعيرة النشطة. حذفها سيجعل أحدث تسعيرة متبقية هي النشطة. الفواتير والتسديدات والديون المحاسبية المحفوظة لن تُحذف. هل تريد المتابعة؟'\n      : 'هل تريد حذف تسعيرة ' + (target.monthNameAr || target.id) + ' من سجل التسعيرات؟ الفواتير والتسديدات والديون التاريخية ستبقى محفوظة.';\n    if (!window.confirm(warning)) return;\n\n    const remaining = tariffs.filter(m => m.id !== monthId);\n    const nextActive = target.isCurrentActive\n      ? [...remaining].sort((a, b) => b.id.localeCompare(a.id))[0]\n      : (remaining.find(m => m.isCurrentActive) || [...remaining].sort((a, b) => b.id.localeCompare(a.id))[0]);\n    const updated = remaining.map(m => ({ ...m, isCurrentActive: m.id === nextActive.id }));\n    setTariffs(updated);\n    setSelectedMonthId(nextActive.id);\n    onSaveMonthlyTariffs(updated, nextActive.id, false);\n  };`;
  c = c.slice(0, start) + handler + c.slice(end);
  c = c.replace('{tariffs.length > 1 && month.isCurrentActive && (', '{tariffs.length > 1 && (');
  c = c.replace('{false && tariffs.length > 1 && !month.isCurrentActive && (', '{tariffs.length > 1 && (');
  c = c.replace('title="مسح تسعيرة الشهر الحالي"', 'title="حذف تسعيرة هذا الشهر"');
  c = c.replace('title="حذف هذا الشهر من السجل"', 'title="حذف تسعيرة هذا الشهر"');
  write(p, c);
}

// 2) Reports: logical annual reset marker. It never destroys debt/invoice source data.
{
  const p = 'src/components/mobile/MobileMonthlyReports.tsx';
  let c = read(p);
  if (!c.includes('RotateCcw,')) c = c.replace('  ShieldCheck,', '  ShieldCheck,\n  RotateCcw,');
  if (!c.includes('reportResetMarkers?:')) {
    c = c.replace(
      '  monthlyTariffs?: MonthlyTariffRecord[];\n}',
      '  monthlyTariffs?: MonthlyTariffRecord[];\n  reportResetMarkers?: Array<{ year: number; resetAt: string }>;\n  onResetYear?: (year: number) => void;\n}'
    );
  }
  c = c.replace(
    '  monthlyTariffs = [],\n}) => {',
    '  monthlyTariffs = [],\n  reportResetMarkers = [],\n  onResetYear,\n}) => {'
  );

  const reportStart = c.indexOf('  const reports = useMemo(() => {');
  const reportEnd = reportStart >= 0 ? c.indexOf('\n\n  const [selectedMonthId', reportStart) : -1;
  if (reportStart < 0 || reportEnd < 0) throw new Error('Reports useMemo block not found');
  const reportBlock = `  const reports = useMemo(() => {\n    const resetMap = new Map<number, number>();\n    for (const marker of reportResetMarkers) {\n      const t = Date.parse(marker.resetAt);\n      if (Number.isFinite(t)) resetMap.set(marker.year, Math.max(resetMap.get(marker.year) || 0, t));\n    }\n    const cleanSubscribers = subscribers.map(sub => ({\n      ...sub,\n      invoicesHistory: (sub.invoicesHistory || []).filter(inv => {\n        const year = Number(String(inv.monthId || '').slice(0, 4));\n        const resetAt = resetMap.get(year);\n        if (!resetAt) return true;\n        const issueAt = Date.parse(inv.issueDate || (inv.monthId + '-01'));\n        return !Number.isFinite(issueAt) || issueAt > resetAt;\n      }),\n    }));\n\n    const map = new Map<string, MonthlyReport>();\n    for (const report of buildMonthlyReports(cleanSubscribers)) map.set(report.monthId, report);\n    for (const tariff of monthlyTariffs) {\n      const resetAt = resetMap.get(Number(tariff.year));\n      const createdAt = Date.parse(tariff.createdAt || (tariff.id + '-01'));\n      if (resetAt && Number.isFinite(createdAt) && createdAt <= resetAt) continue;\n      if (!map.has(tariff.id)) map.set(tariff.id, emptyReportFromTariff(tariff));\n    }\n    return [...map.values()].sort((a, b) => b.monthId.localeCompare(a.monthId));\n  }, [subscribers, monthlyTariffs, reportResetMarkers]);`;
  c = c.slice(0, reportStart) + reportBlock + c.slice(reportEnd);

  const selectEndNeedle = `  const selectMonth = (id: string) => {\n    setSelectedMonthId(id);\n    setOpenList(null);\n  };`;
  if (c.includes(selectEndNeedle) && !c.includes('const resetSelectedYear =')) {
    c = c.replace(selectEndNeedle, selectEndNeedle + `\n\n  const resetSelectedYear = () => {\n    if (!onResetYear) return;\n    const year = Number(String(selected.monthId).slice(0, 4));\n    if (!Number.isFinite(year)) return;\n    if (!window.confirm('تصفير حسابات التقارير لسنة ' + year + '؟ هذا الإجراء يصفر عرض التقارير السنوية فقط ولا يحذف ديون أو فواتير أو تسديدات المشتركين الأصلية.')) return;\n    onResetYear(year);\n    setOpenList(null);\n  };`);
  }

  const afterDataLine = `      <div className="text-center text-[11px] font-bold text-slate-400">\n        البيانات المعروضة تخص <span className="text-blue-400 font-black">{selected.monthNameAr}</span>\n      </div>`;
  if (c.includes(afterDataLine) && !c.includes('تصفير حسابات سنة')) {
    c = c.replace(afterDataLine, afterDataLine + `\n\n      {onResetYear && (\n        <button type="button" onClick={resetSelectedYear} className="w-full h-11 rounded-2xl border border-rose-500/30 bg-rose-500/5 text-rose-300 text-[11px] font-black flex items-center justify-center gap-2">\n          <RotateCcw className="w-4 h-4" />\n          تصفير حسابات سنة {String(selected.monthId).slice(0, 4)} في التقارير\n        </button>\n      )}`);
  }
  write(p, c);
}

// 3) Mobile settings: high-security reset card.
{
  const p = 'src/components/mobile/MobileSettings.tsx';
  let c = read(p);
  if (!c.includes("from '../SecureSystemReset'")) {
    c = c.replace(
      "import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';",
      "import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';\nimport { SecureSystemReset, type SecureResetResult } from '../SecureSystemReset';"
    );
  }
  c = c.replace(
    '  subscriptionLoading?: boolean;\n}',
    '  subscriptionLoading?: boolean;\n  isOwner?: boolean;\n  onSecureReset?: (password: string) => Promise<SecureResetResult>;\n}'
  );
  c = c.replace(
    '  subscriptionLoading = false,\n}) => {',
    '  subscriptionLoading = false,\n  isOwner = false,\n  onSecureReset,\n}) => {'
  );
  const closing = '      </div>\n    </div>\n  );\n};';
  if (c.includes(closing) && !c.includes('<SecureSystemReset')) {
    c = c.replace(closing, `      </div>\n\n      {onSecureReset && (\n        <SecureSystemReset isOwner={isOwner} onResetSystem={onSecureReset} compact />\n      )}\n    </div>\n  );\n};`);
  }
  write(p, c);
}

// 4) Mobile layout: wire tariffs, annual reset, and secure reset.
{
  const p = 'src/components/mobile/MobileLayout.tsx';
  let c = read(p);
  if (!c.includes("from '../SecureSystemReset'")) {
    c = c.replace(
      "import { SubscriptionInfo } from '../SubscriptionStatusUI';",
      "import { SubscriptionInfo } from '../SubscriptionStatusUI';\nimport type { SecureResetResult } from '../SecureSystemReset';"
    );
  }
  c = c.replace('  DeviceViewMode,\n} from', '  DeviceViewMode,\n  MonthlyTariffRecord,\n} from');
  if (!c.includes('reportResetMarkers:')) {
    c = c.replace(
      '  subscriptionLoading?: boolean;\n}',
      '  subscriptionLoading?: boolean;\n  monthlyTariffs: MonthlyTariffRecord[];\n  reportResetMarkers: Array<{ year: number; resetAt: string }>;\n  onResetReportYear: (year: number) => void;\n  isOwner: boolean;\n  onSecureReset: (password: string) => Promise<SecureResetResult>;\n}'
    );
  }
  c = c.replace(
    '  subscriptionLoading = false,\n}) => {',
    '  subscriptionLoading = false,\n  monthlyTariffs,\n  reportResetMarkers,\n  onResetReportYear,\n  isOwner,\n  onSecureReset,\n}) => {'
  );
  c = c.replace(
    '            currency={generatorSpecs.currency || \'د.ع\'}\n          />',
    '            currency={generatorSpecs.currency || \'د.ع\'}\n            monthlyTariffs={monthlyTariffs}\n            reportResetMarkers={reportResetMarkers}\n            onResetYear={isOwner ? onResetReportYear : undefined}\n          />'
  );
  c = c.replace(
    '            subscriptionLoading={subscriptionLoading}\n          />',
    '            subscriptionLoading={subscriptionLoading}\n            isOwner={isOwner}\n            onSecureReset={onSecureReset}\n          />'
  );
  write(p, c);
}

// 5) Cloud sync must stay paused while the full reset is being executed.
{
  const p = 'src/lib/useGeneratorCloudSync.ts';
  let c = read(p);
  if (!c.includes("moldatk_factory_reset_in_progress")) {
    c = c.replace(
      '    const push = async () => {\n      if (!ready.current',
      "    const push = async () => {\n      if (localStorage.getItem(key('moldatk_factory_reset_in_progress', generatorId)) === '1') return;\n      if (!ready.current"
    );
    c = c.replace(
      '    const pull = async (bootstrap = false) => {\n      if (refreshing.current)',
      "    const pull = async (bootstrap = false) => {\n      if (localStorage.getItem(key('moldatk_factory_reset_in_progress', generatorId)) === '1') return;\n      if (refreshing.current)"
    );
  }
  write(p, c);
}

// 6) App handlers: annual report marker + password re-auth + automatic backup + scoped cloud/local reset.
{
  const p = 'src/App.tsx';
  let c = read(p);
  if (!c.includes("from './components/SecureSystemReset'")) {
    c = c.replace(
      "import { FolderDetailModal } from './components/FolderDetailModal';",
      "import { FolderDetailModal } from './components/FolderDetailModal';\nimport type { SecureResetResult } from './components/SecureSystemReset';"
    );
  }

  if (!c.includes('const reportResetMarkers =')) {
    const start = c.indexOf('  const addAuditLog = (entry: any) => {');
    const next = start >= 0 ? c.indexOf('\n\n  const ', start + 10) : -1;
    if (start < 0 || next < 0) throw new Error('addAuditLog insertion point not found');
    const handlers = `\n\n  const reportResetMarkers = auditLogs\n    .filter(log => log.title === 'تصفير تقارير السنة' && log.newValue)\n    .map(log => {\n      try { return JSON.parse(log.newValue || '{}') as { year: number; resetAt: string }; } catch { return null; }\n    })\n    .filter((x): x is { year: number; resetAt: string } => Boolean(x && Number.isFinite(Number(x.year)) && x.resetAt));\n\n  const handleResetReportYear = (year: number) => {\n    if (userSession?.role !== 'generator_admin') {\n      showToast('هذه الصلاحية متاحة لصاحب المولدة فقط');\n      return;\n    }\n    const marker = { year, resetAt: new Date().toISOString() };\n    addAuditLog({\n      category: 'system',\n      title: 'تصفير تقارير السنة',\n      details: 'تم تصفير عرض حسابات التقارير لسنة ' + year + ' بدون حذف الديون أو الفواتير الأصلية',\n      entityName: String(year),\n      newValue: JSON.stringify(marker),\n      actorName: userSession?.username || 'صاحب المولدة',\n    });\n    showToast('تم تصفير حسابات التقارير لسنة ' + year);\n  };\n\n  const handleSecureSystemReset = async (password: string): Promise<SecureResetResult> => {\n    if (userSession?.role !== 'generator_admin' || !userSession.generatorId) {\n      return { ok: false, message: 'هذه العملية متاحة لصاحب المولدة فقط.' };\n    }\n    const generatorId = userSession.generatorId;\n    const markerKey = getStorageKey('moldatk_factory_reset_in_progress');\n\n    try {\n      const { data: userData, error: userError } = await supabase.auth.getUser();\n      if (userError) throw userError;\n      const email = userData.user?.email || userSession.email;\n      if (!email) return { ok: false, message: 'تعذر تحديد بريد حساب صاحب المولدة.' };\n\n      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });\n      if (authError) return { ok: false, message: 'كلمة المرور غير صحيحة. لم يتم حذف أي بيانات.' };\n\n      const backup = {\n        exportedAt: new Date().toISOString(),\n        generatorId,\n        generatorSpecs,\n        subscribers,\n        monthlyTariffs,\n        auditLogs,\n        lines,\n        collectors,\n        invoiceTemplate,\n        walletResetTimestamp,\n      };\n      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });\n      const url = URL.createObjectURL(blob);\n      const a = document.createElement('a');\n      a.href = url;\n      a.download = 'moldatk-backup-before-reset-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';\n      document.body.appendChild(a);\n      a.click();\n      a.remove();\n      window.setTimeout(() => URL.revokeObjectURL(url), 1000);\n\n      localStorage.setItem(markerKey, '1');\n\n      for (const table of ['generator_invoices', 'generator_subscribers', 'generator_lines', 'generator_monthly_tariffs', 'generator_audit_logs', 'generator_settings']) {\n        const { error } = await supabase.from(table).delete().eq('generator_id', generatorId);\n        if (error) throw new Error(table + ': ' + error.message);\n      }\n\n      // Collector application profiles are business access records; remove them when RLS permits it.\n      try { await supabase.from('profiles').delete().eq('generator_id', generatorId).eq('role', 'collector'); } catch {}\n\n      const scopedSuffix = '_' + generatorId;\n      const keysToRemove: string[] = [];\n      for (let i = 0; i < localStorage.length; i += 1) {\n        const k = localStorage.key(i);\n        if (k && k.endsWith(scopedSuffix) && k !== markerKey) keysToRemove.push(k);\n      }\n      keysToRemove.forEach(k => localStorage.removeItem(k));\n\n      setSubscribers([]);\n      setMonthlyTariffs([]);\n      setAuditLogs([]);\n      setLines([]);\n      setCollectors([]);\n      setWalletResetTimestamp('');\n      setGeneratorSpecs(INITIAL_GENERATOR_SPECS);\n      setInvoiceTemplate(INITIAL_INVOICE_TEMPLATE);\n      localStorage.removeItem(markerKey);\n\n      showToast('تم تصفير بيانات النظام بالكامل وإنشاء نسخة احتياطية');\n      window.setTimeout(() => window.location.reload(), 700);\n      return { ok: true };\n    } catch (e: any) {\n      localStorage.removeItem(markerKey);\n      console.error('Secure Moldatk reset failed:', e);\n      return { ok: false, message: 'تعذر إكمال التصفير بأمان: ' + (e?.message || 'خطأ غير معروف') };\n    }\n  };`;
    c = c.slice(0, next) + handlers + c.slice(next);
  }

  // Wire mobile layout props by inserting them before the first MobileLayout closing tag.
  if (!c.includes('onSecureReset={handleSecureSystemReset}')) {
    const mobileStart = c.indexOf('        <MobileLayout');
    const mobileEnd = mobileStart >= 0 ? c.indexOf('        />', mobileStart) : -1;
    if (mobileStart < 0 || mobileEnd < 0) throw new Error('MobileLayout render not found');
    const props = `          monthlyTariffs={monthlyTariffs}\n          reportResetMarkers={reportResetMarkers}\n          onResetReportYear={handleResetReportYear}\n          isOwner={userSession?.role === 'generator_admin'}\n          onSecureReset={handleSecureSystemReset}\n`;
    c = c.slice(0, mobileEnd) + props + c.slice(mobileEnd);
  }

  // Desktop reports use the same report component and same annual reset markers.
  c = c.replace(
    '                monthlyTariffs={monthlyTariffs}\n              />',
    `                monthlyTariffs={monthlyTariffs}\n                reportResetMarkers={reportResetMarkers}\n                onResetYear={userSession?.role === 'generator_admin' ? handleResetReportYear : undefined}\n              />`
  );

  write(p, c);
}

console.log('Applied secure destructive controls: annual report reset, delete-any-tariff, owner re-auth, 10s guard, auto-backup, and scoped full reset');
