import fs from 'node:fs';

const removeThemeFromApp = () => {
  const path = 'src/App.tsx';
  if (!fs.existsSync(path)) return;
  let c = fs.readFileSync(path, 'utf8');

  c = c.replace(/\n\s*const \[moldatkTheme[\s\S]*?\n\s*\};\n\s*\};\n(?=\n\s*const \[pricingModalOpen)/, '\n');
  c = c.replace(/\s*const applyMoldatkTheme = \(theme: string\) => \{[\s\S]*?\n\s*\};\n/g, '');
  c = c.replace(/\s*useEffect\(\(\) => \{\s*applyMoldatkTheme\(moldatkTheme\);\s*\}, \[moldatkTheme\]\);\n/g, '');
  c = c.replace(/\n\s*useEffect\(\(\) => \{\s*try \{\s*document\.documentElement\.removeAttribute\('data-moldatk-theme'\);[\s\S]*?\n\s*\}, \[moldatkTheme\]\);\n/g, '\n');
  c = c.replace(/\n\s*const handleMoldatkThemeChange = \(themeId: string\) => \{[\s\S]*?showToast\('تم تطبيق الثيم على كل التطبيق'\);\s*\};\n/g, '\n');
  c = c.replace(/\n\s*moldatkTheme=\{moldatkTheme\}\n\s*onChangeMoldatkTheme=\{handleMoldatkThemeChange\}/g, '');
  c = c.replace(/\n\s*data-moldatk-theme=\{moldatkTheme\}/g, '');
  c = c.replace(/className="moldatk-mobile-shell /g, 'className="');

  fs.writeFileSync(path, c);
};

const removeThemeFromMobileLayout = () => {
  const path = 'src/components/mobile/MobileLayout.tsx';
  if (!fs.existsSync(path)) return;
  let c = fs.readFileSync(path, 'utf8');
  c = c.replace(/\n\s*moldatkTheme\?: string;\n\s*onChangeMoldatkTheme\?: \(theme: string\) => void;/g, '');
  c = c.replace(/\n\s*moldatkTheme = 'ocean-calm',\n\s*onChangeMoldatkTheme,/g, '');
  c = c.replace(/\n\s*moldatkTheme=\{moldatkTheme\}\n\s*onChangeMoldatkTheme=\{onChangeMoldatkTheme\}/g, '');
  c = c.replace(/\s*data-moldatk-theme=\{moldatkTheme\}/g, '');
  c = c.replace(/className="moldatk-mobile-shell /g, 'className="');
  fs.writeFileSync(path, c);
};

const removeThemeFromMobileSettings = () => {
  const path = 'src/components/mobile/MobileSettings.tsx';
  if (!fs.existsSync(path)) return;
  let c = fs.readFileSync(path, 'utf8');

  c = c.replace(/\n\s*moldatkTheme\?: string;\n\s*onChangeMoldatkTheme\?: \(theme: string\) => void;/g, '');
  c = c.replace(/\n\s*moldatkTheme = 'ocean-calm',\n\s*onChangeMoldatkTheme,/g, '');
  c = c.replace(/\n\s*const \[isThemeSheetOpen[\s\S]*?\n\s*const applySelectedTheme = \(\) => \{[\s\S]*?\n\s*\};\n/g, '\n');
  c = c.replace(/\n\s*const moldatkThemes = \[[\s\S]*?\n\s*\];\n/g, '\n');
  c = c.replace(/\n\s*const activeMoldatkTheme = moldatkThemes\.find[\s\S]*?\n/g, '\n');

  c = c.replace(/\n\s*\{isThemeSheetOpen && \([\s\S]*?\n\s*\)\}\n\s*\{\/\* Theme chooser card \*\/\}\n\s*<div className="bg-white dark:bg-\[#111c38\][\s\S]*?<\/button>\n\s*<\/div>/g, '');
  c = c.replace(/\n\s*\{\/\* Theme chooser card \*\/\}[\s\S]*?\n\s*<SubscriptionInfoButton/g, '\n
      <SubscriptionInfoButton');
  c = c.replace(/\n\s*<div className="bg-white dark:bg-\[#111c38\] rounded-2xl p-4 border border-slate-200\/90 dark:border-slate-800 shadow-xs space-y-3">\n\s*<div className="flex items-center justify-between">\n\s*<div className="flex items-center gap-2">\n\s*<div className="p-2 rounded-xl bg-cyan-500\/10 text-cyan-600">\n\s*<Sparkles[\s\S]*?تطبيق الثيم<\/button>\n\s*<\/div>/g, '');

  fs.writeFileSync(path, c);
};

const removeThemeCss = () => {
  const path = 'src/index.css';
  if (!fs.existsSync(path)) return;
  let c = fs.readFileSync(path, 'utf8');
  c = c.replace(/\n\n\/\* WORKMODE_FINAL_MOBILE_UX_BUNDLE_V1: premium mobile themes \*\/[\s\S]*?\.moldatk-mobile-shell \.theme-text \{ color: var\(--moldatk-primary\); \}\n/g, '\n');
  c = c.replace(/\n\n\/\* GLOBAL_THEME_COVERAGE_FIX_V1[\s\S]*?\/\* END_GLOBAL_THEME_COVERAGE_FIX_V1 \*\/\n/g, '\n');
  fs.writeFileSync(path, c);
};

removeThemeFromApp();
removeThemeFromMobileLayout();
removeThemeFromMobileSettings();
removeThemeCss();

console.log('Removed experimental Moldatk theme system from web branch; dark/light mode remains.');
