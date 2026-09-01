import fs from 'node:fs';

const load = p => fs.readFileSync(p, 'utf8');
const save = (p, c) => fs.writeFileSync(p, c);
const patch = (c, from, to, label, optional = false) => {
  if (!c.includes(from)) {
    if (optional) { console.log(`skip ${label}`); return c; }
    throw new Error(`Missing patch marker: ${label}`);
  }
  console.log(`patched ${label}`);
  return c.replace(from, to);
};

// Super Admin responsive on Android/mobile.
{
  const p = 'src/components/SuperAdminDashboard.tsx';
  let c = load(p);
  c = patch(c,
    'className="min-h-screen bg-slate-100 text-slate-900 font-[\'Cairo\',sans-serif] min-w-[1100px]"',
    'className="min-h-screen bg-slate-100 text-slate-900 font-[\'Cairo\',sans-serif] min-w-0 overflow-x-hidden"',
    'super admin remove forced desktop width', true);
  c = patch(c,
    'className="h-20 bg-[#0b1530] text-white flex items-center justify-between px-8 shadow-lg"',
    'className="bg-[#0b1530] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-8 py-4 sm:py-3 shadow-lg"',
    'super admin responsive header', true);
  c = patch(c,
    '<div className="flex max-w-[1700px] mx-auto">',
    '<div className="flex flex-col lg:flex-row max-w-[1700px] mx-auto">',
    'super admin responsive shell', true);
  c = patch(c,
    '<aside className="w-64 p-5 shrink-0">',
    '<aside className="w-full lg:w-64 p-3 sm:p-5 shrink-0">',
    'super admin responsive aside', true);
  c = patch(c,
    'className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm sticky top-5"',
    'className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm lg:sticky lg:top-5 flex lg:block gap-1 overflow-x-auto"',
    'super admin mobile horizontal nav', true);
  c = patch(c,
    '<main className="p-5 pl-8 flex-1 min-w-0">',
    '<main className="p-3 sm:p-5 lg:pl-8 flex-1 min-w-0 overflow-x-hidden">',
    'super admin responsive main', true);
  c = c.replaceAll('grid grid-cols-4 gap-5', 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-5');
  c = c.replaceAll('grid grid-cols-3 gap-5', 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5');
  c = c.replaceAll('grid grid-cols-[420px_1fr] gap-5', 'grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5');
  c = c.replaceAll('<table className="w-full text-sm">', '<table className="w-full min-w-[760px] text-sm">');
  save(p, c);
}

// Mobile dashboard: replace electrical engineering cards with the cashbox/revenue card.
{
  const p = 'src/components/mobile/MobileDashboard.tsx';
  let c = load(p);
  c = patch(c,
    '  onNavigateToTab: (tab: string) => void;\n}',
    '  onNavigateToTab: (tab: string) => void;\n  cashboxAmount?: number;\n}',
    'mobile dashboard cashbox prop', true);
  c = patch(c,
    '  onOpenNewSubscriberModal,\n  onNavigateToTab,\n}) => {',
    '  onOpenNewSubscriberModal,\n  onNavigateToTab,\n  cashboxAmount = 0,\n}) => {',
    'mobile dashboard cashbox argument', true);
  const start = c.indexOf('      {/* 4. Active Electrical Load Summary Card */}');
  if (start !== -1) {
    const endMarker = '    </div>\n  );\n};';
    const end = c.lastIndexOf(endMarker);
    if (end === -1 || end <= start) throw new Error('Could not locate MobileDashboard ending');
    const replacement = `      {/* 4. Cashbox / financial revenue */}\n      <button\n        type="button"\n        onClick={() => onNavigateToTab('wallet')}\n        className="w-full p-4 rounded-2xl bg-white dark:bg-[#111c38] border border-emerald-200 dark:border-emerald-900/60 shadow-xs text-right active:scale-[0.99] transition-all"\n      >\n        <div className="flex items-center justify-between gap-3">\n          <div className="flex items-center gap-3 min-w-0">\n            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">\n              <DollarSign className="w-5 h-5" />\n            </div>\n            <div className="min-w-0">\n              <h3 className="text-sm font-black text-slate-900 dark:text-white">القاصة</h3>\n              <p className="text-[10px] text-slate-400 mt-0.5">الإيرادات والحركات المالية الحالية</p>\n            </div>\n          </div>\n          <div className="text-left shrink-0">\n            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums block">{formatCurrency(cashboxAmount)}</span>\n            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">فتح القاصة</span>\n          </div>\n        </div>\n      </button>\n\n`;
    c = c.slice(0, start) + replacement + c.slice(end);
    console.log('patched mobile dashboard financial cards');
  }
  save(p, c);
}

// Mobile layout: provide a real cashbox screen on phones.
{
  const p = 'src/components/mobile/MobileLayout.tsx';
  let c = load(p);
  if (!c.includes("import { WalletView } from '../WalletView';")) {
    c = c.replace("import { MobileBottomNav } from '../MobileBottomNav';", "import { MobileBottomNav } from '../MobileBottomNav';\nimport { WalletView } from '../WalletView';");
  }
  c = patch(c,
    '  DeviceViewMode,\n} from \'../../types\';',
    '  DeviceViewMode,\n  Collector,\n  AuditLogEntry,\n} from \'../../types\';',
    'mobile layout finance types', true);
  c = patch(c,
    '  subscriptionLoading?: boolean;\n}',
    '  subscriptionLoading?: boolean;\n  collectors?: Collector[];\n  auditLogs?: AuditLogEntry[];\n  walletResetTimestamp?: string;\n  onClearWalletLogs?: () => void;\n}',
    'mobile layout wallet props', true);
  c = patch(c,
    '  subscriptionInfo = null,\n  subscriptionLoading = false,\n}) => {',
    '  subscriptionInfo = null,\n  subscriptionLoading = false,\n  collectors = [],\n  auditLogs = [],\n  walletResetTimestamp,\n  onClearWalletLogs,\n}) => {',
    'mobile layout wallet args', true);
  c = patch(c,
    '            onNavigateToTab={onTabChange}\n          />',
    '            onNavigateToTab={onTabChange}\n            cashboxAmount={auditLogs.filter(log => { const reset = walletResetTimestamp ? new Date(walletResetTimestamp).getTime() : 0; return log.category === \'payment\' && (!reset || new Date(log.timestamp).getTime() >= reset); }).reduce((sum, log) => sum + (Number(log.amount) || 0), 0)}\n          />',
    'mobile dashboard cashbox amount', true);
  if (!c.includes("activeTab === 'wallet'")) {
    c = c.replace(
      "        {activeTab === 'monitor' && (",
      "        {activeTab === 'wallet' && (\n          <div className=\"p-3.5 pb-24\">\n            <WalletView\n              subscribers={subscribers}\n              collectors={collectors}\n              auditLogs={auditLogs}\n              walletResetTimestamp={walletResetTimestamp}\n              currency={generatorSpecs.currency}\n              onBack={() => onTabChange('dashboard')}\n              onClearWalletLogs={onClearWalletLogs}\n            />\n          </div>\n        )}\n\n        {activeTab === 'monitor' && ("
    );
  }
  save(p, c);
}

// Collector card: remove code, phone and cabinet/line from compact subscriber row.
{
  const p = 'src/components/POSQuickView.tsx';
  let c = load(p);
  const old = `                  <div className="space-y-1.5 pr-2">\n                    <div className="flex items-center gap-2.5">\n                      <span className="text-sm font-black text-white group-hover:text-blue-300 transition-colors">{sub.fullName}</span>\n                      <span className="text-[10px] font-mono bg-blue-950 text-blue-300 px-2.5 py-0.5 rounded-lg border border-blue-800/40">\n                        كود : {sub.subscriberCode || 'MW-000'}\n                      </span>\n                    </div>\n\n                    <div className="flex items-center gap-3 text-xs text-slate-400">\n                      <span className="flex items-center gap-1">\n                        <MapPin className="w-3.5 h-3.5 text-blue-400" />\n                        <span>{lineObj ? lineObj.name : 'الخط الرئيسي'}</span>\n                      </span>\n                      <span>•</span>\n                      <span className="flex items-center gap-1">\n                        <Zap className="w-3.5 h-3.5 text-amber-400" />\n                        <span>{sub.amperes} أمبير</span>\n                      </span>\n                      {sub.phone && (\n                        <>\n                          <span>•</span>\n                          <span className="font-mono">{sub.phone}</span>\n                        </>\n                      )}\n                    </div>\n                  </div>`;
  const fresh = `                  <div className="space-y-1.5 pr-2 min-w-0">\n                    <span className="text-sm font-black text-white group-hover:text-blue-300 transition-colors block truncate">{sub.fullName}</span>\n                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">\n                      <Zap className="w-3.5 h-3.5 text-amber-400" />\n                      <span>{sub.amperes} أمبير</span>\n                    </span>\n                  </div>`;
  c = patch(c, old, fresh, 'collector compact subscriber card', true);
  c = c.replace('className="relative overflow-hidden flex items-center justify-between p-4.5 rounded-3xl', 'className="relative overflow-hidden flex items-center justify-between gap-2 p-3.5 sm:p-4 rounded-3xl');
  c = c.replace('className="flex items-center gap-4"', 'className="flex items-center gap-2 sm:gap-4 shrink-0"');
  save(p, c);
}

// Cabinet add button: immediate local response + persistence and valid line shape.
{
  const p = 'src/components/FolderDetailModal.tsx';
  let c = load(p);
  const start = c.indexOf('  const handleAddLine = () => {');
  const end = c.indexOf('\n\n  const handleDeleteLine', start);
  if (start !== -1 && end !== -1) {
    const fresh = `  const handleAddLine = () => {\n    const index = currentLines.length + 1;\n    const newLine: LineDistribution = {\n      id: \`line-\${Date.now()}\`,\n      name: \`كابينة \${index}\`,\n      zone: '',\n      phaseType: 'single-phase',\n      phaseNameAr: 'فيز أحادي (220V)',\n      maxCapacityAmperes: 0,\n      currentLoadAmperes: 0,\n      subscribersCount: 0,\n      technicianName: '',\n      breakerNumber: '',\n    };\n    const next = [...currentLines, newLine];\n    setCurrentLines(next);\n    onUpdateLines(next);\n  };`;
    c = c.slice(0, start) + fresh + c.slice(end);
    console.log('patched cabinet immediate add');
  }
  c = c.replace('onClick={handleAddLine}\n                  className=', 'type="button"\n                  onClick={handleAddLine}\n                  className=');
  c = c.replace('<span>إضافة خط وقاطع جديد</span>', '<span>إضافة كابينة</span>');
  save(p, c);
}

// Old settings cabinet list also receives a valid LineDistribution object.
{
  const p = 'src/components/SettingsFolderView.tsx';
  let c = load(p);
  c = patch(c,
    "      { id: `line-${Date.now()}`, name: newName, loadAmps: 0, subscribersCount: 0 }",
    "      { id: `line-${Date.now()}`, name: newName, zone: '', phaseType: 'single-phase', phaseNameAr: 'فيز أحادي (220V)', maxCapacityAmperes: 0, currentLoadAmperes: 0, subscribersCount: 0, technicianName: '', breakerNumber: '' }",
    'legacy cabinet valid shape', true);
  save(p, c);
}

// Cloud sync deletion tombstones: a deleted subscriber must never be pulled back from Supabase.
{
  const p = 'src/lib/useGeneratorCloudSync.ts';
  let c = load(p);
  c = patch(c,
    "      audit: key('moldatk_audit_logs', generatorId),\n    };",
    "      audit: key('moldatk_audit_logs', generatorId),\n      deletedSubscribers: key('moldatk_deleted_subscribers', generatorId),\n    };",
    'sync deleted subscriber key', true);
  c = patch(c,
    "      audit: readLocal<AuditLogEntry[]>(localKeys.audit, []),\n    });",
    "      audit: readLocal<AuditLogEntry[]>(localKeys.audit, []),\n      deletedSubscribers: readLocal<string[]>(localKeys.deletedSubscribers, []),\n    });",
    'sync tombstone snapshot', true);
  c = patch(c,
    "        const audit = readLocal<AuditLogEntry[]>(localKeys.audit, []);\n        const invoices = subscribers.flatMap(s => s.invoicesHistory || []);",
    "        const audit = readLocal<AuditLogEntry[]>(localKeys.audit, []);\n        const deletedSubscribers = readLocal<string[]>(localKeys.deletedSubscribers, []);\n        const invoices = subscribers.flatMap(s => s.invoicesHistory || []);\n\n        if (deletedSubscribers.length) {\n          const { error: invoiceDeleteError } = await supabase.from('generator_invoices').delete().eq('generator_id', generatorId).in('subscriber_id', deletedSubscribers);\n          if (invoiceDeleteError) throw invoiceDeleteError;\n          const { error: subscriberDeleteError } = await supabase.from('generator_subscribers').delete().eq('generator_id', generatorId).in('id', deletedSubscribers);\n          if (subscriberDeleteError) throw subscriberDeleteError;\n          writeLocal(localKeys.deletedSubscribers, []);\n        }",
    'sync process subscriber tombstones', true);
  const tombstoneDecl = "        const deletedSubscribers = new Set(readLocal<string[]>(localKeys.deletedSubscribers, []));";
  if (!c.includes(tombstoneDecl)) {
    c = patch(c,
      "        const localAudit = readLocal<AuditLogEntry[]>(localKeys.audit, []);",
      "        const localAudit = readLocal<AuditLogEntry[]>(localKeys.audit, []);\n" + tombstoneDecl,
      'sync pull tombstone set', true);
  } else {
    console.log('skip sync pull tombstone set');
  }
  c = patch(c,
    "        const subscribers = (subsData || []).map((row: any) => {",
    "        const subscribers = (subsData || []).filter((row: any) => !deletedSubscribers.has(row.id)).map((row: any) => {",
    'sync filter deleted subscribers', true);
  save(p, c);
}

// App-level deletion: record the tombstone before removing locally.
{
  const p = 'src/App.tsx';
  let c = load(p);
  const old = `  const handleDeleteSubscriber = (id: string) => {\n    setSubscribers(prev => prev.filter(s => s.id !== id));\n  };`;
  const fresh = `  const handleDeleteSubscriber = (id: string) => {\n    if (userSession?.generatorId) {\n      const key = \`moldatk_deleted_subscribers:\${userSession.generatorId}\`;\n      try {\n        const current = JSON.parse(localStorage.getItem(key) || '[]') as string[];\n        if (!current.includes(id)) localStorage.setItem(key, JSON.stringify([...current, id]));\n      } catch {\n        localStorage.setItem(key, JSON.stringify([id]));\n      }\n    }\n    setSubscribers(prev => prev.filter(s => s.id !== id));\n  };`;
  c = patch(c, old, fresh, 'subscriber deletion tombstone', true);
  save(p, c);
}

console.log('Requested mobile/owner fixes applied.');