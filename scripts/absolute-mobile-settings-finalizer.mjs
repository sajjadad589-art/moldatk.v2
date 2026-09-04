import fs from 'node:fs';

const mobilePath = 'src/components/mobile/MobileSettings.tsx';
const cssPath = 'src/index.css';
const MARKER = 'ABSOLUTE_MOBILE_SETTINGS_FINALIZER_V1';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

function removeFromTo(content, startToken, endToken) {
  let c = content;
  while (c.includes(startToken)) {
    const start = c.indexOf(startToken);
    const end = c.indexOf(endToken, start);
    if (end === -1) break;
    c = c.slice(0, start) + endToken + c.slice(end + endToken.length);
  }
  return c;
}

function removeThemeCard(content) {
  let c = content;
  c = c.replace(/\n\s*\{\/\*\s*2\.\s*Appearance & Theme Toggle \(Dark \/ Light\)\s*\*\/\}[\s\S]*?\n\s*<SubscriptionInfoButton info=\{subscriptionInfo\} loading=\{subscriptionLoading\} \/>/g,
    '\n\n      <SubscriptionInfoButton info={subscriptionInfo} loading={subscriptionLoading} />');
  c = c.replace(/\n\s*\{\/\*[^\n]*(Appearance|Theme|المظهر)[^\n]*\*\/\}[\s\S]*?\n\s*<SubscriptionInfoButton info=\{subscriptionInfo\} loading=\{subscriptionLoading\} \/>/g,
    '\n\n      <SubscriptionInfoButton info={subscriptionInfo} loading={subscriptionLoading} />');
  c = c.replace(/\n\s*<div className=\"bg-white dark:bg\[#[\s\S]*?المظهر \(Dark \/ Light\)[\s\S]*?\n\s*<\/button>\n\s*<\/div>\n/g, '\n');
  c = c.replace(/\n\s*<div className=\"bg-white dark:bg\[#[\s\S]*?المظهر والثيم[\s\S]*?\n\s*<\/div>\n/g, '\n');
  c = c.replace(/\n\s*<div className=\"bg-white dark:bg\[#[\s\S]*?Dark \/ Light[\s\S]*?\n\s*<\/button>\n\s*<\/div>\n/g, '\n');
  return c;
}

function stripAdStateBlocks(content) {
  let c = content;
  const markers = [
    '// SUPABASE_MOBILE_ADS_BOUND_V1',
    '// LIVE_WEB_INDEPENDENT_AD_SLIDES_V1',
    '// FORCE_REMOVE_THEME_AND_STABILIZE_AD_CAROUSEL_V1',
    '// FINAL_WEB_ADMIN_AD_CAROUSEL',
    '// ABSOLUTE_MOBILE_SETTINGS_FINALIZER_V1',
  ];
  for (const m of markers) {
    const start = c.indexOf(m);
    if (start !== -1) {
      const ret = c.indexOf('\n\n  return (', start);
      if (ret !== -1) c = c.slice(0, start) + c.slice(ret + 2);
    }
  }
  c = c.replace(/\n\s*\{supabaseAds\.length > 0 && \([\s\S]*?\n\s*\)\}/g, '');
  c = c.replace(/\n\s*\{activeAdminAd\?\.image_url && \([\s\S]*?\n\s*\)\}/g, '');
  c = c.replace(/\n\s*\{adminAdSlides\.length > 0 && \([\s\S]*?\n\s*\)\}/g, '');
  return c;
}

if (fs.existsSync(mobilePath)) {
  let c = read(mobilePath);

  c = removeThemeCard(c);
  c = stripAdStateBlocks(c);
  c = removeThemeCard(c);

  if (!c.includes("from '../../lib/supabase'")) {
    c = c.replace("import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';", "import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';\nimport { supabase } from '../../lib/supabase';");
  }

  c = c.replace(/export const MobileSettings: React\.FC<MobileSettingsProps> = \(\{[\s\S]*?\}\) => \{\n/, (match) => {
    return match + `  // ${MARKER}\n  const [adminAdSlides, setAdminAdSlides] = React.useState<any[]>([]);\n  const [adminAdIndex, setAdminAdIndex] = React.useState(0);\n\n  React.useEffect(() => {\n    let cancelled = false;\n    const loadSlides = async () => {\n      try {\n        const cached = localStorage.getItem('moldatk_admin_ad_slides');\n        if (cached && !cancelled) setAdminAdSlides(JSON.parse(cached));\n      } catch (e) {}\n      try {\n        const now = new Date().toISOString();\n        const { data, error } = await supabase\n          .from('app_ad_slides')\n          .select('id,title,image_url,link_url,sort_order,updated_at,starts_at,ends_at')\n          .eq('is_active', true)\n          .order('sort_order', { ascending: true })\n          .order('updated_at', { ascending: false })\n          .limit(10);\n        if (!error && Array.isArray(data)) {\n          const rows = data.filter((s: any) => s?.image_url && (!s.starts_at || s.starts_at <= now) && (!s.ends_at || s.ends_at > now));\n          localStorage.setItem('moldatk_admin_ad_slides', JSON.stringify(rows));\n          if (!cancelled) {\n            setAdminAdSlides(rows);\n            setAdminAdIndex(0);\n          }\n        }\n      } catch (e) {}\n    };\n    void loadSlides();\n    const timer = window.setInterval(() => void loadSlides(), 30000);\n    window.addEventListener('online', loadSlides);\n    window.addEventListener('moldatk-local-sync', loadSlides as any);\n    return () => {\n      cancelled = true;\n      window.clearInterval(timer);\n      window.removeEventListener('online', loadSlides);\n      window.removeEventListener('moldatk-local-sync', loadSlides as any);\n    };\n  }, []);\n\n  React.useEffect(() => {\n    if (adminAdSlides.length <= 1) return;\n    const timer = window.setInterval(() => setAdminAdIndex(i => (i + 1) % adminAdSlides.length), 3500);\n    return () => window.clearInterval(timer);\n  }, [adminAdSlides.length]);\n\n  const activeAdminAd = adminAdSlides[adminAdIndex] || null;\n\n`;
  });

  c = c.replace(/    <div className=\"p-3\.5 space-y-4 max-w-lg mx-auto pb-24\">/, `    <div className="p-3.5 space-y-4 max-w-lg mx-auto pb-24">\n      {activeAdminAd?.image_url && (\n        <section className="bg-white dark:bg-[#111c38] rounded-2xl p-3 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">\n          <div className="flex items-center justify-between mb-2">\n            <div className="flex items-center gap-2">\n              <div className="p-1.5 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-300"><Sparkles className="w-4 h-4" /></div>\n              <div>\n                <h3 className="text-xs font-black text-slate-900 dark:text-white">إعلانات الإدارة</h3>\n                <p className="text-[10px] text-slate-500 dark:text-slate-400">تتحدث بالمزامنة عند توفر الإنترنت</p>\n              </div>\n            </div>\n            {adminAdSlides.length > 1 && <span className="text-[10px] text-slate-400 font-bold">{adminAdIndex + 1}/{adminAdSlides.length}</span>}\n          </div>\n          <div className="overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">\n            <div className="flex transition-transform duration-500 ease-out" style={{ transform: \`translateX(-\${adminAdIndex * 100}%)\` }}>\n              {adminAdSlides.map((slide: any) => (\n                <button key={slide.id} type="button" onClick={() => slide.link_url && window.open(slide.link_url, '_blank')} className="min-w-full shrink-0 block">\n                  <img src={slide.image_url} alt={slide.title || 'إعلان الإدارة'} className="w-full aspect-[16/7] object-cover" loading="lazy" />\n                </button>\n              ))}\n            </div>\n          </div>\n          {adminAdSlides.length > 1 && <div className="flex justify-center gap-1.5 mt-2">{adminAdSlides.map((_: any, idx: number) => <span key={idx} className={\`h-1.5 rounded-full transition-all \${idx === adminAdIndex ? 'w-5 bg-blue-600' : 'w-1.5 bg-slate-300 dark:bg-slate-700'}\`} />)}</div>}\n          {activeAdminAd.link_url && <p className="mt-2 text-[10px] font-black text-blue-700 dark:text-blue-300">اضغط على الصورة لفتح الرابط</p>}\n        </section>\n      )}`);

  c = removeThemeCard(c);

  const forbidden = ['المظهر (Dark / Light)', 'المظهر والثيم', 'Appearance & Theme Toggle'];
  const found = forbidden.filter((x) => c.includes(x));
  if (found.length) throw new Error('Mobile theme card cleanup failed: ' + found.join(', '));
  if (!c.includes(MARKER)) throw new Error('Final ad carousel injection missing');
  if (!c.includes('adminAdSlides.map')) throw new Error('Ad carousel map missing');

  write(mobilePath, c);
  console.log('ABSOLUTE finalizer: theme card removed and synced ad carousel injected');
}

if (fs.existsSync(cssPath)) {
  let css = read(cssPath);
  css = css.replace(/\n\/\* WORKMODE_FINAL_MOBILE_UX_BUNDLE_V1: premium mobile themes \*\/[\s\S]*?(?=\n\/\*|$)/g, '');
  css = css.replace(/\n\/\* GLOBAL_THEME_COVERAGE_FIX_V1 \*\/[\s\S]*?(?=\n\/\*|$)/g, '');
  css = css.replace(/\n\/\* MOBILE_THEME_POPUP_ONLY_V1 \*\/[\s\S]*?(?=\n\/\*|$)/g, '');
  write(cssPath, css);
}

console.log('Absolute mobile settings finalizer completed.');
