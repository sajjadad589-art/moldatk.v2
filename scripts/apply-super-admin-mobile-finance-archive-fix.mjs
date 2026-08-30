import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const filePath = path.join(root, 'src/components/SuperAdminDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');
let changed = false;

function replaceAll(name, search, replace) {
  if (content.includes(search)) {
    content = content.split(search).join(replace);
    changed = true;
    console.log(`patched: ${name}`);
  }
}

function replaceOne(name, search, replace, optional = false) {
  if (!content.includes(search)) {
    if (!optional) throw new Error(`Patch pattern not found: ${name}`);
    console.warn(`optional patch skipped: ${name}`);
    return;
  }
  content = content.replace(search, replace);
  changed = true;
  console.log(`patched: ${name}`);
}

function replaceRegex(name, regex, replace, optional = false) {
  if (!regex.test(content)) {
    if (!optional) throw new Error(`Patch regex not found: ${name}`);
    console.warn(`optional regex skipped: ${name}`);
    return;
  }
  content = content.replace(regex, replace);
  changed = true;
  console.log(`patched: ${name}`);
}

// Make the Super Admin usable on mobile phones.
replaceOne(
  'root mobile width',
  `className="min-h-screen bg-slate-100 text-slate-900 font-['Cairo',sans-serif] min-w-[1100px]"`,
  `className="min-h-screen bg-slate-100 text-slate-900 font-['Cairo',sans-serif] lg:min-w-[1100px]"`,
  true
);
replaceOne('layout mobile stack', `className="flex max-w-[1700px] mx-auto"`, `className="flex flex-col lg:flex-row max-w-[1700px] mx-auto"`, true);
replaceOne('aside mobile width', `className="w-64 p-5 shrink-0"`, `className="w-full lg:w-64 p-3 lg:p-5 shrink-0"`, true);
replaceOne('nav mobile sticky', `className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm sticky top-5"`, `className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm lg:sticky lg:top-5 grid grid-cols-2 sm:grid-cols-4 lg:block gap-1"`, true);
replaceOne('main mobile padding', `className="p-5 pl-8 flex-1 min-w-0"`, `className="p-3 lg:p-5 lg:pl-8 flex-1 min-w-0 w-full"`, true);
replaceAll('section horizontal scroll', `rounded-2xl shadow-sm overflow-hidden`, `rounded-2xl shadow-sm overflow-x-auto`);
replaceAll('table minimum width', `className="w-full text-sm"`, `className="w-full min-w-[760px] text-sm"`);
replaceAll('details grid mobile', `className="p-6 grid grid-cols-3 gap-4"`, `className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4"`);
replaceAll('two columns mobile', `grid grid-cols-2 gap-4`, `grid grid-cols-1 md:grid-cols-2 gap-4`);
replaceAll('three columns mobile', `grid grid-cols-3 gap-5`, `grid grid-cols-1 md:grid-cols-3 gap-5`);
replaceAll('four columns mobile', `grid grid-cols-4 gap-5`, `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5`);
replaceAll('md colspan', `className="col-span-2`, `className="md:col-span-2`);

// Rename the displayed area field to the current secret code label in Super Admin.
replaceAll('area label to current pin', `>المنطقة<`, `>الرمز السري الحالي<`);
replaceAll('area placeholder to current pin', `placeholder="المنطقة"`, `placeholder="الرمز السري الحالي"`);
replaceAll('area excel select label', `المنطقة</th>`, `الرمز السري الحالي</th>`);

