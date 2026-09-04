import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replaceOnce = (content, from, to, label) => {
  if (!content.includes(from)) {
    console.warn('web theme skip:', label);
    return content;
  }
  return content.replace(from, to);
};

const marker = 'WEB_THEME_POPUP_GLOBAL_V1';

// 1) Global CSS: the selected theme affects the whole mobile web shell, not only settings cards.
{
  const path = 'src/index.css';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes(marker)) {
      c += `\n\n/* ${marker}: web-only global premium themes */\n:root {\n  --moldatk-bg:#eefbfc;\n  --moldatk-surface:#ffffff;\n  --moldatk-surface-2:#f4fbfb;\n  --moldatk-border:rgba(15,111,120,.20);\n  --moldatk-primary:#0f6f78;\n  --moldatk-primary-2:#16a3a8;\n  --moldatk-accent:#d9a441;\n  --moldatk-ink:#0e2a37;\n  --moldatk-muted:#6b7f8e;\n}\n[data-moldatk-theme=\"ocean-calm\"] { --moldatk-bg:#eefbfc; --moldatk-surface:#ffffff; --moldatk-surface-2:#f5fcfc; --moldatk-border:rgba(15,111,120,.22); --moldatk-primary:#0f6f78; --moldatk-primary-2:#16a3a8; --moldatk-accent:#d9a441; --moldatk-ink:#0e2a37; --moldatk-muted:#63818c; }\n[data-moldatk-theme=\"green-comfort\"] { --moldatk-bg:#f1fbf4; --moldatk-surface:#ffffff; --moldatk-surface-2:#f7fff9; --moldatk-border:rgba(31,122,76,.22); --moldatk-primary:#1f7a4c; --moldatk-primary-2:#37a86d; --moldatk-accent:#c7a34a; --moldatk-ink:#173426; --moldatk-muted:#60796b; }\n[data-moldatk-theme=\"soft-gold\"] { --moldatk-bg:#fff8ea; --moldatk-surface:#fffdf7; --moldatk-surface-2:#fff9ea; --moldatk-border:rgba(139,100,31,.22); --moldatk-primary:#8b641f; --moldatk-primary-2:#c89335; --moldatk-accent:#d4af37; --moldatk-ink:#382a12; --moldatk-muted:#877653; }\n[data-moldatk-theme=\"light-metal\"] { --moldatk-bg:#f7f8fa; --moldatk-surface:#ffffff; --moldatk-surface-2:#f2f5f8; --moldatk-border:rgba(100,116,139,.24); --moldatk-primary:#64748b; --moldatk-primary-2:#94a3b8; --moldatk-accent:#b68b5e; --moldatk-ink:#1f2937; --moldatk-muted:#667085; }\n[data-moldatk-theme=\"official-dark\"] { --moldatk-bg:#07101f; --moldatk-surface:#101a2d; --moldatk-surface-2:#131f35; --moldatk-border:rgba(148,163,184,.24); --moldatk-primary:#2563eb; --moldatk-primary-2:#0ea5e9; --moldatk-accent:#d4af37; --moldatk-ink:#f8fafc; --moldatk-muted:#a9b4c4; }\n.moldatk-mobile-shell {\n  background: radial-gradient(circle at top right, color-mix(in srgb, var(--moldatk-primary-2) 16%, transparent), transparent 34%), var(--moldatk-bg) !important;\n  color: var(--moldatk-ink) !important;\n}\n.moldatk-mobile-shell header,\n.moldatk-mobile-shell [class*=\"bg-\\[\\#0b1530\\]\"],\n.moldatk-mobile-shell [class*=\"bg-blue-600\"],\n.moldatk-mobile-shell [class*=\"bg-blue-700\"],\n.moldatk-mobile-shell [class*=\"from-cyan\"],\n.moldatk-mobile-shell [class*=\"to-blue\"] {\n  background: linear-gradient(135deg, var(--moldatk-primary), var(--moldatk-primary-2)) !important;\n}\n.moldatk-mobile-shell .theme-primary { background: linear-gradient(135deg, var(--moldatk-primary), var(--moldatk-primary-2)) !important; color:white !important; }\n.moldatk-mobile-shell .theme-card,\n.moldatk-mobile-shell [class*=\"bg-white\"],\n.moldatk-mobile-shell [class*=\"bg-slate-50\"],\n.moldatk-mobile-shell [class*=\"bg-slate-100\"] {\n  background-color: var(--moldatk-surface) !important;\n  border-color: var(--moldatk-border) !important;\n}\n.moldatk-mobile-shell [class*=\"text-blue-\"],\n.moldatk-mobile-shell .theme-text { color: var(--moldatk-primary) !important; }\n.moldatk-mobile-shell [class*=\"border-blue-\"],\n.moldatk-mobile-shell [class*=\"ring-blue-\"] { border-color: var(--moldatk-primary-2) !important; --tw-ring-color: var(--moldatk-primary-2) !important; }\n.moldatk-mobile-shell input,\n.moldatk-mobile-shell textarea,\n.moldatk-mobile-shell select {\n  background: var(--moldatk-surface) !important;\n  color: var(--moldatk-ink) !important;\n  border-color: var(--moldatk-border) !important;\n}\n.moldatk-mobile-shell .moldatk-bottom-nav,\n.moldatk-mobile-shell nav {\n  background: color-mix(in srgb, var(--moldatk-surface) 92%, var(--moldatk-primary) 8%) !important;\n  border-color: var(--moldatk-border) !important;\n}\n.theme-picker-backdrop { backdrop-filter: blur(10px); }\n`;
      write(path, c);
      console.log('Applied web global theme CSS');
    }
  }
}

