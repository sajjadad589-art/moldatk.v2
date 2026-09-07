import fs from 'node:fs';

const path = 'android/app/src/main/java/com/mwaldatk/app/SunmiPrinterPlugin.java';
let src = fs.readFileSync(path, 'utf8');

// The repository applies several receipt compatibility patches during both lint
// and build. More than one of them can declare the same helper variable inside
// buildReceiptBitmap(). Keep the first declaration and remove later declarations
// without depending on the exact position/layout of the receipt block.
const dedupeJavaDeclaration = (name, key) => {
  const re = new RegExp(`^([ \\t]*)String ${name} = raw\\(r, "${key}"\\);[ \\t]*$`, 'gm');
  let seen = false;
  src = src.replace(re, match => {
    if (!seen) {
      seen = true;
      return match;
    }
    return '';
  });
};

dedupeJavaDeclaration('previousPaid', 'previousPaid');
dedupeJavaDeclaration('totalBeforePayment', 'totalBeforePayment');
dedupeJavaDeclaration('receiptPreviousPaid', 'previousPaid');
dedupeJavaDeclaration('receiptTotalBeforePayment', 'totalBeforePayment');

src = src.replaceAll('addField(lines, "المتبقي", remainingAmount, false);', 'addField(lines, "المتبقي بعد الدفعة", remainingAmount, true);');
src = src.replaceAll('new DrawLine("مولدتي", 31f', 'new DrawLine("مولدتك", 31f');

const countMatches = re => (src.match(re) || []).length;
if (countMatches(/^\s*String previousPaid = raw\(r, "previousPaid"\);\s*$/gm) > 1) throw new Error('Duplicate SUNMI previousPaid declaration remains');
if (countMatches(/^\s*String totalBeforePayment = raw\(r, "totalBeforePayment"\);\s*$/gm) > 1) throw new Error('Duplicate SUNMI totalBeforePayment declaration remains');
if (countMatches(/^\s*String receiptPreviousPaid = raw\(r, "previousPaid"\);\s*$/gm) > 1) throw new Error('Duplicate SUNMI receiptPreviousPaid declaration remains');
if (countMatches(/^\s*String receiptTotalBeforePayment = raw\(r, "totalBeforePayment"\);\s*$/gm) > 1) throw new Error('Duplicate SUNMI receiptTotalBeforePayment declaration remains');
if (!src.includes('المسدد سابقاً') || !src.includes('المتبقي قبل الدفعة')) throw new Error('SUNMI partial-payment receipt labels missing');

fs.writeFileSync(path, src, 'utf8');
console.log('Deduplicated SUNMI payment receipt Java declarations without changing receipt layout.');
