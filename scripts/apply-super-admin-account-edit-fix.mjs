import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const filePath = path.join(root, 'src/components/SuperAdminDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');
let changed = false;

function patch(name, search, replace, optional = false) {
  if (!content.includes(search)) {
    if (optional) {
      console.warn(`optional patch skipped: ${name}`);
      return;
    }
    throw new Error(`Patch pattern not found: ${name}`);
  }
  content = content.replace(search, replace);
  changed = true;
  console.log(`patched: ${name}`);
}

if (!content.includes('const buildEmailSuggestions =')) {
  patch(
    'add email helpers',
    `const planLabel = (p: SubscriptionPlan) => p.is_custom_duration ? p.name : p.name;\nconst planDurationMs = (p: SubscriptionPlan, days='0', hours='0', minutes='0') => p.is_custom_duration ? customMinutes(days,hours,minutes)*60000 : Number(p.duration_days || p.duration_months*30)*86400000;\n`,
    `const planLabel = (p: SubscriptionPlan) => p.is_custom_duration ? p.name : p.name;\nconst planDurationMs = (p: SubscriptionPlan, days='0', hours='0', minutes='0') => p.is_custom_duration ? customMinutes(days,hours,minutes)*60000 : Number(p.duration_days || p.duration_months*30)*86400000;\n\nconst normalizeEmail = (email: string) => email.trim().toLowerCase();\nconst buildEmailSuggestions = (email: string, usedEmails: string[]) => {\n  const normalized = normalizeEmail(email);\n  const used = new Set(usedEmails.map(normalizeEmail));\n  const [namePartRaw, domainRaw] = normalized.includes('@') ? normalized.split('@') : [normalized || 'generator', 'moldatk.local'];\n  const namePart = (namePartRaw || 'generator').replace(/[^a-zA-Z0-9._-]/g, '') || 'generator';\n  const domain = domainRaw || 'moldatk.local';\n  const suggestions: string[] = [];\n  for (let i = 1; suggestions.length < 3 && i < 100; i += 1) {\n    const candidate = namePart + i + '@' + domain;\n    if (!used.has(candidate)) suggestions.push(candidate);\n  }\n  return suggestions;\n};\nconst emailDuplicateMessage = (email: string, generators: Generator[], excludeId?: string) => {\n  const normalized = normalizeEmail(email);\n  if (!normalized) return '';\n  const usedByOther = generators.some(g => g.id !== excludeId && normalizeEmail(g.email || '') === normalized);\n  if (!usedByOther) return '';\n  const suggestions = buildEmailSuggestions(normalized, generators.map(g => g.email || '').filter(Boolean));\n  return 'إيميل تسجيل الدخول مستخدم مسبقاً. جرّب واحد من هذني: ' + suggestions.join(' ، ');\n};\n`
  );
}

if (!content.includes('const [accountInfoOpen, setAccountInfoOpen]')) {
  patch(
    'add account info state',
    `  const [credentialForm, setCredentialForm] = useState({ email:'', password:'' });\n  const [editSubscriptionForm, setEditSubscriptionForm] = useState({ plan_id:'', starts_at:'', ends_at:'', price_iqd:'', notes:'' });\n`,
    `  const [credentialForm, setCredentialForm] = useState({ email:'', password:'' });\n  const [accountInfoOpen, setAccountInfoOpen] = useState(false);\n  const [accountInfoForm, setAccountInfoForm] = useState({ name:'', owner_name:'', phone:'', area:'' });\n  const [editSubscriptionForm, setEditSubscriptionForm] = useState({ plan_id:'', starts_at:'', ends_at:'', price_iqd:'', notes:'' });\n`
  );
}

