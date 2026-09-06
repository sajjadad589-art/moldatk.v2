import fs from 'node:fs';

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');
const replace = (src, from, to) => src.includes(from) ? src.replaceAll(from, to) : src;

const NAVY = '#0B1F3B';
const NAVY_2 = '#142A45';
const DARK = '#081521';
const GOLD = '#F2B544';

// Global brand tokens. Keep semantic payment colors untouched.
{
  const path = 'src/index.css';
  let src = read(path);
  const marker = '/* MOLDATK_CALM_BRAND_V2 */';
  if (!src.includes(marker)) {
    src += `\n\n${marker}\n:root {\n  --moldatk-navy: ${NAVY};\n  --moldatk-navy-2: ${NAVY_2};\n  --moldatk-dark: ${DARK};\n  --moldatk-gold: ${GOLD};\n  --moldatk-gold-deep: #D89A21;\n  --moldatk-page: #F7F9FC;\n  --moldatk-surface: #FFFFFF;\n  --moldatk-border: #DDE5EC;\n  --moldatk-muted: #667689;\n}\nbody { background: var(--moldatk-page); }\n.dark body { background: var(--moldatk-dark); }\n.brand-focus:focus { outline: none; box-shadow: 0 0 0 2px rgba(242,181,68,.38); border-color: #D89A21; }\n`;
  }
  write(path, src);
}

// Login: calm off-white page, navy actions and muted-gold focus.
{
  const path = 'src/components/LoginView.tsx';
  let src = read(path);
  src = replace(src, 'bg-slate-100 dark:bg-[#070d1e]', 'bg-[#F7F9FC] dark:bg-[#081521]');
  src = replace(src, 'dark:bg-[#111c38]', 'dark:bg-[#102139]');
  src = replace(src, "bg-[#0b2b59] text-white shadow-sm", "bg-[#0B1F3B] text-white shadow-sm ring-1 ring-[#F2B544]/20");
  src = replace(src, 'focus:ring-2 focus:ring-amber-400', 'focus:ring-2 focus:ring-[#F2B544]/45 focus:border-[#D89A21]');
  src = replace(src, 'bg-[#0b2b59] hover:bg-[#123d73]', 'bg-[#0B1F3B] hover:bg-[#142A45]');
  src = replace(src, 'text-amber-400', 'text-[#F2B544]');
  src = replace(src, 'text-amber-300', 'text-[#F2B544]');
  write(path, src);
}

