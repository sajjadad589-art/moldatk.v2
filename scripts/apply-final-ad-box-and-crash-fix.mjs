import fs from 'node:fs';

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

const removeLegacyAdminAdBlocks = (source) => {
  let src = source;
  const tokens = ["from('app_ad_slides')", 'from("app_ad_slides")', 'adminAdTitle', 'adminAdBody', 'adminAdSlides', 'setAdminAdSlides', 'setAdminAdTitle', 'setAdminAdBody'];

  const findBlockStart = (pos) => {
    const candidates = [
      src.lastIndexOf('\n  const ', pos),
      src.lastIndexOf('\n  async function ', pos),
      src.lastIndexOf('\n  function ', pos),
      src.lastIndexOf('\n    const ', pos),
      src.lastIndexOf('\n            <section', pos),
      src.lastIndexOf('\n          <section', pos),
      src.lastIndexOf('\n          <div', pos),
    ].filter(x => x >= 0);
    return candidates.length ? Math.max(...candidates) : Math.max(0, src.lastIndexOf('\n', pos));
  };

  const findBlockEnd = (pos) => {
    const candidates = [
      src.indexOf('\n  const ', pos + 1),
      src.indexOf('\n  const sendNotification', pos + 1),
      src.indexOf('\n  const resetAllDataForRelease', pos + 1),
      src.indexOf('\n  const signOut', pos + 1),
      src.indexOf('\n          {tab ===', pos + 1),
      src.indexOf('\n        </main>', pos + 1),
      src.indexOf('\n  return (', pos + 1),
      src.indexOf('\n};\n', pos + 1),
    ].filter(x => x > pos);
    return candidates.length ? Math.min(...candidates) : src.length;
  };

  let guard = 0;
  while (guard++ < 150) {
    const positions = tokens.map(t => src.indexOf(t)).filter(x => x >= 0);
    if (!positions.length) break;
    const pos = Math.min(...positions);
    const start = findBlockStart(pos);
    const end = findBlockEnd(pos);
    src = src.slice(0, start) + '\n' + src.slice(end);
  }

  return src;
};

const ensureMobileSliderImport = (path) => {
  let src = read(path);
  if (!src) return;
  src = src.replace(/import \{ MobileAdSlider \} from '\.\/MobileAdSlider';\n/g, '');
  src = src.replace('import React', "import { MobileAdSlider } from './MobileAdSlider';\nimport React");
  src = src.replace(/\n\s*<MobileAdSlider className="[^"]*" \/>\n/g, '\n');
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
ensureMobileSliderImport(reportsPath);
let reports = read(reportsPath);
const reportsMarker = '      <div className="grid grid-cols-2 gap-2.5">';
if (reports.includes(reportsMarker) && !reports.includes('<MobileAdSlider className="my-1" />')) {
  reports = reports.replace(reportsMarker, '      <MobileAdSlider className="my-1" />\n\n' + reportsMarker);
}
write(reportsPath, reports);

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

const superPath = 'src/components/SuperAdminDashboard.tsx';
let superSrc = removeLegacyAdminAdBlocks(read(superPath));
superSrc = superSrc.replace(/\nimport \{ AdminAdSlidesPanel \} from '\.\/AdminAdSlidesPanel';/g, '');
superSrc = superSrc.replace(
  "import { calculateSubscriberBill } from '../utils/formatters';",
  "import { calculateSubscriberBill } from '../utils/formatters';\nimport { AdminAdSlidesPanel } from './AdminAdSlidesPanel';"
);
superSrc = superSrc.replace(/\n\s*<AdminAdSlidesPanel \/>\s*\n/g, '\n');

const insertPanel = (source) => {
  let src = source;
  const insert = '<AdminAdSlidesPanel />\n            ';
  const needles = [
    '<form onSubmit={sendNotification}',
    '{tab === \'notifications\' && <div className="grid grid-cols-[420px_1fr] gap-5">',
    "{tab === 'notifications' && <div",
    "{tab === 'overview' && <>",
    '<main className="flex-1 p-6 overflow-y-auto">',
  ];
  for (const needle of needles) {
    const idx = src.indexOf(needle);
    if (idx >= 0) {
      if (needle.startsWith('{tab')) {
        return src.slice(0, idx + needle.length) + '\n            ' + insert + src.slice(idx + needle.length);
      }
      if (needle.startsWith('<main')) {
        return src.slice(0, idx + needle.length) + '\n          ' + insert + src.slice(idx + needle.length);
      }
      return src.slice(0, idx) + insert + src.slice(idx);
    }
  }
  return src;
};

superSrc = insertPanel(superSrc);
write(superPath, superSrc);

const settingsPath = 'src/components/mobile/MobileSettings.tsx';
let settings = read(settingsPath);
settings = settings.replace(/\s*<section[\s\S]*?(المظهر والثيم|اختر اللون المريح|بحري هادئ|ذهبي فاتح|داكن رسمي)[\s\S]*?<\/section>\s*/g, '\n');
settings = settings.replace(/\s*<div[\s\S]*?(View Mode|نمط العرض والتوافق)[\s\S]*?<\/div>\s*/g, '\n');
write(settingsPath, settings);

const finalSuper = read(superPath);
for (const token of ["from('app_ad_slides')", 'from("app_ad_slides")', 'adminAdTitle', 'adminAdBody', 'adminAdSlides', 'setAdminAdSlides']) {
  if (finalSuper.includes(token)) throw new Error(`Legacy admin ad code remains: ${token}`);
}
if (!finalSuper.includes('<AdminAdSlidesPanel />')) throw new Error('AdminAdSlidesPanel missing');
if (!read(dashboardPath).includes('<MobileAdSlider className="mt-1" />')) throw new Error('Dashboard ad slider missing');
if (!read(reportsPath).includes('<MobileAdSlider className="my-1" />')) throw new Error('Reports ad slider missing');
if (!read(sliderPath).includes('3500')) throw new Error('Mobile slider interval missing');
console.log('Final admin ad box cleanup applied.');
