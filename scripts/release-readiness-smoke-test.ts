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
assert(superAdmin.includes('SUPER_ADMIN_SUBSCRIPTION_STATUS_V2'), 'effective subscription status UI missing');
assert(superAdmin.includes("effectiveStatus === 'suspended' ? 'اشتراك متوقف' : 'اشتراك منتهي'"), 'expired/suspended status labels missing');
assert(superAdmin.includes('subscriptionRemainingText(sub)'), 'remaining subscription duration is not shown');
assert(superAdmin.includes('SUPER_ADMIN_RESPONSIVE_NOTIFICATION_CENTER_V2'), 'responsive notifications center missing');
assert(superAdmin.includes('<SeasonalCampaignsPanel />'), 'responsive seasonal campaigns panel missing');
assert(superAdmin.includes('<AdminAdSlidesPanel />'), 'admin advertisement panel missing');
assert(!superAdmin.includes('<SeasonalCampaignManager />'), 'legacy duplicate seasonal manager remains');
assert(!superAdmin.includes('min-w-[1100px]'), 'Super Admin still forces desktop-only width');
assert(superAdmin.includes("supabase.functions.invoke('purge-generator-account'"), 'generator deletion is not using permanent purge backend');
if (superAdmin.includes('WebsiteReleaseManager')) {
  assert(superAdmin.includes("[['website', 'الموقع والتحديثات', Wrench]]"), 'release-management nav is not owner-gated');
  assert(superAdmin.includes("tab === 'website' && isOwnerSuperAdmin"), 'release-management page is not owner-gated');
}

const adPanel = read('src/components/AdminAdSlidesPanel.tsx');
assert(!adPanel.includes('<SeasonalCampaignsPanel />'), 'duplicate seasonal editor still exists inside ads panel');

const sync = read('src/lib/useGeneratorCloudSync.ts');
assert(sync.includes("amount_due: (s.invoicesHistory || []).filter(i => i.status !== 'cancelled')"), 'cloud amount_due is not derived from invoice ledger');
assert(sync.includes('function dedupeInvoicesForCloud('), 'cloud invoice dedupe helper missing');
assert(
  sync.includes('dedupeInvoicesForCloud(writableSubscribers.flatMap') || sync.includes('dedupeInvoicesForCloud(subscribers.flatMap'),
  'cloud invoice dedupe is not wired'
);
assert(sync.includes('moldatk_factory_reset_in_progress'), 'cloud sync is not frozen during factory reset');

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
assert(app.includes("action: 'reset_generator_data'"), 'cloud-authoritative owner reset missing');
assert(app.includes("action: 'delete_subscriber'"), 'permanent subscriber deletion missing');

const subscriberModal = read('src/components/SubscriberModal.tsx');
assert(subscriberModal.includes("const onboardingNoCurrentCharge = String(ensured.currentInvoice?.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE');"), 'debt-aware onboarding quick-payment state missing');
assert(subscriberModal.includes('if (onboardingNoCurrentCharge && totalOutstanding <= 0) return;'), 'zero-charge onboarding guard does not allow real debt payment');
assert(!subscriberModal.includes("if (String(ensured.currentInvoice?.notes || '').includes('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE')) return;"), 'legacy unconditional onboarding payment blocker returned');
assert(subscriberModal.includes('applyPaymentOldestFirst('), 'quick payment no longer allocates debt oldest-first');
assert(subscriberModal.includes('onSaveSubscriber(updated);'), 'subscriber payment does not persist updated ledger state');

const gradle = read('android/app/build.gradle');
assert(/versionCode\s+32\b/.test(gradle), 'Android versionCode is not 32');
assert(/versionName\s+"1\.3\.28"/.test(gradle), 'Android versionName is not 1.3.28');

const mobileDashboard = read('src/components/mobile/MobileDashboard.tsx');
assert(mobileDashboard.includes('const totalSubscribers = paidSubs.length + unpaidSubs.length;'), 'mobile dashboard total is not aligned with paid + unpaid classified subscribers');

const updaterFinalizer = read('scripts/apply-update-delivery-and-internal-theme-v3-fixed.mjs');
assert(updaterFinalizer.includes('candidates.sort((a, b) => Number(b.versionCode) - Number(a.versionCode))[0]'), 'Android updater does not choose highest available version');

const sw = read('public/sw.js');
const main = read('src/main.tsx');
assert(sw.includes('moldatk-shell-v4-1.3.28'), '1.3.28 service-worker cache marker missing');
assert(main.includes('/sw.js?v=1.3.28'), '1.3.28 service-worker registration missing');

console.log('Release readiness regression passed: Super Admin status/UI, permanent data purge, dashboard count, versioning, update selection, Web Push, permissions, cloud debt, subscription locks, and onboarding payments are wired for 1.3.28.');
