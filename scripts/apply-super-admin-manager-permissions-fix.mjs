import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const superPath = path.join(root, 'src/components/SuperAdminDashboard.tsx');
const loginPath = path.join(root, 'src/components/LoginView.tsx');
const typesPath = path.join(root, 'src/types.ts');
let superContent = fs.readFileSync(superPath, 'utf8');
let loginContent = fs.readFileSync(loginPath, 'utf8');
let typesContent = fs.readFileSync(typesPath, 'utf8');
let changed = false;

function replaceIn(which, name, search, replace, optional = false) {
  let content = which === 'super' ? superContent : which === 'login' ? loginContent : typesContent;
  if (!content.includes(search)) {
    if (optional) { console.warn(`optional patch skipped: ${name}`); return; }
    throw new Error(`Patch pattern not found: ${name}`);
  }
  content = content.replace(search, replace);
  if (which === 'super') superContent = content;
  else if (which === 'login') loginContent = content;
  else typesContent = content;
  changed = true;
  console.log(`patched: ${name}`);
}

// types: allow restricted super admin managers to enter the super admin route.
replaceIn('types', 'add super_admin_manager role type',
  "export type UserRole = 'super_admin' | 'generator_admin' | 'admin' | 'collector';",
  "export type UserRole = 'super_admin' | 'super_admin_manager' | 'generator_admin' | 'admin' | 'collector';",
  true
);

// login: managers can log in, and 4-digit PIN is translated to the internal secure password.
replaceIn('login', 'admin login password fallback',
  "        const { data, error } = await supabase.auth.signInWithPassword({\n          email: cleanInput,\n          password: cleanPass,\n        });\n\n        if (error || !data.user) {\n          setErrorMessage('البريد الإلكتروني أو كلمة المرور غير صحيحة');\n          return;\n        }",
  "        let { data, error } = await supabase.auth.signInWithPassword({\n          email: cleanInput,\n          password: cleanPass,\n        });\n\n        if ((error || !data.user) && cleanPass.length >= 4 && cleanPass.length < 6) {\n          const retry = await supabase.auth.signInWithPassword({\n            email: cleanInput,\n            password: cleanPass + 'moldatk',\n          });\n          data = retry.data;\n          error = retry.error;\n        }\n\n        if (error || !data.user) {\n          setErrorMessage('البريد الإلكتروني أو كلمة المرور غير صحيحة');\n          return;\n        }",
  true
);
replaceIn('login', 'allow super admin manager login',
  "        if (profile.role !== 'super_admin' && profile.role !== 'generator_admin') {\n          await supabase.auth.signOut();\n          setErrorMessage('هذا الحساب غير مخول للدخول كتطبيق مالك مولدة');\n          return;\n        }",
  "        if (profile.role !== 'super_admin' && profile.role !== 'super_admin_manager' && profile.role !== 'generator_admin') {\n          await supabase.auth.signOut();\n          setErrorMessage('هذا الحساب غير مخول للدخول كتطبيق مالك مولدة');\n          return;\n        }",
  true
);

