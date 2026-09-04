import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);

const replaceBetween = (content, startNeedle, endNeedle, replacement, label) => {
  const start = content.indexOf(startNeedle);
  if (start === -1) {
    console.warn('skip start:', label);
    return content;
  }
  const end = content.indexOf(endNeedle, start);
  if (end === -1) {
    console.warn('skip end:', label);
    return content;
  }
  return content.slice(0, start) + replacement + content.slice(end);
};

// Mobile settings: remove appearance/theme card, keep only independent ad slide carousel from app_ad_slides.
{
  const path = 'src/components/mobile/MobileSettings.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('INDEPENDENT_AD_SLIDES_CLEANUP_V1')) {
      c = c.replace("import { supabase } from '../../lib/supabase';", "import { supabase } from '../../lib/supabase';");
      if (!c.includes("from '../../lib/supabase'")) {
        c = c.replace("import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';", "import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';\nimport { supabase } from '../../lib/supabase';");
      }

      // Remove old appearance card entirely.
      c = c.replace(/\n\s*\{\/\* 2\. Appearance & Theme Toggle[\s\S]*?<SubscriptionInfoButton info=\{subscriptionInfo\} loading=\{subscriptionLoading\} \/>/, '\n\n      <SubscriptionInfoButton info={subscriptionInfo} loading={subscriptionLoading} />');

      // Remove any old notification/ad carousel snippets from prior experiments.
      c = c.replace(/\n\s*\{supabaseAds\.length > 0 && \([\s\S]*?\n\s*\)\}\n\s*\)/g, '');

      if (!c.includes('const [adminAdSlides')) {
        const stateBlock = `
  // INDEPENDENT_AD_SLIDES_CLEANUP_V1
  const [adminAdSlides, setAdminAdSlides] = React.useState<any[]>([]);
  const [activeAdminAdIndex, setActiveAdminAdIndex] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const loadAdminSlides = async () => {
      try {
        const cached = localStorage.getItem('moldatk_admin_ad_slides_cache');
        if (cached && !cancelled) setAdminAdSlides(JSON.parse(cached));
      } catch (e) {}
      try {
        const { data, error } = await supabase
          .from('app_ad_slides')
          .select('id,title,image_url,link_url,sort_order,updated_at')
          .eq('slot_key', 'settings_top')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('updated_at', { ascending: false })
          .limit(8);
        if (!error && Array.isArray(data)) {
          localStorage.setItem('moldatk_admin_ad_slides_cache', JSON.stringify(data));
          if (!cancelled) setAdminAdSlides(data);
        }
      } catch (e) {}
    };
    void loadAdminSlides();
    const timer = window.setInterval(() => void loadAdminSlides(), 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  React.useEffect(() => {
    if (adminAdSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveAdminAdIndex(i => (i + 1) % adminAdSlides.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [adminAdSlides.length]);
`;
        c = c.replace(/\n\}\) => \{\n/, (m) => m + stateBlock);
      }

      const carousel = `    <div className="p-3.5 space-y-4 max-w-lg mx-auto pb-24">
      {adminAdSlides.length > 0 && (() => {
        const ad = adminAdSlides[Math.min(activeAdminAdIndex, adminAdSlides.length - 1)] || adminAdSlides[0];
        const image = <img src={ad.image_url} alt={ad.title || 'إعلان الإدارة'} className="w-full aspect-[16/7] object-cover rounded-3xl shadow-lg border border-slate-200 dark:border-slate-800 bg-white" loading="lazy" />;
        return (
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-black text-slate-700 dark:text-slate-200">إعلانات الإدارة</h3>
              <span className="text-[10px] font-bold text-slate-400">تتحدث بالمزامنة</span>
            </div>
            {ad.link_url ? (
              <button type="button" onClick={() => window.open(ad.link_url, '_blank')} className="block w-full text-right">
                {image}
              </button>
            ) : image}
            {adminAdSlides.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-1">
                {adminAdSlides.map((_: any, i: number) => <span key={i} className={\`h-1.5 rounded-full transition-all \${i === activeAdminAdIndex ? 'w-5 bg-blue-700' : 'w-1.5 bg-slate-300'}\`} />)}
              </div>
            )}
          </section>
        );
      })()}
`;
      c = c.replace('    <div className="p-3.5 space-y-4 max-w-lg mx-auto pb-24">', carousel);
      write(path, c);
      console.log('Applied independent mobile ad slides and removed appearance/theme card');
    }
  }
}

