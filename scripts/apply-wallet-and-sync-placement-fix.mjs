import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

// Pass real financial data from App into the mobile layout/wallet.
{
  const p = 'src/App.tsx';
  let c = read(p);
  const marker = `          subscriptionInfo={subscriptionInfo}\n          subscriptionLoading={subscriptionLoading}\n        />`;
  const replacement = `          subscriptionInfo={subscriptionInfo}\n          subscriptionLoading={subscriptionLoading}\n          collectors={collectors}\n          auditLogs={auditLogs}\n          walletResetTimestamp={walletResetTimestamp}\n          onClearWalletLogs={() => {\n            const resetAt = new Date().toISOString();\n            setWalletResetTimestamp(resetAt);\n            try { localStorage.setItem(getStorageKey('moldatk_wallet_reset_timestamp'), resetAt); } catch (e) {}\n            showToast('تم تصفير القاصة بنجاح');\n          }}\n        />`;
  if (c.includes(marker) && !c.includes('auditLogs={auditLogs}\n          walletResetTimestamp={walletResetTimestamp}')) {
    c = c.replace(marker, replacement);
  }

  // Audit changes must be pushed immediately to cloud sync so owner cashbox updates quickly.
  const oldAudit = `      try { localStorage.setItem(getStorageKey('moldatk_audit_logs'), JSON.stringify(updated)); } catch (e) {}\n      return updated;`;
  const newAudit = `      try {\n        localStorage.setItem(getStorageKey('moldatk_audit_logs'), JSON.stringify(updated));\n        window.dispatchEvent(new Event('moldatk-local-sync'));\n      } catch (e) {}\n      return updated;`;
  c = c.replace(oldAudit, newAudit);
  write(p, c);
}

// Mobile header receives a dashboard-only sync slot beside the generator name.
{
  const p = 'src/components/mobile/MobileHeader.tsx';
  let c = read(p);
  if (!c.includes('showSyncStatus?: boolean;')) {
    c = c.replace('  onOpenPricingModal: () => void;\n}', '  onOpenPricingModal: () => void;\n  showSyncStatus?: boolean;\n}');
  }
  if (!c.includes('showSyncStatus = false,')) {
    c = c.replace('  onOpenPricingModal,\n}) => {', '  onOpenPricingModal,\n  showSyncStatus = false,\n}) => {');
  }
  const genLine = `<p className="text-[10px] text-blue-200 truncate leading-none mt-0.5">\n              {generatorSpecs.generatorName}\n            </p>`;
  const genLineNew = `<div className="mt-0.5 flex items-center gap-1.5 min-w-0">\n              <p className="text-[10px] text-blue-200 truncate leading-none">{generatorSpecs.generatorName}</p>\n              {showSyncStatus && <div id="moldatk-sync-status-slot" className="flex items-center shrink-0 scale-[0.82] origin-right" />}\n            </div>`;
  if (c.includes(genLine)) c = c.replace(genLine, genLineNew);
  write(p, c);
}

// Only the dashboard exposes the slot; wallet/subscribers/settings never do.
{
  const p = 'src/components/mobile/MobileLayout.tsx';
  let c = read(p);
  if (!c.includes('showSyncStatus={activeTab === \'dashboard\'}')) {
    c = c.replace('        onOpenPricingModal={onOpenPricingModal}\n      />', "        onOpenPricingModal={onOpenPricingModal}\n        showSyncStatus={activeTab === 'dashboard'}\n      />");
  }
  write(p, c);
}

// Never float the connectivity badge over a page when no intended slot exists.
{
  const p = 'src/components/SyncProgressIndicator.tsx';
  let c = read(p);
  c = c.replace(/\n\s*if \(portalTarget\) return createPortal\(badge, portalTarget\);\n\s*return \([\s\S]*?\n\s*\);\n}/, `\n  if (portalTarget) return createPortal(badge, portalTarget);\n  return null;\n}`);
  write(p, c);
}

console.log('Applied mobile wallet totals and dashboard-only sync badge placement fix.');
