import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const marker = 'FORCE_REMOVE_THEME_AND_STABILIZE_AD_CAROUSEL_V1';

function removeThemeCard(content) {
  let c = content;
  c = c.replace(/\n\s*\{\/\*\s*2\.\s*Appearance & Theme Toggle \(Dark \/ Light\)\s*\*\/\}[\s\S]*?\n\s*<SubscriptionInfoButton info=\{subscriptionInfo\} loading=\{subscriptionLoading\} \/>/g,
    '\n\n      <SubscriptionInfoButton info={subscriptionInfo} loading={subscriptionLoading} />');
  c = c.replace(/\n\s*\{\/\*\s*2\.\s*Appearance & Theme Toggle[\s\S]*?\n\s*<SubscriptionInfoButton info=\{subscriptionInfo\} loading=\{subscriptionLoading\} \/>/g,
    '\n\n      <SubscriptionInfoButton info={subscriptionInfo} loading={subscriptionLoading} />');
  c = c.replace(/\n\s*<div className=\"bg-white dark:bg\[#[^\n]*?\n\s*<\/div>\n\s*\n\s*<SubscriptionInfoButton info=\{subscriptionInfo\} loading=\{subscriptionLoading\} \/>/g,
    '\n\n      <SubscriptionInfoButton info={subscriptionInfo} loading={subscriptionLoading} />');
  c = c.replace(/\n\s*\{\/\*[^\n]*Theme[^\n]*\*\/\}[\s\S]*?\n\s*<SubscriptionInfoButton info=\{subscriptionInfo\} loading=\{subscriptionLoading\} \/>/g,
    '\n\n      <SubscriptionInfoButton info={subscriptionInfo} loading={subscriptionLoading} />');
  return c;
}

function stripOldAdInjections(content) {
  let c = content;
  c = c.replace(/\n\s*\/\/ SUPABASE_MOBILE_ADS_BOUND_V1[\s\S]*?\n\s*\}, \[\]\);/g, '');
  c = c.replace(/\n\s*\/\/ LIVE_WEB_INDEPENDENT_AD_SLIDES_V1[\s\S]*?\n\s*const activeAdminAd = adminAdSlides\[adminAdIndex\] \|\| null;\n/g, '\n');
  c = c.replace(/\n\s*\{supabaseAds\.length > 0 && \([\s\S]*?\n\s*\)\}/g, '');
  c = c.replace(/\n\s*\{activeAdminAd\?\.image_url && \([\s\S]*?\n\s*\)\}/g, '');
  c = c.replace(/\n\s*\{adminAdSlides\.length > 0 && \([\s\S]*?\n\s*\)\}/g, '');
  return c;
}

