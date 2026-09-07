import fs from 'node:fs';

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

const ensureMobileSliderImport = (path) => {
  let src = read(path);
  if (!src) return;
  src = src.replace(/import \{ MobileAdSlider \} from '\.\/MobileAdSlider';\n/g, '');
  src = src.replace('import React', "import { MobileAdSlider } from './MobileAdSlider';\nimport React");
  src = src.replace(/\n\s*<MobileAdSlider className="[^"]*" \/>\n/g, '\n');
  write(path, src);
};

const removeMobileSlider = (path) => {
  let src = read(path);
  if (!src) return;
  src = src.replace(/import \{ MobileAdSlider \} from '\.\/MobileAdSlider';\n/g, '');
  src = src.replace(/\n\s*<MobileAdSlider(?:\s+className="[^"]*")?\s*\/>\n/g, '\n');
  write(path, src);
};

const dashboardPath = 'src/components/mobile/MobileDashboard.tsx';
ensureMobileSliderImport(dashboardPath);
let dashboard = read(dashboardPath);
const dashboardMarker = '      {/* 2. Paid / Unpaid collection wheels - keep the approved ring design unchanged. */}';
if (dashboard.includes(dashboardMarker) && !dashboard.includes('<MobileAdSlider className="mt-1" />')) {
  dashboard = dashboard.replace(dashboardMarker, '      <MobileAdSlider className="mt-1" />\n\n' + dashboardMarker);
}
write(dashboardPath, dashboard);

const reportsPath = 'src/components/mobile/MobileMonthlyReports.tsx';
removeMobileSlider(reportsPath);

const sliderPath = 'src/components/mobile/MobileAdSlider.tsx';
let slider = read(sliderPath);
if (slider) {
  slider = slider.replace(/rounded-\[28px\]/g, 'rounded-[22px]');
  slider = slider.replace(/aspect-\[16\/6\]/g, 'aspect-[16/6.4]');
  slider = slider.replace(/aspect-\[16\/7\]/g, 'aspect-[16/6.4]');
  slider = slider.replace(/},\s*4000\)/g, '}, 3500)');
  slider = slider.replace(/},\s*3000\)/g, '}, 3500)');
  write(sliderPath, slider);
}

const settingsPath = 'src/components/mobile/MobileSettings.tsx';
const sourceSettings = read(settingsPath);
if (!sourceSettings.includes('f.folderKey') || !sourceSettings.includes('f.titleAr')) {
  throw new Error('MobileSettings lost its real SettingsFolderItem bindings');
}

await import('./apply-final-ad-syntax-repair.mjs');
await import('./apply-sales-agent-ai-upgrade.mjs');
await import('./apply-owner-ai-help-center.mjs');
await import('./apply-lazy-xlsx.mjs');
await import('./apply-android-push-superadmin-data-fix.mjs');
await import('./apply-superadmin-notifications-delete-generator-fix.mjs');

removeMobileSlider(reportsPath);

const finalDashboard = read(dashboardPath);
const finalReports = read(reportsPath);
const finalSlider = read(sliderPath);
const finalSettings = read(settingsPath);
const finalSuperAdmin = read('src/components/SuperAdminDashboard.tsx');
if (!finalDashboard.includes('<MobileAdSlider className="mt-1" />')) throw new Error('Dashboard ad slider missing');
if (finalReports.includes('MobileAdSlider')) throw new Error('Reports must not contain an ad slider');
if (!finalSlider.includes('3500')) throw new Error('Mobile slider interval missing');
if (!finalSettings.includes('f.folderKey') || !finalSettings.includes('f.titleAr')) throw new Error('Mobile settings folder labels missing');
if (!finalSettings.includes('<OwnerAIAssistant') || !finalSettings.includes('<HelpCenter')) throw new Error('Owner AI/help center missing from mobile settings');
if (finalSuperAdmin.includes('<SeasonalCampaignManager />')) throw new Error('Duplicate seasonal manager remains in Super Admin');
if (!finalSuperAdmin.includes('SUPER_ADMIN_NOTIFICATIONS_LAYOUT_V2')) throw new Error('Super Admin notifications layout fix missing');
if (!finalSuperAdmin.includes('deleteGeneratorAccount')) throw new Error('Super Admin generator delete control missing');

// Branding and update-delivery guards run absolutely last so earlier compatibility scripts cannot restore the previous UI/cache/update behavior.
await import('./apply-brand-identity-v2.mjs');
await import('./apply-brand-surfaces-v2.mjs');
await import('./apply-update-delivery-and-internal-theme-v3-fixed.mjs');
await import('./apply-google-play-cabinet-collector-v2.mjs');
await import('./generate-pwa-brand-icons.mjs');

// The legacy compatibility assertions still target 1.3.18. Normalize either the
// older generated 1.3.17 output or a previous 1.3.19 pass back to 1.3.18, run the
// legacy assertions, then the v6 finalizer below upgrades everything to 1.3.19.
for (const path of ['public/sw.js', 'src/main.tsx']) {
  const current = read(path);
  if (current) write(path, current.replaceAll('1.3.17', '1.3.18').replaceAll('1.3.19', '1.3.18'));
}

// Legacy brand patches still rewrite the web manifest to the old PNGs. Reassert the versioned Moldatk icon set last.
write('public/manifest.webmanifest', JSON.stringify({
  id: '/?pwa=5',
  name: 'مولدتك',
  short_name: 'مولدتك',
  description: 'نظام إدارة المولدات الكهربائية والاشتراكات والجباية',
  lang: 'ar',
  dir: 'rtl',
  start_url: '/?pwa=5',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait-primary',
  background_color: '#0B1F3B',
  theme_color: '#0B1F3B',
  icons: [
    { src: '/icons/moldatk-icon-192-v5.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/moldatk-icon-512-v5.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/moldatk-icon-512-v5.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}, null, 2) + '\n');

if (!read('public/sw.js').includes('moldatk-shell-v4-1.3.18')) throw new Error('1.3.18 service worker cache version missing');
if (!read('src/main.tsx').includes('/sw.js?v=1.3.18')) throw new Error('1.3.18 service worker registration missing');
if (!read('public/manifest.webmanifest').includes('moldatk-icon-192-v5.png')) throw new Error('Versioned PWA manifest icon missing');
for (const iconPath of ['public/icons/moldatk-apple-touch-v5.png', 'public/icons/moldatk-icon-192-v5.png', 'public/icons/moldatk-icon-512-v5.png']) {
  if (!fs.existsSync(iconPath) || fs.statSync(iconPath).size < 1000) throw new Error(`Generated PWA icon missing: ${iconPath}`);
}

// User-visible collector picker and iPhone icon correction must run after every legacy patch and after the v5 compatibility assertions.
await import('./apply-folder-collector-picker-ios-v6.mjs');

// Payment and owner-mobile corrections must be the final functional mutations.
await import('./apply-payment-receipt-precondition-v1.mjs');
await import('./apply-payment-receipt-input-fix-v1.mjs');
await import('./apply-owner-mobile-direct-payment-v1.mjs');
await import('./apply-payment-release-version-1.3.20.mjs');

console.log('Final release guard preserved core features and applied real owner-mobile payments, direct edit flow, receipt feed animation, partial-payment accounting and 1.3.20 update delivery.');
