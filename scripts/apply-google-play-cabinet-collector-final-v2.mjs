import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

// 1) Types
{
  const path = 'src/types.ts';
  let src = read(path);
  if (!src.includes('assignedLineIds?: string[];')) {
    src = src.replace(
      "  assignedLineName?: string;\n  role?: 'collector';",
      "  assignedLineName?: string;\n  assignedLineIds?: string[];\n  assignedAllLines?: boolean;\n  role?: 'collector';"
    );
  }
  if (!src.includes('assignedLineIds?: string[];\n  assignedAllLines?: boolean;\n  username?: string;')) {
    src = src.replace(
      '  assignedLineName?: string;\n  username?: string;',
      '  assignedLineName?: string;\n  assignedLineIds?: string[];\n  assignedAllLines?: boolean;\n  username?: string;'
    );
  }
  write(path, src);
}

// 2) Collector cloud adapter
{
  const path = 'src/lib/collectorCloud.ts';
  let src = read(path);
  if (!src.includes('assignedLineIds: Array.isArray(row.assigned_line_ids)')) {
    src = src.replace(
      '  assignedLineName: row.assigned_line_name || undefined,\n  nationalId:',
      "  assignedLineName: row.assigned_line_name || undefined,\n  assignedLineIds: Array.isArray(row.assigned_line_ids) ? row.assigned_line_ids.map((x: unknown) => String(x)) : [],\n  assignedAllLines: Boolean(row.assigned_all_lines),\n  nationalId:"
    );
  }
  src = src.replace(
    ".select('id,name,phone,is_active,permissions,assigned_line_id,assigned_line_name')",
    ".select('id,name,phone,is_active,permissions,assigned_line_id,assigned_line_name,assigned_line_ids,assigned_all_lines')"
  );
  if (!src.includes('assignedLineIds: Array.isArray(collector.assigned_line_ids)')) {
    src = src.replace(
      '    assignedLineName: collector.assigned_line_name || undefined,\n    generatorId:',
      "    assignedLineName: collector.assigned_line_name || undefined,\n    assignedLineIds: Array.isArray(collector.assigned_line_ids) ? collector.assigned_line_ids.map((x: unknown) => String(x)) : [],\n    assignedAllLines: Boolean(collector.assigned_all_lines),\n    generatorId:"
    );
  }
  write(path, src);
}

