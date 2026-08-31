import fs from 'node:fs';
import path from 'node:path';

const srcRoot = 'src';
const exts = new Set(['.ts', '.tsx', '.js', '.jsx']);

function toAsciiDigits(text) {
  return text
    .replace(/[٠-٩]/g, ch => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, ch => String(ch.charCodeAt(0) - 0x06f0));
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (exts.has(path.extname(entry.name))) {
      let text = fs.readFileSync(full, 'utf8');
      text = toAsciiDigits(text);
      text = text.replace(/'ar-IQ'(?!-u-nu-latn)/g, "'ar-IQ-u-nu-latn'");
      text = text.replace(/"ar-IQ"(?!-u-nu-latn)/g, '"ar-IQ-u-nu-latn"');
      text = text.replace(/\.toLocaleString\(\)/g, ".toLocaleString('en-US')");
      text = text.replace(/new Intl\.NumberFormat\(\)/g, "new Intl.NumberFormat('en-US')");
      fs.writeFileSync(full, text);
    }
  }
}

if (fs.existsSync(srcRoot)) walk(srcRoot);

const formatterFile = 'src/utils/formatters.ts';
if (fs.existsSync(formatterFile)) {
  let text = fs.readFileSync(formatterFile, 'utf8');
  text = text.replace(/toLocaleString\('ar-IQ(?:-u-nu-latn)?'\)/g, "toLocaleString('en-US')");
  fs.writeFileSync(formatterFile, text);
}

const mobileSubscribersFile = 'src/components/mobile/MobileSubscribers.tsx';
if (fs.existsSync(mobileSubscribersFile)) {
  let text = fs.readFileSync(mobileSubscribersFile, 'utf8');
  text = text.replace('  CreditCard,\n', '');
  text = text.replace(/\n\s*<button\n\s*onClick=\{\(e\) => \{\n\s*e\.stopPropagation\(\);\n\s*onTogglePaymentStatus\(sub\.id\);\n\s*\}\}\n\s*className="flex-1 flex items-center justify-center gap-1\.5 py-2 px-3 rounded-xl text-xs font-bold transition-all bg-\[#1E3A8A\] hover:bg-blue-900 text-white shadow-xs cursor-pointer active:scale-98"\n\s*title="تغيير طريقة التسديد"\n\s*>\n\s*<CreditCard className="w-3\.5 h-3\.5 text-yellow-300" \/>\n\s*<span>تسديد \/ خيارات الدفع 💳<\/span>\n\s*<\/button>\n/, '\n');
  fs.writeFileSync(mobileSubscribersFile, text);
}

console.log('Mobile payment strip removed and English digits enforced');
