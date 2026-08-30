import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const loginPath = path.join(root, 'src/components/LoginView.tsx');
const superPath = path.join(root, 'src/components/SuperAdminDashboard.tsx');
let login = fs.readFileSync(loginPath, 'utf8');
let superAdmin = fs.readFileSync(superPath, 'utf8');
let changed = false;

function patchLogin() {
  if (!login.includes("cleanPass + 'moldatk'")) {
    const src = `        const { data, error } = await supabase.auth.signInWithPassword({\n          email: cleanInput,\n          password: cleanPass,\n        });\n\n        if (error || !data.user) {\n          setErrorMessage('البريد الإلكتروني أو كلمة المرور غير صحيحة');\n          return;\n        }`;
    const dst = `        let { data, error } = await supabase.auth.signInWithPassword({\n          email: cleanInput,\n          password: cleanPass,\n        });\n\n        if ((error || !data.user) && cleanPass.length >= 4 && cleanPass.length < 6) {\n          const retry = await supabase.auth.signInWithPassword({\n            email: cleanInput,\n            password: cleanPass + 'moldatk',\n          });\n          data = retry.data;\n          error = retry.error;\n        }\n\n        if (error || !data.user) {\n          setErrorMessage('البريد الإلكتروني أو كلمة المرور غير صحيحة');\n          return;\n        }`;
    if (!login.includes(src)) throw new Error('Login password block not found');
    login = login.replace(src, dst);
    changed = true;
    console.log('patched: super admin mobile 4-digit login fallback');
  }
  if (!login.includes("profile.role !== 'super_admin_manager'")) {
    const src = `        if (profile.role !== 'super_admin' && profile.role !== 'generator_admin') {\n          await supabase.auth.signOut();\n          setErrorMessage('هذا الحساب غير مخول للدخول كتطبيق مالك مولدة');\n          return;\n        }`;
    const dst = `        if (profile.role !== 'super_admin' && profile.role !== 'super_admin_manager' && profile.role !== 'generator_admin') {\n          await supabase.auth.signOut();\n          setErrorMessage('هذا الحساب غير مخول للدخول كتطبيق مالك مولدة');\n          return;\n        }`;
    if (login.includes(src)) {
      login = login.replace(src, dst);
      changed = true;
      console.log('patched: allow super admin manager login');
    }
  }
}

function patchOwnerPinUi() {
  if (!superAdmin.includes('const [ownerPinForm, setOwnerPinForm]')) {
    const src = `  const [managerForm, setManagerForm] = useState({ full_name:'', email:'', password:'', can_activate:false, can_edit:false, can_create_generator:false });`;
    const dst = `  const [managerForm, setManagerForm] = useState({ full_name:'', email:'', password:'', can_activate:false, can_edit:false, can_create_generator:false });\n  const [ownerPinForm, setOwnerPinForm] = useState({ next:'', confirm:'' });`;
    if (!superAdmin.includes(src)) throw new Error('managerForm state not found');
    superAdmin = superAdmin.replace(src, dst);
    changed = true;
    console.log('patched: owner pin state');
  }

  if (!superAdmin.includes('const changeOwnerPin = async')) {
    const marker = `  const createManagerAccount = async (e: React.FormEvent) => {`;
    const insert = `  const changeOwnerPin = async (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!isOwnerSuperAdmin) return setMessage('تغيير رمز السوبر أدمن الرئيسي متاح للمالك الرئيسي فقط');\n    if (ownerPinForm.next.trim().length < 4) return setMessage('الرمز الجديد يجب أن يكون 4 أرقام أو أكثر');\n    if (ownerPinForm.next.trim() !== ownerPinForm.confirm.trim()) return setMessage('تأكيد الرمز غير مطابق');\n    setSavingManager(true);\n    const { data, error } = await supabase.functions.invoke('manage-super-admin-manager', { body: { action:'update_owner_password', password: ownerPinForm.next.trim() } });\n    setSavingManager(false);\n    if (error || !data?.ok) return setMessage('تعذر تغيير رمز حسابك: ' + (data?.error || error?.message || 'خطأ غير معروف'));\n    setOwnerPinForm({ next:'', confirm:'' });\n    setMessage('تم تغيير رمز حساب السوبر أدمن الرئيسي بنجاح. سجّل دخولك بالرمز الجديد.');\n  };\n\n`;
    if (!superAdmin.includes(marker)) throw new Error('createManagerAccount marker not found');
    superAdmin = superAdmin.replace(marker, insert + marker);
    changed = true;
    console.log('patched: owner pin handler');
  }

  if (!superAdmin.includes('تغيير رمز حسابي')) {
    const src = `            {managerOpen && <form onSubmit={createManagerAccount} className="p-5 bg-slate-50 grid grid-cols-2 gap-4 border-b">`;
    const dst = `            <form onSubmit={changeOwnerPin} className="p-5 bg-amber-50/70 border-b border-amber-100 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">\n              <div><label className="block text-xs font-black text-amber-800 mb-1">رمز السوبر أدمن الرئيسي الجديد</label><input type="password" minLength={4} placeholder="4 أرقام أو أكثر" value={ownerPinForm.next} onChange={e=>setOwnerPinForm(f=>({...f,next:e.target.value}))} className="w-full border border-amber-200 rounded-xl px-3 py-3 bg-white font-mono" /></div>\n              <div><label className="block text-xs font-black text-amber-800 mb-1">تأكيد الرمز الجديد</label><input type="password" minLength={4} placeholder="أعد كتابة الرمز" value={ownerPinForm.confirm} onChange={e=>setOwnerPinForm(f=>({...f,confirm:e.target.value}))} className="w-full border border-amber-200 rounded-xl px-3 py-3 bg-white font-mono" /></div>\n              <button disabled={savingManager} className="px-5 py-3 rounded-xl bg-amber-600 text-white font-black disabled:opacity-50">تغيير رمز حسابي</button>\n            </form>\n\n            {managerOpen && <form onSubmit={createManagerAccount} className="p-5 bg-slate-50 grid grid-cols-2 gap-4 border-b">`;
    if (!superAdmin.includes(src)) throw new Error('managerOpen form marker not found');
    superAdmin = superAdmin.replace(src, dst);
    changed = true;
    console.log('patched: owner pin form');
  }
}

patchLogin();
patchOwnerPinUi();

if (changed) {
  fs.writeFileSync(loginPath, login, 'utf8');
  fs.writeFileSync(superPath, superAdmin, 'utf8');
}
console.log('Super admin owner PIN fix applied.');
