import fs from 'node:fs';
import path from 'node:path';

const filePath = path.join(process.cwd(), 'src/components/FolderDetailModal.tsx');
let content = fs.readFileSync(filePath, 'utf8');
let changed = false;

function replaceOnce(name, search, replace) {
  if (!content.includes(search)) {
    console.warn(`optional patch skipped: ${name}`);
    return;
  }
  content = content.replace(search, replace);
  changed = true;
  console.log(`patched: ${name}`);
}

function replaceRegex(name, regex, replace) {
  if (!regex.test(content)) {
    console.warn(`optional regex patch skipped: ${name}`);
    return;
  }
  content = content.replace(regex, replace);
  changed = true;
  console.log(`patched: ${name}`);
}

if (!content.includes('V22_CABINETS_LIST_MODE')) {
  replaceOnce(
    'add cabinets list state',
    `  const fileInputRef = useRef<HTMLInputElement>(null);\n`,
    `  const fileInputRef = useRef<HTMLInputElement>(null);\n  const [isAddingLine, setIsAddingLine] = useState(false);\n  const [newLineName, setNewLineName] = useState('');\n  const [draggedLineId, setDraggedLineId] = useState<string | null>(null);\n\n  // V22_CABINETS_LIST_MODE: إدارة الكابينات كقائمة أسماء فقط مع ترتيب بالسحب.\n`
  );

  replaceRegex(
    'replace add line handler with name-only add',
    /  const handleAddLine = \(\) => \{[\s\S]*?\n  \};\n\n  const handleDeleteLine = \(id: string\) => \{/,
    `  const handleAddLine = () => {\n    setNewLineName('');\n    setIsAddingLine(true);\n  };\n\n  const handleConfirmAddLine = () => {\n    const cleanName = newLineName.trim();\n    if (!cleanName) return;\n\n    const newLine: LineDistribution = {\n      id: \`line-\${Date.now()}\`,\n      name: cleanName,\n      zone: '',\n      phaseType: 'phase-R',\n      phaseNameAr: 'فيز R',\n      maxCapacityAmperes: 0,\n      currentLoadAmperes: 0,\n      subscribersCount: 0,\n      technicianName: '',\n      breakerNumber: '',\n    };\n\n    setCurrentLines(prev => [...prev, newLine]);\n    setNewLineName('');\n    setIsAddingLine(false);\n  };\n\n  const handleMoveLine = (sourceId: string | null, targetId: string) => {\n    if (!sourceId || sourceId === targetId) return;\n    setCurrentLines(prev => {\n      const sourceIndex = prev.findIndex(l => l.id === sourceId);\n      const targetIndex = prev.findIndex(l => l.id === targetId);\n      if (sourceIndex < 0 || targetIndex < 0) return prev;\n      const next = [...prev];\n      const [removed] = next.splice(sourceIndex, 1);\n      next.splice(targetIndex, 0, removed);\n      return next;\n    });\n    setDraggedLineId(null);\n  };\n\n  const handleDeleteLine = (id: string) => {`
  );

  replaceRegex(
    'replace lines zones UI with simple cabinets list',
    /          \{\/\* ================= 2\. Lines & Distribution Zones CRUD ================= \*\/\}\n          \{folderKey === 'lines_zones' && \([\s\S]*?\n          \)\}\n\n          \{\/\* ================= 3\. Collectors & Staff CRUD ================= \*\/\}/,
    `          {/* ================= 2. Lines & Distribution Zones CRUD ================= */}\n          {folderKey === 'lines_zones' && (\n            <div className=\"space-y-4\">\n              <div className=\"flex items-center justify-between gap-3\">\n                <div>\n                  <span className=\"font-black text-slate-900 dark:text-white text-sm\">\n                    قائمة الكابينات / البوردات ({currentLines.length})\n                  </span>\n                  <p className=\"text-[11px] text-slate-500 dark:text-slate-400 mt-1\">\n                    أضف اسم الكابينة فقط، واسحب الكابينة لتغيير ترتيبها.\n                  </p>\n                </div>\n\n                {!isAddingLine && (\n                  <button\n                    onClick={handleAddLine}\n                    className=\"flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black transition-all shadow-xs cursor-pointer\"\n                  >\n                    <Plus className=\"w-4 h-4\" />\n                    <span>إضافة كابينة</span>\n                  </button>\n                )}\n              </div>\n\n              {isAddingLine && (\n                <div className=\"p-4 rounded-2xl border border-blue-500/30 bg-blue-50 dark:bg-blue-950/20 space-y-3\">\n                  <label className=\"block text-[11px] font-bold text-slate-600 dark:text-slate-300\">\n                    اسم الكابينة / البورد\n                  </label>\n                  <input\n                    autoFocus\n                    type=\"text\"\n                    value={newLineName}\n                    onChange={e => setNewLineName(e.target.value)}\n                    onKeyDown={e => {\n                      if (e.key === 'Enter') handleConfirmAddLine();\n                      if (e.key === 'Escape') { setIsAddingLine(false); setNewLineName(''); }\n                    }}\n                    placeholder=\"مثال: كابينة السوق / بورد الشارع الأول\"\n                    className=\"w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500\"\n                  />\n                  <div className=\"flex items-center gap-2\">\n                    <button\n                      onClick={handleConfirmAddLine}\n                      className=\"px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black transition-all\"\n                    >\n                      حفظ الكابينة\n                    </button>\n                    <button\n                      onClick={() => { setIsAddingLine(false); setNewLineName(''); }}\n                      className=\"px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold transition-all\"\n                    >\n                      إلغاء\n                    </button>\n                  </div>\n                </div>\n              )}\n\n              <div className=\"space-y-2\">\n                {currentLines.length === 0 ? (\n                  <div className=\"p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400 font-bold\">\n                    لا توجد كابينات بعد. اضغط إضافة كابينة حتى تبدأ.\n                  </div>\n                ) : (\n                  currentLines.map((line, idx) => (\n                    <div\n                      key={line.id}\n                      draggable\n                      onDragStart={() => setDraggedLineId(line.id)}\n                      onDragOver={e => e.preventDefault()}\n                      onDrop={() => handleMoveLine(draggedLineId, line.id)}\n                      onDragEnd={() => setDraggedLineId(null)}\n                      className={\`p-3 rounded-2xl border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex items-center gap-3 transition-all cursor-grab active:cursor-grabbing \${\n                        draggedLineId === line.id ? 'opacity-60 ring-2 ring-blue-500' : ''\n                      }\`}\n                    >\n                      <div className=\"w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shrink-0\">\n                        {idx + 1}\n                      </div>\n\n                      <div className=\"flex-1 min-w-0\">\n                        <input\n                          type=\"text\"\n                          value={line.name}\n                          onChange={e => handleUpdateLine(line.id, { name: e.target.value })}\n                          className=\"w-full bg-transparent text-slate-900 dark:text-white font-black outline-none border-b border-transparent focus:border-blue-500 px-1 py-1\"\n                          placeholder=\"اسم الكابينة\"\n                        />\n                        <p className=\"text-[10px] text-slate-400 mt-0.5\">اسحب للأعلى أو الأسفل لتغيير الترتيب</p>\n                      </div>\n\n                      <button\n                        type=\"button\"\n                        className=\"px-2 py-1 rounded-lg text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 cursor-grab\"\n                        title=\"اسحب لتغيير الموقع\"\n                      >\n                        ☰\n                      </button>\n\n                      <button\n                        onClick={() => handleDeleteLine(line.id)}\n                        className=\"p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all\"\n                        title=\"حذف الكابينة\"\n                      >\n                        <Trash2 className=\"w-4 h-4\" />\n                      </button>\n                    </div>\n                  ))\n                )}\n              </div>\n            </div>\n          )}\n\n          {/* ================= 3. Collectors & Staff CRUD ================= */}`
  );
}

if (changed) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Cabinets list fix patch applied.');
} else {
  console.log('Cabinets list fix already applied or no matching block found.');
}
