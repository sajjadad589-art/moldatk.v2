import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);

// 1) Load saved theme before React renders so every page gets the theme immediately.
{
  const path = 'src/main.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('GLOBAL_THEME_BOOTSTRAP_V1')) {
      c = c.replace(
        "import './index.css';",
        "import './index.css';\n\n// GLOBAL_THEME_BOOTSTRAP_V1: apply saved theme before the UI mounts.\ntry {\n  const savedTheme = localStorage.getItem('moldatk_premium_theme') || 'ocean-calm';\n  document.documentElement.setAttribute('data-moldatk-theme', savedTheme);\n  document.body.setAttribute('data-moldatk-theme', savedTheme);\n} catch (e) {}"
      );
      write(path, c);
      console.log('Applied global theme bootstrap');
    }
  }
}

// 2) Make CSS variables affect the whole app: backgrounds, cards, fields, headers, tabs, modals, reports, settings.
{
  const path = 'src/index.css';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('GLOBAL_THEME_COVERAGE_V1')) {
      c += `

/* GLOBAL_THEME_COVERAGE_V1: theme must cover all pages, cards, modals, fields and controls */
:root,
[data-moldatk-theme="ocean-calm"] {
  --moldatk-bg:#eefbfc;
  --moldatk-bg-soft:#dff4f6;
  --moldatk-surface:#ffffff;
  --moldatk-surface-2:#f7fdfe;
  --moldatk-border:#d7e7ea;
  --moldatk-primary:#0f6f78;
  --moldatk-primary-2:#16a3a8;
  --moldatk-accent:#d9a441;
  --moldatk-ink:#0e2430;
  --moldatk-muted:#738494;
  --moldatk-topbar:#243f97;
}
[data-moldatk-theme="green-comfort"] { --moldatk-bg:#f1fbf4; --moldatk-bg-soft:#e1f7e9; --moldatk-surface:#ffffff; --moldatk-surface-2:#f8fffa; --moldatk-border:#d6ecdd; --moldatk-primary:#1f7a4c; --moldatk-primary-2:#37a86d; --moldatk-accent:#c7a34a; --moldatk-ink:#173426; --moldatk-muted:#6d8074; --moldatk-topbar:#1f7a4c; }
[data-moldatk-theme="soft-gold"] { --moldatk-bg:#fff8ea; --moldatk-bg-soft:#f8edcf; --moldatk-surface:#fffdf7; --moldatk-surface-2:#fffaf0; --moldatk-border:#ead9ae; --moldatk-primary:#8b641f; --moldatk-primary-2:#c89335; --moldatk-accent:#d4af37; --moldatk-ink:#382a12; --moldatk-muted:#8c7a57; --moldatk-topbar:#8b641f; }
[data-moldatk-theme="light-metal"] { --moldatk-bg:#f7f8fa; --moldatk-bg-soft:#eef1f5; --moldatk-surface:#ffffff; --moldatk-surface-2:#f9fafb; --moldatk-border:#d9dee8; --moldatk-primary:#64748b; --moldatk-primary-2:#94a3b8; --moldatk-accent:#b68b5e; --moldatk-ink:#1f2937; --moldatk-muted:#737f8e; --moldatk-topbar:#475569; }
[data-moldatk-theme="official-dark"] { --moldatk-bg:#07101f; --moldatk-bg-soft:#0d1830; --moldatk-surface:#101a2d; --moldatk-surface-2:#111f36; --moldatk-border:#263654; --moldatk-primary:#0f6f78; --moldatk-primary-2:#0ea5e9; --moldatk-accent:#d4af37; --moldatk-ink:#f8fafc; --moldatk-muted:#a9b6ca; --moldatk-topbar:#101a2d; }

html[data-moldatk-theme],
html[data-moldatk-theme] body,
html[data-moldatk-theme] #root {
  background: var(--moldatk-bg) !important;
  color: var(--moldatk-ink) !important;
}

html[data-moldatk-theme] .moldatk-mobile-shell,
html[data-moldatk-theme] main,
html[data-moldatk-theme] .min-h-screen.bg-slate-50,
html[data-moldatk-theme] .dark\\:bg-\\[\\#070d1e\\],
html[data-moldatk-theme] .bg-slate-50 {
  background: radial-gradient(circle at top, color-mix(in srgb, var(--moldatk-primary-2) 13%, transparent), transparent 38%), var(--moldatk-bg) !important;
  color: var(--moldatk-ink) !important;
}

html[data-moldatk-theme] .bg-white,
html[data-moldatk-theme] .dark\\:bg-\\[\\#111c38\\],
html[data-moldatk-theme] .dark\\:bg-\\[\\#131E38\\],
html[data-moldatk-theme] .bg-slate-50,
html[data-moldatk-theme] .bg-slate-100,
html[data-moldatk-theme] [class*="rounded-2xl"],
html[data-moldatk-theme] [class*="rounded-3xl"] {
  border-color: var(--moldatk-border) !important;
}

html[data-moldatk-theme] .bg-white,
html[data-moldatk-theme] .dark\\:bg-\\[\\#111c38\\],
html[data-moldatk-theme] .dark\\:bg-\\[\\#131E38\\] {
  background-color: var(--moldatk-surface) !important;
  color: var(--moldatk-ink) !important;
}

html[data-moldatk-theme] .bg-slate-50,
html[data-moldatk-theme] .bg-slate-100,
html[data-moldatk-theme] .dark\\:bg-slate-900\\/60,
html[data-moldatk-theme] .dark\\:bg-slate-900\\/80,
html[data-moldatk-theme] .dark\\:bg-slate-900\\/50,
html[data-moldatk-theme] .dark\\:bg-slate-800 {
  background-color: var(--moldatk-surface-2) !important;
  color: var(--moldatk-ink) !important;
}

html[data-moldatk-theme] input,
html[data-moldatk-theme] select,
html[data-moldatk-theme] textarea,
html[data-moldatk-theme] .border {
  background-color: var(--moldatk-surface) !important;
  border-color: var(--moldatk-border) !important;
  color: var(--moldatk-ink) !important;
}
html[data-moldatk-theme] input::placeholder,
html[data-moldatk-theme] textarea::placeholder { color: var(--moldatk-muted) !important; }

html[data-moldatk-theme] .text-slate-900,
html[data-moldatk-theme] .dark\\:text-white,
html[data-moldatk-theme] .text-slate-800,
html[data-moldatk-theme] .dark\\:text-slate-200 { color: var(--moldatk-ink) !important; }
html[data-moldatk-theme] .text-slate-600,
html[data-moldatk-theme] .text-slate-500,
html[data-moldatk-theme] .text-slate-400,
html[data-moldatk-theme] .dark\\:text-slate-300,
html[data-moldatk-theme] .dark\\:text-slate-400 { color: var(--moldatk-muted) !important; }

html[data-moldatk-theme] .bg-blue-600,
html[data-moldatk-theme] .bg-blue-700,
html[data-moldatk-theme] .theme-primary,
html[data-moldatk-theme] button[class*="bg-blue"] {
  background: linear-gradient(135deg, var(--moldatk-primary), var(--moldatk-primary-2)) !important;
  color: #fff !important;
}
html[data-moldatk-theme] .text-blue-600,
html[data-moldatk-theme] .text-blue-700,
html[data-moldatk-theme] .dark\\:text-blue-400,
html[data-moldatk-theme] .theme-text { color: var(--moldatk-primary) !important; }
html[data-moldatk-theme] .bg-blue-600\\/10,
html[data-moldatk-theme] .bg-blue-50 { background-color: color-mix(in srgb, var(--moldatk-primary-2) 12%, white) !important; }

html[data-moldatk-theme] header,
html[data-moldatk-theme] .mobile-topbar,
html[data-moldatk-theme] .sticky.top-0,
html[data-moldatk-theme] .fixed.bottom-0 {
  border-color: var(--moldatk-border) !important;
}

html[data-moldatk-theme] .fixed.bottom-0,
html[data-moldatk-theme] nav {
  background-color: color-mix(in srgb, var(--moldatk-surface) 92%, transparent) !important;
  color: var(--moldatk-ink) !important;
}

html[data-moldatk-theme] .shadow-xs,
html[data-moldatk-theme] .shadow-sm,
html[data-moldatk-theme] .shadow-lg,
html[data-moldatk-theme] .shadow-2xl { box-shadow: 0 16px 38px color-mix(in srgb, var(--moldatk-primary) 13%, transparent) !important; }

html[data-moldatk-theme="official-dark"] .bg-white,
html[data-moldatk-theme="official-dark"] input,
html[data-moldatk-theme="official-dark"] select,
html[data-moldatk-theme="official-dark"] textarea {
  background-color: var(--moldatk-surface) !important;
  color: var(--moldatk-ink) !important;
}
`;
      write(path, c);
      console.log('Applied global theme CSS coverage');
    }
  }
}