// Ensure account info edits are saved through the Edge Function and propagated to profile/local owner data.
if (!content.includes(`action:'update_account_info'`) && !content.includes(`action: 'update_account_info'`)) {
  replaceRegex(
    'save account info via function',
    /  const saveAccountInfo = async \(e: React\.FormEvent\) => \{[\s\S]*?\n  \};\n\n  const saveCredentials/,
    `  const saveAccountInfo = async (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!selectedGeneratorId) return;\n    if (!accountInfoForm.name.trim() || !accountInfoForm.owner_name.trim()) return setMessage('اسم المولدة واسم صاحب المولدة مطلوبات');\n    setSavingAccount(true);\n    const payload = {\n      action:'update_account_info',\n      generator_id:selectedGeneratorId,\n      name: accountInfoForm.name.trim(),\n      owner_name: accountInfoForm.owner_name.trim(),\n      phone: accountInfoForm.phone.trim() || null,\n      area: accountInfoForm.area.trim() || null,\n    };\n    const { data, error } = await supabase.functions.invoke('manage-generator-account', { body: payload });\n    setSavingAccount(false);\n    if (error || !data?.ok) return setMessage('تعذر تعديل معلومات الحساب: ' + (data?.error || error?.message || 'خطأ غير معروف'));\n\n    try {\n      const generatorKey = scopedKey('moldatk_generator', selectedGeneratorId);\n      const stored = readJson<any>(generatorKey, {});\n      localStorage.setItem(generatorKey, JSON.stringify({\n        ...stored,\n        generatorName: payload.name,\n        ownerName: payload.owner_name,\n        ownerPhone: payload.phone || '',\n        location: payload.area || '',\n      }));\n      const rawAccounts = localStorage.getItem('moldatk_generator_accounts');\n      const accounts = rawAccounts ? JSON.parse(rawAccounts) : [];\n      if (Array.isArray(accounts)) {\n        localStorage.setItem('moldatk_generator_accounts', JSON.stringify(accounts.map((x: any) => x?.generatorId === selectedGeneratorId ? { ...x, generatorName: payload.name, ownerName: payload.owner_name, updatedAt: new Date().toISOString() } : x)));\n      }\n    } catch (err) {}\n\n    setAccountInfoOpen(false);\n    setMessage('تم تعديل معلومات الحساب وتحديثها لصاحب المولدة والجباة');\n    await load();\n  };\n\n  const saveCredentials`,
    true
  );
}

// Add monthly financial archive derived from admin_transactions. Current box shows only current month.
if (!content.includes('monthlyArchiveGroups')) {
  replaceOne(
    'add monthly archive calculations',
    `  const selectedGenerator = selectedGeneratorId ? generators.find(g => g.id === selectedGeneratorId) || null : null;\n  const selectedSubscription = selectedGeneratorId ? latestSubscriptionFor(selectedGeneratorId) : null;\n`,
    `  const selectedGenerator = selectedGeneratorId ? generators.find(g => g.id === selectedGeneratorId) || null : null;\n  const selectedSubscription = selectedGeneratorId ? latestSubscriptionFor(selectedGeneratorId) : null;\n\n  const monthKey = (value: string) => {\n    const d = new Date(value);\n    return Number.isFinite(d.getTime()) ? \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}\` : 'unknown';\n  };\n  const monthTitle = (key: string) => {\n    const [year, month] = key.split('-').map(Number);\n    if (!year || !month) return key;\n    return new Intl.DateTimeFormat('ar-IQ', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));\n  };\n  const currentMonthKey = monthKey(new Date().toISOString());\n  const currentMonthTransactions = useMemo(() => transactions.filter(x => monthKey(x.received_at) === currentMonthKey), [transactions, currentMonthKey]);\n  const monthlyArchiveGroups = useMemo(() => {\n    const groups = new Map<string, AdminTransaction[]>();\n    transactions.forEach(tx => {\n      const key = monthKey(tx.received_at);\n      if (key === currentMonthKey) return;\n      if (!groups.has(key)) groups.set(key, []);\n      groups.get(key)!.push(tx);\n    });\n    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([key, rows]) => {\n      const activationRows = rows.filter(x => x.category === 'subscription' || x.category === 'renewal');\n      const typeMap = new Map<string, { label: string; amount: number; count: number; total: number }>();\n      activationRows.forEach(x => {\n        const label = x.category === 'renewal' ? 'تجديد اشتراك' : 'تفعيل اشتراك';\n        const amount = Number(x.amount_iqd || 0);\n        const mapKey = label + '-' + amount;\n        const prev = typeMap.get(mapKey) || { label, amount, count: 0, total: 0 };\n        prev.count += 1;\n        prev.total += x.direction === 'refund' ? -amount : amount;\n        typeMap.set(mapKey, prev);\n      });\n      return {\n        key,\n        title: monthTitle(key),\n        rows,\n        activations: activationRows.length,\n        total: rows.reduce((sum, x) => sum + (x.direction === 'refund' ? -Number(x.amount_iqd || 0) : Number(x.amount_iqd || 0)), 0),\n        types: Array.from(typeMap.values()),\n        names: Array.from(new Set(activationRows.map(x => generatorName(x.generator_id)).filter(Boolean))),\n      };\n    });\n  }, [transactions, currentMonthKey, generators]);\n`,
    true
  );
}

