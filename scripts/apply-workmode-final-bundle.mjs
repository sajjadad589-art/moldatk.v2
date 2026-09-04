import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);

const replaceOnce = (content, from, to, label) => {
  if (!content.includes(from)) {
    console.warn('skip:', label);
    return content;
  }
  return content.replace(from, to);
};

const replaceNth = (content, from, to, nth, label) => {
  let index = -1;
  let start = 0;
  for (let i = 0; i < nth; i += 1) {
    index = content.indexOf(from, start);
    if (index === -1) {
      console.warn('skip:', label);
      return content;
    }
    start = index + from.length;
  }
  return content.slice(0, index) + to + content.slice(index + from.length);
};

const marker = 'WORKMODE_FINAL_MOBILE_UX_BUNDLE_V1';

// 1) Browser PWA meta warning.
{
  const path = 'index.html';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('name="mobile-web-app-capable"')) {
      c = c.replace('    <meta name="apple-mobile-web-app-capable" content="yes" />', '    <meta name="mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />');
      write(path, c);
      console.log('patched mobile-web-app-capable meta');
    }
  }
}

// 2) Theme CSS variables and light premium palettes.
{
  const path = 'src/index.css';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes(marker)) {
      c += `\n\n/* ${marker}: premium mobile themes */\n:root {\n  --moldatk-bg: #f3fbfc;\n  --moldatk-card: rgba(255,255,255,.92);\n  --moldatk-primary: #0f6f78;\n  --moldatk-primary-2: #15a7ad;\n  --moldatk-accent: #d4af37;\n  --moldatk-ink: #0f2430;\n}\n[data-moldatk-theme=\"ocean-calm\"] { --moldatk-bg:#eefbfc; --moldatk-card:#ffffff; --moldatk-primary:#0f6f78; --moldatk-primary-2:#16a3a8; --moldatk-accent:#d9a441; --moldatk-ink:#0e2a37; }\n[data-moldatk-theme=\"green-comfort\"] { --moldatk-bg:#f1fbf4; --moldatk-card:#ffffff; --moldatk-primary:#1f7a4c; --moldatk-primary-2:#37a86d; --moldatk-accent:#c7a34a; --moldatk-ink:#173426; }\n[data-moldatk-theme=\"soft-gold\"] { --moldatk-bg:#fff8ea; --moldatk-card:#fffdf7; --moldatk-primary:#8b641f; --moldatk-primary-2:#c89335; --moldatk-accent:#d4af37; --moldatk-ink:#382a12; }\n[data-moldatk-theme=\"light-metal\"] { --moldatk-bg:#f7f8fa; --moldatk-card:#ffffff; --moldatk-primary:#64748b; --moldatk-primary-2:#94a3b8; --moldatk-accent:#b68b5e; --moldatk-ink:#1f2937; }\n[data-moldatk-theme=\"official-dark\"] { --moldatk-bg:#07101f; --moldatk-card:#101a2d; --moldatk-primary:#0f6f78; --moldatk-primary-2:#0ea5e9; --moldatk-accent:#d4af37; --moldatk-ink:#f8fafc; }\n.moldatk-mobile-shell { background: radial-gradient(circle at top, color-mix(in srgb, var(--moldatk-primary-2) 18%, transparent), transparent 34%), var(--moldatk-bg) !important; color: var(--moldatk-ink); }\n.moldatk-mobile-shell .theme-card { background: var(--moldatk-card); border-color: color-mix(in srgb, var(--moldatk-primary) 20%, transparent); }\n.moldatk-mobile-shell .theme-primary { background: linear-gradient(135deg, var(--moldatk-primary), var(--moldatk-primary-2)); color:white; }\n.moldatk-mobile-shell .theme-text { color: var(--moldatk-primary); }\n`;
      write(path, c);
      console.log('patched premium theme css');
    }
  }
}

// 3) Supabase client: recover expired sessions more quietly and avoid stuck stale auth.
{
  const path = 'src/lib/supabase.ts';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('safeSupabaseFetch')) {
      c = c.replace(
        "export const supabase = createClient(supabaseUrl, supabasePublishableKey, {\n  auth: {",
        "const safeSupabaseFetch: typeof fetch = async (input, init) => {\n  const response = await fetch(input as any, init as any);\n  try {\n    const url = typeof input === 'string' ? input : String((input as Request)?.url || '');\n    if ((response.status === 401 || response.status === 403) && (url.includes('/auth/v1/user') || url.includes('/settings'))) {\n      localStorage.removeItem('moldatk_session');\n      window.dispatchEvent(new CustomEvent('moldatk-auth-expired'));\n    }\n  } catch (e) {}\n  return response;\n};\n\nexport const supabase = createClient(supabaseUrl, supabasePublishableKey, {\n  global: { fetch: safeSupabaseFetch },\n  auth: {"
      );
      write(path, c);
      console.log('patched safe supabase auth recovery');
    }
  }
}