// Desktop header: remove bright royal blue and replace the placeholder M with the real mark.
{
  const path = 'src/components/Navbar.tsx';
  let src = read(path);
  src = replace(src, 'bg-[#1E3A8A] text-white shadow-md border-b border-blue-900/60', 'bg-[#0B1F3B] text-white shadow-md border-b border-[#1C3654]');
  src = replace(src, 'bg-[#14265e] text-blue-200', 'bg-[#081521] text-slate-300');
  src = replace(src, 'border-blue-800/60', 'border-white/10');
  src = replace(src, 'bg-blue-950/60', 'bg-[#142A45]/90');
  src = replace(src, 'bg-blue-900/50', 'bg-[#142A45]/90');
  src = replace(src, 'border-blue-700/50', 'border-white/10');
  src = replace(src, 'text-yellow-400', 'text-[#F2B544]');
  src = replace(src, 'text-blue-200/80', 'text-slate-300/80');
  src = replace(src, 'text-blue-400/65', 'text-[#F2B544]/60');
  src = src.replace(
    /<div className=\{`bg-white rounded-xl flex items-center justify-center text-\[#1E3A8A\] font-black shadow-md shrink-0 \$\{isMobileView \? 'w-8 h-8 text-base' : 'w-10 h-10 text-xl'\}`\}>\s*M\s*<\/div>/,
    `<div className={\`bg-white rounded-xl flex items-center justify-center shadow-md shrink-0 overflow-hidden \${isMobileView ? 'w-8 h-8 p-1' : 'w-10 h-10 p-1'}\`}>\n              <img src="/brand/moldatk-mark.svg" alt="مولدتك" className="w-full h-full object-contain" />\n            </div>`
  );
  src = src.replace(/\{!isMobileView && \(\s*<span className="text-blue-300[\s\S]*?<\/span>\s*\)\}/, '');
  src = replace(src, "'bg-blue-950/80 border-2 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.5)]'", "'bg-[#081521] border border-[#F2B544]/45 text-[#F7E4AF] shadow-sm'");
  src = replace(src, "'bg-blue-900/90 border-2 border-amber-300 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.4)]'", "'bg-[#142A45] border border-[#F2B544]/45 text-[#F7E4AF] shadow-sm'");
  src = replace(src, "darkMode ? 'text-cyan-400' : 'text-amber-300'", "'text-[#F2B544]'");
  write(path, src);
}

// Mobile header runs after the notification-button mutation, so style whatever final block is present.
{
  const path = 'src/components/mobile/MobileHeader.tsx';
  let src = read(path);
  src = replace(src, 'bg-[#1E3A8A] text-white border-b border-blue-900 shadow-md', 'bg-[#0B1F3B] text-white border-b border-[#1C3654] shadow-md');
  src = src.replace(
    /<div className="w-8 h-8 rounded-xl bg-white text-\[#1E3A8A\] flex items-center justify-center font-black text-base shadow-sm shrink-0">\s*M\s*<\/div>/,
    '<div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0 p-1 overflow-hidden"><img src="/brand/moldatk-mark.svg" alt="مولدتك" className="w-full h-full object-contain" /></div>'
  );
  src = replace(src, 'text-blue-200 truncate', 'text-slate-300 truncate');
  src = replace(src, 'bg-blue-950/75 hover:bg-blue-900 border border-blue-700/80', 'bg-[#142A45] hover:bg-[#1B3858] border border-white/10');
  src = replace(src, 'ring-blue-950', 'ring-[#0B1F3B]');
  src = replace(src, 'bg-blue-950/70 hover:bg-blue-900 border border-blue-800 text-blue-200', 'bg-[#142A45] hover:bg-[#1B3858] border border-white/10 text-slate-200');
  src = replace(src, 'text-amber-300', 'text-[#F2B544]');
  write(path, src);
}

// Desktop sidebar and mobile navigation: navy is structural, gold is active accent.
{
  const path = 'src/components/Sidebar.tsx';
  let src = read(path);
  src = replace(src, 'bg-[#1E3A8A] hover:bg-blue-900', 'bg-[#0B1F3B] hover:bg-[#142A45]');
  src = replace(src, 'text-yellow-400', 'text-[#F2B544]');
  src = replace(src, "'bg-blue-50 text-blue-700 font-bold dark:bg-blue-950/60 dark:text-blue-300 shadow-xs'", "'bg-[#FFF7E3] text-[#0B1F3B] font-bold dark:bg-[#142A45] dark:text-[#F7E4AF] shadow-xs'");
  src = replace(src, "isActive ? 'text-[#1E3A8A] dark:text-blue-400'", "isActive ? 'text-[#D89A21] dark:text-[#F2B544]'");
  src = replace(src, "? 'text-blue-600 dark:text-blue-400 font-black bg-blue-50/80 dark:bg-blue-950/60'", "? 'text-[#0B1F3B] dark:text-[#F2B544] font-black bg-[#FFF7E3] dark:bg-[#142A45]'");
  write(path, src);
}

{
  const path = 'src/components/MobileBottomNav.tsx';
  let src = read(path);
  src = replace(src, "? 'text-[#1E3A8A] dark:text-blue-400 font-bold scale-105'", "? 'text-[#0B1F3B] dark:text-[#F2B544] font-bold scale-105'");
  src = replace(src, 'bg-blue-600 text-white', 'bg-[#D89A21] text-white');
  src = replace(src, 'bg-[#1E3A8A] hover:bg-blue-900 text-white shadow-lg shadow-blue-900/30', 'bg-[#0B1F3B] hover:bg-[#142A45] text-white shadow-lg shadow-[#0B1F3B]/25');
  src = replace(src, 'text-yellow-400', 'text-[#F2B544]');
  write(path, src);
}

// Dashboard: preserve green/red payment semantics and ring geometry; rebrand only structural controls.
for (const path of ['src/components/DashboardView.tsx', 'src/components/mobile/MobileDashboard.tsx']) {
  let src = read(path);
  src = replace(src, 'text-[#1E3A8A] dark:text-blue-400', 'text-[#0B1F3B] dark:text-[#F2B544]');
  src = replace(src, 'bg-[#1E3A8A] hover:bg-blue-900', 'bg-[#0B1F3B] hover:bg-[#142A45]');
  src = replace(src, 'text-yellow-400', 'text-[#F2B544]');
  src = replace(src, 'bg-blue-600 active:bg-blue-700 text-white', 'bg-[#0B1F3B] active:bg-[#142A45] text-white');
  src = replace(src, 'bg-gradient-to-l from-blue-950 via-[#13234a] to-[#111c38] border border-blue-700/60', 'bg-gradient-to-l from-[#0B1F3B] via-[#142A45] to-[#0B1F3B] border border-[#F2B544]/35');
  src = replace(src, 'bg-blue-600/20 border border-blue-500/30', 'bg-[#F2B544]/15 border border-[#F2B544]/30');
  src = replace(src, 'text-blue-300', 'text-[#F2B544]');
  src = replace(src, 'text-blue-200/80', 'text-slate-300/85');
  src = replace(src, 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700', 'bg-[#0B1F3B] hover:bg-[#142A45]');
  write(path, src);
}

// Mobile layout and desktop shell: calm light by default; dark mode remains available.
{
  const path = 'src/components/mobile/MobileLayout.tsx';
  let src = read(path);
  src = replace(src, 'bg-slate-50 dark:bg-[#070d1e]', 'bg-[#F7F9FC] dark:bg-[#081521]');
  src = replace(src, 'selection:bg-blue-600 selection:text-white', 'selection:bg-[#F2B544] selection:text-[#0B1F3B]');
  write(path, src);
}
{
  const path = 'src/App.tsx';
  let src = read(path);
  src = src.replace('const [darkMode, setDarkMode] = useState<boolean>(true);', 'const [darkMode, setDarkMode] = useState<boolean>(false);');
  src = replace(src, 'bg-slate-100 dark:bg-[#070d1e]', 'bg-[#F7F9FC] dark:bg-[#081521]');
  write(path, src);
}

// Android installed label + Capacitor display name. Keep com.mwaldatk.app unchanged.
write('android/app/src/main/res/values/strings.xml', `<?xml version='1.0' encoding='utf-8'?>\n<resources>\n    <string name="app_name">مولدتك</string>\n    <string name="title_activity_main">مولدتك</string>\n    <string name="package_name">com.mwaldatk.app</string>\n    <string name="custom_url_scheme">com.mwaldatk.app</string>\n</resources>\n`);

{
  const path = 'capacitor.config.ts';
  let src = read(path);
  src = src.replace("appName: 'mwaldatk'", "appName: 'مولدتك'");
  write(path, src);
}

// Simple native launcher: generator first, no visual noise.
write('android/app/src/main/res/drawable/ic_moldatk_launcher.xml', `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n  <path android:fillColor="#0B1F3B" android:pathData="M16,8H92A8,8 0,0 1,100 16V92A8,8 0,0 1,92 100H16A8,8 0,0 1,8 92V16A8,8 0,0 1,16 8Z"/>\n  <path android:fillColor="#F8FAFC" android:pathData="M24,34H78A6,6 0,0 1,84 40V75A6,6 0,0 1,78 81H24A6,6 0,0 1,18 75V40A6,6 0,0 1,24 34Z"/>\n  <path android:fillColor="#F2B544" android:pathData="M65,34H78A6,6 0,0 1,84 40V75A6,6 0,0 1,78 81H65Z"/>\n  <path android:strokeColor="#F8FAFC" android:strokeWidth="5" android:strokeLineCap="round" android:fillColor="#00000000" android:pathData="M31,34V29A4,4 0,0 1,35 25H56A4,4 0,0 1,60 29V34"/>\n  <path android:strokeColor="#0B1F3B" android:strokeWidth="4" android:strokeLineCap="round" android:fillColor="#00000000" android:pathData="M28,48H51M28,57H51M28,66H51"/>\n  <path android:fillColor="#0B1F3B" android:pathData="M74,43L68,55H73L69,67L80,52H75L80,43Z"/>\n  <path android:fillColor="#F2B544" android:pathData="M24,81H35V88H24ZM68,81H79V88H68Z"/>\n  <path android:fillColor="#D89A21" android:pathData="M18,91H84V95H18Z"/>\n</vector>\n`);

// Modern native splash uses the vector mark on the approved off-white background.
write('android/app/src/main/res/values/styles.xml', `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">\n        <item name="colorPrimary">@color/colorPrimary</item>\n        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>\n        <item name="colorAccent">@color/colorAccent</item>\n    </style>\n    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">\n        <item name="windowActionBar">false</item>\n        <item name="windowNoTitle">true</item>\n        <item name="android:background">@null</item>\n    </style>\n    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">\n        <item name="windowSplashScreenBackground">#F7F9FC</item>\n        <item name="windowSplashScreenAnimatedIcon">@drawable/ic_moldatk_launcher</item>\n        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>\n    </style>\n</resources>\n`);

// Web/PWA identity.
write('public/manifest.webmanifest', JSON.stringify({
  id: '/', name: 'مولدتك', short_name: 'مولدتك',
  description: 'نظام إدارة المولدات الكهربائية والاشتراكات والجباية',
  lang: 'ar', dir: 'rtl', start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait-primary',
  background_color: '#F7F9FC', theme_color: NAVY,
  icons: [
    { src: '/brand/moldatk-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: '/brand/moldatk-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
  ]
}, null, 2) + '\n');

{
  const path = 'index.html';
  let src = read(path);
  src = src.replace(/<title>[\s\S]*?<\/title>/, '<title>مولدتك - إدارة المولدات بسهولة</title>');
  src = src.replace(/<meta name="theme-color" content="[^"]+" \/>/, '<meta name="theme-color" content="#0B1F3B" />');
  src = src.replace('<link rel="apple-touch-icon" href="/icons/icon-192.png" />', '<link rel="icon" href="/brand/moldatk-mark.svg" type="image/svg+xml" />\n    <link rel="apple-touch-icon" href="/icons/icon-192.png" />');
  src = src.replace("<body class=\"bg-slate-50 dark:bg-[#0b1329] text-slate-900 dark:text-slate-100 font-['Cairo',sans-serif] antialiased selection:bg-blue-600 selection:text-white transition-colors duration-200\">", "<body class=\"bg-[#F7F9FC] dark:bg-[#081521] text-[#0B1F3B] dark:text-slate-100 font-['Cairo',sans-serif] antialiased selection:bg-[#F2B544] selection:text-[#0B1F3B] transition-colors duration-200\">");
  write(path, src);
}

write('metadata.json', JSON.stringify({
  name: 'مولدتك - نظام إدارة المولدات',
  description: 'نظام عربي لإدارة المولدات والمشتركين والجباية والتقارير والطباعة بهوية مولدتك الجديدة.',
  requestFramePermissions: [],
  majorCapabilities: ['MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API']
}, null, 2) + '\n');

// Guard against regressions caused by older build-time mutation scripts.
const checks = [
  ['Android Arabic app name', read('android/app/src/main/res/values/strings.xml').includes('<string name="app_name">مولدتك</string>')],
  ['Capacitor Arabic app name', read('capacitor.config.ts').includes("appName: 'مولدتك'")],
  ['Package ID preserved', read('capacitor.config.ts').includes("appId: 'com.mwaldatk.app'")],
  ['Brand mark present', read('public/brand/moldatk-mark.svg').includes('رمز مولدة كهربائية')],
  ['Landing identity present', read('src/LandingPage.tsx').includes('كل شيء') && read('src/LandingPage.tsx').includes('/brand/moldatk-mark.svg')],
  ['Mobile ring logic preserved', read('src/components/mobile/MobileDashboard.tsx').includes('Paid / Unpaid collection wheels')],
  ['Notification header preserved', read('src/components/mobile/MobileHeader.tsx').includes('moldatk-open-notifications')],
  ['Firebase file preserved', fs.existsSync('android/app/google-services.json')],
];
for (const [name, ok] of checks) if (!ok) throw new Error(`Brand identity guard failed: ${name}`);

console.log('Applied Moldatk calm identity v2 across web, dashboard, Android label/icon/splash and PWA without touching accounting, sync or payment semantics.');
