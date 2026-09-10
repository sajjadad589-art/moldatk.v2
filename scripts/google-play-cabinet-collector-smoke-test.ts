import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

const legal = read('src/components/LegalPage.tsx');
const main = read('src/main.tsx');
const login = read('src/components/LoginView.tsx');
const settings = read('src/components/SettingsFolderView.tsx');
const folder = read('src/components/FolderDetailModal.tsx');
const collectorCloud = read('src/lib/collectorCloud.ts');
const pos = read('src/components/POSQuickView.tsx');
const sync = read('src/lib/useGeneratorCloudSync.ts');
const types = read('src/types.ts');
const gradle = read('android/app/build.gradle');
const index = read('index.html');
const manifest = read('public/manifest.webmanifest');

expect(main.includes("<LegalPage kind=\"privacy\" />"), 'Privacy route missing');
expect(main.includes("<LegalPage kind=\"terms\" />"), 'Terms route missing');
expect(main.includes("<LegalPage kind=\"delete-account\" />"), 'Account deletion route missing');
expect(legal.includes("from('account_deletion_requests').insert"), 'Account deletion request form is not connected to Supabase');
expect(legal.includes('Firebase Cloud Messaging') && legal.includes('Supabase'), 'Privacy page must disclose core cloud processors');
expect(login.includes('href="/privacy"') && login.includes('href="/terms"') && login.includes('href="/delete-account"'), 'Login legal links missing');
expect(login.includes('/brand/moldatk-mark.svg') && !login.includes('/brand/moldatk-logo.svg'), 'Login must use the stable mark + HTML wordmark');

expect(types.includes('assignedLineIds?: string[];') && types.includes('assignedAllLines?: boolean;'), 'Collector multi-cabinet types missing');
expect(settings.includes('اختيار كل الكابينات') && settings.includes('collectorAssignedLineIds'), 'Collector settings cabinet picker missing');
expect(settings.includes('syncCloudCollectorRoster'), 'Collector settings assignment must be persisted through server sync');
expect(folder.includes('data-multi-cabinet-picker-v6'), 'Actual FolderDetailModal multi-cabinet picker missing');
expect(folder.includes('<span>الكل</span>') && folder.includes('type="checkbox"'), 'Actual collector picker must contain checkbox options and all');
expect(folder.includes('FOLDER_COLLECTOR_SERVER_SAVE_V6') && folder.includes('syncCloudCollectorRoster'), 'Actual collector modal must persist assignment to server');
expect(collectorCloud.includes('assigned_line_ids') && collectorCloud.includes('assigned_all_lines'), 'Collector cloud adapter missing multi-cabinet fields');
expect(pos.includes('accessibleSubscribers') && pos.includes('allowedLineIds') && pos.includes('resolvedLineId'), 'Collector POS is not scoped to assigned cabinets');

expect(sync.includes('MOLDATK_CAPTURE_DELETED_LINES_V1'), 'Cabinet deletion tombstone capture missing');
expect(sync.includes('MOLDATK_LINE_TOMBSTONE_DELETE_V2') || sync.includes('MOLDATK_LINE_TOMBSTONE_DELETE_V1'), 'Cabinet tombstone cloud delete missing');
expect(sync.includes("order('sort_order'"), 'Cabinet manual ordering is not persisted from cloud');
expect(sync.includes('lineToRow(generatorId, l, index)'), 'Cabinet sort order is not sent to cloud');

expect(index.includes('moldatk-apple-touch-v6.png') && index.includes('pwa-recovery-v6.js'), 'iPhone icon v6 links missing');
expect(manifest.includes('moldatk-icon-192-v6.png') && manifest.includes('/?pwa=6'), 'PWA manifest v6 icon set missing');
expect(fs.existsSync('public/icons/moldatk-apple-touch-v6.png'), 'Generated iPhone v6 icon missing');
expect(fs.statSync('public/icons/moldatk-apple-touch-v6.png').size > 1000, 'Generated iPhone v6 icon is invalid');

expect(gradle.includes('androidxEspressoCoreVersion'), 'Android Gradle Espresso variable mismatch remains');
expect(!gradle.includes('androidxTestEspressoCoreVersion'), 'Broken Android Gradle variable remains');
expect(gradle.includes('versionCode 28') && gradle.includes('versionName "1.3.24"'), 'Android release version is not 1.3.24/28');

console.log('Google Play legal pages, actual multi-cabinet collector picker/scope, cabinet deletion/order sync, iPhone/PWA v6 icon and Android build regression: OK');
