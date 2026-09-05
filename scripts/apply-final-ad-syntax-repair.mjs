import fs from 'node:fs';

const path = 'src/components/SuperAdminDashboard.tsx';
let src = fs.readFileSync(path, 'utf8');

const removeConstFunction = (name) => {
  let guard = 0;
  while (guard++ < 10) {
    const token = `const ${name} =`;
    const start = src.indexOf(token);
    if (start < 0) break;
    const lineStart = src.lastIndexOf('\n', start) + 1;
    const braceStart = src.indexOf('{', start);
    if (braceStart < 0) break;

    let depth = 0;
    let quote = null;
    let escaped = false;
    let end = -1;
    for (let i = braceStart; i < src.length; i += 1) {
      const ch = src[i];
      if (quote) {
        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
      if (ch === '{') depth += 1;
      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i + 1;
          while (end < src.length && /[ \t;]/.test(src[end])) end += 1;
          if (src[end] === '\r') end += 1;
          if (src[end] === '\n') end += 1;
          break;
        }
      }
    }
    if (end < 0) break;
    src = src.slice(0, lineStart) + src.slice(end);
  }
};

// The build still runs older migration scripts that can inject legacy ad managers.
for (const name of ['loadAdminAdSlides', 'saveIndependentAdminAd', 'deleteIndependentAdminAd']) {
  removeConstFunction(name);
}

