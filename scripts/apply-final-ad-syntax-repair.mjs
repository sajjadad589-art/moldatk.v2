import fs from 'node:fs';

const path = 'src/components/SuperAdminDashboard.tsx';
let src = fs.readFileSync(path, 'utf8');

// The build still runs older migration scripts that can inject a legacy ad manager.
// Remove that legacy output deterministically; AdminAdSlidesPanel is the only ad UI allowed here.
src = src.replace(/\n\s*type AdminAdSlide = \{[^\n]*\};\s*/g, '\n');
src = src.replace(/\n\s*const \[[^\n]*(?:adminAd|AdminAd)[^\n]*\n/g, '\n');
src = src.replace(/\n\s*const [^=\n]*(?:adminAd|AdminAd)[^=\n]*=[^\n]*\n/g, '\n');

src = src.replace(
  /useEffect\(\(\) => \{\s*void load\(\);\s*void loadAdminAdSlides\(\);\s*\}, \[\]\);/g,
  'useEffect(() => { void load(); }, []);'
);

src = src.replace(/\n\s*const loadAdminAdSlides = async \(\) => \{[\s\S]*?\n\s*\};/g, '\n');
src = src.replace(/\n\s*const saveIndependentAdminAd = async \(e: React\.FormEvent\) => \{[\s\S]*?(?=\n\s*const sendNotification = async)/g, '\n');

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

// Fallback cleanup for fragments left by older patch variants.
src = src.replace(/\n\s*const \{ data, error \} = await supabase\s*\n\s*\.from\('app_ad_slides'\)[\s\S]*?(?=\n\s*(?:const|return|if|await|set|}\)|};|<))/g, '\n');
src = src.replace(/\n\s*await supabase\s*\n\s*\.from\('app_ad_slides'\)[\s\S]*?(?=\n\s*(?:const|return|if|await|set|}\)|};|<))/g, '\n');
src = src.replace(/\n\s*(?:setAdminAdSlides|setAdminAdTitle|setAdminAdBody|setAdminAdLink|setAdminAdImage|setAdminAdMessage|setAdminAdFile|setAdminAdSaving)\([^\n;]*\);?/g, '\n');

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
  'adminAdTitle',
  'adminAdBody',
  'adminAdSlides',
  'setAdminAdSlides',
  'loadAdminAdSlides',
  'saveIndependentAdminAd',
  'deleteIndependentAdminAd',
  "from('app_ad_slides')",
  'إدارة سلايدات اعلانات',
];
for (const token of forbidden) {
  if (out.includes(token)) throw new Error(`Old/broken admin ad code remains in SuperAdminDashboard: ${token}`);
}
if (!out.includes('<AdminAdSlidesPanel />')) throw new Error('AdminAdSlidesPanel missing after repair');
console.log('Final admin ad syntax repair applied.');
