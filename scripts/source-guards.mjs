import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(path, 'utf8');
const app = source('src/App.tsx');
const sync = source('src/lib/useEventDrivenGeneratorSync.ts');
const admin = source('src/components/SuperAdminDashboard.tsx');
const mobile = source('src/components/mobile/MobileDashboard.tsx');
const desktop = source('src/components/DashboardView.tsx');
const sw = source('public/sw.js');
const count = (text, marker) => text.split(marker).length - 1;

assert.match(app, /lazy\(\(\) => import\('\.\/components\/SuperAdminDashboard'\)/);
assert.match(admin, /await import\('xlsx'\)/);
assert.doesNotMatch(admin, /import \* as XLSX from 'xlsx'/);
assert.match(sync, /const changedSubscriberIds = new Set<string>/);
assert.match(sync, /sent\.deletedSubscribers/);
assert.match(sync, /delete_generator_tariff_month/);
assert.match(sync, /reconcile_generator_no_tariff_state/);
assert.equal(count(mobile, '<section data-ampere-discount-dashboard-mobile-v1'), 1);
assert.equal(count(desktop, '<section data-ampere-discount-dashboard'), 1);
assert.doesNotMatch(sw, /client\.navigate\(client\.url\)/);
assert.match(sw, /url\.pathname\.startsWith\('\/assets\/'\)/);
console.log('Source guards passed.');