// 3) Replace MobileSettings with a stable popup-based theme chooser that applies to html/body/root immediately.
{
  const path = 'src/components/mobile/MobileSettings.tsx';
  if (fs.existsSync(path)) {
    const c = `import React from 'react';
import {
  DollarSign,
  Zap,
  Network,
  Database,
  Moon,
  Sun,
  Smartphone,
  Monitor,
  RotateCcw,
  Download,
  ChevronLeft,
  Shield,
  Sliders,
  Sparkles,
  Users,
  Printer,
  X,
  Check,
} from 'lucide-react';
import {
  DeviceViewMode,
  SubscriptionTierPricing,
  GeneratorSpecs,
  LineDistribution,
  SettingsFolderItem,
} from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { SubscriptionInfoButton, SubscriptionInfo } from '../SubscriptionStatusUI';
import { supabase } from '../../lib/supabase';

interface MobileSettingsProps {
  viewMode: DeviceViewMode;
  onChangeViewMode: (mode: DeviceViewMode) => void;
  darkMode: boolean;
  onToggleTheme: () => void;
  pricingTiers: SubscriptionTierPricing[];
  generatorSpecs: GeneratorSpecs;
  lines: LineDistribution[];
  folders: SettingsFolderItem[];
  onOpenPricingModal: () => void;
  onOpenFolderModal: (folderKey: string) => void;
  onExportData: () => void;
  onResetData: () => void;
  subscriptionInfo?: SubscriptionInfo | null;
  subscriptionLoading?: boolean;
}

const THEME_OPTIONS = [
  { id: 'ocean-calm', title: 'بحري هادئ', desc: 'هادئ، منعش، واضح', swatch: '#16a3a8' },
  { id: 'green-comfort', title: 'أخضر مريح', desc: 'راحة واستقرار', swatch: '#37a86d' },
  { id: 'soft-gold', title: 'ذهبي فاتح', desc: 'دافئ وفخم', swatch: '#d4af37' },
  { id: 'light-metal', title: 'معدني فاتح', desc: 'نظيف واحترافي', swatch: '#94a3b8' },
  { id: 'official-dark', title: 'داكن رسمي', desc: 'ليلي وهادئ', swatch: '#101a2d' },
] as const;

type PremiumTheme = typeof THEME_OPTIONS[number]['id'];

const applyPremiumTheme = (theme: PremiumTheme) => {
  try {
    localStorage.setItem('moldatk_premium_theme', theme);
    document.documentElement.setAttribute('data-moldatk-theme', theme);
    document.body.setAttribute('data-moldatk-theme', theme);
    document.getElementById('root')?.setAttribute('data-moldatk-theme', theme);
    window.dispatchEvent(new CustomEvent('moldatk-theme-change', { detail: { theme } }));
  } catch (e) {}
};

export const MobileSettings: React.FC<MobileSettingsProps> = ({
  viewMode,
  onChangeViewMode,
  darkMode,
  onToggleTheme,
  pricingTiers,
  generatorSpecs,
  lines,
  folders,
  onOpenPricingModal,
  onOpenFolderModal,
  onExportData,
  onResetData,
  subscriptionInfo = null,
  subscriptionLoading = false,
}) => {
  const [supabaseAds, setSupabaseAds] = React.useState<any[]>([]);
  const [isThemePickerOpen, setIsThemePickerOpen] = React.useState(false);
  const [currentTheme, setCurrentTheme] = React.useState<PremiumTheme>(() => {
    try { return (localStorage.getItem('moldatk_premium_theme') as PremiumTheme) || 'ocean-calm'; } catch (e) { return 'ocean-calm'; }
  });
  const [draftTheme, setDraftTheme] = React.useState<PremiumTheme>(currentTheme);

  React.useEffect(() => {
    applyPremiumTheme(currentTheme);
    const onChange = (e: any) => {
      const next = e?.detail?.theme as PremiumTheme;
      if (THEME_OPTIONS.some(t => t.id === next)) setCurrentTheme(next);
    };
    window.addEventListener('moldatk-theme-change', onChange as EventListener);
    return () => window.removeEventListener('moldatk-theme-change', onChange as EventListener);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const loadSupabaseAds = async () => {
      try {
        const cached = localStorage.getItem('moldatk_supabase_ads');
        if (cached && !cancelled) setSupabaseAds(JSON.parse(cached));
      } catch (e) {}
      try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('app_notifications')
          .select('id,title,body,media_url,media_type,action_url,priority,starts_at,ends_at,expires_at,created_at')
          .eq('is_active', true)
          .lte('starts_at', now)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(10);
        if (!error && Array.isArray(data)) {
          const rows = data.filter((ad: any) => (!ad.ends_at || ad.ends_at > now) && (!ad.expires_at || ad.expires_at > now));
          localStorage.setItem('moldatk_supabase_ads', JSON.stringify(rows));
          if (!cancelled) setSupabaseAds(rows);
        }
      } catch (e) {}
    };
    void loadSupabaseAds();
    const timer = window.setInterval(() => void loadSupabaseAds(), 60000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const getFolderIcon = (iconName: string) => {
    switch (iconName) {
      case 'DollarSign': return <DollarSign className="w-5 h-5 text-emerald-500" />;
      case 'Zap': return <Zap className="w-5 h-5 text-amber-500" />;
      case 'Network': return <Network className="w-5 h-5 text-blue-500" />;
      case 'Users': return <Users className="w-5 h-5 text-purple-500" />;
      case 'Printer': return <Printer className="w-5 h-5 text-indigo-500" />;
      default: return <Database className="w-5 h-5 text-slate-500" />;
    }
  };

  const selectedTheme = THEME_OPTIONS.find(t => t.id === currentTheme) || THEME_OPTIONS[0];

  return (
    <div className="p-3.5 space-y-4 max-w-lg mx-auto pb-24">
      {supabaseAds.length > 0 && (
        <section className="rounded-3xl theme-primary p-3.5 shadow-lg overflow-hidden text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Sparkles className="w-5 h-5" /><h3 className="text-sm font-black">إعلانات الإدارة</h3></div>
            <span className="text-[10px] font-bold text-white/75">Supabase</span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x">
            {supabaseAds.map((ad: any) => (
              <button key={ad.id} type="button" onClick={() => ad.action_url && window.open(ad.action_url, '_blank')} className="min-w-[86%] snap-center text-right rounded-2xl bg-white text-slate-900 p-3 border border-white/40">
                {ad.media_url && ad.media_type !== 'video' && <img src={ad.media_url} alt="" className="w-full h-28 object-cover rounded-xl mb-2" loading="lazy" />}
                {ad.media_url && ad.media_type === 'video' && <video src={ad.media_url} className="w-full h-28 object-cover rounded-xl mb-2" controls preload="metadata" />}
                <strong className="block text-sm font-black">{ad.title}</strong>
                <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-5">{ad.body}</p>
                {ad.action_url && <span className="mt-2 inline-block text-[11px] font-black text-blue-700">فتح الرابط</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="bg-white dark:bg-[#111c38] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400"><Sparkles className="w-5 h-5" /></div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">المظهر والثيم العام</h3>
            <p className="text-[10px] text-slate-400">الثيم الحالي: {selectedTheme.title}</p>
          </div>
        </div>
        <button onClick={() => { setDraftTheme(currentTheme); setIsThemePickerOpen(true); }} className="px-4 py-2 rounded-xl theme-primary text-xs font-black">اختيار</button>
      </div>

      <div className="bg-white dark:bg-[#111c38] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400"><Smartphone className="w-5 h-5" /></div>
          <div><h3 className="text-xs font-bold text-slate-900 dark:text-white">نمط العرض والتوافق مع الأجهزة (View Mode)</h3><p className="text-[10px] text-slate-400">اختر واجهة الهاتف أو الحاسوب أو الكشف التلقائي</p></div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
          <button onClick={() => onChangeViewMode('mobile')} className={`flex flex-col items-center justify-center p-2.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'mobile' ? 'theme-primary shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}><Smartphone className="w-4 h-4 mb-1" /><span>هاتف 📱</span></button>
          <button onClick={() => onChangeViewMode('desktop')} className={`flex flex-col items-center justify-center p-2.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'desktop' ? 'theme-primary shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}><Monitor className="w-4 h-4 mb-1" /><span>حاسوب 🖥️</span></button>
          <button onClick={() => onChangeViewMode('auto')} className={`flex flex-col items-center justify-center p-2.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'auto' ? 'theme-primary shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}><RotateCcw className="w-4 h-4 mb-1" /><span>تلقائي 🔄</span></button>
        </div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
          {viewMode === 'auto' && 'الوضع الحالي: كشف تلقائي حسب الجهاز.'}
          {viewMode === 'mobile' && 'الوضع الحالي: واجهة الهاتف مفعلة بشكل دائم.'}
          {viewMode === 'desktop' && 'الوضع الحالي: واجهة الحاسوب مفعلة.'}
        </div>
      </div>

      <div className="bg-white dark:bg-[#111c38] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2"><div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">{darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}</div><div><h3 className="text-xs font-bold text-slate-900 dark:text-white">الوضع الليلي/النهاري</h3><p className="text-[10px] text-slate-400">هذا منفصل عن الثيم العام</p></div></div>
        <button onClick={onToggleTheme} className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${darkMode ? 'bg-blue-600' : 'bg-slate-300'}`}><div className={`w-5 h-5 rounded-full bg-white transition-transform ${darkMode ? 'translate-x-0' : 'translate-x-6'}`} /></button>
      </div>

      <SubscriptionInfoButton info={subscriptionInfo} loading={subscriptionLoading} />

      <div className="bg-white dark:bg-[#111c38] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2"><div className="p-2 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400"><Sliders className="w-5 h-5" /></div><div><h3 className="text-xs font-bold text-slate-900 dark:text-white">فروع وإعدادات المنظومة</h3></div></div>
        <div className="space-y-2 pt-1">
          {folders.map(f => (
            <div key={f.id} onClick={() => { if (f.folderKey === 'pricing') onOpenPricingModal(); else onOpenFolderModal(f.folderKey); }} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0"><div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">{getFolderIcon(f.iconName)}</div><div className="min-w-0"><span className="font-bold text-slate-800 dark:text-slate-200 block truncate">{f.titleAr}</span></div></div>
              <div className="flex items-center gap-1 shrink-0">{f.badge && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{f.badge}</span>}<ChevronLeft className="w-4 h-4 text-slate-400" /></div>
            </div>
          ))}
        </div>
      </div>

      {isThemePickerOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#111c38] border border-slate-200 dark:border-slate-800 shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between"><div><h3 className="text-base font-black text-slate-900 dark:text-white">اختيار الثيم العام</h3><p className="text-xs text-slate-500">اختر اللون ثم اضغط تطبيق</p></div><button onClick={() => setIsThemePickerOpen(false)} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><X className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-1 gap-2">
              {THEME_OPTIONS.map(t => (
                <button key={t.id} onClick={() => setDraftTheme(t.id)} className={`p-3 rounded-2xl border text-right flex items-center gap-3 ${draftTheme === t.id ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-200 dark:border-slate-800'}`}>
                  <span className="w-14 h-10 rounded-xl shrink-0 border" style={{ background: t.swatch }} />
                  <span className="flex-1"><strong className="block text-sm font-black text-slate-900 dark:text-white">{t.title}</strong><span className="block text-xs text-slate-500 mt-1">{t.desc}</span></span>
                  {draftTheme === t.id && <Check className="w-5 h-5 text-blue-600" />}
                </button>
              ))}
            </div>
            <button onClick={() => { setCurrentTheme(draftTheme); applyPremiumTheme(draftTheme); setIsThemePickerOpen(false); }} className="w-full py-3 rounded-2xl theme-primary text-sm font-black">تطبيق الثيم على كل التطبيق</button>
          </div>
        </div>
      )}
    </div>
  );
};
`;
    write(path, c);
    console.log('Replaced MobileSettings with popup theme chooser');
  }
}

// 4) Ensure MobileLayout root has a stable theme class and theme attribute.
{
  const path = 'src/components/mobile/MobileLayout.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('moldatk-mobile-shell')) {
      c = c.replace(
        '<div className="min-h-screen bg-slate-50 dark:bg-[#070d1e] text-slate-900 dark:text-slate-100 flex flex-col font-[\'Cairo\',sans-serif] selection:bg-blue-600 selection:text-white pb-16">',
        '<div data-moldatk-theme={typeof window !== \'undefined\' ? (localStorage.getItem(\'moldatk_premium_theme\') || \'ocean-calm\') : \'ocean-calm\'} className="moldatk-mobile-shell min-h-screen bg-slate-50 dark:bg-[#070d1e] text-slate-900 dark:text-slate-100 flex flex-col font-[\'Cairo\',sans-serif] selection:bg-blue-600 selection:text-white pb-16">'
      );
      write(path, c);
      console.log('Applied MobileLayout theme shell');
    }
  }
}

console.log('Global theme coverage fix applied.');
