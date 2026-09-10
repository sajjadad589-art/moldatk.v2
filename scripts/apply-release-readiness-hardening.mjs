import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value, 'utf8');
const must = (value, message) => { if (!value) throw new Error(`Release readiness hardening: ${message}`); };

// -----------------------------------------------------------------------------
// Customer-order admin controls: secondary Super Admin managers may review
// orders, but payout destination settings remain owner-Super-Admin only.
// -----------------------------------------------------------------------------
{
  const path = 'src/components/CustomerOrdersPanel.tsx';
  let source = read(path);

  if (!source.includes('const [canManagePaymentSettings, setCanManagePaymentSettings]')) {
    const anchor = "  const [receiptUrls, setReceiptUrls] = useState<Record<string,string>>({});";
    must(source.includes(anchor), 'CustomerOrdersPanel state anchor missing');
    source = source.replace(anchor, `${anchor}\n  const [canManagePaymentSettings, setCanManagePaymentSettings] = useState(false);`);
  }

  if (!source.includes("setCanManagePaymentSettings(Boolean(profile?.is_active && profile?.role === 'super_admin'))")) {
    const anchor = "    setLoading(true);\n    setMessage(null);";
    must(source.includes(anchor), 'CustomerOrdersPanel load anchor missing');
    source = source.replace(anchor, `${anchor}\n    const { data: authData } = await supabase.auth.getUser();\n    if (authData.user?.id) {\n      const { data: profile } = await supabase.from('profiles').select('role,is_active').eq('id', authData.user.id).maybeSingle();\n      setCanManagePaymentSettings(Boolean(profile?.is_active && profile?.role === 'super_admin'));\n    } else {\n      setCanManagePaymentSettings(false);\n    }`);
  }

  if (!source.includes("if (!canManagePaymentSettings) return setMessage('تعديل معلومات التحويل متاح للمدير الرئيسي فقط');")) {
    const anchor = "  const saveSettings = async () => {\n    if (!settings) return;";
    must(source.includes(anchor), 'CustomerOrdersPanel saveSettings anchor missing');
    source = source.replace(anchor, "  const saveSettings = async () => {\n    if (!settings) return;\n    if (!canManagePaymentSettings) return setMessage('تعديل معلومات التحويل متاح للمدير الرئيسي فقط');");
  }

  source = source.replace('{settings && <section className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5">', '{settings && canManagePaymentSettings && <section className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5">');

  must(source.includes('canManagePaymentSettings && <section'), 'payment destination form is not owner-only');
  write(path, source);
}

// -----------------------------------------------------------------------------
// Secondary Super Admin managers receive only the explicitly permissioned
// account/order surfaces. Global notifications and release management remain
// owner-level because their backend/RLS operations are owner-only.
// -----------------------------------------------------------------------------
{
  const path = 'src/components/SuperAdminDashboard.tsx';
  let source = read(path);

  if (!source.includes("...(isOwnerSuperAdmin ? ([['notifications', 'الإشعارات', Bell]] as const) : [])")) {
    source = source.replace(
      "    ['notifications', 'الإشعارات', Bell],",
      "    ...(isOwnerSuperAdmin ? ([['notifications', 'الإشعارات', Bell]] as const) : []),"
    );
  }
  if (!source.includes("...(isOwnerSuperAdmin ? ([['website', 'الموقع والتحديثات', Wrench]] as const) : [])")) {
    source = source.replace(
      "    ['website', 'الموقع والتحديثات', Wrench],",
      "    ...(isOwnerSuperAdmin ? ([['website', 'الموقع والتحديثات', Wrench]] as const) : []),"
    );
  }

  source = source.replace("{tab === 'website' && <WebsiteReleaseManager />}", "{tab === 'website' && isOwnerSuperAdmin && <WebsiteReleaseManager />}");
  source = source.replace("{tab === 'notifications' && <div", "{tab === 'notifications' && isOwnerSuperAdmin && <div");
  source = source.replace("{tab === 'notifications' && isOwnerSuperAdmin && isOwnerSuperAdmin && <div", "{tab === 'notifications' && isOwnerSuperAdmin && <div");

  must(source.includes("[['notifications', 'الإشعارات', Bell]]"), 'notifications navigation is not owner-only');
  must(!source.includes("    ['notifications', 'الإشعارات', Bell],"), 'unrestricted notifications navigation remains');
  if (source.includes('WebsiteReleaseManager')) {
    must(source.includes("[['website', 'الموقع والتحديثات', Wrench]]"), 'release-management navigation is not owner-only');
    must(source.includes("tab === 'website' && isOwnerSuperAdmin"), 'release-management page is not owner-only');
  }
  write(path, source);
}

