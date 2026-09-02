import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

// 1) Keep the reset timestamp synchronized through generator_settings.
{
  const p = 'src/lib/useGeneratorCloudSync.ts';
  let c = read(p);

  if (!c.includes("walletReset: key('moldatk_wallet_reset_timestamp', generatorId)")) {
    c = c.replace(
      "      audit: key('moldatk_audit_logs', generatorId),",
      "      audit: key('moldatk_audit_logs', generatorId),\n      walletReset: key('moldatk_wallet_reset_timestamp', generatorId),"
    );
  }

  if (!c.includes("walletReset: localStorage.getItem(localKeys.walletReset) || ''")) {
    c = c.replace(
      "      audit: readLocal<AuditLogEntry[]>(localKeys.audit, []),",
      "      audit: readLocal<AuditLogEntry[]>(localKeys.audit, []),\n      walletReset: localStorage.getItem(localKeys.walletReset) || '',"
    );
  }

  if (!c.includes("const walletResetTimestamp = localStorage.getItem(localKeys.walletReset) || '';")) {
    c = c.replace(
      "        const audit = readLocal<AuditLogEntry[]>(localKeys.audit, []);",
      "        const audit = readLocal<AuditLogEntry[]>(localKeys.audit, []);\n        const walletResetTimestamp = localStorage.getItem(localKeys.walletReset) || '';"
    );
  }

  c = c.replace(
    "          if (specs || invoiceTemplate || invoiceCustom) {",
    "          if (specs || invoiceTemplate || invoiceCustom || walletResetTimestamp) {"
  );

  if (!c.includes('wallet_reset_timestamp: walletResetTimestamp || null')) {
    c = c.replace(
      "              invoice_settings: { template: invoiceTemplate || {}, custom: invoiceCustom || {} },\n              updated_at: new Date().toISOString(),",
      "              invoice_settings: { template: invoiceTemplate || {}, custom: invoiceCustom || {} },\n              wallet_reset_timestamp: walletResetTimestamp || null,\n              updated_at: new Date().toISOString(),"
    );
  }

  if (!c.includes('settings.data.wallet_reset_timestamp')) {
    c = c.replace(
      "          if (inv.custom) writeLocal(localKeys.invoiceCustom, inv.custom);",
      "          if (inv.custom) writeLocal(localKeys.invoiceCustom, inv.custom);\n          if (settings.data.wallet_reset_timestamp) {\n            localStorage.setItem(localKeys.walletReset, String(settings.data.wallet_reset_timestamp));\n          }"
    );
  }

  write(p, c);
}

// 2) Reset must immediately mark local state dirty and trigger cloud sync.
{
  const p = 'src/App.tsx';
  let c = read(p);
  c = c.replace(
    "            try { localStorage.setItem(getStorageKey('moldatk_wallet_reset_timestamp'), resetAt); } catch (e) {}\n            showToast('تم تصفير القاصة بنجاح');",
    "            try {\n              localStorage.setItem(getStorageKey('moldatk_wallet_reset_timestamp'), resetAt);\n              window.dispatchEvent(new Event('moldatk-local-sync'));\n            } catch (e) {}\n            showToast('تم تصفير القاصة بنجاح');"
  );
  write(p, c);
}

// 3) Cashbox balance = successful payments - cancellations after the last reset.
// Old cancellation rows may not have amount, so reverse the latest unmatched payment for the same subscriber.
{
  const p = 'src/components/WalletView.tsx';
  let c = read(p);
  const old = `  const totalCollected = financialLogs\r\n    .filter(log => log.category === 'payment')\r\n    .reduce((acc, log) => acc + (Number(log.amount) || 0), 0);`;
  const next = `  const totalCollected = (() => {\r\n    const ordered = [...financialLogs].sort((a, b) =>\r\n      new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()\r\n    );\r\n    const unmatchedPayments = new Map<string, number[]>();\r\n    let balance = 0;\r\n\r\n    for (const log of ordered) {\r\n      const entityKey = String(log.entityId || 'unknown');\r\n      if (log.category === 'payment') {\r\n        const amount = Math.max(0, Number(log.amount) || 0);\r\n        balance += amount;\r\n        const stack = unmatchedPayments.get(entityKey) || [];\r\n        stack.push(amount);\r\n        unmatchedPayments.set(entityKey, stack);\r\n        continue;\r\n      }\r\n\r\n      if (log.category === 'cancellation') {\r\n        let amount = Math.max(0, Number(log.amount) || 0);\r\n        const stack = unmatchedPayments.get(entityKey) || [];\r\n        if (!amount && stack.length) amount = stack.pop() || 0;\r\n        else if (amount && stack.length) stack.pop();\r\n        unmatchedPayments.set(entityKey, stack);\r\n        balance -= amount;\r\n      }\r\n    }\r\n\r\n    return balance;\r\n  })();`;

  if (c.includes(old)) c = c.replace(old, next);
  else {
    const unixOld = old.replaceAll('\r\n', '\n');
    if (c.includes(unixOld)) c = c.replace(unixOld, next.replaceAll('\r\n', '\n'));
  }
  write(p, c);
}

console.log('Applied authoritative synchronized cashbox balance and reset state');