// 4) Cloud sync: never let a fresh local edit be overwritten by an old pull.
{
  const path = 'src/lib/useGeneratorCloudSync.ts';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('WORKMODE_RECENT_LOCAL_WRITE_GUARD')) {
      c = replaceOnce(
        c,
        "const key = (base: string, generatorId: string) => `${base}_${generatorId}`;",
        "const key = (base: string, generatorId: string) => `${base}_${generatorId}`;\nconst recentWriteKey = (generatorId: string) => key('moldatk_last_local_write', generatorId);",
        'add recent write key'
      );
      c = replaceOnce(
        c,
        "    const pull = async (bootstrap = false) => {\n      if (refreshing.current) return;",
        "    const pull = async (bootstrap = false) => {\n      // WORKMODE_RECENT_LOCAL_WRITE_GUARD: do not overwrite a just-saved edit with older cloud data.\n      const recentLocalWriteAt = Number(localStorage.getItem(recentWriteKey(generatorId)) || 0);\n      if (!bootstrap && recentLocalWriteAt && Date.now() - recentLocalWriteAt < 10000) return;\n      if (refreshing.current) return;",
        'add recent local write guard'
      );
      write(path, c);
      console.log('patched cloud sync local-first guard');
    }
  }
}

// 5) Folder lines/cabinets: delete immediately and persist immediately.
{
  const path = 'src/components/FolderDetailModal.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('WORKMODE_IMMEDIATE_LINE_DELETE')) {
      c = replaceOnce(
        c,
        "  const handleDeleteLine = (id: string) => {\n    if (currentLines.length <= 1) return;\n    setCurrentLines(currentLines.filter(l => l.id !== id));\n  };",
        "  const handleDeleteLine = (id: string) => {\n    // WORKMODE_IMMEDIATE_LINE_DELETE\n    if (currentLines.length <= 1) return;\n    if (!window.confirm('هل تريد حذف هذه الكابينة؟')) return;\n    const updated = currentLines.filter(l => l.id !== id);\n    setCurrentLines(updated);\n    onUpdateLines(updated);\n    setSaved(true);\n    window.setTimeout(() => setSaved(false), 900);\n  };",
        'line delete immediate'
      );
      write(path, c);
      console.log('patched immediate cabinet deletion');
    }
  }
}

// 6) Subscriber modal: deletion confirmation that deletes directly, without requiring save.
{
  const path = 'src/components/SubscriberModal.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('WORKMODE_DIRECT_SUBSCRIBER_DELETE_CONFIRM')) {
      c = replaceOnce(
        c,
        "        {isConfirmUnpaidOpen && (",
        "        {isConfirmDeleteOpen && subscriberToEdit && (\n          <div className=\"absolute inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4 rounded-3xl\">\n            <div className=\"bg-white dark:bg-[#131E38] border border-rose-500/30 rounded-2xl p-6 w-full max-w-sm space-y-4 text-center\">\n              <AlertTriangle className=\"w-9 h-9 mx-auto text-rose-500\" />\n              <h4 className=\"text-sm font-black text-slate-900 dark:text-white\">حذف المشترك</h4>\n              <p className=\"text-xs text-slate-600 dark:text-slate-300 leading-6\">هل أنت متأكد من حذف المشترك <b>{subscriberToEdit.fullName}</b>؟ لا يمكن التراجع عن هذه العملية.</p>\n              <div className=\"flex gap-2\">\n                <button type=\"button\" onClick={() => setIsConfirmDeleteOpen(false)} className=\"flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer\">إلغاء</button>\n                <button type=\"button\" onClick={() => { onDeleteSubscriber(subscriberToEdit.id); setIsConfirmDeleteOpen(false); onClose(); }} className=\"flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-black cursor-pointer\">نعم، احذف</button>\n              </div>\n            </div>\n          </div>\n        )}\n\n        {isConfirmUnpaidOpen && (",
        'subscriber delete confirmation modal'
      );
      write(path, c);
      console.log('patched subscriber delete confirmation');
    }
  }
}

// 7) Mobile dashboard card taps pass correct filter to subscribers page.
{
  const path = 'src/components/mobile/MobileDashboard.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('WORKMODE_DASHBOARD_STATUS_FILTER')) {
      const oldClick = "onClick={() => onNavigateToTab('subscribers')}";
      const paidClick = "onClick={() => { try { localStorage.setItem('moldatk_mobile_subscribers_filter', 'paid'); } catch (e) {} onNavigateToTab('subscribers'); }}";
      const unpaidClick = "onClick={() => { try { localStorage.setItem('moldatk_mobile_subscribers_filter', 'unpaid'); } catch (e) {} onNavigateToTab('subscribers'); }}";
      c = replaceNth(c, oldClick, paidClick, 1, 'paid card filter');
      c = replaceNth(c, oldClick, unpaidClick, 1, 'unpaid card filter');
      c = `// WORKMODE_DASHBOARD_STATUS_FILTER\n` + c;
      write(path, c);
      console.log('patched dashboard paid/unpaid filters');
    }
  }
}