// super admin dashboard types and states.
replaceIn('super', 'add managers tab type',
  "type Tab = 'overview' | 'generators' | 'finance' | 'notifications';",
  "type Tab = 'overview' | 'generators' | 'finance' | 'notifications' | 'managers';",
  true
);
if (!superContent.includes('type SuperAdminManager =')) {
  replaceIn('super', 'add manager type',
    "type AppNotification = {\n  id: string;\n  title: string;\n  body: string;\n  category: 'maintenance' | 'offer' | 'update' | 'general';\n  target_type: 'all_generators' | 'single_generator';\n  generator_id: string | null;\n  is_active: boolean;\n  created_at: string;\n};",
    "type AppNotification = {\n  id: string;\n  title: string;\n  body: string;\n  category: 'maintenance' | 'offer' | 'update' | 'general';\n  target_type: 'all_generators' | 'single_generator';\n  generator_id: string | null;\n  is_active: boolean;\n  created_at: string;\n};\n\ntype SuperAdminManager = {\n  id: string;\n  full_name: string;\n  email: string;\n  can_activate: boolean;\n  can_edit: boolean;\n  can_create_generator: boolean;\n  is_owner: boolean;\n  is_active: boolean;\n  created_at: string;\n};",
    true
  );
}
if (!superContent.includes('const [managers, setManagers]')) {
  replaceIn('super', 'add manager states',
    "  const [notifications, setNotifications] = useState<AppNotification[]>([]);\n  const [loading, setLoading] = useState(true);",
    "  const [notifications, setNotifications] = useState<AppNotification[]>([]);\n  const [managers, setManagers] = useState<SuperAdminManager[]>([]);\n  const [currentManager, setCurrentManager] = useState<SuperAdminManager | null>(null);\n  const [isOwnerSuperAdmin, setIsOwnerSuperAdmin] = useState(false);\n  const [managerOpen, setManagerOpen] = useState(false);\n  const [savingManager, setSavingManager] = useState(false);\n  const [managerForm, setManagerForm] = useState({ full_name:'', email:'', password:'', can_activate:false, can_edit:false, can_create_generator:false });\n  const [loading, setLoading] = useState(true);",
    true
  );
}
if (!superContent.includes('const canCreateGeneratorAccount =')) {
  replaceIn('super', 'add permission computed flags',
    "  const selectedGenerator = selectedGeneratorId ? generators.find(g => g.id === selectedGeneratorId) || null : null;\n  const selectedSubscription = selectedGeneratorId ? latestSubscriptionFor(selectedGeneratorId) : null;",
    "  const selectedGenerator = selectedGeneratorId ? generators.find(g => g.id === selectedGeneratorId) || null : null;\n  const selectedSubscription = selectedGeneratorId ? latestSubscriptionFor(selectedGeneratorId) : null;\n  const canActivateGeneratorAccount = isOwnerSuperAdmin || Boolean(currentManager?.can_activate);\n  const canEditGeneratorAccount = isOwnerSuperAdmin || Boolean(currentManager?.can_edit);\n  const canCreateGeneratorAccount = isOwnerSuperAdmin || Boolean(currentManager?.can_create_generator);",
    true
  );
}

// load managers/permissions after the main load finishes.
if (!superContent.includes('const loadManagers = async () =>')) {
  replaceIn('super', 'add load managers helper',
    "  useEffect(() => { void load(); }, []);",
    "  const loadManagers = async () => {\n    try {\n      const { data: userData } = await supabase.auth.getUser();\n      const { data } = await supabase.functions.invoke('manage-super-admin-manager', { body: { action: 'list' } });\n      if (data?.ok) {\n        const list = (data.managers || []) as SuperAdminManager[];\n        setManagers(list);\n        const current = list.find(m => m.id === userData.user?.id) || null;\n        setCurrentManager(current);\n        setIsOwnerSuperAdmin(Boolean(data.is_owner || current?.is_owner));\n      }\n    } catch (e) {}\n  };\n\n  useEffect(() => { void load(); void loadManagers(); }, []);",
    true
  );
}

// create manager handler.
if (!superContent.includes('const createManagerAccount = async')) {
  replaceIn('super', 'add create manager handler',
    "  const createGeneratorAccount = async (e: React.FormEvent) => {",
    "  const createManagerAccount = async (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!isOwnerSuperAdmin) return setMessage('إنشاء مدراء السوبر أدمن متاح للمدير الرئيسي فقط');\n    if (!managerForm.full_name.trim() || !managerForm.email.trim() || !managerForm.password.trim()) return setMessage('أكمل اسم المدير والإيميل والرمز');\n    if (managerForm.password.trim().length < 4) return setMessage('الرمز يجب أن يكون 4 أرقام أو أكثر');\n    setSavingManager(true);\n    const { data, error } = await supabase.functions.invoke('manage-super-admin-manager', { body: { action:'create', ...managerForm, email:managerForm.email.trim().toLowerCase(), password:managerForm.password.trim() } });\n    setSavingManager(false);\n    if (error || !data?.ok) return setMessage('تعذر إنشاء المدير: ' + (data?.error || error?.message || 'خطأ غير معروف'));\n    setManagerForm({ full_name:'', email:'', password:'', can_activate:false, can_edit:false, can_create_generator:false });\n    setManagerOpen(false);\n    setMessage('تم إنشاء مدير السوبر أدمن وتحديد صلاحياته بنجاح');\n    await loadManagers();\n  };\n\n  const updateManagerPermissions = async (manager: SuperAdminManager, patch: Partial<SuperAdminManager> & { password?: string }) => {\n    if (!isOwnerSuperAdmin) return setMessage('تعديل صلاحيات المدراء متاح للمدير الرئيسي فقط');\n    setSavingManager(true);\n    const { data, error } = await supabase.functions.invoke('manage-super-admin-manager', { body: { action:'update', manager_id: manager.id, ...patch } });\n    setSavingManager(false);\n    if (error || !data?.ok) return setMessage('تعذر تعديل المدير: ' + (data?.error || error?.message || 'خطأ غير معروف'));\n    setMessage('تم تحديث صلاحيات المدير');\n    await loadManagers();\n  };\n\n  const createGeneratorAccount = async (e: React.FormEvent) => {",
    true
  );
}