// 2) App: persist selected theme and pass it to mobile web layout.
{
  const path = 'src/App.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('WEB_THEME_APP_STATE_V1')) {
      c = replaceOnce(c,
        "  const [toastMessage, setToastMessage] = useState<string | null>(null);",
        "  // WEB_THEME_APP_STATE_V1\n  const [mobileTheme, setMobileTheme] = useState<string>(() => {\n    try { return localStorage.getItem('moldatk_mobile_theme') || 'ocean-calm'; } catch (e) { return 'ocean-calm'; }\n  });\n\n  useEffect(() => {\n    try {\n      localStorage.setItem('moldatk_mobile_theme', mobileTheme);\n      document.documentElement.setAttribute('data-moldatk-theme', mobileTheme);\n    } catch (e) {}\n  }, [mobileTheme]);\n\n  const [toastMessage, setToastMessage] = useState<string | null>(null);",
        'App mobile theme state'
      );
      c = replaceOnce(c,
        "          subscriptionLoading={subscriptionLoading}\n        />",
        "          subscriptionLoading={subscriptionLoading}\n          mobileTheme={mobileTheme}\n          onChangeMobileTheme={setMobileTheme}\n        />",
        'App pass mobile theme props'
      );
      write(path, c);
      console.log('Applied App theme persistence');
    }
  }
}

// 3) MobileLayout: themed root wrapper + pass props to settings.
{
  const path = 'src/components/mobile/MobileLayout.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('WEB_THEME_LAYOUT_PROPS_V1')) {
      c = replaceOnce(c,
        "  subscriptionInfo?: SubscriptionInfo | null;\n  subscriptionLoading?: boolean;\n}",
        "  subscriptionInfo?: SubscriptionInfo | null;\n  subscriptionLoading?: boolean;\n  mobileTheme?: string;\n  onChangeMobileTheme?: (theme: string) => void;\n}",
        'Layout interface theme props'
      );
      c = replaceOnce(c,
        "  subscriptionInfo = null,\n  subscriptionLoading = false,\n}) => {",
        "  subscriptionInfo = null,\n  subscriptionLoading = false,\n  mobileTheme = 'ocean-calm',\n  onChangeMobileTheme,\n}) => {\n  // WEB_THEME_LAYOUT_PROPS_V1",
        'Layout destructure theme props'
      );
      c = replaceOnce(c,
        "    <div className=\"min-h-screen bg-slate-50 dark:bg-[#070d1e] text-slate-900 dark:text-slate-100 flex flex-col font-['Cairo',sans-serif] selection:bg-blue-600 selection:text-white pb-16\">",
        "    <div data-moldatk-theme={mobileTheme} className=\"moldatk-mobile-shell min-h-screen bg-slate-50 dark:bg-[#070d1e] text-slate-900 dark:text-slate-100 flex flex-col font-['Cairo',sans-serif] selection:bg-blue-600 selection:text-white pb-16\">",
        'Layout themed root'
      );
      c = replaceOnce(c,
        "            subscriptionLoading={subscriptionLoading}\n          />",
        "            subscriptionLoading={subscriptionLoading}\n            mobileTheme={mobileTheme}\n            onChangeMobileTheme={onChangeMobileTheme}\n          />",
        'Layout pass settings theme props'
      );
      write(path, c);
      console.log('Applied MobileLayout global theme wrapper');
    }
  }
}