// 3) SettingsFolderView collector editor: server-saved multi-cabinet selection.
{
  const path = 'src/components/SettingsFolderView.tsx';
  let src = read(path);
  if (!src.includes("from '../lib/collectorCloud'")) {
    const anchor = "import { SubscriptionInfoButton, SubscriptionInfo } from './SubscriptionStatusUI';";
    if (src.includes(anchor)) src = src.replace(anchor, `${anchor}\nimport { syncCloudCollectorRoster } from '../lib/collectorCloud';`);
  }
  if (!src.includes('collectorAssignedLineIds')) {
    src = src.replace(
      "  const [collectorPasscode, setCollectorPasscode] = useState('');",
      "  const [collectorPasscode, setCollectorPasscode] = useState('');\n  const [collectorAssignedLineIds, setCollectorAssignedLineIds] = useState<string[]>([]);\n  const [collectorAssignedAllLines, setCollectorAssignedAllLines] = useState(true);\n  const [collectorSaving, setCollectorSaving] = useState(false);"
    );
  }

  const start = src.indexOf('  const handleOpenAddCollector = () => {');
  const end = src.indexOf('  const addLineFromInput = () => {', start);
  if (start >= 0 && end > start && !src.slice(start, end).includes('saveCollectorRoster')) {
    const replacement = `  const handleOpenAddCollector = () => {
    setEditingCollector(null);
    setCollectorName('');
    setCollectorPhone('');
    setCollectorPasscode('');
    setCollectorAssignedLineIds([]);
    setCollectorAssignedAllLines(true);
    setIsAddCollectorModalOpen(true);
  };

  const handleOpenEditCollector = (c: Collector) => {
    setEditingCollector(c);
    setCollectorName(c.name);
    setCollectorPhone(c.phone);
    setCollectorPasscode(c.passcode || '');
    const ids = Array.isArray(c.assignedLineIds) && c.assignedLineIds.length
      ? c.assignedLineIds
      : (c.assignedLineId ? [c.assignedLineId] : []);
    setCollectorAssignedLineIds(ids);
    setCollectorAssignedAllLines(c.assignedAllLines === true || ids.length === 0);
    setIsAddCollectorModalOpen(true);
  };

  const saveCollectorRoster = async (updated: Collector[], message: string) => {
    setCollectorSaving(true);
    try {
      const saved = await syncCloudCollectorRoster(updated);
      const finalList = saved.length ? saved : updated;
      setCollectorsList(finalList);
      onUpdateCollectors?.(finalList);
      setIsAddCollectorModalOpen(false);
      alert(message);
    } catch (error) {
      console.error('Collector roster save failed:', error);
      alert('تعذر حفظ حساب الجابي على السيرفر. تحقق من الإنترنت ثم حاول مرة أخرى.');
    } finally {
      setCollectorSaving(false);
    }
  };

  const handleSaveCollectorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectorName.trim() || !collectorPhone.trim()) {
      alert('يرجى إدخال اسم الجابي ورقم الهاتف (اليوزر)');
      return;
    }
    if (!collectorAssignedAllLines && collectorAssignedLineIds.length === 0) {
      alert('اختر كابينة واحدة على الأقل أو اختر الكل');
      return;
    }

    const validIds = collectorAssignedAllLines ? [] : collectorAssignedLineIds.filter(id => linesData.some(line => line.id === id));
    const firstLine = validIds.length ? linesData.find(line => line.id === validIds[0]) : undefined;
    let updated: Collector[];
    if (editingCollector) {
      updated = collectorsList.map(c => c.id === editingCollector.id ? {
        ...c,
        name: collectorName.trim(),
        phone: collectorPhone.trim(),
        passcode: collectorPasscode.trim() || c.passcode || '',
        assignedLineIds: validIds,
        assignedAllLines: collectorAssignedAllLines,
        assignedLineId: collectorAssignedAllLines ? undefined : firstLine?.id,
        assignedLineName: collectorAssignedAllLines ? 'كل الكابينات' : firstLine?.name,
      } : c);
      await saveCollectorRoster(updated, 'تم تحديث الجابي والكابينات المخصصة بنجاح');
    } else {
      const item: Collector = {
        id: `col-${Date.now()}`,
        name: collectorName.trim(),
        phone: collectorPhone.trim(),
        passcode: collectorPasscode.trim() || '1234',
        role: 'collector',
        assignedLineIds: validIds,
        assignedAllLines: collectorAssignedAllLines,
        assignedLineId: collectorAssignedAllLines ? undefined : firstLine?.id,
        assignedLineName: collectorAssignedAllLines ? 'كل الكابينات' : firstLine?.name,
      };
      updated = [...collectorsList, item];
      await saveCollectorRoster(updated, 'تم إضافة الجابي وربطه بالكابينات بنجاح');
    }
  };

  const handleDeleteCollector = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف حساب هذا الجابي؟')) return;
    const updated = collectorsList.filter(c => c.id !== id);
    await saveCollectorRoster(updated, 'تم حذف حساب الجابي بنجاح');
  };

`;
    src = src.slice(0, start) + replacement + src.slice(end);
  }

  const modalStart = src.indexOf('{/* نافذة إضافة أو تعديل معلومات جابي');
  const modalEnd = src.indexOf('{/* نافذة عرض سجل الحركات', modalStart);
  if (modalStart >= 0 && modalEnd > modalStart) {
    let modal = src.slice(modalStart, modalEnd);
    if (!modal.includes('الكابينات المسموحة لهذا الجابي')) {
      const footerAnchor = '              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">';
      const picker = `              <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-4">
                <div>
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200">الكابينات المسموحة لهذا الجابي</label>
                  <p className="text-[10px] text-slate-500 mt-1">يمكن تأشير أكثر من كابينة بنفس الوقت.</p>
                </div>
                <label className={\`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer text-xs font-black \${collectorAssignedAllLines ? 'bg-[#FFF7E3] border-[#D89A21] text-[#0B1F3B]' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'}\`}>
                  <input type="checkbox" checked={collectorAssignedAllLines} onChange={e => { setCollectorAssignedAllLines(e.target.checked); if (e.target.checked) setCollectorAssignedLineIds([]); }} className="w-4 h-4 accent-[#0B1F3B]" />
                  <span>الكل</span>
                </label>
                {!collectorAssignedAllLines && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                    {linesData.map(line => {
                      const checked = collectorAssignedLineIds.includes(line.id);
                      return (
                        <label key={line.id} className={\`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer text-xs font-bold \${checked ? 'bg-[#FFF7E3] border-[#D89A21] text-[#0B1F3B]' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'}\`}>
                          <input type="checkbox" checked={checked} onChange={() => setCollectorAssignedLineIds(prev => checked ? prev.filter(id => id !== line.id) : [...prev, line.id])} className="w-4 h-4 accent-[#0B1F3B]" />
                          <span className="truncate">{line.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

`;
      if (modal.includes(footerAnchor)) modal = modal.replace(footerAnchor, picker + footerAnchor);
    }
    modal = modal.replace("{editingCollector ? 'حفظ التعديلات' : 'حفظ وإضافة الحساب'}", "{collectorSaving ? 'جاري الحفظ...' : (editingCollector ? 'حفظ التعديلات' : 'حفظ وإضافة الحساب')}");
    src = src.slice(0, modalStart) + modal + src.slice(modalEnd);
  }
  write(path, src);
}