// block UI actions by permission.
replaceIn('super', 'create generator permission check',
  "    const plan = plans.find(x => x.id === generatorForm.plan_id);",
  "    if (!canCreateGeneratorAccount) return setMessage('ليست لديك صلاحية إنشاء حساب صاحب مولدة');\n    const plan = plans.find(x => x.id === generatorForm.plan_id);",
  true
);
replaceIn('super', 'renew permission check',
  "    if (!selectedGeneratorId) return;\n    const plan = plans.find(p => p.id === renewalForm.plan_id);",
  "    if (!selectedGeneratorId) return;\n    if (!canActivateGeneratorAccount) return setMessage('ليست لديك صلاحية التفعيل أو التجديد');\n    const plan = plans.find(p => p.id === renewalForm.plan_id);",
  true
);
replaceIn('super', 'credentials permission check',
  "    if (!selectedGeneratorId) return;\n    if (!credentialForm.email.trim() && !credentialForm.password.trim()) return setMessage('أدخل الإيميل أو كلمة مرور جديدة');",
  "    if (!selectedGeneratorId) return;\n    if (!canEditGeneratorAccount) return setMessage('ليست لديك صلاحية تعديل معلومات الحساب');\n    if (!credentialForm.email.trim() && !credentialForm.password.trim()) return setMessage('أدخل الإيميل أو كلمة مرور جديدة');",
  true
);
replaceIn('super', 'status permission check',
  "    if (!selectedGeneratorId) return;\n    setSavingAccount(true);\n    const { data, error } = await supabase.functions.invoke('manage-generator-account', {",
  "    if (!selectedGeneratorId) return;\n    if (!canActivateGeneratorAccount) return setMessage('ليست لديك صلاحية التفعيل أو الإيقاف');\n    setSavingAccount(true);\n    const { data, error } = await supabase.functions.invoke('manage-generator-account', {",
  true
);
replaceIn('super', 'subscription edit permission check',
  "    if (!selectedGeneratorId || !selectedSubscription) return;\n    const start = new Date(editSubscriptionForm.starts_at);",
  "    if (!selectedGeneratorId || !selectedSubscription) return;\n    if (!canActivateGeneratorAccount) return setMessage('ليست لديك صلاحية تعديل الاشتراك');\n    const start = new Date(editSubscriptionForm.starts_at);",
  true
);
replaceIn('super', 'account info permission check',
  "    if (!selectedGeneratorId) return;\n    if (!accountInfoForm.name.trim() || !accountInfoForm.owner_name.trim()) return setMessage('اسم المولدة واسم صاحب المولدة مطلوبات');",
  "    if (!selectedGeneratorId) return;\n    if (!canEditGeneratorAccount) return setMessage('ليست لديك صلاحية تعديل معلومات الحساب');\n    if (!accountInfoForm.name.trim() || !accountInfoForm.owner_name.trim()) return setMessage('اسم المولدة واسم صاحب المولدة مطلوبات');",
  true
);
replaceIn('super', 'account info save through edge function',
  "    const { error } = await supabase.from('generators').update(payload).eq('id', selectedGeneratorId);\n    setSavingAccount(false);\n    if (error) return setMessage('تعذر تعديل معلومات الحساب: ' + error.message);",
  "    const { data, error } = await supabase.functions.invoke('manage-generator-account', { body: { action:'update_info', generator_id:selectedGeneratorId, ...payload } });\n    setSavingAccount(false);\n    if (error || !data?.ok) return setMessage('تعذر تعديل معلومات الحساب: ' + (data?.error || error?.message || 'خطأ غير معروف'));",
  true
);

