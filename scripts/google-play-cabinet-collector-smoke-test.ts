import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

const legal = read('src/components/LegalPage.tsx');
const main = read('src/main.tsx');
const login = read('src/components/LoginView.tsx');
const settings = read('src/components/SettingsFolderView.tsx');
const folderDetail = read('src/components/FolderDetailModal.tsx');
const collectorCloud = read('src/lib/collectorCloud.ts');
const pos = read('src/components/POSQuickView.tsx');
const sync = read('src/lib/useGeneratorCloudSync.ts');
const types = read('src/types.ts');
const gradle = read('android/app/build.gradle');
const html = read('index.html');
const manifest = read('public/manifest.webmanifest');

expect(main.includes("<LegalPage kind=\"privacy\" />"), 'Privacy route missing');
expect(main.includes("<LegalPage kind=\"terms\" />"), 'Terms route missing');
expect(main.includes("<LegalPage kind=\"delete-account\" />"), 'Account deletion route missing');
expect(legal.includes("from('account_deletion_requests').insert"), 'Account deletion request form is not connected to Supabase');
expect(legal.includes('Firebase Cloud Messaging') && legal.includes('Supabase'), 'Privacy page must disclose core cloud processors');
expect(login.includes('href="/privacy"') && login.includes('href="/terms"') && login.includes('href="/delete-account"'), 'Login legal links missing');
expect(login.includes('/brand/moldatk-mark.svg') && !login.includes('/brand/moldatk-logo.svg'), 'Login must use the stable mark + HTML wordmark');

expect(types.includes('assignedLineIds?: string[];') && types.includes('assignedAllLines?: boolean;'), 'Collector multi-cabinet types missing');
expect(
  (settings.includes('اختيار كل الكابينات') && settings.includes('collectorAssignedLineIds')) ||
  (folderDetail.includes('كابينات محددة') && folderDetail.includes('assignedLineIds')),
  'Collector cabinet picker missing'
);
expect(settings.includes('syncCloudCollectorRoster') || folderDetail.includes('syncCloudCollectorRoster'), 'Collector assignment must be persisted through server sync');
expect(folderDetail.includes('كابينات محددة') && folderDetail.includes('>الكل</span>'), 'Folder detail collector dropdown is not checkbox multi-select');
expect(folderDetail.includes('syncCloudCollectorRoster'), 'Folder detail collector assignments are not saved to server');
expect(collectorCloud.includes('assigned_line_ids') && collectorCloud.includes('assigned_all_lines'), 'Collector cloud adapter missing multi-cabinet fields');
expect(pos.includes('accessibleSubscribers') && pos.includes('allowedLineIds'), 'Collector POS is not scoped to assigned cabinets');

expect(sync.includes('MOLDATK_CAPTURE_DELETED_LINES_V1'), 'Cabinet deletion tombstone capture missing');
expect(sync.includes('MOLDATK_LINE_TOMBSTONE_DELETE_V1'), 'Cabinet tombstone cloud delete missing');
expect(sync.includes("order('sort_order'"), 'Cabinet manual ordering is not persisted from cloud');
expect(sync.includes('lineToRow(generatorId, l, index)'), 'Cabinet sort order is not sent to cloud');

expect(html.includes('moldatk-icon-180-v1318.png') && html.includes('moldatk-icon-192-v1318.png'), 'iPhone/browser icon links missing');
expect(manifest.includes('moldatk-icon-512-v1318.png'), 'PWA manifest still uses the old icon');
expect(fs.existsSync('public/icons/moldatk-icon-180-v1318.png') && fs.statSync('public/icons/moldatk-icon-180-v1318.png').size > 1000, 'Generated Apple touch icon missing');
expect(fs.existsSync('public/icons/moldatk-icon-512-v1318.png') && fs.statSync('public/icons/moldatk-icon-512-v1318.png').size > 1000, 'Generated PWA icon missing');

expect(gradle.includes('androidxEspressoCoreVersion'), 'Android Gradle Espresso variable mismatch remains');
expect(!gradle.includes('androidxTestEspressoCoreVersion'), 'Broken Android Gradle variable remains');

console.log('Google Play legal pages, corrected login branding, checkbox multi-cabinet collector scope, cabinet deletion/order sync, iPhone/PWA icon and Android Gradle regression: OK');