if (!content.includes('const openAccountInfo = () =>')) {
  patch(
    'add account info handlers',
    `  const openCredentials = () => {\n    if (!selectedGenerator) return;\n    setCredentialForm({ email: selectedGenerator.email || '', password: '' });\n    setCredentialsOpen(true);\n  };\n\n  const saveCredentials = async (e: React.FormEvent) => {\n`,
    `  const openCredentials = () => {\n    if (!selectedGenerator) return;\n    setCredentialForm({ email: selectedGenerator.email || '', password: '' });\n    setCredentialsOpen(true);\n  };\n\n  const openAccountInfo = () => {\n    if (!selectedGenerator) return;\n    setAccountInfoForm({\n      name: selectedGenerator.name || '',\n      owner_name: selectedGenerator.owner_name || '',\n      phone: selectedGenerator.phone || '',\n      area: selectedGenerator.area || '',\n    });\n    setAccountInfoOpen(true);\n  };\n\n  const saveAccountInfo = async (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!selectedGeneratorId) return;\n    if (!accountInfoForm.name.trim() || !accountInfoForm.owner_name.trim()) return setMessage('اسم المولدة واسم صاحب المولدة مطلوبات');\n    setSavingAccount(true);\n    const payload = {\n      name: accountInfoForm.name.trim(),\n      owner_name: accountInfoForm.owner_name.trim(),\n      phone: accountInfoForm.phone.trim() || null,\n      area: accountInfoForm.area.trim() || null,\n    };\n    const { error } = await supabase.from('generators').update(payload).eq('id', selectedGeneratorId);\n    setSavingAccount(false);\n    if (error) return setMessage('تعذر تعديل معلومات الحساب: ' + error.message);\n\n    try {\n      const generatorKey = scopedKey('moldatk_generator', selectedGeneratorId);\n      const stored = readJson<any>(generatorKey, {});\n      localStorage.setItem(generatorKey, JSON.stringify({\n        ...stored,\n        generatorName: payload.name,\n        ownerName: payload.owner_name,\n        ownerPhone: payload.phone || '',\n        location: payload.area || '',\n      }));\n\n      const rawAccounts = localStorage.getItem('moldatk_generator_accounts');\n      const accounts = rawAccounts ? JSON.parse(rawAccounts) : [];\n      if (Array.isArray(accounts)) {\n        localStorage.setItem('moldatk_generator_accounts', JSON.stringify(accounts.map((x: any) => x?.generatorId === selectedGeneratorId ? { ...x, generatorName: payload.name, ownerName: payload.owner_name, updatedAt: new Date().toISOString() } : x)));\n      }\n    } catch (err) {}\n\n    setAccountInfoOpen(false);\n    setMessage('تم تعديل معلومات الحساب بنجاح');\n    await load();\n  };\n\n  const saveCredentials = async (e: React.FormEvent) => {\n`
  );
}

if (!content.includes('password.trim().length < 4')) {
  patch(
    'create generator duplicate and password validation',
    `    const plan = plans.find(x => x.id === generatorForm.plan_id);\n    if (!plan) return setMessage('اختر نوع الاشتراك');\n`,
    `    const normalizedEmail = normalizeEmail(generatorForm.email);\n    const duplicateEmailMessage = emailDuplicateMessage(normalizedEmail, generators);\n    if (duplicateEmailMessage) return setMessage(duplicateEmailMessage);\n    if (generatorForm.password.trim().length < 4) return setMessage('الرمز / كلمة المرور لازم لا يقل عن 4 أرقام أو أحرف');\n    const plan = plans.find(x => x.id === generatorForm.plan_id);\n    if (!plan) return setMessage('اختر نوع الاشتراك');\n`
  );
  patch(
    'create generator normalized email',
    `        email: generatorForm.email.trim().toLowerCase(), password: generatorForm.password,\n`,
    `        email: normalizedEmail, password: generatorForm.password.trim(),\n`
  );
}

if (!content.includes('if (credentialForm.password.trim() && credentialForm.password.trim().length < 4)')) {
  patch(
    'credentials duplicate and 4 digit validation',
    `    if (!selectedGeneratorId) return;\n    if (!credentialForm.email.trim() && !credentialForm.password.trim()) return setMessage('أدخل الإيميل أو كلمة مرور جديدة');\n    setSavingAccount(true);\n    const { data, error } = await supabase.functions.invoke('manage-generator-account', {\n      body: { action:'update_credentials', generator_id:selectedGeneratorId, email:credentialForm.email.trim() || null, password:credentialForm.password || null }\n    });\n`,
    `    if (!selectedGeneratorId) return;\n    if (!credentialForm.email.trim() && !credentialForm.password.trim()) return setMessage('أدخل الإيميل أو كلمة مرور جديدة');\n    const nextEmail = normalizeEmail(credentialForm.email);\n    const duplicateEmailMessage = nextEmail ? emailDuplicateMessage(nextEmail, generators, selectedGeneratorId) : '';\n    if (duplicateEmailMessage) return setMessage(duplicateEmailMessage);\n    if (credentialForm.password.trim() && credentialForm.password.trim().length < 4) return setMessage('الرمز / كلمة المرور ممكن يكون 4 أرقام، لكن لا يقل عن 4');\n    setSavingAccount(true);\n    const { data, error } = await supabase.functions.invoke('manage-generator-account', {\n      body: { action:'update_credentials', generator_id:selectedGeneratorId, email:nextEmail || null, password:credentialForm.password.trim() || null }\n    });\n`
  );
}

