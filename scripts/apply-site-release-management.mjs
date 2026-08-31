import fs from 'node:fs';

const adminFile = 'src/components/SuperAdminDashboard.tsx';
let admin = fs.readFileSync(adminFile, 'utf8');

if (!admin.includes("import { WebsiteReleaseManager } from './WebsiteReleaseManager';")) {
  admin = admin.replace("import { calculateSubscriberBill } from '../utils/formatters';", "import { calculateSubscriberBill } from '../utils/formatters';\nimport { WebsiteReleaseManager } from './WebsiteReleaseManager';");
}
admin = admin.replace("type Tab = 'overview' | 'generators' | 'finance' | 'notifications';", "type Tab = 'overview' | 'generators' | 'finance' | 'notifications' | 'website';");
if (!admin.includes("['website', 'الموقع والتحديثات', Wrench]")) {
  admin = admin.replace("    ['notifications', 'الإشعارات', Bell],", "    ['notifications', 'الإشعارات', Bell],\n    ['website', 'الموقع والتحديثات', Wrench],");
}
if (!admin.includes("tab === 'website' && <WebsiteReleaseManager")) {
  admin = admin.replace("          {tab === 'overview' && <>", "          {tab === 'website' && <WebsiteReleaseManager />}\n\n          {tab === 'overview' && <>");
}
fs.writeFileSync(adminFile, admin);

const appFile = 'src/App.tsx';
let app = fs.readFileSync(appFile, 'utf8');
if (!app.includes("import { useGeneratorCloudSync } from './lib/useGeneratorCloudSync';")) {
  app = app.replace("import { supabase } from './lib/supabase';", "import { supabase } from './lib/supabase';\nimport { useGeneratorCloudSync } from './lib/useGeneratorCloudSync';");
}
if (!app.includes("const ENABLE_NATIVE_PUSH = import.meta.env.VITE_ENABLE_NATIVE_PUSH === 'true';")) {
  app = app.replace(
    "import { FolderDetailModal } from './components/FolderDetailModal';\n",
    "import { FolderDetailModal } from './components/FolderDetailModal';\n\nconst ENABLE_NATIVE_PUSH = import.meta.env.VITE_ENABLE_NATIVE_PUSH === 'true';\n"
  );
}
app = app.replace(
  "if (userSession?.role !== 'generator_admin' || !Capacitor.isNativePlatform()) return;",
  "if (userSession?.role !== 'generator_admin' || !Capacitor.isNativePlatform() || !ENABLE_NATIVE_PUSH) return;"
);
if (!app.includes('useGeneratorCloudSync(userSession);')) {
  const anchor = "  const settingsFolders: SettingsFolderItem[] = INITIAL_SETTINGS_FOLDERS;";
  app = app.replace(anchor, `${anchor}\n\n  // مزامنة فورية بين نسخة الويب وتطبيق Android لنفس حساب المولدة.\n  useGeneratorCloudSync(userSession);`);
}
fs.writeFileSync(appFile, app);

const landingFile = 'src/LandingPage.tsx';
let landing = fs.readFileSync(landingFile, 'utf8');
landing = landing.replace("import React from 'react';", "import React, { useEffect, useState } from 'react';");
if (!landing.includes("from './lib/siteManagement'")) {
  landing = landing.replace("} from 'lucide-react';", "} from 'lucide-react';\nimport { DEFAULT_SITE_SETTINGS, loadActiveRelease, loadSiteSettings, whatsappUrl as buildWhatsappUrl, type AppRelease } from './lib/siteManagement';");
}
const stateAnchor = "  const appUrl = `${window.location.origin}/`;";
if (!landing.includes('const [siteSettings, setSiteSettings]')) {
  landing = landing.replace(stateAnchor, `${stateAnchor}\n  const [siteSettings, setSiteSettings] = useState(DEFAULT_SITE_SETTINGS);\n  const [activeRelease, setActiveRelease] = useState<AppRelease | null>(null);\n\n  useEffect(() => {\n    let cancelled = false;\n    Promise.all([loadSiteSettings(), loadActiveRelease()]).then(([site, release]) => {\n      if (cancelled) return;\n      setSiteSettings(site);\n      setActiveRelease(release);\n    }).catch(() => {});\n    return () => { cancelled = true; };\n  }, []);`);
}
landing = landing.replace(/  const whatsappUrl = `https:\/\/wa\.me\/9647766334555\?text=\$\{encodeURIComponent\('[^']*'\)\}`;/, "  const whatsappUrl = buildWhatsappUrl(siteSettings.whatsapp_phone, siteSettings.whatsapp_message);");
landing = landing.replace(/<h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-\[1\.2\]">\s*إدارة المولدة والجباية<br\/><span className="text-amber-400">من أي جهاز<\/span>\s*<\/h1>/, '<h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.2]">{siteSettings.hero_title}</h1>');
landing = landing.replace(/<p className="text-slate-300 leading-8 max-w-xl text-sm sm:text-base">\s*مولدتك يجمع المشتركين، التسديدات، الفواتير، الجباة والإعدادات في نظام واحد\. استخدمه على Android أو iPhone أو الكمبيوتر بدون ما تنفصل بياناتك بين جهاز وجهاز\.\s*<\/p>/, '<p className="text-slate-300 leading-8 max-w-xl text-sm sm:text-base">{siteSettings.hero_subtitle}</p>');

const releaseWhatsapp = `<a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#25D366] text-white font-black hover:bg-[#20bd5a] transition-all">\n                  <MessageCircle className="w-5 h-5" /> لطلب التطبيق تواصل عن طريق الواتساب\n                </a>`;
if (landing.includes(releaseWhatsapp) && !landing.includes('activeRelease?.apk_url')) {
  landing = landing.replace(releaseWhatsapp, `{siteSettings.android_download_enabled && activeRelease?.apk_url && (\n                  <a href={activeRelease.apk_url} className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-400 text-slate-950 font-black hover:bg-amber-300 transition-all">\n                    <Download className="w-5 h-5" /> تحميل Android v{activeRelease.version_name}\n                  </a>\n                )}\n                ${releaseWhatsapp}`);
}
landing = landing.replace(/<a href=\{whatsappUrl\} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1\.5 text-emerald-400 hover:text-emerald-300 font-bold"><MessageCircle className="w-4 h-4" \/> 07766334555<\/a>/, '<a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-bold"><MessageCircle className="w-4 h-4" /> {siteSettings.whatsapp_phone}</a>');
fs.writeFileSync(landingFile, landing);

console.log('Website/release management, cloud sync, and Android stability guards applied');
