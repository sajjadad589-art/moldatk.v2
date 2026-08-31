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

  // احذف زر «تسديد / خيارات الدفع» من بطاقة المشترك في واجهة الهاتف فقط.
  // نعتمد على title الثابت حتى يبقى الحذف صحيحاً حتى لو تغير اسم الـ handler لاحقاً.
  text = text.replace(
    /\n\s*<button\b[\s\S]*?title="تغيير طريقة التسديد"[\s\S]*?<\/button>\n/,
    '\n'
  );

  // احذف CreditCard من الاستيراد فقط إذا لم يعد مستخدماً بعد حذف الزر.
  const bodyWithoutImport = text.replace(/import[\s\S]*?from 'lucide-react';/, '');
  if (!/\bCreditCard\b/.test(bodyWithoutImport)) {
    text = text.replace('  CreditCard,\n', '');
  }

  fs.writeFileSync(mobileSubscribersFile, text);
}

console.log('Mobile payment strip removed and English digits enforced');