// -----------------------------------------------------------------------------
// Cloud subscriber aggregates are derived from the invoice ledger before push.
// Also collapse accidental duplicate live monthly invoices client-side so a
// stale device cannot recreate duplicate billing rows.
// -----------------------------------------------------------------------------
{
  const path = 'src/lib/useGeneratorCloudSync.ts';
  let source = read(path);

  source = source.replace(
    '  amount_due: Number(s.amountDue || 0),',
    "  amount_due: (s.invoicesHistory || []).filter(i => i.status !== 'cancelled').reduce((sum, i) => sum + Math.max(0, Number(i.remainingAmount || 0)), 0),"
  );

  if (!source.includes('function dedupeInvoicesForCloud(')) {
    const anchor = 'async function replaceMissingRows(table: string, generatorId: string, ids: string[]) {';
    must(source.includes(anchor), 'cloud-sync helper anchor missing');
    const helper = `function dedupeInvoicesForCloud(invoices: SubscriberInvoice[]): SubscriberInvoice[] {\n  const cancelled: SubscriberInvoice[] = [];\n  const liveByPeriod = new Map<string, SubscriberInvoice>();\n  const statusRank: Record<string, number> = { paid: 4, partial: 3, unpaid: 2, free: 1 };\n\n  for (const invoice of invoices) {\n    if (invoice.status === 'cancelled') {\n      cancelled.push(invoice);\n      continue;\n    }\n    const key = \`${'${invoice.subscriberId}'}|${'${invoice.monthId}'}\`;\n    const current = liveByPeriod.get(key);\n    if (!current) {\n      liveByPeriod.set(key, invoice);\n      continue;\n    }\n    const invoiceScore = (statusRank[invoice.status] || 0) * 1_000_000_000 + Number(invoice.paidAmount || 0);\n    const currentScore = (statusRank[current.status] || 0) * 1_000_000_000 + Number(current.paidAmount || 0);\n    if (invoiceScore > currentScore || (invoiceScore === currentScore && String(invoice.id) > String(current.id))) {\n      liveByPeriod.set(key, invoice);\n    }\n  }\n  return [...cancelled, ...liveByPeriod.values()];\n}\n\n`;
    source = source.replace(anchor, helper + anchor);
  }

  source = source.replace(
    '        const invoices = subscribers.flatMap(s => s.invoicesHistory || []);',
    '        const invoices = dedupeInvoicesForCloud(subscribers.flatMap(s => s.invoicesHistory || []));'
  );

  must(source.includes("amount_due: (s.invoicesHistory || []).filter(i => i.status !== 'cancelled')"), 'subscriber amount_due is not ledger-derived');
  must(source.includes('dedupeInvoicesForCloud(subscribers.flatMap'), 'invoice push dedupe is not wired');
  write(path, source);
}

// Android package metadata must match the release/update metadata exactly.
{
  const path = 'android/app/build.gradle';
  let source = read(path);
  source = source.replace(/versionCode\s+\d+/, 'versionCode 28');
  source = source.replace(/versionName\s+"[^"]+"/, 'versionName "1.3.24"');
  must(source.includes('versionCode 28'), 'Android versionCode is not 28');
  must(source.includes('versionName "1.3.24"'), 'Android versionName is not 1.3.24');
  write(path, source);
}

// Rotated Web Push key must be represented only by the public half in client code,
// and every registration must identify the key version to the protected server.
{
  const source = read('src/lib/webPush.ts');
  must(source.includes('BF0RyOTwx_Cvu8APpq7JP18HCzBO_4UVi-e64aoTbP-YGytDh3szjwBrPrTRH4dKSA0OnASOKQu1D4zTvIVTjvU'), 'rotated Web Push public key missing');
  must(source.includes('vapid_public_key: WEB_PUSH_VAPID_PUBLIC_KEY'), 'Web Push key-version binding missing');
  must(source.includes('await subscription.unsubscribe()'), 'old Web Push subscription rotation missing');
}

console.log('Release readiness hardening passed: owner-only global controls, rotated Web Push, ledger-derived cloud debt, duplicate invoice protection, and Android version alignment are intact.');