{
  const path = 'src/components/mobile/MobileSettings.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    c = removeThemeCard(c);
    c = stripOldAdInjections(c);

    if (!c.includes("from '../../lib/supabase'")) {
      c = c.replace("import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';", "import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';\nimport { supabase } from '../../lib/supabase';");
    }

    if (!c.includes(marker)) {
      c = c.replace(/\}\) => \{\n/, `}) => {\n  // ${marker}\n  const [adminAdSlides, setAdminAdSlides] = React.useState<any[]>([]);\n  const [adminAdIndex, setAdminAdIndex] = React.useState(0);\n\n  React.useEffect(() => {\n    let cancelled = false;\n    const loadSlides = async () => {\n      try {\n        const cached = localStorage.getItem('moldatk_admin_ad_slides');\n        if (cached && !cancelled) setAdminAdSlides(JSON.parse(cached));\n      } catch (e) {}\n      try {\n        const now = new Date().toISOString();\n        const { data, error } = await supabase\n          .from('app_ad_slides')\n          .select('id,title,image_url,link_url,sort_order,updated_at,starts_at,ends_at')\n          .eq('is_active', true)\n          .order('sort_order', { ascending: true })\n          .order('updated_at', { ascending: false })\n          .limit(10);\n        if (!error && Array.isArray(data)) {\n          const rows = data.filter((s: any) => (!s.starts_at || s.starts_at <= now) && (!s.ends_at || s.ends_at > now));\n          localStorage.setItem('moldatk_admin_ad_slides', JSON.stringify(rows));\n          if (!cancelled) {\n            setAdminAdSlides(rows);\n            setAdminAdIndex(0);\n          }\n        }\n      } catch (e) {}\n    };\n    void loadSlides();\n    const timer = window.setInterval(() => void loadSlides(), 30000);\n    window.addEventListener('moldatk-local-sync', loadSlides as any);\n    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('moldatk-local-sync', loadSlides as any); };\n  }, []);\n\n  React.useEffect(() => {\n    if (adminAdSlides.length <= 1) return;\n    const timer = window.setInterval(() => setAdminAdIndex(i => (i + 1) % adminAdSlides.length), 3500);\n    return () => window.clearInterval(timer);\n  }, [adminAdSlides.length]);\n\n  const activeAdminAd = adminAdSlides[adminAdIndex] || null;\n`);
    }

    const adBlock = `    <div className="p-3.5 space-y-4 max-w-lg mx-auto pb-24">\n      {activeAdminAd?.image_url && (\n        <section className="bg-white dark:bg-[#111c38] rounded-2xl p-3 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">\n          <div className="flex items-center justify-between mb-2">\n            <div className="flex items-center gap-2">\n              <div className="p-1.5 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-300"><Sparkles className="w-4 h-4" /></div>\n              <div>\n                <h3 className="text-xs font-black text-slate-900 dark:text-white">إعلانات الإدارة</h3>\n                <p className="text-[10px] text-slate-500 dark:text-slate-400">تتحدث بالمزامنة عند توفر الإنترنت</p>\n              </div>\n            </div>\n            {adminAdSlides.length > 1 && <span className="text-[10px] text-slate-400 font-bold">{adminAdIndex + 1}/{adminAdSlides.length}</span>}\n          </div>\n          <button type="button" onClick={() => activeAdminAd.link_url && window.open(activeAdminAd.link_url, '_blank')} className="block w-full overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">\n            <img src={activeAdminAd.image_url} alt={activeAdminAd.title || 'إعلان الإدارة'} className="w-full aspect-[16/7] object-cover transition-opacity duration-500" loading="lazy" />\n          </button>\n          {adminAdSlides.length > 1 && <div className="flex justify-center gap-1.5 mt-2">{adminAdSlides.map((_: any, idx: number) => <span key={idx} className={\`h-1.5 rounded-full transition-all \${idx === adminAdIndex ? 'w-5 bg-blue-600' : 'w-1.5 bg-slate-300 dark:bg-slate-700'}\`} />)}</div>}\n          {activeAdminAd.link_url && <p className="mt-2 text-[10px] font-black text-blue-700 dark:text-blue-300">اضغط على الصورة لفتح الرابط</p>}\n        </section>\n      )}`;
    c = c.replace(/    <div className=\"p-3\.5 space-y-4 max-w-lg mx-auto pb-24\">/, adBlock);
    c = removeThemeCard(c);
    write(path, c);
    console.log('Force removed mobile theme card and stabilized single ad carousel area');
  }
}