// 8) Mobile subscribers: status filter from dashboard + page-style subscriber details.
{
  const path = 'src/components/mobile/MobileSubscribers.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('WORKMODE_MOBILE_SUBSCRIBER_PAGE_V1')) {
      c = replaceOnce(c, "import { Search, Plus, Phone, Users, X, Trash2 } from 'lucide-react';", "import { Search, Plus, Phone, Users, X, Trash2, ChevronRight, Edit3, WalletCards, MessageCircle } from 'lucide-react';", 'mobile subscribers imports');
      c = replaceOnce(c, "  onOpenSubscriberModal,\n  onDeleteSubscriber,\n}) => {", "  onOpenSubscriberModal,\n  onOpenReceiptModal,\n  onDeleteSubscriber,\n}) => {\n  // WORKMODE_MOBILE_SUBSCRIBER_PAGE_V1\n  const readInitialStatusFilter = (): 'all' | 'unpaid' | 'paid' | 'partial' | 'free' => {\n    try {\n      const saved = localStorage.getItem('moldatk_mobile_subscribers_filter');\n      localStorage.removeItem('moldatk_mobile_subscribers_filter');\n      if (saved === 'paid' || saved === 'unpaid' || saved === 'partial' || saved === 'free') return saved;\n    } catch (e) {}\n    return 'all';\n  };\n  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);", 'mobile subscriber state');
      c = replaceOnce(c, "  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'partial' | 'free'>('all');", "  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'partial' | 'free'>(readInitialStatusFilter);", 'initial status filter');
      const oldFilterStart = "  const filteredSubscribers = subscribers.filter(sub => {";
      const oldFilterEnd = "  const freeCount = subscribers.filter(s => s.paymentStatus === 'free' || s.tier === 'free').length;";
      const start = c.indexOf(oldFilterStart);
      const end = c.indexOf(oldFilterEnd, start);
      if (start !== -1 && end !== -1) {
        const afterEnd = end + oldFilterEnd.length;
        const newBlock = "  const getRemainingAmount = (sub: Subscriber) => Math.max(0, Number(sub.amountDue || 0) - Number(sub.amountPaid || 0));\n  const isFreeSubscriber = (sub: Subscriber) => sub.paymentStatus === 'free' || sub.tier === 'free';\n  const isPaidSubscriber = (sub: Subscriber) => !isFreeSubscriber(sub) && (sub.paymentStatus === 'paid' || getRemainingAmount(sub) === 0);\n  const isUnpaidSubscriber = (sub: Subscriber) => !isFreeSubscriber(sub) && (sub.paymentStatus === 'unpaid' || sub.paymentStatus === 'partial' || getRemainingAmount(sub) > 0);\n\n  const filteredSubscribers = subscribers.filter(sub => {\n    const needle = searchTerm.trim().toLowerCase();\n    const matchesSearch = !needle ||\n      (sub.fullName || '').toLowerCase().includes(needle) ||\n      (sub.phone || '').toLowerCase().includes(needle) ||\n      (sub.code || '').toLowerCase().includes(needle) ||\n      (sub.subscriberCode || '').toLowerCase().includes(needle) ||\n      (sub.boxNumber || '').toLowerCase().includes(needle) ||\n      (sub.lineName || sub.line || '').toLowerCase().includes(needle);\n\n    const matchesStatus = statusFilter === 'all'\n      ? true\n      : statusFilter === 'free'\n      ? isFreeSubscriber(sub)\n      : statusFilter === 'paid'\n      ? isPaidSubscriber(sub)\n      : statusFilter === 'unpaid'\n      ? isUnpaidSubscriber(sub)\n      : sub.paymentStatus === statusFilter;\n\n    const matchesLine = lineFilter === 'all'\n      ? true\n      : sub.lineId === lineFilter ||\n        (!!selectedLine?.name && (sub.lineName === selectedLine.name || sub.line === selectedLine.name));\n\n    return matchesSearch && matchesStatus && matchesLine;\n  });\n\n  const paidCount = subscribers.filter(isPaidSubscriber).length;\n  const partialCount = subscribers.filter(s => s.paymentStatus === 'partial').length;\n  const unpaidCount = subscribers.filter(isUnpaidSubscriber).length;\n  const freeCount = subscribers.filter(isFreeSubscriber).length;";
        c = c.slice(0, start) + newBlock + c.slice(afterEnd);
      } else {
        console.warn('skip: mobile subscribers filter block');
      }
      const returnMarker = "  return (\n    <div className=\"p-2.5 space-y-2.5 max-w-lg mx-auto pb-24\">";
      const detailPage = "  if (selectedSubscriber) {\n    const sub = selectedSubscriber;\n    const remaining = getRemainingAmount(sub);\n    const statusLabel = isFreeSubscriber(sub) ? 'مجاني' : isPaidSubscriber(sub) ? 'مسدد' : sub.paymentStatus === 'partial' ? 'مسدد جزئياً' : 'غير مسدد';\n    const statusClass = isPaidSubscriber(sub) ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : isFreeSubscriber(sub) ? 'text-slate-600 bg-slate-50 border-slate-100' : 'text-rose-600 bg-rose-50 border-rose-100';\n    return (\n      <div className=\"p-3.5 space-y-3.5 max-w-lg mx-auto pb-24 bg-slate-50 dark:bg-[#070d1e] min-h-screen\" dir=\"rtl\">\n        <div className=\"flex items-center justify-between\">\n          <button type=\"button\" onClick={() => setSelectedSubscriber(null)} className=\"w-10 h-10 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 flex items-center justify-center\"><ChevronRight className=\"w-5 h-5\" /></button>\n          <h2 className=\"text-base font-black text-slate-900 dark:text-white\">ملف المشترك</h2>\n          <button type=\"button\" onClick={() => onOpenSubscriberModal(sub)} className=\"w-10 h-10 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 flex items-center justify-center\"><Edit3 className=\"w-4 h-4\" /></button>\n        </div>\n\n        <section className=\"rounded-3xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 p-4 shadow-sm\">\n          <div className=\"flex items-start gap-3\">\n            <div className=\"w-16 h-16 rounded-3xl bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 flex items-center justify-center shrink-0\"><Users className=\"w-8 h-8\" /></div>\n            <div className=\"flex-1 min-w-0\">\n              <h3 className=\"text-xl font-black text-slate-950 dark:text-white truncate\">{sub.fullName}</h3>\n              <p className=\"text-xs font-mono text-slate-500 mt-1\">{sub.code || sub.subscriberCode}</p>\n              <span className={'mt-3 inline-flex px-3 py-1 rounded-xl border text-xs font-black ' + statusClass}>{statusLabel}</span>\n            </div>\n          </div>\n        </section>\n\n        <section className=\"rounded-3xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 overflow-hidden\">\n          {[\n            ['رقم الهاتف', sub.phone || '—'],\n            ['الكابينة', sub.lineName || sub.line || 'غير محددة'],\n            ['عدد الأمبيرات', formatNumberArabic(sub.amperes) + ' أمبير'],\n            ['المبلغ المستحق', isFreeSubscriber(sub) ? 'مجاني' : formatCurrency(Number(sub.amountDue || 0))],\n            ['المبلغ المدفوع', formatCurrency(Number(sub.amountPaid || 0))],\n            ['المتبقي', formatCurrency(remaining)],\n            ['العنوان', sub.address || '—'],\n            ['رقم الصندوق', sub.boxNumber || '—'],\n            ['ملاحظات', sub.notes || '—'],\n          ].map(([label, value]) => (\n            <div key={label} className=\"flex items-center justify-between gap-3 px-4 py-3 border-b last:border-b-0 border-slate-100 dark:border-slate-800\">\n              <span className=\"text-xs font-bold text-slate-500\">{label}</span>\n              <strong className=\"text-sm font-black text-slate-900 dark:text-white text-left\">{value}</strong>\n            </div>\n          ))}\n        </section>\n\n        <div className=\"grid grid-cols-3 gap-2\">\n          <button type=\"button\" onClick={() => onOpenReceiptModal(sub)} className=\"py-3 rounded-2xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center gap-1.5\"><WalletCards className=\"w-4 h-4\" />تسديد</button>\n          <button type=\"button\" onClick={() => sub.phone && window.open('tel:' + sub.phone)} className=\"py-3 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 text-xs font-black flex items-center justify-center gap-1.5\"><Phone className=\"w-4 h-4\" />اتصال</button>\n          <button type=\"button\" onClick={() => sub.phone && window.open('https://wa.me/964' + sub.phone.replace(/^0/, ''))} className=\"py-3 rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 text-xs font-black flex items-center justify-center gap-1.5\"><MessageCircle className=\"w-4 h-4\" />واتساب</button>\n        </div>\n\n        <button type=\"button\" onClick={() => { if (window.confirm('هل أنت متأكد من حذف هذا المشترك؟')) { onDeleteSubscriber(sub.id); setSelectedSubscriber(null); } }} className=\"w-full py-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-black flex items-center justify-center gap-2\"><Trash2 className=\"w-4 h-4\" />حذف المشترك</button>\n      </div>\n    );\n  }\n\n" + returnMarker;
      c = replaceOnce(c, returnMarker, detailPage, 'mobile subscriber detail page');
      c = replaceOnce(c, "onClick={() => onOpenSubscriberModal(sub)}", "onClick={() => setSelectedSubscriber(sub)}", 'subscriber card opens page');
      write(path, c);
      console.log('patched mobile subscriber page and filters');
    }
  }
}

