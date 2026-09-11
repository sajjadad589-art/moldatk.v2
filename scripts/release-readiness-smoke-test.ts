import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`Release readiness smoke test: ${message}`);
};

const webPush = read('src/lib/webPush.ts');
assert(webPush.includes('BF0RyOTwx_Cvu8APpq7JP18HCzBO_4UVi-e64aoTbP-YGytDh3szjwBrPrTRH4dKSA0OnASOKQu1D4zTvIVTjvU'), 'rotated public VAPID key missing');
assert(webPush.includes('vapid_public_key: WEB_PUSH_VAPID_PUBLIC_KEY'), 'VAPID version is not sent to registration backend');
assert(webPush.includes('await subscription.unsubscribe()'), 'old Web Push subscriptions are not rotated');

const orders = read('src/components/CustomerOrdersPanel.tsx');
assert(orders.includes('canManagePaymentSettings'), 'customer order payout settings role guard missing');
assert(orders.includes("profile?.role === 'super_admin'"), 'payout settings are not restricted to owner Super Admin');
assert(orders.includes('settings && canManagePaymentSettings && <section'), 'secondary manager can still render payout settings editor');

const superAdmin = read('src/components/SuperAdminDashboard.tsx');
assert(superAdmin.includes("[['notifications', 'الإشعارات', Bell]]"), 'notifications nav is not owner-gated');
assert(!superAdmin.includes("    ['notifications', 'الإشعارات', Bell],"), 'unrestricted notifications nav remains');
assert(superAdmin.includes("tab === 'notifications' && isOwnerSuperAdmin"), 'notifications page is not owner-gated');
if (superAdmin.includes('WebsiteReleaseManager')) {
  assert(superAdmin.includes("[['website', 'الموقع والتحديثات', Wrench]]"), 'release-management nav is not owner-gated');
  assert(superAdmin.includes("tab === 'website' && isOwnerSuperAdmin"), 'release-management page is not owner-gated');
}

const sync = read('src/lib/useGeneratorCloudSync.ts');
assert(sync.includes("amount_due: (s.invoicesHistory || []).filter(i => i.status !== 'cancelled')"), 'cloud amount_due is not derived from invoice ledger');
assert(sync.includes('function dedupeInvoicesForCloud('), 'cloud invoice dedupe helper missing');
assert(
  sync.includes('dedupeInvoicesForCloud(writableSubscribers.flatMap') || sync.includes('dedupeInvoicesForCloud(subscribers.flatMap'),
  'cloud invoice dedupe is not wired'
);

const app = read('src/App.tsx');
assert(app.includes('SUBSCRIPTION_LOCK_STABILITY_V1'), 'subscription lock stability marker missing');
assert(app.includes('const loadSubscription = async (showBlockingLoader = false) => {'), 'subscription refresh mode missing');
assert(app.includes('void loadSubscription(true);'), 'initial subscription check must be blocking');
assert(app.includes('window.setInterval(() => void loadSubscription(false), 30 * 1000)'), 'periodic subscription refresh must stay non-blocking');
assert(app.includes("const subscriptionAccessControlled = userSession.role === 'generator_admin' || userSession.role === 'collector';"), 'owner/collector subscription lock missing');
assert(app.includes("subscriptionInfo?.accountStatus === 'suspended'"), 'suspended account lock missing');
assert(app.includes("subscriptionInfo.subscriptionStatus !== 'active' || daysUntilExpiry(subscriptionInfo.endsAt) <= 0"), 'expired account lock missing');
assert(!app.includes("&& !subscriptionLoading && subscriptionInfo?.accountStatus === 'suspended'"), 'suspended account can temporarily unlock during refresh');
assert(!app.includes("&& !subscriptionLoading && (!subscriptionInfo || subscriptionInfo.subscriptionStatus !== 'active'"), 'expired account can temporarily unlock during refresh');

const subscriberModal = read('src/components/SubscriberModal.tsx');
assert(subscriberModal.includes("const onboardingNoCurrentCharge = String(ensured.currentInvoice?.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE');"), 'debt-aware onboarding quick-payment state missing');
assert(subscriberModal.includes('if (onboardingNoCurrentCharge && totalOutstanding <= 0) return;'), 'zero-charge onboarding guard does not allow real debt payment');
assert(!subscriberModal.includes("if (String(ensured.currentInvoice?.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE')) return;"), 'legacy unconditional onboarding payment blocker returned');
assert(subscriberModal.includes('applyPaymentOldestFirst('), 'quick payment no longer allocates debt oldest-first');
assert(subscriberModal.includes('onSaveSubscriber(updated);'), 'subscriber payment does not persist updated ledger state');

const gradle = read('android/app/build.gradle');
assert(/versionCode\s+30\b/.test(gradle), 'Android versionCode is not 30');
assert(/versionName\s+"1\.3\.26"/.test(gradle), 'Android versionName is not 1.3.26');

const mobileDashboard = read('src/components/mobile/MobileDashboard.tsx');
assert(mobileDashboard.includes('const totalSubscribers = paidSubs.length + unpaidSubs.length;'), 'mobile dashboard total is not aligned with paid + unpaid classified subscribers');

const updaterFinalizer = read('scripts/apply-update-delivery-and-internal-theme-v3-fixed.mjs');
assert(updaterFinalizer.includes('candidates.sort((a, b) => Number(b.versionCode) - Number(a.versionCode))[0]'), 'Android updater does not choose highest available version');

const sw = read('public/sw.js');
const main = read('src/main.tsx');
assert(sw.includes('moldatk-shell-v4-1.3.26'), '1.3.26 service-worker cache marker missing');
assert(main.includes('/sw.js?v=1.3.26'), '1.3.26 service-worker registration missing');

console.log('Release readiness regression passed: dashboard count, versioning, update selection, Web Push rotation, Super Admin permissions, payout settings, cloud debt, duplicate-invoice protection, sticky subscription locks, and onboarding debt payments are wired for 1.3.26.');