// 4) MobileSettings: popup picker with Apply button instead of applying immediately in the card.
{
  const path = 'src/components/mobile/MobileSettings.tsx';
  if (fs.existsSync(path)) {
    let c = read(path);
    if (!c.includes('WEB_THEME_SETTINGS_POPUP_V1')) {
      c = replaceOnce(c,
        "  subscriptionInfo?: SubscriptionInfo | null;\n  subscriptionLoading?: boolean;\n}",
        "  subscriptionInfo?: SubscriptionInfo | null;\n  subscriptionLoading?: boolean;\n  mobileTheme?: string;\n  onChangeMobileTheme?: (theme: string) => void;\n}",
        'Settings interface theme props'
      );
      c = replaceOnce(c,
        "  subscriptionInfo = null,\n  subscriptionLoading = false,\n}) => {",
        "  subscriptionInfo = null,\n  subscriptionLoading = false,\n  mobileTheme = 'ocean-calm',\n  onChangeMobileTheme,\n}) => {\n  // WEB_THEME_SETTINGS_POPUP_V1\n  const [themePickerOpen, setThemePickerOpen] = React.useState(false);\n  const [draftTheme, setDraftTheme] = React.useState(mobileTheme);\n  React.useEffect(() => setDraftTheme(mobileTheme), [mobileTheme]);\n  const themeOptions = [\n    { id: 'ocean-calm', label: 'بحري هادئ', desc: 'هادئ، منعش، واضح', color: '#16a3a8' },\n    { id: 'green-comfort', label: 'أخضر مريح', desc: 'راحة واستقرار', color: '#37a86d' },\n    { id: 'soft-gold', label: 'ذهبي فاتح', desc: 'دافئ وفخم', color: '#d4af37' },\n    { id: 'light-metal', label: 'معدني فاتح', desc: 'نظيف واحترافي', color: '#94a3b8' },\n    { id: 'official-dark', label: 'داكن رسمي', desc: 'ليلي وهادئ', color: '#0f172a' },\n  ];\n  const currentThemeLabel = themeOptions.find(t => t.id === mobileTheme)?.label || 'بحري هادئ';\n  const applyTheme = () => {\n    try {\n      localStorage.setItem('moldatk_mobile_theme', draftTheme);\n      document.documentElement.setAttribute('data-moldatk-theme', draftTheme);\n    } catch (e) {}\n    if (onChangeMobileTheme) onChangeMobileTheme(draftTheme);\n    setThemePickerOpen(false);\n  };",
        'Settings theme popup state'
      );

      const card = `
      <div className="theme-card bg-white dark:bg-[#111c38] rounded-2xl p-4 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
        <button type="button" onClick={() => setThemePickerOpen(true)} className="w-full flex items-center justify-between text-right">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-600/10 text-cyan-600 dark:text-cyan-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white">الثيم العام للتطبيق</h3>
              <p className="text-[10px] text-slate-400">الحالي: {currentThemeLabel} — يطبق على كل الواجهة</p>
            </div>
          </div>
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {themePickerOpen && (
        <div className="fixed inset-0 z-[999] theme-picker-backdrop bg-slate-950/60 flex items-end justify-center p-3">
          <div className="w-full max-w-lg rounded-[2rem] bg-white dark:bg-[#101a2d] border border-slate-200 dark:border-slate-700 shadow-2xl p-4 space-y-4 max-h-[86vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">اختيار الثيم العام</h3>
                <p className="text-[10px] text-slate-400 mt-1">اختار اللون، وبعدها اضغط تطبيق</p>
              </div>
              <button type="button" onClick={() => setThemePickerOpen(false)} className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black">×</button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {themeOptions.map(option => (
                <button key={option.id} type="button" onClick={() => setDraftTheme(option.id)} className={(draftTheme === option.id ? 'ring-2 ring-blue-500 border-blue-300 ' : 'border-slate-200 dark:border-slate-700 ') + 'rounded-2xl border bg-slate-50 dark:bg-slate-900 p-3 text-right flex items-center gap-3'}>
                  <span className="w-16 h-11 rounded-xl shrink-0 border border-white/60" style={{ background: option.color }} />
                  <span className="flex-1 min-w-0">
                    <strong className="block text-xs font-black text-slate-900 dark:text-white">{option.label}</strong>
                    <span className="block text-[10px] text-slate-400 mt-1">{option.desc}</span>
                  </span>
                  <span className={(draftTheme === option.id ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-transparent') + ' w-6 h-6 rounded-full flex items-center justify-center text-xs font-black'}>✓</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button type="button" onClick={() => setThemePickerOpen(false)} className="py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black">إلغاء</button>
              <button type="button" onClick={applyTheme} className="py-3 rounded-2xl theme-primary text-white text-xs font-black shadow-lg">تطبيق</button>
            </div>
          </div>
        </div>
      )}
`;
      c = replaceOnce(c,
        "      {/* 1. Device View Mode Selector Card (الميزة المطلوبة بوضوح) */}",
        card + "\n      {/* 1. Device View Mode Selector Card (الميزة المطلوبة بوضوح) */}",
        'insert theme popup card'
      );
      write(path, c);
      console.log('Applied MobileSettings popup theme picker');
    }
  }
}

console.log('Web-only global theme popup applied.');
