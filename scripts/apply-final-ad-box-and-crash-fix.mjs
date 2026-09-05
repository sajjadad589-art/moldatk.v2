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

// Reports must remain clean: no advertisement carousel in the monthly reports screen.
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

// IMPORTANT: never overwrite MobileSettings here. The real component contains
// ads, device compatibility, subscription info, pricing and every settings folder.
// A previous release build replaced it with a simplified component that used
// non-existent fields (key/title/description), producing blank settings cards.
const settingsPath = 'src/components/mobile/MobileSettings.tsx';
const sourceSettings = read(settingsPath);
if (!sourceSettings.includes('f.folderKey') || !sourceSettings.includes('f.titleAr')) {
  throw new Error('MobileSettings lost its real SettingsFolderItem bindings');
}

// Run build-safety repairs first, then inject owner-facing features last.
await import('./apply-final-ad-syntax-repair.mjs');
await import('./apply-sales-agent-ai-upgrade.mjs');
await import('./apply-owner-ai-help-center.mjs');
await import('./apply-lazy-xlsx.mjs');

// Re-apply the reports cleanup after every build-time transform so no earlier script
// can bring the reports advertisement back.
removeMobileSlider(reportsPath);

const finalDashboard = read(dashboardPath);
const finalReports = read(reportsPath);
const finalSlider = read(sliderPath);
const finalSettings = read(settingsPath);
if (!finalDashboard.includes('<MobileAdSlider className="mt-1" />')) throw new Error('Dashboard ad slider missing');
if (finalReports.includes('MobileAdSlider')) throw new Error('Reports must not contain an ad slider');
if (!finalSlider.includes('3500')) throw new Error('Mobile slider interval missing');
if (!finalSettings.includes('f.folderKey') || !finalSettings.includes('f.titleAr')) throw new Error('Mobile settings folder labels missing');
if (!finalSettings.includes('<OwnerAIAssistant') || !finalSettings.includes('<HelpCenter')) throw new Error('Owner AI/help center missing from mobile settings');

console.log('Final release guard preserved full settings, kept dashboard ads, removed report ads, and applied AI/help features safely.');