src = src.replace(/\n\s*type AdminAdSlide = \{[^\n]*\};\s*/g, '\n');
src = src.replace(/\n\s*const \[[^\n]*(?:adminAd|AdminAd)[^\n]*\n/g, '\n');
src = src.replace(/\n\s*const [^=\n]*(?:adminAd|AdminAd)[^=\n]*=[^\n]*\n/g, '\n');
src = src.replace(
  /useEffect\(\(\) => \{\s*void load\(\);\s*void loadAdminAdSlides\(\);\s*\}, \[\]\);/g,
  'useEffect(() => { void load(); }, []);'
);
src = src.replace(/\s*<form onSubmit=\{saveIndependentAdminAd\}[\s\S]*?<\/form>\s*/g, '\n');

const removeSectionContaining = (token) => {
  let guard = 0;
  while (guard++ < 10) {
    const pos = src.indexOf(token);
    if (pos < 0) break;
    const start = src.lastIndexOf('<section', pos);
    const close = src.indexOf('</section>', pos);
    if (start < 0 || close < 0) break;
    src = src.slice(0, start) + src.slice(close + '</section>'.length);
  }
};
removeSectionContaining('إدارة سلايدات اعلانات');

src = src.replace(/\n\s*<section[\s\S]*?(?:adminAdSlides|adminAdTitle|adminAdForm|adminAdImageFile|saveIndependentAdminAd|deleteIndependentAdminAd)[\s\S]*?<\/section>\s*\n/g, '\n');

for (const legacyToken of [
  'setAdminAdSlides', 'setAdminAdTitle', 'setAdminAdBody', 'setAdminAdLink',
  'setAdminAdImage', 'setAdminAdMessage', 'setAdminAdFile', 'setAdminAdSaving',
  'setAdminAdImageFile', 'setAdminAdForm', 'adminAdTitle', 'adminAdBody',
  'adminAdSlides', 'adminAdForm', 'adminAdImageFile', 'adminAdFile',
  'adminAdLink', 'adminAdSaving', 'loadAdminAdSlides', 'saveIndependentAdminAd',
  'deleteIndependentAdminAd',
]) {
  const escapedToken = legacyToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  src = src.replace(new RegExp(`^.*${escapedToken}.*(?:\\r?\\n|$)`, 'gm'), '');
}

// Keep exactly one modern ad panel, seasonal manager and customer orders panel.
src = src.replace(/\nimport \{ AdminAdSlidesPanel \} from '\.\/AdminAdSlidesPanel';/g, '');
src = src.replace(/\nimport \{ SeasonalCampaignManager \} from '\.\/SeasonalCampaignManager';/g, '');
src = src.replace(/\nimport \{ CustomerOrdersPanel \} from '\.\/CustomerOrdersPanel';/g, '');
src = src.replace(
  "import { calculateSubscriberBill } from '../utils/formatters';",
  "import { calculateSubscriberBill } from '../utils/formatters';\nimport { AdminAdSlidesPanel } from './AdminAdSlidesPanel';\nimport { SeasonalCampaignManager } from './SeasonalCampaignManager';\nimport { CustomerOrdersPanel } from './CustomerOrdersPanel';"
);

src = src.replace(/type Tab = 'overview' \| 'generators' \| 'finance' \| 'notifications';/g, "type Tab = 'overview' | 'generators' | 'finance' | 'orders' | 'notifications';");
src = src.replace(/\n\s*\['orders', 'طلبات الموقع',[^\n]*\n/g, '\n');
src = src.replace(
  "    ['finance', 'الحسابات', CircleDollarSign],\n    ['notifications', 'الإشعارات', Bell],",
  "    ['finance', 'الحسابات', CircleDollarSign],\n    ['orders', 'طلبات الموقع', WalletCards],\n    ['notifications', 'الإشعارات', Bell],"
);

src = src.replace(/\n\s*\{tab === 'orders' && <CustomerOrdersPanel \/>\}\s*\n/g, '\n');
const generatorsNeedle = "          {tab === 'generators' &&";
const generatorsIndex = src.indexOf(generatorsNeedle);
if (generatorsIndex >= 0) {
  src = src.slice(0, generatorsIndex) + "          {tab === 'orders' && <CustomerOrdersPanel />}\n\n" + src.slice(generatorsIndex);
}

src = src.replace(/\n\s*<AdminAdSlidesPanel \/>\s*\n/g, '\n');
src = src.replace(/\n\s*<SeasonalCampaignManager \/>\s*\n/g, '\n');
const needle = '<form onSubmit={sendNotification}';
const idx = src.indexOf(needle);
if (idx >= 0) {
  src = src.slice(0, idx) + '<SeasonalCampaignManager />\n            <AdminAdSlidesPanel />\n            ' + src.slice(idx);
}

fs.writeFileSync(path, src, 'utf8');

// Add a prominent order entry point to the public landing page. Do it at the end of the build
// so older patch scripts cannot hide the customer-order flow.
const landingPath = 'src/LandingPage.tsx';
let landing = fs.readFileSync(landingPath, 'utf8');
if (!landing.includes('href="/order"')) {
  landing = landing.replace(
    '<div className="flex flex-wrap gap-3">',
    '<div className="flex flex-wrap gap-3">\n              <a href="/order" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-400 text-slate-950 font-black hover:bg-emerald-300 transition-all">\n                اشترك أو جدد الآن <ArrowLeft className="w-5 h-5" />\n              </a>'
  );
  landing = landing.replace(
    '<a href="#features" className="hover:text-white transition-colors">المزايا</a>',
    '<a href="/order" className="text-emerald-300 hover:text-emerald-200 transition-colors">الاشتراك</a>\n            <a href="#features" className="hover:text-white transition-colors">المزايا</a>'
  );
}
fs.writeFileSync(landingPath, landing, 'utf8');

const out = fs.readFileSync(path, 'utf8');
const forbidden = [
  'adminAdTitle', 'adminAdBody', 'adminAdSlides', 'setAdminAdSlides',
  'adminAdForm', 'adminAdImageFile', 'loadAdminAdSlides',
  'saveIndependentAdminAd', 'deleteIndependentAdminAd',
  "from('app_ad_slides')", 'إدارة سلايدات اعلانات',
];
for (const token of forbidden) {
  if (out.includes(token)) throw new Error(`Old/broken admin ad code remains in SuperAdminDashboard: ${token}`);
}
if (!out.includes('<AdminAdSlidesPanel />')) throw new Error('AdminAdSlidesPanel missing after repair');
if (!out.includes('<SeasonalCampaignManager />')) throw new Error('SeasonalCampaignManager missing after repair');
if (!out.includes("['orders', 'طلبات الموقع', WalletCards]")) throw new Error('Customer orders navigation missing after repair');
if (!out.includes("{tab === 'orders' && <CustomerOrdersPanel />}")) throw new Error('CustomerOrdersPanel missing after repair');
if (!landing.includes('href="/order"')) throw new Error('Customer order landing link missing after repair');
console.log('Final admin ad, seasonal campaign and customer order repair applied.');
