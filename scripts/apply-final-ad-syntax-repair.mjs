import fs from 'node:fs';

const path = 'src/components/SuperAdminDashboard.tsx';
let src = fs.readFileSync(path, 'utf8');

// Remove any broken/orphan code left by old ad patches. The standalone AdminAdSlidesPanel is the only allowed ad UI here.
src = src.replace(/\n\s*const \{ data, error \} = await supabase\s*\n\s*\.from\('app_ad_slides'\)[\s\S]*?(?=\n\s*(?:const|return|if|await|set|}\)|}\;|<))/g, '\n');
src = src.replace(/\n\s*await supabase\s*\n\s*\.from\('app_ad_slides'\)[\s\S]*?(?=\n\s*(?:const|return|if|await|set|}\)|}\;|<))/g, '\n');
src = src.replace(/\n\s*(?:setAdminAdSlides|setAdminAdTitle|setAdminAdBody|setAdminAdLink|setAdminAdImage|setAdminAdMessage)\([^\n;]*\);?/g, '\n');
src = src.replace(/\n\s*if \((?:error|uploadError|insertError)[\s\S]{0,260}?(?:AdminAd|adminAd|إعلان|السلايدات)[\s\S]{0,260}?\n\s*}/g, '\n');
src = src.replace(/\n\s*const \[[^\n]*(?:adminAd|AdminAd)[^\n]*\n/g, '\n');
src = src.replace(/\n\s*const [^=\n]*(?:adminAd|AdminAd)[^=\n]*=[^\n]*\n/g, '\n');
src = src.replace(/\n\s*<section[\s\S]*?(?:adminAd|AdminAd|app_ad_slides)[\s\S]*?<\/section>\s*\n/g, '\n');

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
const forbidden = ['adminAdTitle', 'adminAdBody', 'setAdminAdSlides', "from('app_ad_slides')"];
for (const token of forbidden) {
  if (out.includes(token)) throw new Error(`Old/broken admin ad code remains in SuperAdminDashboard: ${token}`);
}
if (!out.includes('<AdminAdSlidesPanel />')) throw new Error('AdminAdSlidesPanel missing after repair');
console.log('Final admin ad syntax repair applied.');