replaceOne('finance current table rows', `{transactions.map(x => <tr key={x.id}`, `{currentMonthTransactions.map(x => <tr key={x.id}`, true);
replaceOne('finance empty current month message', `{transactions.length === 0 && <div className="p-10 text-center text-slate-500 font-bold">لا توجد حركات مالية بعد</div>}`, `{currentMonthTransactions.length === 0 && <div className="p-10 text-center text-slate-500 font-bold">صندوق هذا الشهر فارغ. الأرصدة السابقة موجودة في أرشيف الصندوق.</div>}`, true);

if (!content.includes('أرشيف الصندوق الشهري')) {
  replaceOne(
    'insert finance monthly archive section',
    `              {currentMonthTransactions.length === 0 && <div className="p-10 text-center text-slate-500 font-bold">صندوق هذا الشهر فارغ. الأرصدة السابقة موجودة في أرشيف الصندوق.</div>}\n            </section>\n          </>}`,
    `              {currentMonthTransactions.length === 0 && <div className="p-10 text-center text-slate-500 font-bold">صندوق هذا الشهر فارغ. الأرصدة السابقة موجودة في أرشيف الصندوق.</div>}\n            </section>\n\n            <section className="mt-5 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto">\n              <div className="p-5 border-b"><h2 className="text-lg font-black">أرشيف الصندوق الشهري</h2><p className="text-xs text-slate-500 mt-1">كل يوم 1 بالشهر يصير صندوق الشهر الحالي فارغ تلقائياً، والشهور السابقة تبقى هنا كتقرير.</p></div>\n              <div className="p-5 space-y-4 min-w-[760px]">\n                {monthlyArchiveGroups.length === 0 ? <div className="text-center text-slate-500 font-bold py-8">لا يوجد أرشيف شهري بعد</div> : monthlyArchiveGroups.map(month => (\n                  <details key={month.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">\n                    <summary className="cursor-pointer list-none flex items-center justify-between gap-4">\n                      <div><p className="font-black text-slate-900">{month.title}</p><p className="text-xs text-slate-500 mt-1">عدد عمليات التفعيل/التجديد: {month.activations}</p></div>\n                      <div className="text-left"><p className="text-xs text-slate-500 font-bold">مجموع الصندوق</p><p className="font-black text-emerald-700">{iqd(month.total)}</p></div>\n                    </summary>\n                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">\n                      <div className="bg-white rounded-xl border p-4"><p className="font-black mb-3">أنواع التفعيلات وأسعارها</p>{month.types.length === 0 ? <p className="text-sm text-slate-500">لا توجد تفعيلات بهذا الشهر</p> : month.types.map((t, i) => <div key={i} className="flex justify-between border-t py-2 text-sm"><span>{t.label} × {t.count}</span><b>{iqd(t.amount)}</b></div>)}</div>\n                      <div className="bg-white rounded-xl border p-4"><p className="font-black mb-3">أسماء الحسابات التي فعلت بالشهر السابق</p>{month.names.length === 0 ? <p className="text-sm text-slate-500">لا توجد أسماء</p> : <div className="flex flex-wrap gap-2">{month.names.map(name => <span key={name} className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-black">{name}</span>)}</div>}</div>\n                    </div>\n                  </details>\n                ))}\n              </div>\n            </section>\n          </>}`,
    true
  );
}

if (changed) fs.writeFileSync(filePath, content, 'utf8');
console.log('Super admin mobile and finance archive patch applied.');
