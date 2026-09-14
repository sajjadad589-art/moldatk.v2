import fs from 'node:fs';
const read = p => fs.readFileSync(p, 'utf8').replaceAll('\r\n','\n');
const write = (p,s) => fs.writeFileSync(p,s,'utf8');
const must = (ok,message) => { if (!ok) throw new Error('Event sync/cashbox: '+message); };

// Run LAST: the existing build generates the legacy hook and finance components.
// Route to a maintained runtime without allowing earlier patchers to re-enable it.
let app = read('src/App.tsx');
app = app.replace(/^import .* from '\.\/lib\/(?:useGeneratorCloudSync|useEventDrivenGeneratorSync|cashboxCloud)';\n/gm,'');
app = "import { useEventDrivenGeneratorSync as useGeneratorCloudSync, flushGeneratorSync } from './lib/useEventDrivenGeneratorSync';\nimport { resetCashbox } from './lib/cashboxCloud';\n" + app;
const handler = `onClearWalletLogs={async () => {
                const generatorId = userSession?.generatorId;
                if (!generatorId || userSession?.role !== 'generator_admin') return;
                try {
                  await flushGeneratorSync(generatorId);
                  const confirmed = await resetCashbox(generatorId);
                  setWalletResetTimestamp(confirmed.reset_at || '');
                  showToast('تم تصفير القاصة وحفظه في السحابة');
                } catch (error) {
                  console.error('Cashbox reset failed:', error);
                  showToast('لم يتم تأكيد التصفير. تحقق من الاتصال وأعد المحاولة');
                }
              }}`;
app = app.replace(/onClearWalletLogs=\{(?:async )?\(\) => \{[\s\S]*?\n\s*\}\}/g, handler);
must((app.match(/await resetCashbox\(generatorId\)/g)||[]).length === 2,'desktop/mobile reset handlers missing');
write('src/App.tsx',app);

let accounting = read('src/utils/authoritativeAccounting.ts');
const start = accounting.indexOf('export function reconciledCashbox(');
must(start>=0,'cashbox calculation missing');
accounting = accounting.slice(0,start)+`export function reconciledCashbox(collected: number, logs: AuditLogEntry[] = [], resetAt?: string, activeMonthId = getMonthId()) {
  if (!resetAt) return n(collected);
  const resetMs = Date.parse(resetAt);
  if (!Number.isFinite(resetMs)) return 0;
  // A reset never falls back to the old invoice total, even when history is incomplete.
  // Cross-month collections after the marker belong to the current cashbox too.
  return net(logs.filter(log => (log.category === 'payment' || log.category === 'cancellation')
    && Number.isFinite(Date.parse(log.timestamp || '')) && Date.parse(log.timestamp) > resetMs));
}
`;
write('src/utils/authoritativeAccounting.ts',accounting);

for (const [path,relative] of [['src/components/WalletView.tsx','../lib/'],['src/components/DashboardView.tsx','../lib/'],['src/components/mobile/MobileLayout.tsx','../../lib/']]) {
  let s=read(path);
  if (!s.includes("import { useCashboxBalance }")) s=`import { useCashboxBalance } from '${relative}useCashboxBalance';\n`+s;
  if (path.endsWith('WalletView.tsx')) {
    s=s.replace('onClearWalletLogs?: () => void;', 'onClearWalletLogs?: () => void | Promise<void>;');
    if (!s.includes('const [resetting,')) s=s.replace('  const [countdown,', '  const [resetting, setResetting] = useState(false);\n  const [countdown,');
    s=s.replace('disabled={countdown > 0}', 'disabled={countdown > 0 || resetting}');
    s=s.replace(`onClick={() => {
                  if (onClearWalletLogs) {
                    onClearWalletLogs();
                  }
                  setIsConfirmResetOpen(false);
                }}`, `onClick={async () => {
                  if (resetting) return;
                  setResetting(true);
                  try { await onClearWalletLogs?.(); setIsConfirmResetOpen(false); }
                  finally { setResetting(false); }
                }}`);
    s=s.replace("{countdown > 0 ? `يرجى القراءة (${countdown}ث)` : 'تأكيد التصفير'}", "{resetting ? 'جاري حفظ التصفير...' : countdown > 0 ? `يرجى القراءة (${countdown}ث)` : 'تأكيد التصفير'}");
    // Earlier release generators can place this block inside the countdown effect.
    // Remove every generated copy and insert hooks at component scope.
    s=s.replace(/\n\s*\/\/ AUTHORITATIVE_WALLET_V2\s*\n\s*const walletSummary = summarizeSubscribers\([^;]+;\s*\n\s*const authoritativeCashbox = (?:useCashboxBalance\()?reconciledCashbox\([^;]+;\s*/g, '\n');
    const walletHookBlock = `  // AUTHORITATIVE_WALLET_V2
  const walletSummary = summarizeSubscribers(subscribers, pricingTiers, activeMonthId);
  const authoritativeCashbox = useCashboxBalance(reconciledCashbox(walletSummary.collected, auditLogs, walletResetTimestamp, activeMonthId));

`;
    const firstEffect = s.indexOf('  useEffect(() => {');
    must(firstEffect >= 0, 'wallet component effect anchor missing');
    s = s.slice(0, firstEffect) + walletHookBlock + s.slice(firstEffect);
    s=s.replace('if (logTime < resetTimeMs) return false;', 'if (!Number.isFinite(logTime) || logTime <= resetTimeMs) return false;');
  } else if (path.endsWith('DashboardView.tsx')) {
    s=s.replace(/const totalCollectedRevenue = billingCycleActive\n\s*\? reconciledCashbox\(dashboardSummary.collected, auditLogs, walletResetTimestamp, activeMonthId\)\n\s*: 0;/,
      'const totalCollectedRevenue = useCashboxBalance(billingCycleActive\n    ? reconciledCashbox(dashboardSummary.collected, auditLogs, walletResetTimestamp, activeMonthId)\n    : 0);');
  } else {
    s=s.replace('const mobileCashboxAmount = reconciledCashbox(\n    mobileCashboxSummary.collected,\n    auditLogs,\n    walletResetTimestamp,\n    activeMonthId,\n  );',
      'const mobileCashboxAmount = useCashboxBalance(reconciledCashbox(\n    mobileCashboxSummary.collected,\n    auditLogs,\n    walletResetTimestamp,\n    activeMonthId,\n  ));');
  }
  must(s.includes('useCashboxBalance('),'server balance binding missing: '+path);
  write(path,s);
}
must(!app.includes("from './lib/useGeneratorCloudSync'"),'legacy hook still imported');
console.log('Event-driven single-flight sync and server-confirmed cashbox reset installed.');

