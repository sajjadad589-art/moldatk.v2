import fs from 'node:fs';

const mobilePath = 'src/components/mobile/MobileSettings.tsx';
const adminPath = 'src/components/SuperAdminDashboard.tsx';
const notifPath = 'src/components/GeneratorNotifications.tsx';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

if (fs.existsSync(mobilePath)) {
  let c = read(mobilePath);
  c = c.replace(/إعلان الإدارة/g, 'اعلانات');
  c = c.replace(/\.limit\(1\)/g, '.limit(10)');
  c = c.replace(/3500/g, '3000');
  write(mobilePath, c);
}

if (fs.existsSync(adminPath)) {
  let c = read(adminPath);

  if (!c.includes('type AdminAdSlide =')) {
    c = c.replace(/type AppNotification = \{[\s\S]*?\n\};/, (m) => `${m}\n\ntype AdminAdSlide = {\n  id: string;\n  title?: string | null;\n  image_url: string;\n  link_url?: string | null;\n  sort_order?: number | null;\n  is_active?: boolean | null;\n  updated_at?: string | null;\n};`);
  }

  if (!c.includes('const [adminAdSlides, setAdminAdSlides]')) {
    c = c.replace(/  const \[notificationForm, setNotificationForm\] = useState\([\s\S]*?\n  \}\);/, (m) => `${m}\n\n  const [adminAdSlides, setAdminAdSlides] = useState<AdminAdSlide[]>([]);\n  const [adminAdFile, setAdminAdFile] = useState<File | null>(null);\n  const [adminAdTitle, setAdminAdTitle] = useState('');\n  const [adminAdLink, setAdminAdLink] = useState('');\n  const [adminAdSaving, setAdminAdSaving] = useState(false);`);
  }

  if (!c.includes('const loadAdminAdSlides = async')) {
    c = c.replace(/  useEffect\(\(\) => \{ void load\(\); \}, \[\]\);/, `  const loadAdminAdSlides = async () => {\n    const { data, error } = await supabase\n      .from('app_ad_slides')\n      .select('id,title,image_url,link_url,sort_order,is_active,updated_at')\n      .eq('is_active', true)\n      .order('sort_order', { ascending: true })\n      .order('updated_at', { ascending: false })\n      .limit(20);\n    if (!error && Array.isArray(data)) setAdminAdSlides(data as AdminAdSlide[]);\n  };\n\n  useEffect(() => { void load(); void loadAdminAdSlides(); }, []);`);
  }

  if (!c.includes('const saveIndependentAdminAd = async')) {
    c = c.replace(/\n  const sendNotification = async \(e: React\.FormEvent\) => \{/, `\n  const saveIndependentAdminAd = async (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!adminAdFile) return setMessage('اختر صورة السلايد أولاً');\n    setAdminAdSaving(true);\n    try {\n      const ext = adminAdFile.name.split('.').pop() || 'jpg';\n      const path = 'slides/' + Date.now() + '-' + Math.random().toString(16).slice(2) + '.' + ext;\n      const upload = await supabase.storage.from('app-ad-slides').upload(path, adminAdFile, { upsert: false, contentType: adminAdFile.type || 'image/jpeg' });\n      if (upload.error) throw upload.error;\n      const publicUrl = supabase.storage.from('app-ad-slides').getPublicUrl(path).data.publicUrl;\n      const { error } = await supabase.from('app_ad_slides').insert({\n        slot_key: 'settings_top',\n        title: adminAdTitle.trim() || 'اعلان',\n        image_url: publicUrl,\n        link_url: adminAdLink.trim() || null,\n        sort_order: adminAdSlides.length + 1,\n        is_active: true,\n        updated_at: new Date().toISOString(),\n      });\n      if (error) throw error;\n      setAdminAdFile(null);\n      setAdminAdTitle('');\n      setAdminAdLink('');\n      setMessage('تمت إضافة السلايد وسيظهر عند اتصال المستخدمين بالإنترنت');\n      await loadAdminAdSlides();\n    } catch (err: any) {\n      setMessage('تعذر حفظ السلايد: ' + (err?.message || 'خطأ غير معروف'));\n    } finally {\n      setAdminAdSaving(false);\n    }\n  };\n\n  const deleteIndependentAdminAd = async (slide: AdminAdSlide) => {\n    const ok = window.confirm('تأكيد حذف هذا السلايد من الاعلانات؟');\n    if (!ok) return;\n    setAdminAdSaving(true);\n    try {\n      const { error } = await supabase.from('app_ad_slides').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', slide.id);\n      if (error) throw error;\n      setAdminAdSlides(prev => prev.filter(x => x.id !== slide.id));\n      setMessage('تم حذف السلايد من الاعلانات');\n    } catch (err: any) {\n      setMessage('تعذر حذف السلايد: ' + (err?.message || 'خطأ غير معروف'));\n    } finally {\n      setAdminAdSaving(false);\n    }\n  };\n\n  const sendNotification = async (e: React.FormEvent) => {`);
  }

  c = c.replace(/إرسال إشعار/g, 'اشعارات التطبيق');
  c = c.replace(/صيانة، عروض، أو تحديثات التطبيق/g, 'أرسل إشعار منبثق لأصحاب المولدات');
  c = c.replace(/نشر الإشعار/g, 'إرسال اشعار منبثق');
  c = c.replace(/سجل الإشعارات/g, 'سجل اشعارات التطبيق');

  if (!c.includes('إدارة سلايدات اعلانات')) {
    const openMarker = `{tab === 'notifications' && <div className="grid grid-cols-[420px_1fr] gap-5">`;
    const adsSection = `{tab === 'notifications' && <div className="space-y-5">\n            <section className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-blue-900 rounded-2xl shadow-sm overflow-hidden text-white">\n              <div className="p-5 border-b border-white/10 flex items-center justify-between">\n                <div><h2 className="text-lg font-black flex items-center gap-2"><UploadCloud className="w-5 h-5" />اعلانات</h2><p className="text-xs text-blue-100 mt-1">إدارة سلايدات اعلانات التطبيق — أكثر من صورة، انتقال تلقائي كل 3 ثواني</p></div>\n                <span className="text-[11px] font-black px-3 py-1 rounded-full bg-cyan-400/15 text-cyan-100 border border-cyan-300/20">Supabase Sync</span>\n              </div>\n              <form onSubmit={saveIndependentAdminAd} className="p-5 grid grid-cols-[1fr_1fr_auto] gap-3 items-end bg-white/5">\n                <label className="block"><span className="text-xs font-black text-blue-100">عنوان اختياري</span><input value={adminAdTitle} onChange={e => setAdminAdTitle(e.target.value)} placeholder="مثال: اعلان جديد" className="mt-1 w-full rounded-xl border border-white/15 bg-white text-slate-900 px-3 py-3 text-sm" /></label>\n                <label className="block"><span className="text-xs font-black text-blue-100">رابط اختياري</span><input value={adminAdLink} onChange={e => setAdminAdLink(e.target.value)} placeholder="https://..." className="mt-1 w-full rounded-xl border border-white/15 bg-white text-slate-900 px-3 py-3 text-sm" /></label>\n                <label className="cursor-pointer bg-white text-slate-900 px-4 py-3 rounded-xl font-black text-sm flex items-center gap-2"><UploadCloud className="w-4 h-4" />رفع صورة<input type="file" accept="image/*" onChange={e => setAdminAdFile(e.target.files?.[0] || null)} className="hidden" /></label>\n                <div className="col-span-2 text-xs text-blue-100">{adminAdFile ? adminAdFile.name : 'القياس المفضل 1200×520 أو نسبة 16:7'}</div>\n                <button disabled={adminAdSaving || !adminAdFile} className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 rounded-xl px-5 py-3 font-black text-sm">{adminAdSaving ? 'جاري الحفظ...' : 'إضافة سلايد'}</button>\n              </form>\n              <div className="p-5 grid grid-cols-3 gap-4">\n                {adminAdSlides.length === 0 && <div className="col-span-3 rounded-2xl border border-dashed border-white/20 p-6 text-center text-blue-100 font-bold">لا توجد سلايدات حالياً</div>}\n                {adminAdSlides.map((slide, idx) => <div key={slide.id} className="rounded-2xl bg-white text-slate-900 overflow-hidden shadow-sm">\n                  <img src={slide.image_url} className="w-full aspect-[16/7] object-cover bg-slate-100" alt={slide.title || 'اعلان'} />\n                  <div className="p-3"><p className="font-black text-sm truncate">{slide.title || 'سلايد إعلان ' + (idx + 1)}</p><p className="text-xs text-slate-500 mt-1">{slide.link_url ? 'الصورة تحتوي رابط' : 'صورة عرض فقط'}</p><button type="button" disabled={adminAdSaving} onClick={() => void deleteIndependentAdminAd(slide)} className="mt-3 w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl py-2.5 font-black text-sm flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" />حذف السلايد</button></div>\n                </div>)}\n              </div>\n            </section>\n            <div className="grid grid-cols-[420px_1fr] gap-5">`;
    if (!c.includes(openMarker)) throw new Error('notifications tab open marker not found');
    c = c.replace(openMarker, adsSection);
    const closeMarker = `\n          </div>}\n        </main>`;
    if (!c.includes(closeMarker)) throw new Error('notifications tab close marker not found');
    c = c.replace(closeMarker, `\n            </div>\n          </div>}\n        </main>`);
  }

  write(adminPath, c);
}

