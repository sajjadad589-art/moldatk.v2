import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let changed = false;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}
function write(relativePath, content) {
  fs.writeFileSync(path.join(root, relativePath), content, 'utf8');
  changed = true;
  console.log('patched ' + relativePath);
}
function mustReplace(content, name, search, replace, optional = false) {
  if (!content.includes(search)) {
    if (optional) {
      console.warn('optional skipped: ' + name);
      return content;
    }
    throw new Error('Patch pattern not found: ' + name);
  }
  console.log('patched: ' + name);
  return content.replace(search, replace);
}
function insertAfter(content, name, marker, insert, uniqueNeedle) {
  if (uniqueNeedle && content.includes(uniqueNeedle)) return content;
  if (!content.includes(marker)) throw new Error('Patch marker not found: ' + name);
  console.log('patched: ' + name);
  return content.replace(marker, marker + insert);
}

// 1) Super Admin: account info edit, 4 digit PIN support, duplicate email suggestions.
{
  const file = 'src/components/SuperAdminDashboard.tsx';
  let content = read(file);

  const helperMarker = "const planDurationMs = (p: SubscriptionPlan, days='0', hours='0', minutes='0') => p.is_custom_duration ? customMinutes(days,hours,minutes)*60000 : Number(p.duration_days || p.duration_months*30)*86400000;\n";
  const helpers = `\nconst normalizeEmail = (email: string) => String(email || '').trim().toLowerCase();\nconst isFourDigitPin = (value: string) => /^\\d{4}$/.test(String(value || '').trim());\nconst toAuthPassword = (value: string) => isFourDigitPin(value) ? 'moldatk-pin-' + String(value || '').trim() : String(value || '').trim();\nconst buildEmailSuggestions = (email: string, usedEmails: string[]) => {\n  const normalized = normalizeEmail(email);\n  const used = new Set(usedEmails.map(normalizeEmail));\n  const parts = normalized.includes('@') ? normalized.split('@') : [normalized || 'generator', 'moldatk.local'];\n  const namePart = (parts[0] || 'generator').replace(/[^a-zA-Z0-9._-]/g, '') || 'generator';\n  const domain = parts[1] || 'moldatk.local';\n  const suggestions: string[] = [];\n  for (let i = 1; suggestions.length < 3 && i < 100; i += 1) {\n    const candidate = namePart + i + '@' + domain;\n    if (!used.has(candidate)) suggestions.push(candidate);\n  }\n  return suggestions;\n};\nconst emailDuplicateMessage = (email: string, generators: Generator[], excludeId?: string) => {\n  const normalized = normalizeEmail(email);\n  if (!normalized) return '';\n  const usedByOther = generators.some(g => g.id !== excludeId && normalizeEmail(g.email || '') === normalized);\n  if (!usedByOther) return '';\n  const suggestions = buildEmailSuggestions(normalized, generators.map(g => g.email || '').filter(Boolean));\n  return 'إيميل تسجيل الدخول مستخدم مسبقاً. جرّب واحد من هذني: ' + suggestions.join(' ، ');\n};\n`;
  content = insertAfter(content, 'add super admin helpers', helperMarker, helpers, 'const toAuthPassword = (value: string) =>');

  const stateSearch = "  const [credentialForm, setCredentialForm] = useState({ email:'', password:'' });\n  const [editSubscriptionForm, setEditSubscriptionForm] = useState({ plan_id:'', starts_at:'', ends_at:'', price_iqd:'', notes:'' });\n";
  const stateReplace = "  const [credentialForm, setCredentialForm] = useState({ email:'', password:'' });\n  const [accountInfoOpen, setAccountInfoOpen] = useState(false);\n  const [accountInfoForm, setAccountInfoForm] = useState({ name:'', owner_name:'', phone:'', area:'' });\n  const [editSubscriptionForm, setEditSubscriptionForm] = useState({ plan_id:'', starts_at:'', ends_at:'', price_iqd:'', notes:'' });\n";
  if (!content.includes('const [accountInfoOpen, setAccountInfoOpen]')) {
    content = mustReplace(content, 'add account info state', stateSearch, stateReplace);
  }

  const handlerMarker = `  const openCredentials = () => {\n    if (!selectedGenerator) return;\n    setCredentialForm({ email: selectedGenerator.email || '', password: '' });\n    setCredentialsOpen(true);\n  };\n\n`;
  const handlers = `  const openAccountInfo = () => {\n    if (!selectedGenerator) return;\n    setAccountInfoForm({\n      name: selectedGenerator.name || '',\n      owner_name: selectedGenerator.owner_name || '',\n      phone: selectedGenerator.phone || '',\n      area: selectedGenerator.area || '',\n    });\n    setAccountInfoOpen(true);\n  };\n\n  const saveAccountInfo = async (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!selectedGeneratorId) return;\n    if (!accountInfoForm.name.trim() || !accountInfoForm.owner_name.trim()) return setMessage('اسم المولدة واسم صاحب المولدة مطلوبات');\n    const payload = {\n      name: accountInfoForm.name.trim(),\n      owner_name: accountInfoForm.owner_name.trim(),\n      phone: accountInfoForm.phone.trim() || null,\n      area: accountInfoForm.area.trim() || null,\n    };\n    setSavingAccount(true);\n    const { data, error } = await supabase.functions.invoke('manage-generator-account', {\n      body: { action: 'update_info', generator_id: selectedGeneratorId, ...payload }\n    });\n    setSavingAccount(false);\n    if (error || !data?.ok) return setMessage('تعذر تعديل معلومات الحساب: ' + (data?.error || error?.message || 'خطأ غير معروف'));\n\n    setGenerators(prev => prev.map(g => g.id === selectedGeneratorId ? { ...g, ...payload } : g));\n    try {\n      const generatorKey = scopedKey('moldatk_generator', selectedGeneratorId);\n      const stored = readJson<any>(generatorKey, {});\n      localStorage.setItem(generatorKey, JSON.stringify({\n        ...stored,\n        generatorName: payload.name,\n        ownerName: payload.owner_name,\n        ownerPhone: payload.phone || '',\n        location: payload.area || '',\n      }));\n      const rawAccounts = localStorage.getItem('moldatk_generator_accounts');\n      const accounts = rawAccounts ? JSON.parse(rawAccounts) : [];\n      if (Array.isArray(accounts)) {\n        localStorage.setItem('moldatk_generator_accounts', JSON.stringify(accounts.map((x: any) =>\n          x?.generatorId === selectedGeneratorId\n            ? { ...x, generatorName: payload.name, ownerName: payload.owner_name, ownerPhone: payload.phone || '', area: payload.area || '', updatedAt: new Date().toISOString() }\n            : x\n        )));\n      }\n      window.dispatchEvent(new Event('moldatk-local-sync'));\n    } catch (err) {}\n\n    setAccountInfoOpen(false);\n    setMessage('تم تعديل معلومات الحساب وظهورها لدى صاحب المولدة والجباة');\n    await load();\n  };\n\n`;
  content = insertAfter(content, 'add account info handlers', handlerMarker, handlers, 'const saveAccountInfo = async');

  // If an older direct-update implementation exists, force it to use the Edge Function.
  const directUpdateSnippet = `    const { error } = await supabase.from('generators').update(payload).eq('id', selectedGeneratorId);\n    setSavingAccount(false);\n    if (error) return setMessage(\`تعذر تعديل معلومات الحساب: \${error.message}\`);`;
  const edgeUpdateSnippet = `    const { data, error } = await supabase.functions.invoke('manage-generator-account', {\n      body: { action: 'update_info', generator_id: selectedGeneratorId, ...payload }\n    });\n    setSavingAccount(false);\n    if (error || !data?.ok) return setMessage('تعذر تعديل معلومات الحساب: ' + (data?.error || error?.message || 'خطأ غير معروف'));`;
  content = content.replace(directUpdateSnippet, edgeUpdateSnippet);

  const createValidationSearch = `    const plan = plans.find(x => x.id === generatorForm.plan_id);\n    if (!plan) return setMessage('اختر نوع الاشتراك');\n`;
  const createValidationReplace = `    const normalizedEmail = normalizeEmail(generatorForm.email);\n    const duplicateEmail = emailDuplicateMessage(normalizedEmail, generators);\n    if (duplicateEmail) return setMessage(duplicateEmail);\n    if (generatorForm.password.trim().length < 4) return setMessage('الرمز / كلمة المرور لازم لا يقل عن 4 أرقام أو أحرف');\n    const plan = plans.find(x => x.id === generatorForm.plan_id);\n    if (!plan) return setMessage('اختر نوع الاشتراك');\n`;
  if (!content.includes('const duplicateEmail = emailDuplicateMessage(normalizedEmail, generators);')) {
    content = mustReplace(content, 'validate duplicate email/create password min 4', createValidationSearch, createValidationReplace);
    content = mustReplace(content, 'send normalized email and transformed password',
      `        email: generatorForm.email.trim().toLowerCase(), password: generatorForm.password,\n`,
      `        email: normalizedEmail, password: toAuthPassword(generatorForm.password),\n`
    );
  }

  const credentialsSearch = `    if (!selectedGeneratorId) return;\n    if (!credentialForm.email.trim() && !credentialForm.password.trim()) return setMessage('أدخل الإيميل أو كلمة مرور جديدة');\n    setSavingAccount(true);\n    const { data, error } = await supabase.functions.invoke('manage-generator-account', {\n      body: { action:'update_credentials', generator_id:selectedGeneratorId, email:credentialForm.email.trim() || null, password:credentialForm.password || null }\n    });\n    setSavingAccount(false);\n    if (error || !data?.ok) return setMessage(\`تعذر تعديل بيانات الدخول: \${data?.error || error?.message || 'خطأ غير معروف'}\`);\n`;
  const credentialsReplace = `    if (!selectedGeneratorId) return;\n    if (!credentialForm.email.trim() && !credentialForm.password.trim()) return setMessage('أدخل الإيميل أو كلمة مرور جديدة');\n    const nextEmail = normalizeEmail(credentialForm.email);\n    const duplicateEmail = nextEmail ? emailDuplicateMessage(nextEmail, generators, selectedGeneratorId) : '';\n    if (duplicateEmail) return setMessage(duplicateEmail);\n    if (credentialForm.password.trim() && credentialForm.password.trim().length < 4) return setMessage('الرمز / كلمة المرور ممكن يكون 4 أرقام، لكن لا يقل عن 4');\n    setSavingAccount(true);\n    const { data, error } = await supabase.functions.invoke('manage-generator-account', {\n      body: { action:'update_credentials', generator_id:selectedGeneratorId, email:nextEmail || null, password:credentialForm.password.trim() ? toAuthPassword(credentialForm.password) : null }\n    });\n    setSavingAccount(false);\n    if (error || !data?.ok) {\n      const suggestions = nextEmail ? buildEmailSuggestions(nextEmail, generators.map(g => g.email || '').filter(Boolean)) : [];\n      return setMessage('تعذر تعديل بيانات الدخول: ' + (data?.error || error?.message || 'خطأ غير معروف') + (suggestions.length ? ' — اقتراحات إيميل بديلة: ' + suggestions.join(' ، ') : ''));\n    }\n`;
  if (!content.includes('toAuthPassword(credentialForm.password)')) {
    content = mustReplace(content, 'credentials duplicate/min4/transform', credentialsSearch, credentialsReplace);
  }

  const closeSearch = `setSelectedGeneratorId(null); setRenewalOpen(false); setCredentialsOpen(false); setEditSubscriptionOpen(false);`;
  const closeReplace = `setAccountInfoOpen(false); setSelectedGeneratorId(null); setRenewalOpen(false); setCredentialsOpen(false); setEditSubscriptionOpen(false);`;
  if (!content.includes(closeReplace)) content = mustReplace(content, 'close account info with modal', closeSearch, closeReplace, true);

  const headerSearch = `<div><h2 className="text-xl font-black">{selectedGenerator.name}</h2><p className="text-xs text-slate-500 mt-1">تفاصيل الحساب والاشتراك</p></div><button onClick={() => { setAccountInfoOpen(false); setSelectedGeneratorId(null); setRenewalOpen(false); setCredentialsOpen(false); setEditSubscriptionOpen(false); }} className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>`;
  const headerReplace = `<div><h2 className="text-xl font-black">{selectedGenerator.name}</h2><p className="text-xs text-slate-500 mt-1">تفاصيل الحساب والاشتراك</p></div><div className="flex items-center gap-2"><button onClick={openAccountInfo} className="px-4 py-2 rounded-xl bg-blue-700 text-white font-black text-xs inline-flex items-center gap-2"><Pencil className="w-4 h-4" />تعديل كل معلومات الحساب</button><button onClick={() => { setAccountInfoOpen(false); setSelectedGeneratorId(null); setRenewalOpen(false); setCredentialsOpen(false); setEditSubscriptionOpen(false); }} className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button></div>`;
  if (!content.includes('تعديل كل معلومات الحساب')) {
    content = mustReplace(content, 'add edit account button', headerSearch, headerReplace, true);
  }

  const formMarker = `          </div>\n\n          {credentialsOpen && <form onSubmit={saveCredentials}`;
  const formInsert = `          </div>\n\n          {accountInfoOpen && <form onSubmit={saveAccountInfo} className="mx-6 mb-6 bg-blue-50/60 border border-blue-100 rounded-2xl p-5 grid grid-cols-2 gap-4">\n            <div className="col-span-2"><h3 className="font-black text-lg">تعديل كل معلومات صاحب المولدة</h3><p className="text-xs text-slate-500 mt-1">أي تعديل هنا ينحفظ في قاعدة البيانات ويظهر عند صاحب المولدة والجباة بعد التحديث/تسجيل الدخول.</p></div>\n            <input required placeholder="اسم المولدة" value={accountInfoForm.name} onChange={e=>setAccountInfoForm(f=>({...f,name:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white" />\n            <input required placeholder="اسم صاحب المولدة" value={accountInfoForm.owner_name} onChange={e=>setAccountInfoForm(f=>({...f,owner_name:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white" />\n            <input placeholder="رقم الهاتف" value={accountInfoForm.phone} onChange={e=>setAccountInfoForm(f=>({...f,phone:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white" />\n            <input placeholder="المنطقة" value={accountInfoForm.area} onChange={e=>setAccountInfoForm(f=>({...f,area:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white" />\n            <div className="col-span-2 flex justify-end gap-3"><button type="button" onClick={()=>setAccountInfoOpen(false)} className="px-4 py-2.5 rounded-xl border font-black bg-white">إلغاء</button><button disabled={savingAccount} className="px-5 py-2.5 rounded-xl bg-blue-700 text-white font-black disabled:opacity-50 inline-flex items-center gap-2"><Save className="w-4 h-4"/>حفظ كل المعلومات</button></div>\n          </form>}\n\n          {credentialsOpen && <form onSubmit={saveCredentials}`;
  if (!content.includes('accountInfoOpen && <form onSubmit={saveAccountInfo}')) {
    content = mustReplace(content, 'insert account info edit form', formMarker, formInsert);
  }

  content = content.replace(`minLength={6} placeholder="كلمة المرور الأولية"`, `minLength={4} placeholder="كلمة المرور الأولية / رمز 4 أرقام"`);
  content = content.replace(`type="text" minLength={6} placeholder="كلمة مرور جديدة (اختياري)"`, `type="text" minLength={4} placeholder="كلمة مرور جديدة / رمز 4 أرقام (اختياري)"`);

  write(file, content);
}

// 2) Owner login: 4 digit PIN is transformed to the real Supabase password automatically.
{
  const file = 'src/components/LoginView.tsx';
  let content = read(file);
  const marker = `    const cleanPass = passwordInput.trim();\n`;
  const insert = `    const authPass = /^\\d{4}$/.test(cleanPass) ? 'moldatk-pin-' + cleanPass : cleanPass;\n`;
  content = insertAfter(content, 'owner login four digit pin transform', marker, insert, 'const authPass = /^\\d{4}$/.test(cleanPass)');
  content = content.replace(`          password: cleanPass,`, `          password: authPass,`);
  write(file, content);
}

if (!changed) console.log('No changes needed.');
console.log('Super admin account edit v24 patch applied.');
