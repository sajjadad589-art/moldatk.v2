import fs from 'node:fs';

const p = 'src/components/SuperAdminDashboard.tsx';
let c = fs.readFileSync(p, 'utf8');

// Keep create-account errors inside the modal so they are visible above the form overlay.
if (!c.includes('const [generatorFormError, setGeneratorFormError]')) {
  c = c.replace(
    "  const [message, setMessage] = useState<string | null>(null);",
    "  const [message, setMessage] = useState<string | null>(null);\n  const [generatorFormError, setGeneratorFormError] = useState<string | null>(null);"
  );
}

const createStart = c.indexOf('  const createGeneratorAccount = async (e: React.FormEvent) => {');
const createEnd = createStart >= 0 ? c.indexOf('\n\n  const renewSubscription', createStart) : -1;
if (createStart < 0 || createEnd < 0) throw new Error('createGeneratorAccount handler not found');

const createHandler = `  const createGeneratorAccount = async (e: React.FormEvent) => {\n    e.preventDefault();\n    setGeneratorFormError(null);\n    setMessage(null);\n\n    const cleanName = generatorForm.name.trim();\n    const cleanOwner = generatorForm.owner_name.trim();\n    const cleanEmail = generatorForm.email.trim().toLowerCase();\n    const cleanPassword = generatorForm.password.trim();\n\n    if (!cleanName || !cleanOwner || !cleanEmail || !cleanPassword) {\n      setGeneratorFormError('أكمل اسم المولدة، اسم المالك، البريد وكلمة المرور');\n      return;\n    }\n\n    const duplicateGenerator = generators.find(g => (g.email || '').trim().toLowerCase() === cleanEmail);\n    if (duplicateGenerator) {\n      setGeneratorFormError('إيميل تسجيل الدخول مستخدم مسبقاً لحساب ' + duplicateGenerator.name + '. استخدم إيميلاً مختلفاً.');\n      return;\n    }\n\n    const plan = plans.find(x => x.id === generatorForm.plan_id);\n    if (!plan) {\n      setGeneratorFormError('اختر نوع الاشتراك');\n      return;\n    }\n\n    const start = new Date(generatorForm.starts_at);\n    const durationMs = planDurationMs(plan, generatorForm.test_days, generatorForm.test_hours, generatorForm.test_minutes);\n    if (!Number.isFinite(start.getTime()) || durationMs <= 0) {\n      setGeneratorFormError('حدد مدة اشتراك صحيحة');\n      return;\n    }\n\n    const end = new Date(start.getTime() + durationMs);\n    setCreatingGenerator(true);\n\n    try {\n      const { data, error } = await supabase.functions.invoke('create-generator-account', {\n        body: {\n          name: cleanName,\n          owner_name: cleanOwner,\n          phone: generatorForm.phone.trim() || null,\n          area: generatorForm.area.trim() || null,\n          email: cleanEmail,\n          password: cleanPassword,\n          plan_id: plan.id,\n          starts_at: start.toISOString(),\n          ends_at: end.toISOString(),\n          price_iqd: Number(generatorForm.price_iqd || plan.price_iqd || 0),\n        }\n      });\n\n      let serverMessage = data?.error || '';\n      if (error && !serverMessage) {\n        const context = (error as any)?.context;\n        if (context && typeof context.clone === 'function') {\n          try {\n            const payload = await context.clone().json();\n            serverMessage = payload?.error || payload?.message || '';\n          } catch {}\n        }\n        if (!serverMessage) serverMessage = (error as any)?.message || 'خطأ غير معروف';\n      }\n\n      if (error || !data?.ok) {\n        const text = serverMessage || 'خطأ غير معروف';\n        setGeneratorFormError(text.includes('مستخدم مسبقاً')\n          ? 'إيميل تسجيل الدخول مستخدم مسبقاً. استخدم إيميلاً مختلفاً.'\n          : 'تعذر إنشاء الحساب: ' + text);\n        return;\n      }\n\n      setGeneratorForm({ name:'', owner_name:'', phone:'', area:'', email:'', password:'', plan_id:'', starts_at:localDateTimeValue(), price_iqd:'', test_days:'0', test_hours:'0', test_minutes:'30' });\n      setGeneratorFormError(null);\n      setGeneratorOpen(false);\n      setMessage('تم إنشاء صاحب المولدة وحساب الدخول والاشتراك بنجاح');\n      await load();\n    } catch (err: any) {\n      setGeneratorFormError('تعذر إنشاء الحساب: ' + (err?.message || 'خطأ غير معروف'));\n    } finally {\n      setCreatingGenerator(false);\n    }\n  };`;

c = c.slice(0, createStart) + createHandler + c.slice(createEnd);

// Reset the modal-local error whenever the dialog is opened or closed.
c = c.replace(
  '<button onClick={() => setGeneratorOpen(true)} className="bg-blue-700',
  '<button onClick={() => { setGeneratorFormError(null); setGeneratorOpen(true); }} className="bg-blue-700'
);
c = c.replaceAll('onClick={() => setGeneratorOpen(false)}', 'onClick={() => { setGeneratorFormError(null); setGeneratorOpen(false); }}');

const modalStart = c.indexOf('      {generatorOpen && <div');
const modalEnd = modalStart >= 0 ? c.indexOf('\n      </div>}\n    </div>', modalStart) : -1;
if (modalStart < 0) throw new Error('Generator modal not found');
const safeEnd = modalEnd > modalStart ? modalEnd : c.length;
let modal = c.slice(modalStart, safeEnd);

// Force light form controls. The app root may carry dark color-scheme, which made these inputs render black on iPhone.
modal = modal.replace(
  'className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[94vh] overflow-y-auto"',
  'className="w-full max-w-3xl bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[94vh] overflow-y-auto" style={{ colorScheme: \'light\' }}'
);

const lightField = 'border border-slate-300 rounded-xl px-3 py-3 bg-white text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';
const lightSmallField = 'mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';
const lightDateField = 'mt-1 w-full border border-slate-300 rounded-xl px-3 py-3 bg-white text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';

modal = modal.replaceAll('className="border rounded-xl px-3 py-3"', `className="${lightField}"`);
modal = modal.replaceAll('className="border rounded-xl px-3 py-3 bg-white"', `className="${lightField}"`);
modal = modal.replaceAll('className="mt-1 w-full border rounded-xl px-3 py-3"', `className="${lightDateField}"`);
modal = modal.replaceAll('className="mt-1 w-full border rounded-xl px-3 py-2 bg-white"', `className="${lightSmallField}"`);

// Make backend/validation errors visible inside the dialog instead of behind it.
if (!modal.includes('{generatorFormError &&')) {
  const gridNeedle = '          <div className="p-6 grid grid-cols-2 gap-4">';
  modal = modal.replace(
    gridNeedle,
    `          {generatorFormError && <div role="alert" className="mx-6 mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{generatorFormError}</div>}\n${gridNeedle}`
  );
}

// Be explicit about submission; mobile Safari should never infer a non-submit button here.
modal = modal.replace(
  '<button disabled={creatingGenerator} className="px-6 py-2.5 rounded-xl bg-blue-700 text-white font-black disabled:opacity-50">',
  '<button type="submit" disabled={creatingGenerator} className="px-6 py-2.5 rounded-xl bg-blue-700 text-white font-black disabled:opacity-50 disabled:cursor-not-allowed">'
);

c = c.slice(0, modalStart) + modal + c.slice(safeEnd);
fs.writeFileSync(p, c);
console.log('Applied Super Admin owner-create fix: readable light inputs, explicit submit, duplicate-email validation, and visible modal errors');
