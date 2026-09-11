import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c, 'utf8');
const must = (v, m) => { if (!v) throw new Error(`Dashboard count/release 1.3.26: ${m}`); };

// Mobile dashboard: the headline count must describe the same population shown
// by the paid/unpaid rings. Free/exempt and zero-current-charge onboarding rows
// stay in the subscribers module, but are not counted inside monthly collection status.
{
  const path = 'src/components/mobile/MobileDashboard.tsx';
  let s = read(path);

  s = s.replace(
    "  const totalSubscribers = subscribers.length;\n  const paidSubs = billingCycleActive ? subscribers.filter(isPaidThisMonth) : [];\n  const unpaidSubs = billingCycleActive ? subscribers.filter(isUnpaidThisMonth) : [];",
    "  const paidSubs = billingCycleActive ? subscribers.filter(isPaidThisMonth) : [];\n  const unpaidSubs = billingCycleActive ? subscribers.filter(isUnpaidThisMonth) : [];\n  const totalSubscribers = paidSubs.length + unpaidSubs.length;"
  );

  // Legacy/canonical fallback before the authoritative pass.
  if (s.includes('  const totalSubscribers = subscribers.length;') && s.includes('const paidSubs = subscribers.filter')) {
    s = s.replace('  const totalSubscribers = subscribers.length;\n\n', '');
    const anchor = "  const unpaidSubs = subscribers.filter(sub => {\n    const invoice = currentAccount(sub);\n    if (invoice) return invoice.status !== 'free' && getInvoiceRemaining(invoice) > 0;\n    return sub.paymentStatus === 'unpaid' || sub.paymentStatus === 'partial';\n  });";
    if (s.includes(anchor)) s = s.replace(anchor, `${anchor}\n\n  const totalSubscribers = paidSubs.length + unpaidSubs.length;`);
  }

  must(s.includes('const totalSubscribers = paidSubs.length + unpaidSubs.length;'), 'mobile total count does not match paid + unpaid');
  write(path, s);
}

// Desktop uses the same monthly classified population.
{
  const path = 'src/components/DashboardView.tsx';
  let s = read(path);
  s = s.replace(
    "  const totalCount = subscribers.length;\n  const paidSubscribers = billingCycleActive ? dashboardSummary.paidSubscribers : [];\n  const unpaidSubscribers = billingCycleActive ? dashboardSummary.unpaidSubscribers : [];",
    "  const paidSubscribers = billingCycleActive ? dashboardSummary.paidSubscribers : [];\n  const unpaidSubscribers = billingCycleActive ? dashboardSummary.unpaidSubscribers : [];\n  const totalCount = paidSubscribers.length + unpaidSubscribers.length;"
  );
  if (s.includes('AUTHORITATIVE_FINANCE_V2')) {
    must(s.includes('const totalCount = paidSubscribers.length + unpaidSubscribers.length;'), 'desktop total count does not match paid + unpaid');
  }
  write(path, s);
}

// Final release identity. Older finalizers intentionally normalize to 1.3.25 first;
// this absolute-last pass advances the package/cache identity to 1.3.26 / code 30.
for (const path of ['public/sw.js', 'src/main.tsx', 'public/pwa-recovery-v6.js']) {
  if (!fs.existsSync(path)) continue;
  write(path, read(path).replaceAll('1.3.25', '1.3.26'));
}

{
  const path = 'android/app/build.gradle';
  let s = read(path);
  s = s.replace(/versionCode\s+\d+/, 'versionCode 30');
  s = s.replace(/versionName\s+"[^"]+"/, 'versionName "1.3.26"');
  must(s.includes('versionCode 30'), 'Android versionCode 30 missing');
  must(s.includes('versionName "1.3.26"'), 'Android versionName 1.3.26 missing');
  write(path, s);
}

must(read('public/sw.js').includes('moldatk-shell-v4-1.3.26'), '1.3.26 service-worker cache marker missing');
must(read('src/main.tsx').includes('/sw.js?v=1.3.26'), '1.3.26 service-worker registration missing');

console.log('Dashboard count corrected: monthly total equals paid + unpaid classified subscribers. Release 1.3.26 / code 30 finalized.');
