import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

const replaceBlock = (src, pattern, replacement, label) => {
  const next = src.replace(pattern, replacement);
  if (next === src) console.warn(`skip: ${label}`);
  return next;
};

// 1) الكابينات: أي إضافة/حذف/تعديل ينحفظ مباشرة وينطلق حدث تحديث عام.
{
  const path = 'src/components/FolderDetailModal.tsx';
  let s = read(path);

  if (!s.includes('MOLDATK_CABINET_INSTANT_PERSIST_V2')) {
    s = s.replace(
      /  \/\/ --- Line Handlers ---\s*\n  const handleAddLine = \(\) => \{/,
      `  // MOLDATK_CABINET_INSTANT_PERSIST_V2\n  const persistLinesImmediately = (nextLines: LineDistribution[]) => {\n    const fixedLines = nextLines.map(line => ({\n      ...line,\n      name: line.name || 'كابينة بدون اسم',\n      lineName: (line as any).lineName || line.name || 'كابينة بدون اسم',\n      updatedAt: new Date().toISOString(),\n    } as any));\n    setCurrentLines(fixedLines);\n    onUpdateLines(fixedLines);\n    setSaved(true);\n    try { window.dispatchEvent(new Event('moldatk-local-sync')); } catch (e) {}\n    window.setTimeout(() => setSaved(false), 700);\n  };\n\n  // --- Line Handlers ---\n  const handleAddLine = () => {`
    );
  }

  s = s.replace(/setCurrentLines\(\s*\[\.\.\.currentLines,\s*newLine\]\s*\);/g, 'persistLinesImmediately([...currentLines, newLine]);');

  s = replaceBlock(
    s,
    /  const handleDeleteLine = \(id: string\) => \{[\s\S]*?\n  \};\n\n  const handleUpdateLine =/,
    `  const handleDeleteLine = (id: string) => {\n    const nextLines = currentLines.filter(l => l.id !== id);\n    persistLinesImmediately(nextLines);\n  };\n\n  const handleUpdateLine =`,
    'delete line instant persist'
  );

  s = replaceBlock(
    s,
    /  const handleUpdateLine = \(id: string, updates: Partial<LineDistribution>\) => \{[\s\S]*?\n  \};\n\n  \/\/ --- Collector Handlers ---/,
    `  const handleUpdateLine = (id: string, updates: Partial<LineDistribution>) => {\n    const nextLines = currentLines.map(l => (l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } as any : l));\n    persistLinesImmediately(nextLines);\n  };\n\n  // --- Collector Handlers ---`,
    'update line instant persist'
  );

  must(s.includes('persistLinesImmediately'), 'cabinet persist helper missing');
  must(!s.includes('if (currentLines.length <= 1) return;'), 'old cabinet delete guard still exists');
  write(path, s);
}

// 2) الإعدادات العادية: حذف الكابينة من بطاقة الإعدادات ينحفظ مباشرة أيضاً.
{
  const path = 'src/components/SettingsFolderView.tsx';
  let s = read(path);

  s = replaceBlock(
    s,
    /  const handleItemDelete = \(id: string\) => \{[\s\S]*?\n  \};\n\n  const handleItemSaveEdit =/,
    `  const handleItemDelete = (id: string) => {\n    const newList = linesData.filter(l => l.id !== id).map(line => ({ ...line }));\n    setLinesData(newList);\n    if (onUpdateLines) {\n      onUpdateLines(newList);\n    }\n    try { window.dispatchEvent(new Event('moldatk-local-sync')); } catch (e) {}\n  };\n\n  const handleItemSaveEdit =`,
    'settings item delete instant'
  );

  s = replaceBlock(
    s,
    /  const handleItemSaveEdit = \(id: string\) => \{[\s\S]*?\n  \};\n\n  const handleDragStart =/,
    `  const handleItemSaveEdit = (id: string) => {\n    if (!editTextVal || !editTextVal.trim()) return;\n    const newList = linesData.map(l => l.id === id ? { ...l, name: editTextVal.trim(), lineName: editTextVal.trim(), updatedAt: new Date().toISOString() } as any : l);\n    setLinesData(newList);\n    setEditId(null);\n    setEditTextVal('');\n    if (onUpdateLines) {\n      onUpdateLines(newList);\n    }\n    try { window.dispatchEvent(new Event('moldatk-local-sync')); } catch (e) {}\n  };\n\n  const handleDragStart =`,
    'settings item edit instant'
  );

  write(path, s);
}

// 3) App: كل مسارات تحديث الكابينات تحفظ scoped localStorage وتطلق sync event.
{
  const path = 'src/App.tsx';
  let s = read(path);

  const updateLinesHandler = `onUpdateLines={(newLines) => {\n          const fixedLines = newLines.map(line => ({ ...line, updatedAt: (line as any).updatedAt || new Date().toISOString() } as any));\n          setLines(fixedLines);\n          try {\n            localStorage.setItem(getStorageKey('moldatk_lines'), JSON.stringify(fixedLines));\n            localStorage.setItem(getStorageKey('moldatk_lines_updated_at'), new Date().toISOString());\n            window.dispatchEvent(new Event('moldatk-local-sync'));\n          } catch (e) {}\n        }}`;

  const updateLinesHandlerCompact = `onUpdateLines={newLines => {\n                const fixedLines = newLines.map(line => ({ ...line, updatedAt: (line as any).updatedAt || new Date().toISOString() } as any));\n                setLines(fixedLines);\n                try {\n                  localStorage.setItem(getStorageKey('moldatk_lines'), JSON.stringify(fixedLines));\n                  localStorage.setItem(getStorageKey('moldatk_lines_updated_at'), new Date().toISOString());\n                  window.dispatchEvent(new Event('moldatk-local-sync'));\n                } catch (e) {}\n              }}`;

  s = s.replace(/onUpdateLines=\{\(newLines\) => \{\s*setLines\(newLines\);\s*localStorage\.setItem\(getStorageKey\('moldatk_lines'\), JSON\.stringify\(newLines\)\);\s*\}\}/g, updateLinesHandler);

  s = s.replace(/onUpdateLines=\{newLines => \{\s*setLines\(newLines\);\s*try \{\s*localStorage\.setItem\(getStorageKey\('moldatk_lines'\), JSON\.stringify\(newLines\)\);\s*window\.dispatchEvent\(new Event\('moldatk-local-sync'\)\);\s*\} catch \(e\) \{\}\s*\}\}/g, updateLinesHandlerCompact);

  s = s.replace(/onUpdateLines=\{\(newLines\) => \{\s*const fixedLines = newLines\.map\(line => \(\{ \.\.\.line \}\)\);[\s\S]*?\n\s*\}\}/g, updateLinesHandler);

  // القاصة: التصفير لازم يمسح سجل الدفعات والإلغاءات فعلياً من الواجهة الحالية، مو بس يخزن وقت.
  const clearWalletHandler = `onClearWalletLogs={() => {\n                const resetAt = new Date().toISOString();\n                setWalletResetTimestamp(resetAt);\n                setAuditLogs(prev => {\n                  const keptLogs = prev.filter(log => !['payment', 'cancellation', 'pricing'].includes(String(log.category)));\n                  try { localStorage.setItem(getStorageKey('moldatk_audit_logs'), JSON.stringify(keptLogs)); } catch (e) {}\n                  return keptLogs;\n                });\n                try {\n                  localStorage.setItem(getStorageKey('moldatk_wallet_reset_timestamp'), resetAt);\n                  localStorage.setItem(getStorageKey('moldatk_wallet_reset_nonce'), String(Date.now()));\n                  window.dispatchEvent(new Event('moldatk-local-sync'));\n                } catch (e) {}\n                showToast('تم تصفير القاصة بنجاح');\n              }}`;

  s = replaceBlock(
    s,
    /onClearWalletLogs=\{\(\) => \{\s*const resetAt = new Date\(\)\.toISOString\(\);[\s\S]*?showToast\('تم تصفير القاصة بنجاح'\);\s*\}\}/g,
    clearWalletHandler,
    'clear wallet handler'
  );

  // مسح سجل الحركات من المجلدات يحدّث الواجهة أيضاً.
  s = s.replace(/localStorage\.setItem\(getStorageKey\('moldatk_audit_logs'\), JSON\.stringify\(\[\]\)\);\s*showToast\('تم مسح سجل الحركات'\);/g,
    `localStorage.setItem(getStorageKey('moldatk_audit_logs'), JSON.stringify([]));\n          try { window.dispatchEvent(new Event('moldatk-local-sync')); } catch (e) {}\n          showToast('تم مسح سجل الحركات');`
  );

  must(s.includes('moldatk_wallet_reset_nonce'), 'wallet reset nonce missing');
  must(s.includes('moldatk_lines_updated_at'), 'lines update timestamp missing');
  write(path, s);
}

// 4) Dashboard wallet: القاصة تعتمد على السجل بعد التصفير وتطرح الإلغاءات.
{
  const path = 'src/components/DashboardView.tsx';
  let s = read(path);

  const dashboardReplacement = `  // القاصة تقرأ من سجل العمليات بعد آخر تصفير: التسديد يزيد، والإلغاء ينقص.\n  const totalCollectedRevenue = auditLogs\n    .filter(log => {\n      if (log.category !== 'payment' && log.category !== 'cancellation') return false;\n      if (resetTimeMs > 0) {\n        const logTime = log.timestamp ? new Date(log.timestamp).getTime() : 0;\n        if (logTime > 0 && logTime < resetTimeMs) return false;\n      }\n      return true;\n    })\n    .reduce((acc, log) => {\n      const amount = Math.abs(Number(log.amount) || 0);\n      return log.category === 'cancellation' ? acc - amount : acc + amount;\n    }, 0);`;

  s = s.replace(/  const totalCollectedRevenue = auditLogs[\s\S]*?\n\n  \/\/ حساب الديون/, `${dashboardReplacement}\n\n  // حساب الديون`);
  must(s.includes("log.category !== 'payment' && log.category !== 'cancellation'"), 'Dashboard cancellation subtraction missing');
  write(path, s);
}

// 5) Wallet page: القاصة تطرح الإلغاءات وتظهر المبلغ صحيح.
{
  const path = 'src/components/WalletView.tsx';
  let s = read(path);

  const walletReplacement = `  const totalCollected = financialLogs\n    .filter(log => log.category === 'payment' || log.category === 'cancellation')\n    .reduce((acc, log) => {\n      const amount = Math.abs(Number(log.amount) || 0);\n      return log.category === 'cancellation' ? acc - amount : acc + amount;\n    }, 0);\n\n`;

  s = s.replace(/  const totalCollected = financialLogs[\s\S]*?\n\n  return \(/, `${walletReplacement}  return (`);

  s = s.replace(
    /\{log\.amount !== undefined && log\.amount > 0 && \([\s\S]*?<\/span>\s*\)\}/,
    `{log.amount !== undefined && Math.abs(Number(log.amount) || 0) > 0 && (\n                    <span className={\`text-sm font-black tabular-nums \${isPayment ? 'text-emerald-500' : 'text-rose-500'}\`} dir="ltr">\n                      {isPayment ? '+' : '-'}{Math.abs(Number(log.amount) || 0).toLocaleString()} {currency}\n                    </span>\n                  )}`
  );

  write(path, s);
}

// 6) إعلان الإدارة بالموبايل: صندوق Banner واضح بنفس فكرة الصورة، يتحرك كل 3 ثواني ويبقى ظاهر حتى لو لا توجد صورة.
{
  const path = 'src/components/mobile/MobileSettings.tsx';
  let s = read(path);

  s = s.replace(/<h3 className="text-sm font-black text-slate-900 dark:text-white">اعلانات<\/h3>/g, '<h3 className="text-sm font-black text-slate-900 dark:text-white">إعلانات الإدارة</h3>');
  s = s.replace(/}, 3000\);/g, '}, 3500);');
  s = s.replace(/className="w-full aspect-\[16\/7\] object-cover bg-slate-100 dark:bg-slate-900"/g, 'className="w-full aspect-[16/7] object-cover bg-slate-100 dark:bg-slate-900 transition-transform duration-500"');

  write(path, s);
}

console.log('MOLDATK_CABINET_WALLET_FINAL_FIX_V2 applied');
