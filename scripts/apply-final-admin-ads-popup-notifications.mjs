import fs from 'node:fs';

const mobilePath = 'src/components/mobile/MobileSettings.tsx';
const adminPath = 'src/components/SuperAdminDashboard.tsx';
const notifPath = 'src/components/GeneratorNotifications.tsx';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

// Final mobile advertisement box: name = اعلانات, multiple slides, 3s transition.
if (fs.existsSync(mobilePath)) {
  let c = read(mobilePath);
  c = c.replace(/إعلانات الإدارة/g, 'اعلانات');
  c = c.replace(/إعلان الإدارة/g, 'اعلان');
  c = c.replace(/إعلانات/g, 'اعلانات');
  c = c.replace(/3500/g, '3000');
  c = c.replace(/\.limit\(1\)/g, '.limit(10)');
  c = c.replace(/تتحدث بالمزامنة عند توفر الإنترنت/g, 'تتحدث تلقائياً عند الاتصال بالإنترنت');
  write(mobilePath, c);
}

// Final Super Admin UI: clear ad colors, upload many slides, delete per slide, app notifications section.
if (fs.existsSync(adminPath)) {
  let c = read(adminPath);

  c = c.replace(/إعلان الإدارة المستقل/g, 'اعلانات');
  c = c.replace(/إعلان الإدارة/g, 'اعلانات');
  c = c.replace(/صورة واحدة محفوظة في Supabase وتتحدث بدون تحديث التطبيق/g, 'ارفع أكثر من سلايد، والسلايدات تظهر متحركة كل 3 ثواني بدون تحديث التطبيق');
  c = c.replace(/الإعلان الحالي مفعل ومحفوظ/g, 'السلايد محفوظ ومفعل');
  c = c.replace(/حفظ إعلان الإدارة/g, 'إضافة سلايد إعلان');
  c = c.replace(/اختر صورة الإعلان أولاً/g, 'اختر صورة السلايد أولاً');
  c = c.replace(/تم حفظ إعلان الإدارة وسيظهر عند اتصال المستخدمين بالإنترنت/g, 'تمت إضافة السلايد وسيظهر عند اتصال المستخدمين بالإنترنت');
  c = c.replace(/تعذر حفظ إعلان الإدارة:/g, 'تعذر حفظ السلايد:');

  // Do not deactivate old slides. Each upload adds a new active slide.
  c = c.replace(/\n\s*await supabase\.from\('app_ad_slides'\)\.update\(\{ is_active: false, updated_at: new Date\(\)\.toISOString\(\) \}\)\.eq\('is_active', true\);/g,
    '\n      // keep old slides active: every upload adds another carousel slide');
  c = c.replace(/sort_order: 1,/g, 'sort_order: adminAdSlides.length + 1,');

  if (!c.includes('const deleteIndependentAdminAd = async')) {
    c = c.replace(/\n\s*const saveIndependentAdminAd = async \(e: React\.FormEvent\) => \{/,
`\n  const deleteIndependentAdminAd = async (slide: AdminAdSlide) => {\n    const ok = window.confirm('تأكيد حذف هذا السلايد من الاعلانات؟');\n    if (!ok) return;\n    setAdminAdSaving(true);\n    try {\n      const { error } = await supabase\n        .from('app_ad_slides')\n        .update({ is_active: false, updated_at: new Date().toISOString() })\n        .eq('id', slide.id);\n      if (error) throw error;\n      setAdminAdSlides(prev => prev.filter(x => x.id !== slide.id));\n      setMessage('تم حذف السلايد من الاعلانات');\n    } catch (err: any) {\n      setMessage('تعذر حذف السلايد: ' + (err?.message || 'خطأ غير معروف'));\n    } finally {\n      setAdminAdSaving(false);\n    }\n  };\n\n  const saveIndependentAdminAd = async (e: React.FormEvent) => {`);
  }

  // Replace the single current image preview with a grid of all active slides and a red trash button under each image.
  c = c.replace(
/\{adminAdSlides\[0\]\?\.image_url && <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">[\s\S]*?<\/div>\}\n\n              <label className="block text-xs font-black text-slate-700 mb-1">عنوان اختياري<\/label>/,
`{adminAdSlides.length > 0 && <div className="mb-4 space-y-3">\n                <p className="text-xs font-black text-slate-700">السلايدات الحالية</p>\n                <div className="grid grid-cols-1 gap-3">\n                  {adminAdSlides.map((slide, idx) => <div key={slide.id} className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">\n                    <img src={slide.image_url} className="w-full aspect-[16/7] object-cover" alt={slide.title || 'سلايد اعلان'} />\n                    <div className="p-3 flex items-center justify-between gap-3">\n                      <div className="min-w-0">\n                        <p className="text-xs font-black text-slate-900 truncate">{slide.title || 'سلايد إعلان ' + (idx + 1)}</p>\n                        <p className="text-[11px] text-slate-500">{slide.link_url ? 'الصورة تحتوي رابط' : 'صورة عرض فقط'}</p>\n                      </div>\n                      <button\n                        type="button"\n                        disabled={adminAdSaving}\n                        onClick={() => void deleteIndependentAdminAd(slide)}\n                        className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-black"\n                        title="حذف السلايد"\n                      >\n                        <Trash2 className="w-4 h-4" /> حذف\n                      </button>\n                    </div>\n                  </div>)}\n                </div>\n              </div>}\n\n              <label className="block text-xs font-black text-slate-700 mb-1">عنوان اختياري</label>`
  );

  c = c.replace(/<h2 className="text-lg font-black flex items-center gap-2 text-slate-900"><Megaphone className="w-5 h-5" \/>إرسال إشعار<\/h2>/g,
    '<h2 className="text-lg font-black flex items-center gap-2 text-slate-900"><Megaphone className="w-5 h-5" />اشعارات التطبيق</h2>');
  c = c.replace(/<p className="text-xs text-slate-500 mt-1 mb-5">صيانة، عروض، أو تحديثات التطبيق<\/p>/g,
    '<p className="text-xs text-slate-500 mt-1 mb-5">أرسل إشعار منبثق لأصحاب المولدات</p>');
  c = c.replace(/نشر الإشعار/g, 'إرسال اشعار منبثق');
  c = c.replace(/سجل الإشعارات/g, 'سجل اشعارات التطبيق');

  write(adminPath, c);
}

// Make owner notifications pop up automatically once when a new notification arrives.
if (fs.existsSync(notifPath)) {
  let c = read(notifPath);
  if (!c.includes('MOLDATK_AUTO_POPUP_NOTIFICATIONS_V1')) {
    c = c.replace(/  useEffect\(\(\) => \{\n    void load\(\);\n    const timer = window\.setInterval\(\(\) => void load\(\), 60_000\);\n    return \(\) => window\.clearInterval\(timer\);\n  \}, \[\]\);/,
`  useEffect(() => {\n    void load();\n    const timer = window.setInterval(() => void load(), 30_000);\n    return () => window.clearInterval(timer);\n  }, []);\n\n  // MOLDATK_AUTO_POPUP_NOTIFICATIONS_V1\n  useEffect(() => {\n    const newest = items[0];\n    if (!newest?.id) return;\n    const key = 'moldatk_last_seen_popup_notification';\n    const seen = localStorage.getItem(key);\n    if (seen !== newest.id) {\n      localStorage.setItem(key, newest.id);\n      setOpen(true);\n    }\n  }, [items]);`);
  }
  write(notifPath, c);
}

// Hard checks so Vercel build fails if the requested pieces are not in the actual built source.
const mobileOut = fs.existsSync(mobilePath) ? read(mobilePath) : '';
const adminOut = fs.existsSync(adminPath) ? read(adminPath) : '';
const notifOut = fs.existsSync(notifPath) ? read(notifPath) : '';
for (const [label, text, required] of [
  ['mobile ads title', mobileOut, 'اعلانات'],
  ['mobile 3s timer', mobileOut, '3000'],
  ['mobile carousel', mobileOut, 'adminAdSlides.map'],
  ['admin delete', adminOut, 'deleteIndependentAdminAd'],
  ['admin trash button', adminOut, 'Trash2'],
  ['admin multiple slides', adminOut, 'adminAdSlides.length + 1'],
  ['app notifications title', adminOut, 'اشعارات التطبيق'],
  ['auto popup notifications', notifOut, 'MOLDATK_AUTO_POPUP_NOTIFICATIONS_V1'],
]) {
  if (!text.includes(required)) throw new Error(`${label} missing: ${required}`);
}

console.log('Finalized: ads box renamed, multi-slide carousel at 3s, red trash delete buttons, and popup app notifications.');
