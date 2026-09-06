import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

const sync = read('src/lib/useGeneratorCloudSync.ts');
const app = read('src/App.tsx');
const mobileSubscribers = read('src/components/mobile/MobileSubscribers.tsx');
const css = read('src/index.css');
const main = read('src/main.tsx');
const sw = read('public/sw.js');

expect(sync.includes('MOLDATK_IOS_SYNC_COALESCE_V1'), 'iPhone realtime sync coalescing missing');
expect(sync.includes('15000'), 'sync fallback interval was not reduced');
expect(!sync.includes('setInterval(onLocalChange, 2500)'), 'old 2.5 second sync polling remains');
expect(sync.includes('.limit(250)'), 'audit pull is still unbounded/heavy');
expect(sync.includes('schedulePull'), 'realtime pull debounce missing');

expect(app.includes('LazySuperAdminDashboard'), 'Super Admin/XLSX is still in the normal initial owner bundle');
expect(!app.includes("import { SuperAdminDashboard } from './components/SuperAdminDashboard';"), 'static Super Admin import remains');
expect(app.includes('MOLDATK_COALESCED_LOCAL_SYNC_V1') && app.includes('requestAnimationFrame'), 'local sync rerender coalescing missing');

expect(mobileSubscribers.includes('MOLDATK_MOBILE_PROGRESSIVE_LIST_V1'), 'progressive mobile subscriber rendering missing');
expect(mobileSubscribers.includes('visibleSubscribers.map'), 'subscriber list still renders every matching subscriber at once');
expect(mobileSubscribers.includes('useDeferredValue'), 'mobile search work is not deferred');
expect(mobileSubscribers.includes('عرض المزيد'), 'progressive subscriber list has no continuation control');

expect(css.includes('MOLDATK_IOS_STABILITY_V1'), 'iOS rendering stability CSS missing');
expect(main.includes('MOLDATK_IOS_DEVICE_CLASS_V1'), 'iPhone/iPad runtime detection missing');
expect(main.includes('5 * 60 * 1000'), 'service worker checks are still too frequent');
expect(sw.includes('MOLDATK_IOS_NO_FORCED_CLIENT_RELOAD_V1'), 'service worker stability marker missing');
expect(!sw.includes('client.navigate(client.url)'), 'service worker can still force reload an active iPhone page');

console.log('iPhone performance regression: coalesced sync, bounded pull, progressive DOM, lazy Super Admin, lighter iOS rendering and stable service worker: OK');