{
  const path = 'src/components/SuperAdminDashboard.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);

    if (!c.includes('type AdminAdSlide =')) {
      c = c.replace("type Tab = 'overview' | 'generators' | 'finance' | 'notifications';", "type AdminAdSlide = { id: string; title: string | null; image_url: string; link_url: string | null; is_active: boolean; sort_order: number | null; updated_at: string; };\ntype Tab = 'overview' | 'generators' | 'finance' | 'notifications';");
    }
    if (!c.includes('const [adminAdSlides, setAdminAdSlides]')) {
      c = c.replace(/const \[notifications, setNotifications\] = useState<AppNotification\[\]>\(\[\]\);/, `const [notifications, setNotifications] = useState<AppNotification[]>([]);\n  const [adminAdSlides, setAdminAdSlides] = useState<AdminAdSlide[]>([]);\n  const [adminAdSaving, setAdminAdSaving] = useState(false);\n  const [adminAdImageFile, setAdminAdImageFile] = useState<File | null>(null);\n  const [adminAdForm, setAdminAdForm] = useState({ title: '', link_url: '' });`);
    }
    c = c.replace(/await Promise\.all\(\[loadGenerators\(\), loadPlans\(\), loadSubscriptions\(\), loadTransactions\(\), loadNotifications\(\)\]\);/g,
      `await Promise.all([loadGenerators(), loadPlans(), loadSubscriptions(), loadTransactions(), loadNotifications(), loadAdminAdSlides()]);`);

    if (!c.includes('const saveIndependentAdminAd = async')) {
      const fns = `\n  const loadAdminAdSlides = async () => {\n    const { data, error } = await supabase\n      .from('app_ad_slides')\n      .select('id,title,image_url,link_url,is_active,sort_order,updated_at')\n      .eq('is_active', true)\n      .order('sort_order', { ascending: true })\n      .order('updated_at', { ascending: false })\n      .limit(10);\n    if (!error) setAdminAdSlides((data || []) as AdminAdSlide[]);\n  };\n\n  const saveIndependentAdminAd = async (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!adminAdImageFile) { setError('ارفع صورة الإعلان أولاً'); return; }\n    setAdminAdSaving(true);\n    setError(null);\n    try {\n      const safeName = adminAdImageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-90) || 'admin-ad.jpg';\n      const storagePath = 'slides/' + Date.now() + '-' + Math.random().toString(16).slice(2) + '-' + safeName;\n      const { error: uploadError } = await supabase.storage\n        .from('app-ad-slides')\n        .upload(storagePath, adminAdImageFile, { contentType: adminAdImageFile.type || 'image/jpeg', upsert: false });\n      if (uploadError) throw uploadError;\n      const { data: publicFile } = supabase.storage.from('app-ad-slides').getPublicUrl(storagePath);\n\n      const { error: insertError } = await supabase.from('app_ad_slides').insert({\n        title: adminAdForm.title.trim() || 'إعلان الإدارة',\n        image_url: publicFile.publicUrl,\n        link_url: adminAdForm.link_url.trim() || null,\n        is_active: true,\n        sort_order: (adminAdSlides.length || 0) + 1,\n        starts_at: new Date().toISOString(),\n      } as any);\n      if (insertError) throw insertError;\n\n      setAdminAdImageFile(null);\n      setAdminAdForm({ title: '', link_url: '' });\n      setMessage('تم حفظ سلايد الإعلان وسيظهر عند اتصال المستخدمين بالإنترنت');\n      await loadAdminAdSlides();\n    } catch (err: any) {\n      setError('تعذر حفظ إعلان الإدارة: ' + (err?.message || 'خطأ غير معروف'));\n    } finally {\n      setAdminAdSaving(false);\n    }\n  };\n`;
      c = c.replace(/\n  const sendNotification = async \(e: React\.FormEvent\) => \{/, fns + '\n  const sendNotification = async (e: React.FormEvent) => {');
    }

    if (!c.includes('إعلان الإدارة المستقل')) {
      const panel = `\n            <form onSubmit={saveIndependentAdminAd} className="bg-white border border-blue-200 rounded-2xl shadow-sm p-5 h-fit">\n              <h2 className="text-lg font-black flex items-center gap-2 text-slate-900"><UploadCloud className="w-5 h-5 text-blue-700" />إعلان الإدارة المستقل</h2>\n              <p className="text-xs text-slate-500 mt-1 mb-5">ارفع صورة إعلان. تظهر للمستخدمين بالمزامنة بدون تحديث Android.</p>\n              {adminAdSlides[0]?.image_url && <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden"><img src={adminAdSlides[0].image_url} className="w-full aspect-[16/7] object-cover" alt="الإعلان الحالي" /><div className="p-3 text-xs text-slate-600 font-bold">عدد السلايدات الفعالة: {adminAdSlides.length}</div></div>}\n              <label className="block text-xs font-black text-slate-700 mb-1">عنوان اختياري</label>\n              <input placeholder="مثلاً: عرض جديد" value={adminAdForm.title} onChange={e => setAdminAdForm(f => ({...f, title:e.target.value}))} className="w-full border border-slate-300 rounded-xl px-3 py-3 mb-3 bg-white text-slate-900" />\n              <label className="block text-xs font-black text-slate-700 mb-1">إرفاق صورة الإعلان</label>\n              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-blue-300 bg-blue-50 rounded-2xl p-5 mb-3 cursor-pointer hover:bg-blue-100 text-blue-800 font-black">\n                <UploadCloud className="w-8 h-8" />\n                <span>{adminAdImageFile ? adminAdImageFile.name : 'اضغط هنا لرفع / إرفاق صورة'}</span>\n                <span className="text-[11px] text-blue-600">المقاس المفضل: 1200×520 أو نسبة 16:7</span>\n                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => setAdminAdImageFile(e.target.files?.[0] || null)} className="hidden" />\n              </label>\n              <label className="block text-xs font-black text-slate-700 mb-1">رابط اختياري عند الضغط على الصورة</label>\n              <input placeholder="https://..." value={adminAdForm.link_url} onChange={e => setAdminAdForm(f => ({...f, link_url:e.target.value}))} className="w-full border border-slate-300 rounded-xl px-3 py-3 mb-3 bg-white text-slate-900" />\n              <button disabled={adminAdSaving} className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2"><Save className="w-4 h-4" />{adminAdSaving ? 'جاري الحفظ...' : 'حفظ سلايد الإعلان'}</button>\n            </form>`;
      c = c.replace(/\{tab === 'notifications' && <div className="grid grid-cols-\[420px_1fr\] gap-5">/,
        `{tab === 'notifications' && <div className="grid grid-cols-[420px_420px_1fr] gap-5">${panel}`);
      c = c.replace(/\{tab === 'notifications' && <div className="grid grid-cols-\[420px_420px_1fr\] gap-5">(?![\s\S]*?إعلان الإدارة المستقل)/,
        `{tab === 'notifications' && <div className="grid grid-cols-[420px_420px_1fr] gap-5">${panel}`);
    }

    write(path, c);
    console.log('Ensured Super Admin independent ad slide uploader');
  }
}

console.log(`${marker} applied`);