// 9) Mobile monthly reports: pass monthly tariffs and add direct month dropdown.
{
  const path = 'src/components/mobile/MobileLayout.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('mobileTheme?: string')) {
      c = replaceOnce(c, "  SettingsFolderItem,\n  DeviceViewMode,\n} from '../../types';", "  SettingsFolderItem,\n  DeviceViewMode,\n  MonthlyTariffRecord,\n} from '../../types';", 'layout import monthly tariff');
      c = replaceOnce(c, "  subscriptionLoading?: boolean;\n}", "  subscriptionLoading?: boolean;\n  monthlyTariffs?: MonthlyTariffRecord[];\n  mobileTheme?: string;\n  onChangeMobileTheme?: (theme: string) => void;\n}", 'layout props add theme/months');
      c = replaceOnce(c, "  subscriptionLoading = false,\n}) => {", "  subscriptionLoading = false,\n  monthlyTariffs = [],\n  mobileTheme = 'ocean-calm',\n  onChangeMobileTheme,\n}) => {", 'layout destructure theme');
      c = replaceOnce(c, "    <div className=\"min-h-screen bg-slate-50 dark:bg-[#070d1e] text-slate-900 dark:text-slate-100 flex flex-col font-['Cairo',sans-serif] selection:bg-blue-600 selection:text-white pb-16\">", "    <div data-moldatk-theme={mobileTheme} className=\"moldatk-mobile-shell min-h-screen bg-slate-50 dark:bg-[#070d1e] text-slate-900 dark:text-slate-100 flex flex-col font-['Cairo',sans-serif] selection:bg-blue-600 selection:text-white pb-16\">", 'layout theme shell');
      c = replaceOnce(c, "            currency={generatorSpecs.currency || 'د.ع'}\n          />", "            currency={generatorSpecs.currency || 'د.ع'}\n            monthlyTariffs={monthlyTariffs}\n          />", 'reports monthly tariffs prop');
      c = replaceOnce(c, "            subscriptionLoading={subscriptionLoading}\n          />", "            subscriptionLoading={subscriptionLoading}\n            mobileTheme={mobileTheme}\n            onChangeMobileTheme={onChangeMobileTheme}\n          />", 'settings theme props');
      write(path, c);
      console.log('patched mobile layout theme/monthly props');
    }
  }

  const pathReports = 'src/components/mobile/MobileMonthlyReports.tsx';
  if (fs.existsSync(pathReports)) {
    let c = read(pathReports);
    if (!c.includes('WORKMODE_MONTH_SELECT_DROPDOWN')) {
      c = replaceOnce(c, "const monthShort = (monthId: string) => {\n  const [year, month] = monthId.split('-');\n  return `${Number(month)}/${year}`;\n};", "const monthShort = (monthId: string) => {\n  const [year, month] = monthId.split('-');\n  return `${Number(month)}-${year}`;\n};", 'month short hyphen format');
      c = replaceOnce(c, "      <div className=\"text-center text-[11px] font-bold text-slate-400\">\n        البيانات المعروضة تخص <span className=\"text-blue-400 font-black\">{selected.monthNameAr}</span>\n      </div>", "      <div className=\"WORKMODE_MONTH_SELECT_DROPDOWN rounded-2xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 p-3\">\n        <label className=\"text-[10px] font-black text-slate-500 dark:text-slate-400 block mb-1\">اختيار الشهر</label>\n        <select value={selectedMonthId} onChange={e => selectMonth(e.target.value)} className=\"w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm font-black text-slate-900 dark:text-white\">\n          {reports.map(r => <option key={r.monthId} value={r.monthId}>{monthShort(r.monthId)}</option>)}\n        </select>\n      </div>\n\n      <div className=\"text-center text-[11px] font-bold text-slate-400\">\n        اضغط على أي عداد لعرض قائمته فقط — لا تظهر القوائم الطويلة تلقائياً\n      </div>", 'month direct dropdown');
      write(pathReports, c);
      console.log('patched monthly reports dropdown');
    }
  }
}