// 4) POSQuickView + App scope
{
  const path = 'src/components/POSQuickView.tsx';
  let src = read(path);
  if (!src.includes('allowedLineIds?: string[];')) {
    src = src.replace('  lines: { id: string; name: string }[];\n  onSaveSubscriber:', '  lines: { id: string; name: string }[];\n  allowedLineIds?: string[];\n  assignedAllLines?: boolean;\n  onSaveSubscriber:');
  }
  if (!src.includes('allowedLineIds = [],')) {
    src = src.replace('  lines,\n  onSaveSubscriber,', '  lines,\n  allowedLineIds = [],\n  assignedAllLines = false,\n  onSaveSubscriber,');
  }
  if (!src.includes('const accessibleLines =')) {
    const anchor = '  const filteredSubs = subscribers.filter(sub => {';
    if (src.includes(anchor)) {
      const block = `  const hasExplicitAssignment = assignedAllLines || allowedLineIds.length > 0;
  const accessibleLines = assignedAllLines || !hasExplicitAssignment ? lines : lines.filter(line => allowedLineIds.includes(line.id));
  const accessibleLineIds = new Set(accessibleLines.map(line => line.id));
  const accessibleLineNames = new Set(accessibleLines.map(line => line.name));
  const accessibleSubscribers = assignedAllLines || !hasExplicitAssignment
    ? subscribers
    : subscribers.filter(sub => Boolean((sub.lineId && accessibleLineIds.has(sub.lineId)) || ((sub.lineName || sub.line) && accessibleLineNames.has(sub.lineName || sub.line || ''))));

`;
      src = src.replace(anchor, block + '  const filteredSubs = accessibleSubscribers.filter(sub => {');
    }
  }
  src = src.replace('  const totalCollected = subscribers.reduce((acc, sub) => {', '  const totalCollected = accessibleSubscribers.reduce((acc, sub) => {');
  src = src.replace('  const totalUnpaid = subscribers.reduce((acc, sub) => {', '  const totalUnpaid = accessibleSubscribers.reduce((acc, sub) => {');
  src = src.replace(/\{lines\.map\(\(line\) =>/g, '{accessibleLines.map((line) =>');
  write(path, src);
}

{
  const path = 'src/App.tsx';
  let src = read(path);
  if (!src.includes('allowedLineIds={userSession.assignedLineIds')) {
    const anchor = "          collectorName={userSession.collectorName || 'جابي ميداني'}";
    if (src.includes(anchor)) {
      src = src.replace(anchor, `${anchor}\n          allowedLineIds={userSession.assignedLineIds || (userSession.assignedLineId ? [userSession.assignedLineId] : [])}\n          assignedAllLines={userSession.assignedAllLines === true || (!userSession.assignedLineId && !(userSession.assignedLineIds || []).length)}`);
    }
  }
  write(path, src);
}

// 5) Cabinet deletion + ordering after resilient sync removed replaceMissingRows.
{
  const path = 'src/lib/useGeneratorCloudSync.ts';
  let src = read(path);
  src = src.replace('const lineToRow = (generatorId: string, l: LineDistribution) => ({', 'const lineToRow = (generatorId: string, l: LineDistribution, sortOrder = 0) => ({');
  if (!src.includes('  sort_order: sortOrder,')) src = src.replace('  breaker_number: l.breakerNumber || null,\n  updated_at:', '  breaker_number: l.breakerNumber || null,\n  sort_order: sortOrder,\n  updated_at:');

  if (!src.includes("deletedLines: key('moldatk_deleted_line_ids'")) {
    src = src.replace("      lines: key('moldatk_lines', generatorId),", "      lines: key('moldatk_lines', generatorId),\n      deletedLines: key('moldatk_deleted_line_ids', generatorId),");
  }
  if (!src.includes('deletedLineIds: readLocal<string[]>(localKeys.deletedLines')) {
    src = src.replace('      lines: readLocal<LineDistribution[]>(localKeys.lines, []),', '      lines: readLocal<LineDistribution[]>(localKeys.lines, []),\n      deletedLineIds: readLocal<string[]>(localKeys.deletedLines, []),');
  }

  const pushLinesDecl = '        const lines = readLocal<LineDistribution[]>(localKeys.lines, []);';
  if (src.includes(pushLinesDecl) && !src.includes('const deletedLineIds = new Set(readLocal<string[]>(localKeys.deletedLines')) {
    src = src.replace(pushLinesDecl, "        const deletedLineIds = new Set(readLocal<string[]>(localKeys.deletedLines, []));\n        const lines = readLocal<LineDistribution[]>(localKeys.lines, []).filter(line => !deletedLineIds.has(line.id));");
  }
  src = src.replace('lines.map(l => lineToRow(generatorId, l))', 'lines.map((l, index) => lineToRow(generatorId, l, index))');

  if (!src.includes('MOLDATK_LINE_TOMBSTONE_DELETE_V2')) {
    const lineUpsert = `          if (lines.length) {
            const { error } = await supabase.from('generator_lines').upsert(lines.map((l, index) => lineToRow(generatorId, l, index)), { onConflict: 'generator_id,id' });
            if (error) throw error;
          }`;
    const legacyLineUpsert = `          if (lines.length) {
            const { error } = await supabase.from('generator_lines').upsert(lines.map(l => lineToRow(generatorId, l)), { onConflict: 'generator_id,id' });
            if (error) throw error;
          }`;
    const anchor = src.includes(lineUpsert) ? lineUpsert : legacyLineUpsert;
    must(src.includes(anchor), 'generator_lines upsert block missing after resilient sync');
    const normalizedAnchor = anchor.replace('lines.map(l => lineToRow(generatorId, l))', 'lines.map((l, index) => lineToRow(generatorId, l, index))');
    const replacement = `${normalizedAnchor}
          // MOLDATK_LINE_TOMBSTONE_DELETE_V2
          if (deletedLineIds.size) {
            const { error: deleteLinesError } = await supabase
              .from('generator_lines')
              .delete()
              .eq('generator_id', generatorId)
              .in('id', Array.from(deletedLineIds));
            if (deleteLinesError) throw deleteLinesError;
            writeLocal(localKeys.deletedLines, []);
          }`;
    src = src.replace(anchor, replacement);
  }

  src = src.replace("supabase.from('generator_lines').select('*').eq('generator_id', generatorId).order('created_at')", "supabase.from('generator_lines').select('*').eq('generator_id', generatorId).order('sort_order', { ascending: true }).order('created_at', { ascending: true })");

  if (!src.includes('MOLDATK_CAPTURE_DELETED_LINES_V2')) {
    const oldOnLocal = `    const onLocalChange = () => {
      if (!ready.current || refreshing.current) return;
      const next = snapshot();
      if (next !== lastSnapshot.current) void push();
    };`;
    must(src.includes(oldOnLocal), 'onLocalChange block missing');
    const newOnLocal = `    const onLocalChange = () => {
      if (!ready.current || refreshing.current) return;
      // MOLDATK_CAPTURE_DELETED_LINES_V2
      try {
        const previous = lastSnapshot.current ? JSON.parse(lastSnapshot.current) : {};
        const previousLines: LineDistribution[] = Array.isArray(previous?.lines) ? previous.lines : [];
        const currentLines = readLocal<LineDistribution[]>(localKeys.lines, []);
        const currentIds = new Set(currentLines.map(line => line.id));
        const removed = previousLines.map(line => line?.id).filter(Boolean).filter(id => !currentIds.has(id));
        if (removed.length) {
          const tombstones = new Set(readLocal<string[]>(localKeys.deletedLines, []));
          removed.forEach(id => tombstones.add(String(id)));
          writeLocal(localKeys.deletedLines, Array.from(tombstones));
        }
      } catch (error) {
        console.warn('Cabinet tombstone capture failed:', error);
      }
      const next = snapshot();
      if (next !== lastSnapshot.current) void push();
    };`;
    src = src.replace(oldOnLocal, newOnLocal);
  }
  write(path, src);
}

// 6) Public Google Play legal routes + login links/brand.
{
  const path = 'src/main.tsx';
  let src = read(path);
  if (!src.includes("import LegalPage from './components/LegalPage';")) {
    src = src.replace("import { CustomerOrderAssistant } from './components/CustomerOrderAssistant';", "import { CustomerOrderAssistant } from './components/CustomerOrderAssistant';\nimport LegalPage from './components/LegalPage';");
  }
  if (!src.includes("window.location.pathname === '/privacy'")) {
    const anchor = "  if (window.location.pathname === '/download' || window.location.pathname === '/about') {";
    must(src.includes(anchor), 'main route anchor missing');
    src = src.replace(anchor, `  if (window.location.pathname === '/privacy') return <LegalPage kind="privacy" />;\n  if (window.location.pathname === '/terms') return <LegalPage kind="terms" />;\n  if (window.location.pathname === '/delete-account') return <LegalPage kind="delete-account" />;\n\n${anchor}`);
  }
  write(path, src);
}

{
  const path = 'src/components/LoginView.tsx';
  let src = read(path);
  const logoRegex = /          <div className="mx-auto w-full max-w-\[250px\][\s\S]*?<\/div>\n          <p className="text-xs text-slate-500 dark:text-slate-400">/;
  if (logoRegex.test(src)) {
    src = src.replace(logoRegex, `          <div className="mx-auto inline-flex items-center justify-center gap-3 rounded-3xl bg-white px-5 py-3 shadow-lg shadow-blue-950/10 border border-slate-100" dir="rtl">
            <img src="/brand/moldatk-mark.svg" alt="" className="w-14 h-14 object-contain shrink-0" />
            <div className="text-right leading-tight">
              <div className="text-3xl font-black tracking-tight text-[#0B1F3B]">مولدتك</div>
              <div className="text-[10px] font-bold text-slate-500 mt-1">إدارة المولدات بسهولة</div>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">`);
  }
  if (!src.includes('href="/privacy"')) {
    const footer = `        <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
          جميع حسابات المالك والجباة مرتبطة بـ Supabase Authentication
        </div>`;
    const replacement = `        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-center space-y-2">
          <p className="text-[10px] text-slate-400">تسجيل دخول آمن لحسابات المالك والجباة</p>
          <div className="flex items-center justify-center gap-3 text-[10px] font-bold">
            <a href="/privacy" className="text-slate-500 hover:text-[#D89A21]">سياسة الخصوصية</a>
            <span className="text-slate-300">•</span>
            <a href="/terms" className="text-slate-500 hover:text-[#D89A21]">الشروط والأحكام</a>
            <span className="text-slate-300">•</span>
            <a href="/delete-account" className="text-slate-500 hover:text-rose-600">حذف الحساب</a>
          </div>
        </div>`;
    if (src.includes(footer)) src = src.replace(footer, replacement);
  }
  write(path, src);
}

// Final guards
const types = read('src/types.ts');
const cloud = read('src/lib/collectorCloud.ts');
const settings = read('src/components/SettingsFolderView.tsx');
const pos = read('src/components/POSQuickView.tsx');
const sync = read('src/lib/useGeneratorCloudSync.ts');
const main = read('src/main.tsx');
const login = read('src/components/LoginView.tsx');
must(types.includes('assignedLineIds?: string[];') && types.includes('assignedAllLines?: boolean;'), 'collector assignment types missing');
must(cloud.includes('assigned_line_ids') && cloud.includes('assigned_all_lines'), 'collector cloud fields missing');
must(settings.includes('الكابينات المسموحة لهذا الجابي') && settings.includes('syncCloudCollectorRoster'), 'settings collector multi-cabinet UI missing');
must(pos.includes('accessibleSubscribers') && pos.includes('allowedLineIds'), 'POS assignment filter missing');
must(sync.includes('MOLDATK_LINE_TOMBSTONE_DELETE_V2') && sync.includes('MOLDATK_CAPTURE_DELETED_LINES_V2'), 'cabinet tombstone sync missing');
must(sync.includes("order('sort_order'"), 'cabinet sort order missing');
must(main.includes("'/privacy'") && main.includes("'/terms'") && main.includes("'/delete-account'"), 'legal routes missing');
must(login.includes('href="/privacy"') && login.includes('/brand/moldatk-mark.svg'), 'login legal/brand fix missing');

console.log('Applied resilient Google Play legal routes, multi-cabinet collector scope and cabinet deletion/order sync v2.');
