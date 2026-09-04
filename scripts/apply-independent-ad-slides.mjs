import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);

const ensureImport = (content, path, symbol) => content.includes(path)
  ? content
  : content.replace("import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';", `import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';\n${symbol}`);

// Remove old experimental theme scripts from the chain and add this script once.
{
  const path = 'scripts/apply-month-activation-accounting-fix.mjs';
  if (fs.existsSync(path)) {
    let c = read(path);
    c = c.replace(/\nawait import\('\.\/apply-web-theme-popup-only\.mjs'\);/g, '');
    c = c.replace(/\nawait import\('\.\/apply-global-theme-coverage-fix\.mjs'\);/g, '');
    c = c.replace(/\nawait import\('\.\/remove-web-theme-system\.mjs'\);/g, '');
    if (!c.includes("./apply-independent-ad-slides.mjs")) {
      c += "\nawait import('./apply-independent-ad-slides.mjs');\n";
    }
    write(path, c);
  }
}

// Mobile settings: independent slideshow, not notifications UI. Reads from app_notifications with category='offer'.
{
  const path = 'src/components/mobile/MobileSettings.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);

    if (!c.includes("from '../../lib/supabase'")) {
      c = ensureImport(c, "from '../../lib/supabase'", "import { supabase } from '../../lib/supabase';");
    }
    if (!c.includes('ImageIcon')) {
      c = c.replace('Printer,', 'Printer,\n  ImageIcon,');
    }

    if (!c.includes('INDEPENDENT_AD_SLIDES_V1')) {
      const stateBlock = `
  // INDEPENDENT_AD_SLIDES_V1 - إعلان/سلايدات مستقلة عن الإشعارات
  const [adSlides, setAdSlides] = React.useState<any[]>([]);
  const [activeAdSlide, setActiveAdSlide] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const loadAdSlides = async () => {
      try {
        const cached = localStorage.getItem('moldatk_independent_ad_slides');
        if (cached && !cancelled) {
          const rows = JSON.parse(cached);
          if (Array.isArray(rows)) setAdSlides(rows);
        }
      } catch (e) {}

      try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('app_notifications')
          .select('id,title,body,media_url,media_type,action_url,priority,starts_at,ends_at,expires_at,created_at')
          .eq('is_active', true)
          .eq('category', 'offer')
          .not('media_url', 'is', null)
          .lte('starts_at', now)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(8);
        if (!error && Array.isArray(data)) {
          const rows = data.filter((ad: any) => (!ad.ends_at || ad.ends_at > now) && (!ad.expires_at || ad.expires_at > now));
          localStorage.setItem('moldatk_independent_ad_slides', JSON.stringify(rows));
          if (!cancelled) {
            setAdSlides(rows);
            setActiveAdSlide(0);
          }
        }
      } catch (e) {}
    };
    void loadAdSlides();
    const refreshTimer = window.setInterval(() => void loadAdSlides(), 60000);
    return () => { cancelled = true; window.clearInterval(refreshTimer); };
  }, []);

  React.useEffect(() => {
    if (adSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveAdSlide(prev => (prev + 1) % adSlides.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [adSlides.length]);
`;
      c = c.replace(/\n\}\) => \{\n/, (m) => m + stateBlock);

      const insertAfter = `  return (\n    <div className="p-3.5 space-y-4 max-w-lg mx-auto pb-24">`;
      const slideUi = `  return (\n    <div className="p-3.5 space-y-4 max-w-lg mx-auto pb-24">\n      {adSlides.length > 0 && (() => {\n        const ad = adSlides[Math.min(activeAdSlide, adSlides.length - 1)] || adSlides[0];\n        const image = (\n          <img\n            src={ad.media_url}\n            alt={ad.title || 'إعلان'}\n            loading="lazy"\n            className="w-full aspect-[16/7] object-cover rounded-[1.4rem] border border-slate-200 dark:border-slate-800 shadow-sm bg-white"\n          />\n        );\n        return (\n          <section className="rounded-[1.6rem] bg-white dark:bg-[#111c38] border border-slate-200/90 dark:border-slate-800 p-3 shadow-xs overflow-hidden">\n            <div className="flex items-center justify-between mb-2">\n              <div className="flex items-center gap-2">\n                <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400"><ImageIcon className="w-4 h-4" /></div>\n                <div>\n                  <h3 className="text-xs font-black text-slate-900 dark:text-white">إعلانات الإدارة</h3>\n                  <p className="text-[10px] text-slate-400">تتحدث تلقائياً من السوبر أدمن</p>\n                </div>\n              </div>\n              {adSlides.length > 1 && <span className="text-[10px] font-bold text-slate-400">{activeAdSlide + 1}/{adSlides.length}</span>}\n            </div>\n            {ad.action_url ? (\n              <button type="button" onClick={() => window.open(ad.action_url, '_blank')} className="block w-full text-right">{image}</button>\n            ) : image}\n            {(ad.title || ad.body) && (\n              <div className="pt-2 px-1">\n                {ad.title && <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">{ad.title}</h4>}\n                {ad.body && <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-5">{ad.body}</p>}\n              </div>\n            )}\n            {adSlides.length > 1 && (\n              <div className="flex items-center justify-center gap-1.5 pt-3">\n                {adSlides.map((_: any, idx: number) => (\n                  <button key={idx} type="button" onClick={() => setActiveAdSlide(idx)} className={\`h-1.5 rounded-full transition-all \${idx === activeAdSlide ? 'w-6 bg-blue-600' : 'w-1.5 bg-slate-300 dark:bg-slate-700'}\`} />\n                ))}\n              </div>\n            )}\n          </section>\n        );\n      })()}`;
      if (c.includes(insertAfter)) c = c.replace(insertAfter, slideUi);
      write(path, c);
    }
  }
}

// Super Admin: keep the ad panel independent in wording and do not label it as notification.
{
  const path = 'src/components/SuperAdminDashboard.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    c = c.replace(/إرسال إشعار/g, 'إدارة سلايدات الإعلان');
    c = c.replace(/نشر الإشعار/g, 'حفظ سلايد الإعلان');
    c = c.replace(/نص الإشعار/g, 'وصف الإعلان');
    c = c.replace(/صيانة، عروض، أو تحديثات التطبيق/g, 'إعلانات مستقلة تظهر أعلى الإعدادات داخل تطبيق صاحب المولدة');
    c = c.replace(/إعلان داخل التطبيق/g, 'سلايدات الإعلان داخل التطبيق');
    c = c.replace(/ينحفظ مباشرة في Supabase ويظهر لأصحاب المولدات بالموبايل/g, 'منفصل عن الإشعارات: ارفع صورة مناسبة وأضف رابط اختياري');
    c = c.replace(/حفظ الإعلان في Supabase/g, 'حفظ سلايد الإعلان');
    c = c.replace(/أو رابط صورة\/فيديو جاهز/g, 'أو رابط صورة جاهز');
    c = c.replace(/image\/\*,video\/mp4,video\/webm/g, 'image/*');
    c = c.replace(/رفع صورة\/فيديو الإعلان إلى Supabase/g, 'رفع صورة الإعلان إلى Supabase - يفضّل 1200×520 أو 16:7');

    // Allow multiple slides again by removing the single-slot deactivation behavior if present.
    c = c.replace(/\n\s*await supabase\.from\('app_notifications'\)[\s\S]*?\.neq\('id', data\.id\);/g, '');
    write(path, c);
  }
}

console.log('Independent ad slides applied: no theme system, no notification dependency, image upload, optional link, auto rotation.');