// Super Admin: add a separate, clear ad slides manager backed by app_ad_slides.
{
  const path = 'src/components/SuperAdminDashboard.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('INDEPENDENT_AD_SLIDES_ADMIN_V1')) {
      if (!c.includes('const [adSlideFile')) {
        c = c.replace(
          "  const [notificationMediaFile, setNotificationMediaFile] = useState<File | null>(null);",
          "  const [notificationMediaFile, setNotificationMediaFile] = useState<File | null>(null);\n  // INDEPENDENT_AD_SLIDES_ADMIN_V1\n  const [adSlideFile, setAdSlideFile] = useState<File | null>(null);\n  const [adSlideTitle, setAdSlideTitle] = useState('');\n  const [adSlideLink, setAdSlideLink] = useState('');"
        );
      }

      const fn = `
  const saveAdminAdSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!adSlideFile) {
        setMessage('ارفق صورة الإعلان أولاً');
        return;
      }
      if (!adSlideFile.type.startsWith('image/')) {
        setMessage('الإعلان يقبل صورة فقط');
        return;
      }
      const ext = adSlideFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const safeName = adSlideFile.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80) || 'admin-ad.' + ext;
      const storagePath = \`settings-top/\${Date.now()}-\${Math.random().toString(16).slice(2)}-\${safeName}\`;
      const { error: uploadError } = await supabase.storage
        .from('app-ad-slides')
        .upload(storagePath, adSlideFile, { contentType: adSlideFile.type || 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;
      const { data: publicFile } = supabase.storage.from('app-ad-slides').getPublicUrl(storagePath);

      await supabase.from('app_ad_slides').update({ is_active: false }).eq('slot_key', 'settings_top');
      const { error } = await supabase.from('app_ad_slides').insert({
        slot_key: 'settings_top',
        title: adSlideTitle.trim() || null,
        image_url: publicFile.publicUrl,
        link_url: adSlideLink.trim() || null,
        sort_order: 0,
        is_active: true,
      } as any);
      if (error) throw error;
      setAdSlideFile(null);
      setAdSlideTitle('');
      setAdSlideLink('');
      setMessage('تم حفظ إعلان الإدارة المستقل، وسيظهر عند اتصال المستخدم بالإنترنت بدون تحديث التطبيق');
      await load();
    } catch (err: any) {
      setMessage('تعذر حفظ إعلان الإدارة: ' + (err?.message || 'خطأ غير معروف'));
    }
  };
`;
      const insertBefore = '  const resetAllDataForRelease = async () => {';
      c = c.replace(insertBefore, fn + '\n' + insertBefore);

      const card = `
            <form onSubmit={saveAdminAdSlide} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:col-span-2">
              <h2 className="text-lg font-black flex items-center gap-2"><Megaphone className="w-5 h-5 text-blue-700" />إعلان الإدارة المستقل</h2>
              <p className="text-xs text-slate-500 mt-1 mb-5">ليس مرتبطاً بالإشعارات. صورة واحدة محفوظة في Supabase وتتحدث عند الاتصال بالإنترنت.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block md:col-span-2">
                  <span className="text-xs font-black text-slate-600">إرفاق صورة الإعلان</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => setAdSlideFile(e.target.files?.[0] || null)} className="mt-2 w-full rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/70 p-4 text-sm font-bold text-slate-700 file:ml-3 file:rounded-xl file:border-0 file:bg-blue-700 file:px-4 file:py-2 file:text-white file:font-black" />
                  <span className="block text-[11px] text-slate-400 mt-2">أفضل قياس: 1200×520 أو أي صورة عريضة بنسبة قريبة من 16:7</span>
                </label>
                <input placeholder="عنوان داخلي اختياري" value={adSlideTitle} onChange={e => setAdSlideTitle(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input placeholder="رابط اختياري عند الضغط على الصورة" value={adSlideLink} onChange={e => setAdSlideLink(e.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {adSlideFile && <div className="mt-4 rounded-3xl overflow-hidden border border-slate-200 bg-slate-50"><img src={URL.createObjectURL(adSlideFile)} alt="معاينة الإعلان" className="w-full aspect-[16/7] object-cover" /></div>}
              <button className="mt-4 w-full rounded-2xl bg-blue-700 text-white py-3 font-black shadow-lg shadow-blue-700/20">حفظ وتحديث إعلان الإدارة</button>
            </form>
`;
      // Put separate ad slide card right before old notification card if possible.
      c = c.replace('<form onSubmit={sendNotification} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">', card + '\n            <form onSubmit={sendNotification} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">');

      // Make the old notification card visually distinct and not confused with ad slides.
      c = c.replace('إعلان داخل التطبيق</h2>', 'إشعار النظام</h2>');
      c = c.replace('ينحفظ مباشرة في Supabase ويظهر لأصحاب المولدات بالموبايل', 'للرسائل والتنبيهات فقط، وليس لإعلان الصورة داخل الإعدادات');

      write(path, c);
      console.log('Applied independent Super Admin ad slide manager');
    }
  }
}

console.log('Independent ad slides cleanup applied.');
