import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

// -----------------------------------------------------------------------------
// 1) Types: a collector may access multiple cabinets or all cabinets.
// -----------------------------------------------------------------------------
{
  const path = 'src/types.ts';
  let src = read(path);
  if (!src.includes('assignedLineIds?: string[];')) {
    src = src.replace(
      '  assignedLineName?: string;\n  role?: \'collector\';',
      "  assignedLineName?: string;\n  assignedLineIds?: string[];\n  assignedAllLines?: boolean;\n  role?: 'collector';"
    );
  }
  if (!src.includes('assignedAllLines?: boolean;\n  generatorId?: string | null;')) {
    src = src.replace(
      '  assignedLineName?: string;\n  username?: string;',
      '  assignedLineName?: string;\n  assignedLineIds?: string[];\n  assignedAllLines?: boolean;\n  username?: string;'
    );
  }
  write(path, src);
}

// -----------------------------------------------------------------------------
// 2) Collector cloud adapter: persist and restore multi-cabinet assignment.
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// 3) Settings collector editor: choose multiple cabinets or all, save to server.
// -----------------------------------------------------------------------------
{
  const path = 'src/components/SettingsFolderView.tsx';
  let src = read(path);

  if (!src.includes("from '../lib/collectorCloud'")) {
    const anchor = "import { SubscriptionInfoButton, SubscriptionInfo } from './SubscriptionStatusUI';";
    src = src.replace(anchor, `${anchor}\nimport { syncCloudCollectorRoster } from '../lib/collectorCloud';`);
  }

  if (!src.includes('collectorAssignedLineIds')) {
    src = src.replace(
      "  const [collectorPasscode, setCollectorPasscode] = useState('');",
      "  const [collectorPasscode, setCollectorPasscode] = useState('');\n  const [collectorAssignedLineIds, setCollectorAssignedLineIds] = useState<string[]>([]);\n  const [collectorAssignedAllLines, setCollectorAssignedAllLines] = useState(true);\n  const [collectorSaving, setCollectorSaving] = useState(false);"
    );
  }

  const start = src.indexOf('  const handleOpenAddCollector = () => {');
  const end = src.indexOf('  const addLineFromInput = () => {', start);
  must(start >= 0 && end > start, 'Collector management block not found');

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

  const saveCollectorRoster = async (updated: Collector[], successMessage: string) => {
    setCollectorSaving(true);
    try {
      const saved = await syncCloudCollectorRoster(updated);
      const finalList = saved.length ? saved : updated;
      setCollectorsList(finalList);
      if (onUpdateCollectors) onUpdateCollectors(finalList);
      setIsAddCollectorModalOpen(false);
      alert(successMessage);
    } catch (error) {
      console.error('Collector roster save failed:', error);
      alert('تعذر حفظ حساب الجابي على السيرفر. تحقق من الإنترنت والبيانات ثم حاول مرة أخرى.');
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
      alert('اختر كابينة واحدة على الأقل أو فعّل اختيار كل الكابينات');
      return;
    }

    const validIds = collectorAssignedAllLines
      ? []
      : collectorAssignedLineIds.filter(id => linesData.some(line => line.id === id));
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
      await saveCollectorRoster(updated, 'تم تحديث بيانات الجابي والكابينات المخصصة بنجاح!');
    } else {
      const newCollectorObj: Collector = {
        id: \`col-\${Date.now()}\`,
        name: collectorName.trim(),
        phone: collectorPhone.trim(),
        passcode: collectorPasscode.trim() || '1234',
        role: 'collector',
        assignedLineIds: validIds,
        assignedAllLines: collectorAssignedAllLines,
        assignedLineId: collectorAssignedAllLines ? undefined : firstLine?.id,
        assignedLineName: collectorAssignedAllLines ? 'كل الكابينات' : firstLine?.name,
      };
      updated = [...collectorsList, newCollectorObj];
      await saveCollectorRoster(updated, 'تم إضافة حساب الجابي وربطه بالكابينات بنجاح!');
    }
  };

  const handleDeleteCollector = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف حساب هذا الجابي؟ سيتم إلغاء دخوله للنظام أيضاً.')) return;
    const updated = collectorsList.filter(c => c.id !== id);
    setCollectorSaving(true);
    try {
      const saved = await syncCloudCollectorRoster(updated);
      const finalList = saved.length ? saved : updated;
      setCollectorsList(finalList);
      if (onUpdateCollectors) onUpdateCollectors(finalList);
    } catch (error) {
      console.error('Collector delete failed:', error);
      alert('تعذر حذف حساب الجابي من السيرفر. لم يتم حذف الحساب محلياً.');
    } finally {
      setCollectorSaving(false);
    }
  };

`;
  src = src.slice(0, start) + replacement + src.slice(end);

  const modalStart = src.indexOf('{/* نافذة إضافة أو تعديل معلومات جابي');
  const modalEnd = src.indexOf('{/* نافذة عرض سجل الحركات', modalStart);
  must(modalStart >= 0 && modalEnd > modalStart, 'Collector modal section not found');
  let modal = src.slice(modalStart, modalEnd);

  if (!modal.includes('اختيار كل الكابينات')) {
    const footerAnchor = '              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">';
    const assignmentUi = `              <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-black text-slate-800 dark:text-slate-200">الكابينات المسموحة لهذا الجابي</label>
                    <p className="text-[10px] text-slate-500 mt-1">يمكن اختيار أكثر من كابينة، أو السماح بكل الكابينات.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCollectorAssignedAllLines(!collectorAssignedAllLines); if (!collectorAssignedAllLines) setCollectorAssignedLineIds([]); }}
                    className={\`px-3 py-2 rounded-xl text-[11px] font-black border transition-all \${collectorAssignedAllLines ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'}\`}
                  >
                    اختيار كل الكابينات
                  </button>
                </div>

                {!collectorAssignedAllLines && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                    {linesData.map(line => {
                      const checked = collectorAssignedLineIds.includes(line.id);
                      return (
                        <label key={line.id} className={\`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer text-xs font-bold transition-all \${checked ? 'bg-[#FFF7E3] border-[#D89A21] text-[#0B1F3B]' : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'}\`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setCollectorAssignedLineIds(prev => checked ? prev.filter(id => id !== line.id) : [...prev, line.id])}
                            className="w-4 h-4 accent-[#0B1F3B]"
                          />
                          <span className="truncate">{line.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {collectorAssignedAllLines && <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">هذا الجابي يستطيع مشاهدة والعمل على جميع الكابينات.</p>}
              </div>

`;
    must(modal.includes(footerAnchor), 'Collector modal footer anchor missing');
    modal = modal.replace(footerAnchor, assignmentUi + footerAnchor);
  }

  modal = modal.replace(
    '                  {editingCollector ? \'حفظ التعديلات\' : \'حفظ وإضافة الحساب\'}',
    "                  {collectorSaving ? 'جاري الحفظ...' : (editingCollector ? 'حفظ التعديلات' : 'حفظ وإضافة الحساب')}"
  );
  modal = modal.replace(
    '                  type="submit"\n                  className=',
    '                  type="submit"\n                  disabled={collectorSaving}\n                  className='
  );

  src = src.slice(0, modalStart) + modal + src.slice(modalEnd);
  write(path, src);
}

// -----------------------------------------------------------------------------
// 4) POS collector view: enforce selected cabinet scope in the UI as well as RLS.
// -----------------------------------------------------------------------------
{
  const path = 'src/components/POSQuickView.tsx';
  let src = read(path);

  if (!src.includes('allowedLineIds?: string[];')) {
    src = src.replace(
      '  lines: { id: string; name: string }[];\n  onSaveSubscriber:',
      '  lines: { id: string; name: string }[];\n  allowedLineIds?: string[];\n  assignedAllLines?: boolean;\n  onSaveSubscriber:'
    );
  }
  if (!src.includes('allowedLineIds = [],')) {
    src = src.replace(
      '  lines,\n  onSaveSubscriber,',
      '  lines,\n  allowedLineIds = [],\n  assignedAllLines = false,\n  onSaveSubscriber,'
    );
  }

  if (!src.includes('const accessibleLines =')) {
    const anchor = '  const filteredSubs = subscribers.filter(sub => {';
    const scope = `  const hasExplicitAssignment = assignedAllLines || allowedLineIds.length > 0;
  const accessibleLines = assignedAllLines || !hasExplicitAssignment
    ? lines
    : lines.filter(line => allowedLineIds.includes(line.id));
  const accessibleLineIds = new Set(accessibleLines.map(line => line.id));
  const accessibleSubscribers = assignedAllLines || !hasExplicitAssignment
    ? subscribers
    : subscribers.filter(sub => Boolean(sub.lineId && accessibleLineIds.has(sub.lineId)));

`;
    must(src.includes(anchor), 'POS filtered subscriber anchor missing');
    src = src.replace(anchor, scope + '  const filteredSubs = accessibleSubscribers.filter(sub => {');
  } else {
    src = src.replace('  const filteredSubs = subscribers.filter(sub => {', '  const filteredSubs = accessibleSubscribers.filter(sub => {');
  }

  src = src.replace('  const totalCollected = subscribers.reduce((acc, sub) => {', '  const totalCollected = accessibleSubscribers.reduce((acc, sub) => {');
  src = src.replace('  const totalUnpaid = subscribers.reduce((acc, sub) => {', '  const totalUnpaid = accessibleSubscribers.reduce((acc, sub) => {');
  src = src.replace(/\{lines\.map\(\(line\) =>/g, '{accessibleLines.map((line) =>');
  write(path, src);
}

// -----------------------------------------------------------------------------
// 5) App: pass collector assignment scope into POS.
// -----------------------------------------------------------------------------
{
  const path = 'src/App.tsx';
  let src = read(path);
  if (!src.includes('allowedLineIds={userSession.assignedLineIds')) {
    const anchor = "          collectorName={userSession.collectorName || 'جابي ميداني'}";
    must(src.includes(anchor), 'App collector POS anchor missing');
    src = src.replace(
      anchor,
      `${anchor}\n          allowedLineIds={userSession.assignedLineIds || (userSession.assignedLineId ? [userSession.assignedLineId] : [])}\n          assignedAllLines={userSession.assignedAllLines === true || (!userSession.assignedLineId && !(userSession.assignedLineIds || []).length)}`
    );
  }
  write(path, src);
}

// -----------------------------------------------------------------------------
// 6) Cabinet cloud sync: deletion tombstones + durable manual sort order.
// -----------------------------------------------------------------------------
{
  const path = 'src/lib/useGeneratorCloudSync.ts';
  let src = read(path);

  src = src.replace(
    'const lineToRow = (generatorId: string, l: LineDistribution) => ({',
    'const lineToRow = (generatorId: string, l: LineDistribution, sortOrder = 0) => ({'
  );
  if (!src.includes('  sort_order: sortOrder,')) {
    src = src.replace('  breaker_number: l.breakerNumber || null,\n  updated_at:', '  breaker_number: l.breakerNumber || null,\n  sort_order: sortOrder,\n  updated_at:');
  }

  if (!src.includes("deletedLines: key('moldatk_deleted_line_ids'")) {
    src = src.replace(
      "      lines: key('moldatk_lines', generatorId),",
      "      lines: key('moldatk_lines', generatorId),\n      deletedLines: key('moldatk_deleted_line_ids', generatorId),"
    );
  }

  if (!src.includes('deletedLineIds: readLocal<string[]>(localKeys.deletedLines')) {
    src = src.replace(
      '      lines: readLocal<LineDistribution[]>(localKeys.lines, []),',
      '      lines: readLocal<LineDistribution[]>(localKeys.lines, []),\n      deletedLineIds: readLocal<string[]>(localKeys.deletedLines, []),'
    );
  }

  src = src.replace(
    '        const lines = readLocal<LineDistribution[]>(localKeys.lines, []);',
    "        const deletedLineIds = new Set(readLocal<string[]>(localKeys.deletedLines, []));\n        const lines = readLocal<LineDistribution[]>(localKeys.lines, []).filter(line => !deletedLineIds.has(line.id));"
  );
  src = src.replace(
    'subscribers.map(s => subscriberToRow(generatorId, s))',
    'subscribers.map(s => subscriberToRow(generatorId, s))'
  );
  src = src.replace(
    'lines.map(l => lineToRow(generatorId, l))',
    'lines.map((l, index) => lineToRow(generatorId, l, index))'
  );

  const replaceMissingAnchor = "          await replaceMissingRows('generator_lines', generatorId, lines.map(l => l.id));";
  if (!src.includes('MOLDATK_LINE_TOMBSTONE_DELETE_V1')) {
    must(src.includes(replaceMissingAnchor), 'generator_lines replaceMissing anchor missing');
    src = src.replace(
      replaceMissingAnchor,
      `          // MOLDATK_LINE_TOMBSTONE_DELETE_V1: delete removed cabinets before any realtime pull can restore them.
          if (deletedLineIds.size) {
            const { error: deleteLinesError } = await supabase
              .from('generator_lines')
              .delete()
              .eq('generator_id', generatorId)
              .in('id', Array.from(deletedLineIds));
            if (deleteLinesError) throw deleteLinesError;
          }
          await replaceMissingRows('generator_lines', generatorId, lines.map(l => l.id));`
    );
  }

  src = src.replace(
    "supabase.from('generator_lines').select('*').eq('generator_id', generatorId).order('created_at')",
    "supabase.from('generator_lines').select('*').eq('generator_id', generatorId).order('sort_order', { ascending: true }).order('created_at', { ascending: true })"
  );

  if (!src.includes('const lineTombstones = new Set(readLocal<string[]>(localKeys.deletedLines')) {
    const writeAnchor = '        writeLocal(localKeys.lines, (lines.data || []).map(rowToLine));';
    must(src.includes(writeAnchor), 'cloud pull line write anchor missing');
    src = src.replace(
      writeAnchor,
      "        const lineTombstones = new Set(readLocal<string[]>(localKeys.deletedLines, []));\n        writeLocal(localKeys.lines, (lines.data || []).filter((row: any) => !lineTombstones.has(String(row.id))).map(rowToLine));"
    );
  }

  const localChangeStart = src.indexOf('    const onLocalChange = () => {');
  const localChangeEnd = src.indexOf('\n    };', localChangeStart);
  must(localChangeStart >= 0 && localChangeEnd > localChangeStart, 'onLocalChange block missing');
  const localChangeBlock = src.slice(localChangeStart, localChangeEnd + 7);
  if (!localChangeBlock.includes('MOLDATK_CAPTURE_DELETED_LINES_V1')) {
    const replacementLocalChange = `    const onLocalChange = () => {
      if (!ready.current || refreshing.current) return;

      // MOLDATK_CAPTURE_DELETED_LINES_V1: compare the last acknowledged snapshot with local state.
      try {
        const previous = lastSnapshot.current ? JSON.parse(lastSnapshot.current) : {};
        const previousLines: LineDistribution[] = Array.isArray(previous?.lines) ? previous.lines : [];
        const currentLines = readLocal<LineDistribution[]>(localKeys.lines, []);
        const currentIds = new Set(currentLines.map(line => line.id));
        const removedIds = previousLines.map(line => line?.id).filter(Boolean).filter(id => !currentIds.has(id));
        if (removedIds.length) {
          const tombstones = new Set(readLocal<string[]>(localKeys.deletedLines, []));
          removedIds.forEach(id => tombstones.add(String(id)));
          writeLocal(localKeys.deletedLines, Array.from(tombstones));
        }
      } catch (error) {
        console.warn('Cabinet deletion tombstone capture failed:', error);
      }

      const next = snapshot();
      if (next !== lastSnapshot.current) void push();
    };`;
    src = src.slice(0, localChangeStart) + replacementLocalChange + src.slice(localChangeEnd + 7);
  }

  write(path, src);
}

// -----------------------------------------------------------------------------
// 7) Google Play public legal routes + clean login brand and links.
// -----------------------------------------------------------------------------
{
  const path = 'src/main.tsx';
  let src = read(path);
  if (!src.includes("import LegalPage from './components/LegalPage';")) {
    src = src.replace("import { CustomerOrderAssistant } from './components/CustomerOrderAssistant';", "import { CustomerOrderAssistant } from './components/CustomerOrderAssistant';\nimport LegalPage from './components/LegalPage';");
  }
  if (!src.includes("window.location.pathname === '/privacy'")) {
    const anchor = "  if (window.location.pathname === '/download' || window.location.pathname === '/about') {";
    must(src.includes(anchor), 'Main legal route anchor missing');
    const routes = `  if (window.location.pathname === '/privacy') return <LegalPage kind="privacy" />;
  if (window.location.pathname === '/terms') return <LegalPage kind="terms" />;
  if (window.location.pathname === '/delete-account') return <LegalPage kind="delete-account" />;

`;
    src = src.replace(anchor, routes + anchor);
  }
  write(path, src);
}

{
  const path = 'src/components/LoginView.tsx';
  let src = read(path);

  const logoRegex = /          <div className="mx-auto w-full max-w-\[250px\][\s\S]*?<\/div>\n          <p className="text-xs text-slate-500 dark:text-slate-400">/;
  if (logoRegex.test(src)) {
    src = src.replace(
      logoRegex,
      `          <div className="mx-auto inline-flex items-center justify-center gap-3 rounded-3xl bg-white px-5 py-3 shadow-lg shadow-blue-950/10 border border-slate-100" dir="rtl">
            <img src="/brand/moldatk-mark.svg" alt="" className="w-14 h-14 object-contain shrink-0" />
            <div className="text-right leading-tight">
              <div className="text-3xl font-black tracking-tight text-[#0B1F3B]">مولدتك</div>
              <div className="text-[10px] font-bold text-slate-500 mt-1">إدارة المولدات بسهولة</div>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">`
    );
  }

  const oldFooter = `        <div className="text-center pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
          جميع حسابات المالك والجباة مرتبطة بـ Supabase Authentication
        </div>`;
  const newFooter = `        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-center space-y-2">
          <p className="text-[10px] text-slate-400">تسجيل دخول آمن لحسابات المالك والجباة</p>
          <div className="flex items-center justify-center gap-3 text-[10px] font-bold">
            <a href="/privacy" className="text-slate-500 hover:text-[#D89A21]">سياسة الخصوصية</a>
            <span className="text-slate-300">•</span>
            <a href="/terms" className="text-slate-500 hover:text-[#D89A21]">الشروط والأحكام</a>
            <span className="text-slate-300">•</span>
            <a href="/delete-account" className="text-slate-500 hover:text-rose-600">حذف الحساب</a>
          </div>
        </div>`;
  if (src.includes(oldFooter)) src = src.replace(oldFooter, newFooter);
  else if (!src.includes('href="/privacy"')) {
    src = src.replace('\n      </div>\n    </div>\n  );', `\n        ${newFooter.trim()}\n      </div>\n    </div>\n  );`);
  }
  write(path, src);
}

// Final invariants.
const types = read('src/types.ts');
const collectorCloud = read('src/lib/collectorCloud.ts');
const settings = read('src/components/SettingsFolderView.tsx');
const pos = read('src/components/POSQuickView.tsx');
const sync = read('src/lib/useGeneratorCloudSync.ts');
const main = read('src/main.tsx');
const login = read('src/components/LoginView.tsx');
const legal = read('src/components/LegalPage.tsx');

must(types.includes('assignedLineIds?: string[];') && types.includes('assignedAllLines?: boolean;'), 'multi-cabinet types missing');
must(collectorCloud.includes('assigned_line_ids') && collectorCloud.includes('assigned_all_lines'), 'collector cloud assignment fields missing');
must(settings.includes('اختيار كل الكابينات') && settings.includes('syncCloudCollectorRoster'), 'collector multi-cabinet UI/server save missing');
must(pos.includes('accessibleSubscribers') && pos.includes('allowedLineIds'), 'collector POS scope missing');
must(sync.includes('MOLDATK_LINE_TOMBSTONE_DELETE_V1') && sync.includes('sort_order'), 'cabinet deletion/order cloud guard missing');
must(main.includes("'/privacy'") && main.includes("'/terms'") && main.includes("'/delete-account'"), 'Google Play legal routes missing');
must(login.includes('href="/privacy"') && login.includes('/brand/moldatk-mark.svg') && !login.includes('/brand/moldatk-logo.svg'), 'login legal links or corrected brand missing');
must(legal.includes("account_deletion_requests") && legal.includes('سياسة الخصوصية') && legal.includes('الشروط والأحكام'), 'legal pages incomplete');

console.log('Applied Google Play legal pages, corrected login logo, collector multi-cabinet assignment and cabinet deletion/order sync guard.');
