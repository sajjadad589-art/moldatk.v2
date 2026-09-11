import fs from 'node:fs';

const path = 'src/App.tsx';
let source = fs.readFileSync(path, 'utf8');
const must = (value, message) => { if (!value) throw new Error(`Subscription lock stability: ${message}`); };

// Keep the first subscription check blocking, but make periodic refreshes silent.
if (!source.includes('SUBSCRIPTION_LOCK_STABILITY_V1')) {
  source = source.replace(
    '    const loadSubscription = async () => {',
    '    // SUBSCRIPTION_LOCK_STABILITY_V1: background refresh must never unlock an expired/suspended account.\n    const loadSubscription = async (showBlockingLoader = false) => {'
  );
}

source = source.replace(
  "      setSubscriptionLoading(userSession.role === 'generator_admin');",
  '      if (showBlockingLoader) setSubscriptionLoading(true);'
);
source = source.replace(
  '      setSubscriptionLoading(true);',
  '      if (showBlockingLoader) setSubscriptionLoading(true);'
);
source = source.replace(
  '        setSubscriptionLoading(false);',
  '        if (showBlockingLoader) setSubscriptionLoading(false);'
);
source = source.replace(
  '    void loadSubscription();',
  '    void loadSubscription(true);'
);
source = source.replace(
  '    const timer = window.setInterval(() => void loadSubscription(), 30 * 1000);',
  '    const timer = window.setInterval(() => void loadSubscription(false), 30 * 1000);'
);

const finalLegacyGuards = `  if ((userSession.role === 'generator_admin' || userSession.role === 'collector') && !subscriptionLoading && subscriptionInfo?.accountStatus === 'suspended') {\n    return <SuspendedAccountScreen reason={subscriptionInfo.suspensionReason} onLogout={handleLogout} />;\n  }\n\n  if ((userSession.role === 'generator_admin' || userSession.role === 'collector') && !subscriptionLoading && (!subscriptionInfo || subscriptionInfo.subscriptionStatus !== 'active' || daysUntilExpiry(subscriptionInfo.endsAt) <= 0)) {\n    return <ExpiredSubscriptionScreen onLogout={handleLogout} />;\n  }`;

const canonicalLegacyGuards = `  if (userSession.role === 'generator_admin' && !subscriptionLoading && subscriptionInfo?.accountStatus === 'suspended') {\n    return <SuspendedAccountScreen reason={subscriptionInfo.suspensionReason} onLogout={handleLogout} />;\n  }\n\n  if (userSession.role === 'generator_admin' && !subscriptionLoading && (!subscriptionInfo || subscriptionInfo.subscriptionStatus !== 'active' || daysUntilExpiry(subscriptionInfo.endsAt) <= 0)) {\n    return <ExpiredSubscriptionScreen onLogout={handleLogout} />;\n  }`;

const stableGuards = `  const subscriptionAccessControlled = userSession.role === 'generator_admin' || userSession.role === 'collector';\n\n  // SUBSCRIPTION_LOCK_STABILITY_V1: a refresh may update data, but it can never temporarily expose the app.\n  if (subscriptionAccessControlled && subscriptionInfo?.accountStatus === 'suspended') {\n    return <SuspendedAccountScreen reason={subscriptionInfo.suspensionReason} onLogout={handleLogout} />;\n  }\n\n  if (subscriptionAccessControlled && subscriptionInfo && (subscriptionInfo.subscriptionStatus !== 'active' || daysUntilExpiry(subscriptionInfo.endsAt) <= 0)) {\n    return <ExpiredSubscriptionScreen onLogout={handleLogout} />;\n  }\n\n  if (subscriptionAccessControlled && !subscriptionInfo) {\n    if (subscriptionLoading) {\n      return (\n        <div dir=\"rtl\" className=\"min-h-screen bg-slate-100 dark:bg-[#070d1e] flex items-center justify-center p-5 font-['Cairo',sans-serif]\">\n          <div className=\"w-full max-w-md bg-white dark:bg-[#111c38] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-8 text-center\">\n            <div className=\"w-10 h-10 mx-auto rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin mb-4\" />\n            <div className=\"font-black text-slate-900 dark:text-white\">جاري التحقق من حالة الاشتراك...</div>\n          </div>\n        </div>\n      );\n    }\n    return <ExpiredSubscriptionScreen onLogout={handleLogout} />;\n  }`;

if (!source.includes('const subscriptionAccessControlled =')) {
  if (source.includes(finalLegacyGuards)) source = source.replace(finalLegacyGuards, stableGuards);
  else if (source.includes(canonicalLegacyGuards)) source = source.replace(canonicalLegacyGuards, stableGuards);
}

must(source.includes('SUBSCRIPTION_LOCK_STABILITY_V1'), 'marker missing');
must(source.includes('const loadSubscription = async (showBlockingLoader = false) => {'), 'refresh mode parameter missing');
must(source.includes('void loadSubscription(true);'), 'initial subscription check is not blocking');
must(source.includes('window.setInterval(() => void loadSubscription(false), 30 * 1000)'), 'background subscription refresh is not silent');
must(source.includes('const subscriptionAccessControlled ='), 'stable access guard missing');
must(source.includes("subscriptionInfo?.accountStatus === 'suspended'"), 'suspended account lock missing');
must(source.includes("subscriptionInfo.subscriptionStatus !== 'active' || daysUntilExpiry(subscriptionInfo.endsAt) <= 0"), 'expired account lock missing');
must(!source.includes("&& !subscriptionLoading && subscriptionInfo?.accountStatus === 'suspended'"), 'suspension lock still bypasses while refreshing');
must(!source.includes("&& !subscriptionLoading && (!subscriptionInfo || subscriptionInfo.subscriptionStatus !== 'active'"), 'expiry lock still bypasses while refreshing');

fs.writeFileSync(path, source, 'utf8');
console.log('Subscription lock stability applied: expired/suspended accounts remain blocked during every background refresh.');
