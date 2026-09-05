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
// Remove complete legacy functions first so their Supabase chains cannot be left orphaned.
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

// One old patch embeds an advertisement form directly inside the notifications tab.
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

// Strip one-line callbacks/JSX props/loader calls left by historical injectors.
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

// Keep exactly one modern panel import and one panel instance.
src = src.replace(/\nimport \{ AdminAdSlidesPanel \} from '\.\/AdminAdSlidesPanel';/g, '');
src = src.replace(
  "import { calculateSubscriberBill } from '../utils/formatters';",
  "import { calculateSubscriberBill } from '../utils/formatters';\nimport { AdminAdSlidesPanel } from './AdminAdSlidesPanel';"
);
src = src.replace(/\n\s*<AdminAdSlidesPanel \/>\s*\n/g, '\n');
const needle = '<form onSubmit={sendNotification}';
const idx = src.indexOf(needle);
if (idx >= 0) {
  src = src.slice(0, idx) + '<AdminAdSlidesPanel />\n            ' + src.slice(idx);
}

fs.writeFileSync(path, src, 'utf8');

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
console.log('Final admin ad syntax repair applied.');
