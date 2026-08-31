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

  // Remove only the payment button identified by its stable title.
  // Do not use a broad regex starting at an arbitrary <button>, because that can
  // consume earlier JSX buttons and leave the component syntactically invalid.
  const paymentTitle = 'title="تغيير طريقة التسديد"';
  const titleIndex = text.indexOf(paymentTitle);

  if (titleIndex !== -1) {
    const buttonStart = text.lastIndexOf('<button', titleIndex);
    const buttonEndTag = '</button>';
    const buttonEnd = text.indexOf(buttonEndTag, titleIndex);

    if (buttonStart !== -1 && buttonEnd !== -1) {
      let removeStart = buttonStart;
      let removeEnd = buttonEnd + buttonEndTag.length;

      // Include surrounding indentation/newline for clean JSX formatting.
      const previousNewline = text.lastIndexOf('\n', buttonStart);
      if (previousNewline !== -1) removeStart = previousNewline;
      if (text[removeEnd] === '\n') removeEnd += 1;

      text = text.slice(0, removeStart) + '\n' + text.slice(removeEnd);
    }
  }

  // Remove CreditCard from the import only if it is no longer used.
  const bodyWithoutImport = text.replace(/import[\s\S]*?from 'lucide-react';/, '');
  if (!/\bCreditCard\b/.test(bodyWithoutImport)) {
    text = text.replace('  CreditCard,\n', '');
  }

  fs.writeFileSync(mobileSubscribersFile, text);
}

console.log('Mobile payment strip removed safely and English digits enforced');