// 10) App: mobile theme persistence, local-write mark, correct props and delete feedback.
{
  const path = 'src/App.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('WORKMODE_APP_MOBILE_THEME_STATE')) {
      c = replaceOnce(c, "  const [viewMode, setViewMode] = useState<any>(() => {\n    try {\n      return localStorage.getItem('moldatk_view_mode') || 'auto';\n    } catch (e) {\n      return 'auto';\n    }\n  });", "  const [viewMode, setViewMode] = useState<any>(() => {\n    try {\n      return localStorage.getItem('moldatk_view_mode') || 'auto';\n    } catch (e) {\n      return 'auto';\n    }\n  });\n\n  // WORKMODE_APP_MOBILE_THEME_STATE\n  const [mobileTheme, setMobileTheme] = useState<string>(() => {\n    try { return localStorage.getItem('moldatk_mobile_theme') || 'ocean-calm'; } catch (e) { return 'ocean-calm'; }\n  });\n\n  const markLocalWrite = () => {\n    try {\n      if (userSession?.generatorId) localStorage.setItem(getStorageKey('moldatk_last_local_write'), String(Date.now()));\n    } catch (e) {}\n  };", 'app theme state');
      c = replaceOnce(c, "  useEffect(() => {\n    try {\n      localStorage.setItem('moldatk_view_mode', viewMode);\n    } catch (e) {}\n  }, [viewMode]);", "  useEffect(() => {\n    try {\n      localStorage.setItem('moldatk_view_mode', viewMode);\n    } catch (e) {}\n  }, [viewMode]);\n\n  useEffect(() => {\n    try {\n      localStorage.setItem('moldatk_mobile_theme', mobileTheme);\n      document.documentElement.setAttribute('data-moldatk-theme', mobileTheme);\n    } catch (e) {}\n  }, [mobileTheme]);\n\n  useEffect(() => {\n    const expired = () => showToast('انتهت الجلسة، سجل دخولك من جديد حتى تستمر المزامنة');\n    window.addEventListener('moldatk-auth-expired', expired as EventListener);\n    return () => window.removeEventListener('moldatk-auth-expired', expired as EventListener);\n  }, []);", 'app theme effect/auth listener');
      c = c.replaceAll("window.dispatchEvent(new Event('moldatk-local-sync'));", "markLocalWrite();\n        window.dispatchEvent(new Event('moldatk-local-sync'));");
      c = replaceOnce(c, "          subscriptionLoading={subscriptionLoading}\n        />", "          subscriptionLoading={subscriptionLoading}\n          monthlyTariffs={monthlyTariffs}\n          mobileTheme={mobileTheme}\n          onChangeMobileTheme={setMobileTheme}\n        />", 'mobile layout props');
      c = replaceOnce(c, "              try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}\n              markLocalWrite();\n        window.dispatchEvent(new Event('moldatk-local-sync'));\n              return updated;", "              try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}\n              markLocalWrite();\n              window.dispatchEvent(new Event('moldatk-local-sync'));\n              return updated;", 'format mobile delete dispatch');
      c = replaceOnce(c, "            showToast('تم حذف المشترك بنجاح');", "            showToast('تم حذف المشترك');\n            setActiveTab('subscribers');", 'delete toast wording');
      c = replaceOnce(c, "              try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}\n              return updated;", "              try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}\n              markLocalWrite();\n              window.dispatchEvent(new Event('moldatk-local-sync'));\n              return updated;", 'subscriber modal delete local sync');
      c = replaceOnce(c, "            setIsSubscriberModalOpen(false);", "            setIsSubscriberModalOpen(false);\n            showToast('تم حذف المشترك');\n            setActiveTab('subscribers');", 'subscriber modal delete return');
      c = replaceOnce(c, "          onUpdateLines={(newLines) => {\n            setLines(newLines);\n            localStorage.setItem(getStorageKey('moldatk_lines'), JSON.stringify(newLines));\n          }}", "          onUpdateLines={(newLines) => {\n            setLines(newLines);\n            localStorage.setItem(getStorageKey('moldatk_lines'), JSON.stringify(newLines));\n            markLocalWrite();\n            window.dispatchEvent(new Event('moldatk-local-sync'));\n          }}", 'line update mark local write');
      write(path, c);
      console.log('patched App mobile theme, local-first writes and delete feedback');
    }
  }
}

