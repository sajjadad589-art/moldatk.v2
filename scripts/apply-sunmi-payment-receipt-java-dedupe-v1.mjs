import fs from 'node:fs';

const path = 'android/app/src/main/java/com/mwaldatk/app/SunmiPrinterPlugin.java';
let src = fs.readFileSync(path, 'utf8');

// Older receipt guards and the payment patch can both inject the same variables.
// Normalize the partial-payment section to one canonical block every time the
// mutation chain runs (lint + build), so Java compilation stays idempotent.
src = src.replace(
  /\n\s*String previousPaid = raw\(r, "previousPaid"\);\s*\n\s*if \(!previousPaid\.isEmpty\(\)\) addField\(lines, "المسدد سابقاً", previousPaid, true\);\s*/g,
  '\n'
);
src = src.replace(
  /\n\s*String totalBeforePayment = raw\(r, "totalBeforePayment"\);\s*\n\s*if \(!totalBeforePayment\.isEmpty\(\)\) addField\(lines, "المتبقي قبل الدفعة", totalBeforePayment, true\);\s*/g,
  '\n'
);
src = src.replace(
  /\n\s*String receiptPreviousPaid = raw\(r, "previousPaid"\);\s*\n\s*if \(!receiptPreviousPaid\.isEmpty\(\)\) addField\(lines, "المسدد سابقاً", receiptPreviousPaid, true\);\s*/g,
  '\n'
);
src = src.replace(
  /\n\s*String receiptTotalBeforePayment = raw\(r, "totalBeforePayment"\);\s*\n\s*if \(!receiptTotalBeforePayment\.isEmpty\(\)\) addField\(lines, "المتبقي قبل الدفعة", receiptTotalBeforePayment, true\);\s*/g,
  '\n'
);

const paidAnchor = '        String paidAmount = raw(r, "paidAmount");';
if (!src.includes(paidAnchor)) throw new Error('SUNMI paidAmount anchor missing');

const canonical = `        String receiptPreviousPaid = raw(r, "previousPaid");\n        if (!receiptPreviousPaid.isEmpty()) addField(lines, "المسدد سابقاً", receiptPreviousPaid, true);\n\n        String receiptTotalBeforePayment = raw(r, "totalBeforePayment");\n        if (!receiptTotalBeforePayment.isEmpty()) addField(lines, "المتبقي قبل الدفعة", receiptTotalBeforePayment, true);\n\n${paidAnchor}`;
src = src.replace(paidAnchor, canonical);

src = src.replaceAll('addField(lines, "المتبقي", remainingAmount, false);', 'addField(lines, "المتبقي بعد الدفعة", remainingAmount, true);');
src = src.replaceAll('new DrawLine("مولدتي", 31f', 'new DrawLine("مولدتك", 31f');

const count = (needle) => src.split(needle).length - 1;
if (count('String receiptPreviousPaid = raw(r, "previousPaid");') !== 1) throw new Error('SUNMI previousPaid declaration is not unique');
if (count('String receiptTotalBeforePayment = raw(r, "totalBeforePayment");') !== 1) throw new Error('SUNMI totalBeforePayment declaration is not unique');
if (count('String totalBeforePayment = raw(r, "totalBeforePayment");') !== 0) throw new Error('Legacy duplicate totalBeforePayment declaration remains');
if (!src.includes('addField(lines, "المتبقي بعد الدفعة", remainingAmount, true);')) throw new Error('SUNMI remaining-after-payment label missing');

fs.writeFileSync(path, src, 'utf8');
console.log('Normalized SUNMI payment receipt Java block to one idempotent partial-payment section.');
