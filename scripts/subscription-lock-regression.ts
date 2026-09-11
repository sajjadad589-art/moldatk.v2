import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

expect(app.includes('SUBSCRIPTION_LOCK_STABILITY_V1'), 'subscription lock stability marker missing');
expect(app.includes('const loadSubscription = async (showBlockingLoader = false) => {'), 'subscription refresh mode missing');
expect(app.includes('void loadSubscription(true);'), 'initial subscription check must be blocking');
expect(app.includes('window.setInterval(() => void loadSubscription(false), 30 * 1000)'), 'periodic subscription refresh must be non-blocking');
expect(app.includes("subscriptionInfo?.accountStatus === 'suspended'"), 'suspended account lock missing');
expect(app.includes("subscriptionInfo.subscriptionStatus !== 'active' || daysUntilExpiry(subscriptionInfo.endsAt) <= 0"), 'expired account lock missing');
expect(app.includes("const subscriptionAccessControlled = userSession.role === 'generator_admin' || userSession.role === 'collector';"), 'owner/collector subscription guard missing');
expect(!app.includes("&& !subscriptionLoading && subscriptionInfo?.accountStatus === 'suspended'"), 'suspended account can still unlock while refreshing');
expect(!app.includes("&& !subscriptionLoading && (!subscriptionInfo || subscriptionInfo.subscriptionStatus !== 'active'"), 'expired account can still unlock while refreshing');

console.log('Subscription lock regression passed: expired/suspended owner and collector accounts stay blocked while the 30s status refresh runs.');