// 11) Mobile settings: full settings remain, add announcement cards and theme chooser.
{
  const path = 'src/components/mobile/MobileSettings.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('WORKMODE_MOBILE_SETTINGS_ADS_THEMES')) {
      c = replaceOnce(c, "import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';", "import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';\nimport { supabase } from '../../lib/supabase';", 'settings supabase import');
      c = replaceOnce(c, "  subscriptionLoading?: boolean;\n}", "  subscriptionLoading?: boolean;\n  mobileTheme?: string;\n  onChangeMobileTheme?: (theme: string) => void;\n}", 'settings theme props');
      c = replaceOnce(c, "  subscriptionInfo = null,\n  subscriptionLoading = false,\n}) => {", "  subscriptionInfo = null,\n  subscriptionLoading = false,\n  mobileTheme = 'ocean-calm',\n  onChangeMobileTheme,\n}) => {\n  // WORKMODE_MOBILE_SETTINGS_ADS_THEMES\n  const [announcementCards, setAnnouncementCards] = React.useState<any[]>([]);\n  const themeOptions = [\n    { id: 'ocean-calm', label: 'بحري هادئ', desc: 'هادي، منعش، واضح', color: '#16a3a8' },\n    { id: 'green-comfort', label: 'أخضر مريح', desc: 'راحة واستقرار', color: '#37a86d' },\n    { id: 'soft-gold', label: 'ذهبي فاتح', desc: 'دافئ وفخم', color: '#d4af37' },\n    { id: 'light-metal', label: 'معدني فاتح', desc: 'نظيف واحترافي', color: '#94a3b8' },\n    { id: 'official-dark', label: 'داكن رسمي', desc: 'ليلي وهادئ', color: '#0f172a' },\n  ];\n  const applyTheme = (id: string) => {\n    try {\n      localStorage.setItem('moldatk_mobile_theme', id);\n      document.documentElement.setAttribute('data-moldatk-theme', id);\n    } catch (e) {}\n    if (onChangeMobileTheme) onChangeMobileTheme(id);\n  };\n\n  React.useEffect(() => {\n    let cancelled = false;\n    const loadAds = async () => {\n      try {\n        const cached = localStorage.getItem('moldatk_mobile_announcement_cards');\n        if (cached && !cancelled) setAnnouncementCards(JSON.parse(cached));\n      } catch (e) {}\n      try {\n        const now = new Date().toISOString();\n        const { data, error } = await supabase\n          .from('app_notifications')\n          .select('*')\n          .eq('is_active', true)\n          .order('priority', { ascending: false })\n          .order('created_at', { ascending: false })\n          .limit(8);\n        if (!error && Array.isArray(data)) {\n          const rows = data.filter((a: any) => (!a.starts_at || a.starts_at <= now) && (!a.ends_at || a.ends_at >= now));\n          localStorage.setItem('moldatk_mobile_announcement_cards', JSON.stringify(rows));\n          if (!cancelled) setAnnouncementCards(rows);\n        }\n      } catch (e) {\n        // الإعلانات اختيارية، لا نكسر الإعدادات إذا الشبكة غير متاحة.\n      }\n    };\n    void loadAds();\n    const timer = window.setInterval(() => void loadAds(), 60 * 1000);\n    return () => { cancelled = true; window.clearInterval(timer); };\n  }, []);", 'settings ads/theme state');
      const insertion = "    <div className=\"p-3.5 space-y-4 max-w-lg mx-auto pb-24\">\n      {announcementCards.length > 0 && (\n        <section className=\"rounded-3xl theme-primary p-3.5 shadow-lg overflow-hidden\">\n          <div className=\"flex items-center justify-between mb-3\">\n            <div className=\"flex items-center gap-2\"><Sparkles className=\"w-5 h-5 text-white\" /><h3 className=\"text-sm font-black text-white\">إعلانات الإدارة</h3></div>\n            <span className=\"text-[10px] font-bold text-white/75\">تتحدث بالمزامنة</span>\n          </div>\n          <div className=\"flex gap-2 overflow-x-auto no-scrollbar snap-x\">\n            {announcementCards.map((ad: any) => (\n              <button key={ad.id} type=\"button\" onClick={() => ad.action_url && window.open(ad.action_url, '_blank')} className=\"min-w-[86%] snap-center text-right rounded-2xl bg-white/95 text-slate-900 p-3 border border-white/40\">\n                {ad.media_url && ad.media_type !== 'video' && <img src={ad.media_url} alt=\"\" className=\"w-full h-28 object-cover rounded-xl mb-2\" loading=\"lazy\" />}\n                {ad.media_url && ad.media_type === 'video' && <video src={ad.media_url} className=\"w-full h-28 object-cover rounded-xl mb-2\" controls preload=\"metadata\" />}\n                <strong className=\"block text-sm font-black\">{ad.title}</strong>\n                <p className=\"text-xs text-slate-600 mt-1 line-clamp-2 leading-5\">{ad.body}</p>\n                {ad.action_url && <span className=\"mt-2 inline-block text-[11px] font-black theme-text\">فتح الرابط</span>}\n              </button>\n            ))}\n          </div>\n        </section>\n      )}\n\n      <section className=\"theme-card bg-white dark:bg-[#111c38] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3\">\n        <div className=\"flex items-center gap-2\">\n          <div className=\"p-2 rounded-xl bg-cyan-600/10 text-cyan-700 dark:text-cyan-300\"><Sparkles className=\"w-5 h-5\" /></div>\n          <div><h3 className=\"text-xs font-black text-slate-900 dark:text-white\">المظهر والثيم</h3><p className=\"text-[10px] text-slate-400\">اختر اللون المريح لنفسيتك وعينك</p></div>\n        </div>\n        <div className=\"grid grid-cols-2 gap-2\">\n          {themeOptions.map(option => (\n            <button key={option.id} type=\"button\" onClick={() => applyTheme(option.id)} className={(mobileTheme === option.id ? 'ring-2 ring-blue-500 border-blue-300 ' : 'border-slate-200 dark:border-slate-700 ') + 'rounded-2xl border bg-white dark:bg-slate-900 p-2.5 text-right'}>\n              <span className=\"block w-full h-8 rounded-xl mb-2\" style={{ background: option.color }} />\n              <strong className=\"block text-[11px] font-black text-slate-900 dark:text-white\">{option.label}</strong>\n              <span className=\"block text-[9px] text-slate-400 mt-0.5\">{option.desc}</span>\n            </button>\n          ))}\n        </div>\n      </section>";
      c = replaceOnce(c, "    <div className=\"p-3.5 space-y-4 max-w-lg mx-auto pb-24\">", insertion, 'settings insert ads/themes');
      write(path, c);
      console.log('patched mobile settings ads and theme chooser');
    }
  }
}