if (fs.existsSync(notifPath)) {
  let c = read(notifPath);
  if (!c.includes('MOLDATK_AUTO_POPUP_NOTIFICATIONS_V1')) {
    c = c.replace(/  useEffect\(\(\) => \{\n    void load\(\);\n    const timer = window\.setInterval\(\(\) => void load\(\), 60_000\);\n    return \(\) => window\.clearInterval\(timer\);\n  \}, \[\]\);/, `  useEffect(() => {\n    void load();\n    const timer = window.setInterval(() => void load(), 30_000);\n    return () => window.clearInterval(timer);\n  }, []);\n\n  // MOLDATK_AUTO_POPUP_NOTIFICATIONS_V1\n  useEffect(() => {\n    const newest = items[0];\n    if (!newest?.id) return;\n    const key = 'moldatk_last_seen_popup_notification';\n    const seen = localStorage.getItem(key);\n    if (seen !== newest.id) {\n      localStorage.setItem(key, newest.id);\n      setOpen(true);\n    }\n  }, [items]);`);
  }
  write(notifPath, c);
}

const mobileOut = fs.existsSync(mobilePath) ? read(mobilePath) : '';
const adminOut = fs.existsSync(adminPath) ? read(adminPath) : '';
const notifOut = fs.existsSync(notifPath) ? read(notifPath) : '';
for (const [label, text, required] of [
  ['mobile ads title', mobileOut, 'اعلانات'],
  ['mobile 3s timer', mobileOut, '3000'],
  ['mobile carousel array', mobileOut, 'adminAdSlides'],
  ['mobile multi-slide query', mobileOut, '.limit(10)'],
  ['admin ads manager', adminOut, 'إدارة سلايدات اعلانات'],
  ['admin delete function', adminOut, 'deleteIndependentAdminAd'],
  ['admin upload bucket', adminOut, "from('app-ad-slides')"],
  ['admin link column', adminOut, 'link_url'],
  ['admin notification title', adminOut, 'اشعارات التطبيق'],
  ['auto popup notifications', notifOut, 'MOLDATK_AUTO_POPUP_NOTIFICATIONS_V1'],
]) {
  if (!text.includes(required)) throw new Error(`${label} missing: ${required}`);
}

console.log('Final Super Admin ads manager injected: multi-upload, red trash delete, link_url, 3s mobile carousel, app notifications title.');