// owner-only reset and nav/tab.
replaceIn('super', 'owner only reset button',
  "          <button\n            onClick={() => void resetAllDataForRelease()}\n            disabled={resettingAllData}\n            className=\"flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-sm font-bold\"\n            title=\"تصفير بيانات التجربة قبل الإطلاق\"\n          >\n            <Trash2 className=\"w-4 h-4\" />{resettingAllData ? 'جاري التصفير...' : 'تصفير بيانات التجربة'}\n          </button>",
  "          {isOwnerSuperAdmin && <button\n            onClick={() => void resetAllDataForRelease()}\n            disabled={resettingAllData}\n            className=\"flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-sm font-bold\"\n            title=\"تصفير بيانات التجربة قبل الإطلاق\"\n          >\n            <Trash2 className=\"w-4 h-4\" />{resettingAllData ? 'جاري التصفير...' : 'تصفير بيانات التجربة'}\n          </button>}",
  true
);
replaceIn('super', 'add managers nav item',
  "    ['notifications', 'الإشعارات', Bell],\n  ] as const;",
  "    ['notifications', 'الإشعارات', Bell],\n    ...(isOwnerSuperAdmin ? ([['managers', 'مدراء السوبر أدمن', ShieldCheck]] as const) : []),\n  ] as const;",
  true
);

// add managers page before closing main.
if (!superContent.includes("tab === 'managers'")) {
  replaceIn('super', 'insert managers page',
    "          {tab === 'notifications' && <div className=\"grid grid-cols-[420px_1fr] gap-5\">",
    "          {tab === 'managers' && isOwnerSuperAdmin && <section className=\"bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden\">\n            <div className=\"px-6 py-5 border-b border-slate-200 flex items-center justify-between\">\n              <div><h2 className=\"text-lg font-black flex items-center gap-2\"><ShieldCheck className=\"w-5 h-5\" />مدراء السوبر أدمن</h2><p className=\"text-xs text-slate-500 mt-1\">إنشاء مدراء بصلاحيات محددة بدون صلاحية حذف أصحاب المولدات أو إنشاء مدراء آخرين.</p></div>\n              <button onClick={() => setManagerOpen(true)} className=\"bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-2\"><UserPlus className=\"w-4 h-4\" />إضافة مدير</button>\n            </div>\n            {managerOpen && <form onSubmit={createManagerAccount} className=\"p-5 bg-slate-50 grid grid-cols-2 gap-4 border-b\">\n              <input required placeholder=\"اسم المدير\" value={managerForm.full_name} onChange={e=>setManagerForm(f=>({...f,full_name:e.target.value}))} className=\"border rounded-xl px-3 py-3 bg-white\" />\n              <input required type=\"email\" placeholder=\"إيميل المدير\" value={managerForm.email} onChange={e=>setManagerForm(f=>({...f,email:e.target.value}))} className=\"border rounded-xl px-3 py-3 bg-white\" />\n              <input required minLength={4} placeholder=\"رمز الدخول / 4 أرقام\" value={managerForm.password} onChange={e=>setManagerForm(f=>({...f,password:e.target.value}))} className=\"border rounded-xl px-3 py-3 bg-white\" />\n              <div className=\"flex items-center gap-4 text-xs font-black\">\n                <label><input type=\"checkbox\" checked={managerForm.can_activate} onChange={e=>setManagerForm(f=>({...f,can_activate:e.target.checked}))}/> تفعيل وتجديد</label>\n                <label><input type=\"checkbox\" checked={managerForm.can_edit} onChange={e=>setManagerForm(f=>({...f,can_edit:e.target.checked}))}/> تعديل معلومات</label>\n                <label><input type=\"checkbox\" checked={managerForm.can_create_generator} onChange={e=>setManagerForm(f=>({...f,can_create_generator:e.target.checked}))}/> إنشاء حساب صاحب مولدة</label>\n              </div>\n              <div className=\"col-span-2 flex justify-end gap-3\"><button type=\"button\" onClick={()=>setManagerOpen(false)} className=\"px-4 py-2.5 rounded-xl border font-black bg-white\">إلغاء</button><button disabled={savingManager} className=\"px-5 py-2.5 rounded-xl bg-blue-700 text-white font-black disabled:opacity-50\">حفظ المدير</button></div>\n            </form>}\n            <div className=\"overflow-x-auto\"><table className=\"w-full text-sm\"><thead className=\"bg-slate-50 text-slate-500\"><tr><th className=\"p-4 text-right\">المدير</th><th className=\"p-4 text-right\">الإيميل</th><th className=\"p-4 text-center\">تفعيل</th><th className=\"p-4 text-center\">تعديل</th><th className=\"p-4 text-center\">إنشاء حساب</th><th className=\"p-4 text-center\">الحالة</th></tr></thead><tbody>{managers.map(m => <tr key={m.id} className=\"border-t\"><td className=\"p-4 font-black\">{m.full_name}{m.is_owner ? ' — المدير الرئيسي' : ''}</td><td className=\"p-4\">{m.email}</td>{(['can_activate','can_edit','can_create_generator'] as const).map(k => <td key={k} className=\"p-4 text-center\"><input type=\"checkbox\" disabled={m.is_owner || savingManager} checked={Boolean(m[k])} onChange={e=>void updateManagerPermissions(m,{[k]:e.target.checked} as any)} /></td>)}<td className=\"p-4 text-center\"><button disabled={m.is_owner || savingManager} onClick={()=>void updateManagerPermissions(m,{is_active:!m.is_active})} className={\`px-3 py-1.5 rounded-lg text-xs font-black ${m.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}\`}>{m.is_active ? 'فعال' : 'موقوف'}</button></td></tr>)}</tbody></table></div>\n          </section>}\n\n          {tab === 'notifications' && <div className=\"grid grid-cols-[420px_1fr] gap-5\">",
    true
  );
}