// 12) Super Admin notification form: allow ad media/link fields with sync-friendly content.
{
  const path = 'src/components/SuperAdminDashboard.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('WORKMODE_SUPER_ADMIN_AD_FIELDS')) {
      c = replaceOnce(c, "  is_active: boolean;\n  created_at: string;\n};", "  is_active: boolean;\n  created_at: string;\n  media_url?: string | null;\n  media_type?: 'image' | 'video' | null;\n  action_url?: string | null;\n  priority?: number | null;\n  starts_at?: string | null;\n  ends_at?: string | null;\n};", 'notification optional fields type');
      c = replaceOnce(c, "  const [notificationForm, setNotificationForm] = useState({\n    title: '', body: '', category: 'maintenance', target_type: 'all_generators', generator_id: ''\n  });", "  // WORKMODE_SUPER_ADMIN_AD_FIELDS\n  const [notificationForm, setNotificationForm] = useState({\n    title: '', body: '', category: 'maintenance', target_type: 'all_generators', generator_id: '',\n    media_url: '', media_type: 'image', action_url: '', priority: '0', starts_at: '', ends_at: ''\n  });", 'notification form fields');
      c = replaceOnce(c, "        generator_id: notificationForm.target_type === 'single_generator' ? notificationForm.generator_id : null,\n      },", "        generator_id: notificationForm.target_type === 'single_generator' ? notificationForm.generator_id : null,\n        media_url: notificationForm.media_url.trim() || null,\n        media_type: notificationForm.media_url.trim() ? notificationForm.media_type : null,\n        action_url: notificationForm.action_url.trim() || null,\n        priority: Number(notificationForm.priority || 0),\n        starts_at: notificationForm.starts_at || null,\n        ends_at: notificationForm.ends_at || null,\n      },", 'send notification extra fields');
      c = replaceOnce(c, "    setNotificationForm({ title: '', body: '', category: 'maintenance', target_type: 'all_generators', generator_id: '' });", "    setNotificationForm({ title: '', body: '', category: 'maintenance', target_type: 'all_generators', generator_id: '', media_url: '', media_type: 'image', action_url: '', priority: '0', starts_at: '', ends_at: '' });", 'reset notification form extra fields');
      c = replaceOnce(c, "              <textarea rows={5} placeholder=\"نص الإشعار\" value={notificationForm.body} onChange={e => setNotificationForm(f => ({...f, body:e.target.value}))} className=\"w-full border rounded-xl px-3 py-3 mb-3 resize-none\" />\n              <button className=\"w-full bg-blue-700 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2\"><Bell className=\"w-4 h-4\" />نشر الإشعار</button>", "              <textarea rows={5} placeholder=\"نص الإشعار / الإعلان\" value={notificationForm.body} onChange={e => setNotificationForm(f => ({...f, body:e.target.value}))} className=\"w-full border rounded-xl px-3 py-3 mb-3 resize-none\" />\n              <div className=\"grid grid-cols-2 gap-3 mb-3\">\n                <input placeholder=\"رابط صورة أو فيديو اختياري\" value={notificationForm.media_url} onChange={e => setNotificationForm(f => ({...f, media_url:e.target.value}))} className=\"border rounded-xl px-3 py-3\" />\n                <select value={notificationForm.media_type} onChange={e => setNotificationForm(f => ({...f, media_type:e.target.value}))} className=\"border rounded-xl px-3 py-3 bg-white\"><option value=\"image\">صورة</option><option value=\"video\">فيديو</option></select>\n                <input placeholder=\"رابط فتح عند الضغط اختياري\" value={notificationForm.action_url} onChange={e => setNotificationForm(f => ({...f, action_url:e.target.value}))} className=\"border rounded-xl px-3 py-3\" />\n                <input inputMode=\"numeric\" placeholder=\"الأولوية 0 - 100\" value={notificationForm.priority} onChange={e => setNotificationForm(f => ({...f, priority:e.target.value.replace(/\\D/g,'')}))} className=\"border rounded-xl px-3 py-3\" />\n                <label className=\"text-xs font-bold text-slate-600\">بداية الظهور<input type=\"datetime-local\" value={notificationForm.starts_at} onChange={e => setNotificationForm(f => ({...f, starts_at:e.target.value}))} className=\"mt-1 w-full border rounded-xl px-3 py-3 bg-white\" /></label>\n                <label className=\"text-xs font-bold text-slate-600\">نهاية الظهور<input type=\"datetime-local\" value={notificationForm.ends_at} onChange={e => setNotificationForm(f => ({...f, ends_at:e.target.value}))} className=\"mt-1 w-full border rounded-xl px-3 py-3 bg-white\" /></label>\n              </div>\n              <button className=\"w-full bg-blue-700 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2\"><Bell className=\"w-4 h-4\" />نشر الإشعار / الإعلان</button>", 'notification ad fields UI');
      c = replaceOnce(c, "<p className=\"text-sm text-slate-600 mt-1 leading-6\">{n.body}</p><p className=\"text-xs text-slate-400 mt-2\">إلى:", "<p className=\"text-sm text-slate-600 mt-1 leading-6\">{n.body}</p>{n.media_url && <p className=\"text-xs text-blue-700 mt-2 break-all\">وسائط: {n.media_url}</p>}{n.action_url && <p className=\"text-xs text-emerald-700 mt-1 break-all\">رابط: {n.action_url}</p>}<p className=\"text-xs text-slate-400 mt-2\">إلى:", 'notification log shows media/link');
      write(path, c);
      console.log('patched super admin announcement fields');
    }
  }
}

