import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const ui = fs.readFileSync('src/components/SubscriptionStatusUI.tsx', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260919165000_collector_subscription_access_authoritative.sql', 'utf8');

const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

expect(app.includes('SUBSCRIPTION_ACCESS_RPC_V2'), 'server-authoritative subscription marker missing');
expect(app.includes("supabase.rpc('get_my_subscription_access_state')"), 'subscription access RPC is not used');
expect(app.includes("userSession.role !== 'generator_admin' && userSession.role !== 'collector'"), 'owner/collector access scope missing');
expect(app.includes('serverAccessActive: Boolean(data.accessActive)'), 'server access decision is not mapped into SubscriptionInfo');
expect(app.includes('subscriptionInfo.serverAccessActive === false'), 'server access decision is not enforced');
expect(app.includes('SubscriptionUnavailableScreen'), 'network failure must not be misreported as expired');
expect(app.includes('setSubscriptionLoading(accessControlled);'), 'login must block until subscription check completes');
expect(app.includes("userSession?.generatorId && (userSession.role === 'generator_admin' || userSession.role === 'collector')"), 'restored collector session must block on first subscription check');
expect(app.includes('window.setInterval(() => void loadSubscription(false), 30 * 1000)'), 'periodic subscription refresh missing');
expect(!app.includes("userSession.role === 'generator_admin' && sub.error"), 'collector subscription errors are still ignored');
expect(!app.includes("if (userSession.role === 'generator_admin') {\n            if (sub.data)"), 'collector still bypasses subscription assignment');

expect(ui.includes('serverAccessActive?: boolean;'), 'SubscriptionInfo server access field missing');
expect(ui.includes('SubscriptionUnavailableScreen'), 'subscription unavailable screen missing');
expect(ui.includes('لم يتم اعتبار الاشتراك منتهياً'), 'network failure screen must not claim expiration');

expect(migration.includes('get_my_subscription_access_state'), 'authoritative subscription RPC migration missing');
expect(migration.includes("s.status = 'active'"), 'RPC must require active subscription status');
expect(migration.includes('s.starts_at <= v_now'), 'RPC must enforce subscription start using server clock');
expect(migration.includes('s.ends_at > v_now'), 'RPC must enforce subscription expiry using server clock');
expect(migration.includes("v_generator.status = 'active' and v_has_current"), 'RPC must combine account and subscription state');
expect(migration.includes('auth.uid()'), 'RPC must bind access to authenticated user');
expect(migration.includes('public.profiles'), 'RPC must resolve generator through authenticated profile');

console.log('Subscription access regression passed: owner and collector share one server-authoritative access decision and network failures cannot masquerade as expiry.');