// Hide action buttons according to permissions, but keep tables visible.
replaceIn('super', 'disable create generator button',
  "<button onClick={() => setGeneratorOpen(true)} className=\"bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-2\"><UserPlus className=\"w-4 h-4\" />إضافة صاحب مولدة</button>",
  "{canCreateGeneratorAccount && <button onClick={() => setGeneratorOpen(true)} className=\"bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-2\"><UserPlus className=\"w-4 h-4\" />إضافة صاحب مولدة</button>}",
  true
);
replaceIn('super', 'disable edit account button',
  "<button onClick={openAccountInfo} className=\"px-4 py-2 rounded-xl bg-blue-700 text-white font-black text-xs inline-flex items-center gap-2\"><Pencil className=\"w-4 h-4\" />تعديل معلومات الحساب</button>",
  "{canEditGeneratorAccount && <button onClick={openAccountInfo} className=\"px-4 py-2 rounded-xl bg-blue-700 text-white font-black text-xs inline-flex items-center gap-2\"><Pencil className=\"w-4 h-4\" />تعديل معلومات الحساب</button>}",
  true
);
replaceIn('super', 'disable credentials buttons marker',
  "<button onClick={openCredentials} className=\"mt-2 text-xs font-black text-violet-700 inline-flex items-center gap-1\"><Pencil className=\"w-3.5 h-3.5\"/>تعديل</button>",
  "{canEditGeneratorAccount && <button onClick={openCredentials} className=\"mt-2 text-xs font-black text-violet-700 inline-flex items-center gap-1\"><Pencil className=\"w-3.5 h-3.5\"/>تعديل</button>}",
  true
);
replaceIn('super', 'disable credentials password button marker',
  "<button onClick={openCredentials} className=\"mt-2 text-xs font-black text-violet-700 inline-flex items-center gap-1\"><KeyRound className=\"w-3.5 h-3.5\"/>تغيير كلمة المرور</button>",
  "{canEditGeneratorAccount && <button onClick={openCredentials} className=\"mt-2 text-xs font-black text-violet-700 inline-flex items-center gap-1\"><KeyRound className=\"w-3.5 h-3.5\"/>تغيير كلمة المرور</button>}",
  true
);

if (changed) {
  fs.writeFileSync(superPath, superContent, 'utf8');
  fs.writeFileSync(loginPath, loginContent, 'utf8');
  fs.writeFileSync(typesPath, typesContent, 'utf8');
}
console.log('Super admin manager permissions patch applied.');