if (!content.includes('اقتراحات إيميل بديلة')) {
  patch(
    'improve account error message with suggestions',
    `    setSavingAccount(false);\n    if (error || !data?.ok) return setMessage(\`تعذر تعديل بيانات الدخول: \${data?.error || error?.message || 'خطأ غير معروف'}\`);\n`,
    `    setSavingAccount(false);\n    if (error || !data?.ok) {\n      const suggestions = credentialForm.email ? buildEmailSuggestions(credentialForm.email, generators.map(g => g.email || '').filter(Boolean)) : [];\n      return setMessage('تعذر تعديل بيانات الدخول: ' + (data?.error || error?.message || 'خطأ غير معروف') + (suggestions.length ? ' — اقتراحات إيميل بديلة: ' + suggestions.join(' ، ') : ''));\n    }\n`
  );
}

if (!content.includes('setAccountInfoOpen(false); setSelectedGeneratorId(null)')) {
  patch(
    'close account info when details closes',
    `setSelectedGeneratorId(null); setRenewalOpen(false); setCredentialsOpen(false); setEditSubscriptionOpen(false);`,
    `setAccountInfoOpen(false); setSelectedGeneratorId(null); setRenewalOpen(false); setCredentialsOpen(false); setEditSubscriptionOpen(false);`
  );
}

if (!content.includes('تعديل معلومات الحساب')) {
  patch(
    'add edit account button to details header',
    `<div><h2 className="text-xl font-black">{selectedGenerator.name}</h2><p className="text-xs text-slate-500 mt-1">تفاصيل الحساب والاشتراك</p></div><button onClick={() => { setAccountInfoOpen(false); setSelectedGeneratorId(null); setRenewalOpen(false); setCredentialsOpen(false); setEditSubscriptionOpen(false); }} className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>`,
    `<div><h2 className="text-xl font-black">{selectedGenerator.name}</h2><p className="text-xs text-slate-500 mt-1">تفاصيل الحساب والاشتراك</p></div><div className="flex items-center gap-2"><button onClick={openAccountInfo} className="px-4 py-2 rounded-xl bg-blue-700 text-white font-black text-xs inline-flex items-center gap-2"><Pencil className="w-4 h-4" />تعديل معلومات الحساب</button><button onClick={() => { setAccountInfoOpen(false); setSelectedGeneratorId(null); setRenewalOpen(false); setCredentialsOpen(false); setEditSubscriptionOpen(false); }} className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button></div>`
  );
}

if (!content.includes('accountInfoOpen && <form onSubmit={saveAccountInfo}')) {
  patch(
    'insert account info edit form',
    `          </div>\n\n          {credentialsOpen && <form onSubmit={saveCredentials}`,
    `          </div>\n\n          {accountInfoOpen && <form onSubmit={saveAccountInfo} className="mx-6 mb-6 bg-blue-50/60 border border-blue-100 rounded-2xl p-5 grid grid-cols-2 gap-4">\n            <div className="col-span-2"><h3 className="font-black text-lg">تعديل معلومات صاحب المولدة</h3><p className="text-xs text-slate-500 mt-1">كل المعلومات المدخلة سابقاً أصبحت قابلة للتعديل من هنا.</p></div>\n            <input required placeholder="اسم المولدة" value={accountInfoForm.name} onChange={e=>setAccountInfoForm(f=>({...f,name:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white" />\n            <input required placeholder="اسم صاحب المولدة" value={accountInfoForm.owner_name} onChange={e=>setAccountInfoForm(f=>({...f,owner_name:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white" />\n            <input placeholder="رقم الهاتف" value={accountInfoForm.phone} onChange={e=>setAccountInfoForm(f=>({...f,phone:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white" />\n            <input placeholder="المنطقة" value={accountInfoForm.area} onChange={e=>setAccountInfoForm(f=>({...f,area:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white" />\n            <div className="col-span-2 flex justify-end gap-3"><button type="button" onClick={()=>setAccountInfoOpen(false)} className="px-4 py-2.5 rounded-xl border font-black bg-white">إلغاء</button><button disabled={savingAccount} className="px-5 py-2.5 rounded-xl bg-blue-700 text-white font-black disabled:opacity-50 inline-flex items-center gap-2"><Save className="w-4 h-4"/>حفظ معلومات الحساب</button></div>\n          </form>}\n\n          {credentialsOpen && <form onSubmit={saveCredentials}`
  );
}

patch('allow 4 chars in create password input', `minLength={6} placeholder="كلمة المرور الأولية"`, `minLength={4} placeholder="كلمة المرور الأولية / رمز 4 أرقام"`, true);
patch('allow 4 chars in credentials password input', `type="text" minLength={6} placeholder="كلمة مرور جديدة (اختياري)"`, `type="text" minLength={4} placeholder="كلمة مرور جديدة / رمز 4 أرقام (اختياري)"`, true);

if (changed) {
  fs.writeFileSync(filePath, content, 'utf8');
}
console.log('Super admin account edit patch applied.');
