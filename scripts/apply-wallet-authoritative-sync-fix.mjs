import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

// 1) Keep cashbox reset timestamp synchronized through generator_settings.
// Cloud is authoritative on pull, INCLUDING null. This clears stale device-only reset timestamps
// left by older builds which caused the cashbox to show only the newest payment.
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

  // Normalize the whole pull block (with or without an existing else) so this script is safe
  // to run more than once in the same CI job (lint, then build).
  const resetPullBlock = /\s*if \(settings\.data\.wallet_reset_timestamp\) \{\s*localStorage\.setItem\(localKeys\.walletReset, String\(settings\.data\.wallet_reset_timestamp\)\);\s*\}(?:\s*else\s*\{\s*localStorage\.removeItem\(localKeys\.walletReset\);\s*\})?/;
  if (resetPullBlock.test(c)) {
    c = c.replace(
      resetPullBlock,
      `\n          if (settings.data.wallet_reset_timestamp) {\n            localStorage.setItem(localKeys.walletReset, String(settings.data.wallet_reset_timestamp));\n          } else {\n            localStorage.removeItem(localKeys.walletReset);\n          }`
    );
  } else {
    c = c.replace(
      "          if (inv.custom) writeLocal(localKeys.invoiceCustom, inv.custom);",
      "          if (inv.custom) writeLocal(localKeys.invoiceCustom, inv.custom);\n          if (settings.data.wallet_reset_timestamp) {\n            localStorage.setItem(localKeys.walletReset, String(settings.data.wallet_reset_timestamp));\n          } else {\n            localStorage.removeItem(localKeys.walletReset);\n          }"
    );
  }

  write(p, c);
}

// 2) Reset must update React state + local storage + cloud sync immediately.
{
  const p = 'src/App.tsx';
  let c = read(p);

  c = c.replace(
    /onClearWalletLogs=\{\(\) => \{[\s\S]*?showToast\('تم تصفير القاصة بنجاح'\);\s*\}\}/,
    `onClearWalletLogs={() => {\n            const resetAt = new Date().toISOString();\n            setWalletResetTimestamp(resetAt);\n            try {\n              localStorage.setItem(getStorageKey('moldatk_wallet_reset_timestamp'), resetAt);\n              window.dispatchEvent(new Event('moldatk-local-sync'));\n            } catch (e) {}\n            showToast('تم تصفير القاصة بنجاح');\n          }}`
  );

  write(p, c);
}

// 3) Cashbox = payment cash-in - cancelled/refunded payment cash-out, after last synchronized reset.
// Old cancellation rows may have null amount, so pair them to the latest unmatched payment for the same subscriber.
{
  const p = 'src/components/WalletView.tsx';
  let c = read(p);

  const replacement = `  const totalCollected = (() => {\n    const ordered = [...financialLogs].sort((a, b) =>\n      new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()\n    );\n    const unmatchedPayments = new Map<string, number[]>();\n    let balance = 0;\n\n    for (const log of ordered) {\n      const entityKey = String(log.entityId || 'unknown');\n      if (log.category === 'payment') {\n        const amount = Math.max(0, Number(log.amount) || 0);\n        if (amount <= 0) continue;\n        balance += amount;\n        const stack = unmatchedPayments.get(entityKey) || [];\n        stack.push(amount);\n        unmatchedPayments.set(entityKey, stack);\n        continue;\n      }\n\n      if (log.category === 'cancellation') {\n        let amount = Math.max(0, Number(log.amount) || 0);\n        const stack = unmatchedPayments.get(entityKey) || [];\n        if (!amount && stack.length) amount = stack.pop() || 0;\n        else if (amount && stack.length) stack.pop();\n        unmatchedPayments.set(entityKey, stack);\n        balance -= amount;\n      }\n    }\n\n    return Math.max(0, balance);\n  })();`;

  const simple = /  const totalCollected = financialLogs[\s\S]*?\.reduce\(\(acc, log\) => acc \+ \(Number\(log\.amount\) \|\| 0\), 0\);/;
  const patched = /  const totalCollected = \(\(\) => \{[\s\S]*?\n  \}\)\(\);/;
  if (simple.test(c)) c = c.replace(simple, replacement);
  else if (patched.test(c)) c = c.replace(patched, replacement);
  else throw new Error('Wallet totalCollected block not found');

  write(p, c);
}

console.log('Applied synchronized cashbox repair: cloud-authoritative reset + net cashflow balance');
