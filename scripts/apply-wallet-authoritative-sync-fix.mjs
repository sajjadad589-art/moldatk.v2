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

// 3) Cashbox total follows the active filters.
// No filters => actual current cashbox balance.
// Collector/date filters => net amount collected by that filtered result set.
// Payment-only => total payments. Cancellation-only => total cancelled amount.
// Old cancellation rows may have null amount, so resolve them against the latest unmatched
// payment for the same subscriber from the full post-reset financial history.
{
  const p = 'src/components/WalletView.tsx';
  let c = read(p);

  const replacement = `  const walletResolvedAmounts = (() => {\n    const ordered = [...financialLogs].sort((a, b) =>\n      new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()\n    );\n    const unmatchedPayments = new Map<string, Array<{ key: string; amount: number }>>();\n    const amounts = new Map<string, number>();\n\n    const logKey = (log: AuditLogEntry, index: number) =>\n      String((log as any).id || \`${'${'}log.timestamp || ''}-${'${'}log.category}-${'${'}log.entityId || ''}-${'${'}index}\`);\n\n    ordered.forEach((log, index) => {\n      const key = logKey(log, index);\n      const entityKey = String(log.entityId || 'unknown');\n\n      if (log.category === 'payment') {\n        const amount = Math.max(0, Number(log.amount) || 0);\n        amounts.set(key, amount);\n        if (amount > 0) {\n          const stack = unmatchedPayments.get(entityKey) || [];\n          stack.push({ key, amount });\n          unmatchedPayments.set(entityKey, stack);\n        }\n        return;\n      }\n\n      if (log.category === 'cancellation') {\n        let amount = Math.max(0, Number(log.amount) || 0);\n        const stack = unmatchedPayments.get(entityKey) || [];\n        if (!amount && stack.length) amount = stack.pop()?.amount || 0;\n        else if (amount && stack.length) stack.pop();\n        unmatchedPayments.set(entityKey, stack);\n        amounts.set(key, amount);\n        return;\n      }\n\n      amounts.set(key, 0);\n    });\n\n    return { ordered, amounts, logKey };\n  })();\n\n  const isWalletFilterActive =\n    filterType !== 'all' || selectedCollector !== 'all' || !!startDate || !!endDate;\n\n  const totalCollected = (() => {\n    const sourceLogs = isWalletFilterActive ? filteredLogs : financialLogs;\n    let payments = 0;\n    let cancellations = 0;\n\n    sourceLogs.forEach(log => {\n      const originalIndex = walletResolvedAmounts.ordered.indexOf(log);\n      const key = walletResolvedAmounts.logKey(log, originalIndex >= 0 ? originalIndex : 0);\n      const amount = Math.max(0, walletResolvedAmounts.amounts.get(key) || Number(log.amount) || 0);\n      if (log.category === 'payment') payments += amount;\n      if (log.category === 'cancellation') cancellations += amount;\n    });\n\n    if (filterType === 'payment') return payments;\n    if (filterType === 'cancellation') return cancellations;\n    return Math.max(0, payments - cancellations);\n  })();`;

  const simple = /  const totalCollected = financialLogs[\s\S]*?\.reduce\(\(acc, log\) => acc \+ \(Number\(log\.amount\) \|\| 0\), 0\);/;
  const oldPatched = /  const totalCollected = \(\(\) => \{[\s\S]*?\n  \}\)\(\);/;
  const filteredPatched = /  const walletResolvedAmounts = \(\(\) => \{[\s\S]*?\n  \}\)\(\);/;

  if (c.includes('const walletResolvedAmounts = (() => {')) {
    // Already applied in this CI pass; leave it unchanged.
  } else if (simple.test(c)) {
    c = c.replace(simple, replacement);
  } else if (oldPatched.test(c)) {
    c = c.replace(oldPatched, replacement);
  } else if (!filteredPatched.test(c)) {
    throw new Error('Wallet totalCollected block not found');
  }

  c = c.replace(
    '<span className="text-xs font-bold text-emerald-400 block mb-1">الرصيد الحالي في القاصة</span>',
    '<span className="text-xs font-bold text-emerald-400 block mb-1">{isWalletFilterActive ? \'قيمة النتائج حسب الفلتر\' : \'الرصيد الحالي في القاصة\'}</span>'
  );

  write(p, c);
}

console.log('Applied synchronized cashbox repair and filter-aware wallet total');