// 13) Receipt: dynamic rows already exist; fix date and month formatting for thermal printing.
{
  const path = 'src/components/InvoiceReceiptModal.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('WORKMODE_RECEIPT_SIMPLE_DATE_MONTH')) {
      c = replaceOnce(c, "  const finalized = Boolean(invoice && (isPaid || isPartial || isFree));\n  const statusText = isCancelled ? 'ملغي' : isFree ? 'مجاني' : isPaid ? 'مسدد' : isPartial ? 'تسديد جزئي' : 'غير مسدد';", "  const finalized = Boolean(invoice && (isPaid || isPartial || isFree));\n  const statusText = isCancelled ? 'ملغي' : isFree ? 'مجاني' : isPaid ? 'مسدد' : isPartial ? 'تسديد جزئي' : 'غير مسدد';\n\n  // WORKMODE_RECEIPT_SIMPLE_DATE_MONTH\n  const formatReceiptDate = (value?: string) => {\n    const d = value ? new Date(value) : new Date();\n    const safeDate = Number.isNaN(d.getTime()) ? new Date() : d;\n    const datePart = new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(safeDate);\n    const timePart = new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { hour: '2-digit', minute: '2-digit', hour12: true }).format(safeDate).replace('AM', 'ص').replace('PM', 'م');\n    return datePart + '    ' + timePart;\n  };\n  const formatReceiptMonth = (raw?: string) => {\n    const text = clean(raw);\n    if (!text) return '';\n    const iso = text.match(/(20\\d{2})[-\\/](\\d{1,2})/);\n    if (iso) return String(Number(iso[2])) + '-' + iso[1];\n    const named = text.match(/شهر\\s*(\\d{1,2}).*?(20\\d{2})/);\n    if (named) return String(Number(named[1])) + '-' + named[2];\n    return text;\n  };\n  const displayIssueDate = formatReceiptDate(issueDate);\n  const displayPaymentMonth = formatReceiptMonth(paymentMonth || invoice?.monthId);", 'receipt date/month helpers');
      c = c.replaceAll('month: paymentMonth,', 'month: displayPaymentMonth,');
      c = c.replaceAll('issueDate,', 'issueDate: displayIssueDate,');
      c = c.replaceAll('paymentMonth ? `شهر التسديد: ${paymentMonth}` : \'\',', 'displayPaymentMonth ? `شهر التسديد: ${displayPaymentMonth}` : \'\',');
      c = c.replaceAll('`التاريخ: ${issueDate}`', '`التاريخ: ${displayIssueDate}`');
      c = c.replaceAll('<Row label="التاريخ" value={issueDate} strong />', '<Row label="التاريخ" value={displayIssueDate} strong />');
      c = c.replaceAll('{paymentMonth && <Row label="شهر التسديد" value={paymentMonth} strong />}', '{displayPaymentMonth && <Row label="شهر التسديد" value={displayPaymentMonth} strong />}');
      write(path, c);
      console.log('patched receipt formatting');
    }
  }
}

console.log('Workmode final mobile UX bundle applied.');
