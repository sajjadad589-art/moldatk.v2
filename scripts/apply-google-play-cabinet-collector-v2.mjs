import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');
const must = (condition, message) => { if (!condition) throw new Error(message); };

// The project has a long compatibility mutation chain. Make the v1 patch tolerate a
// legacy generator-lines block that may already have been rewritten by an earlier guard.
const v1Path = 'scripts/apply-google-play-cabinet-collector-final.mjs';
let v1 = read(v1Path);
v1 = v1.replace(
  "    must(src.includes(replaceMissingAnchor), 'generator_lines replaceMissing anchor missing');",
  "    if (!src.includes(replaceMissingAnchor)) console.warn('generator_lines replaceMissing anchor already rewritten; v2 will inject tombstone delete safely');"
);
v1 = v1.replace(
  "must(sync.includes('MOLDATK_LINE_TOMBSTONE_DELETE_V1') && sync.includes('sort_order'), 'cabinet deletion/order cloud guard missing');",
  "must(sync.includes('sort_order'), 'cabinet sort-order cloud guard missing');"
);
write(v1Path, v1);

await import('./apply-google-play-cabinet-collector-final.mjs');

// Inject the cloud deletion immediately inside the generator-admin push branch. This
// location survives all current legacy transforms and runs before the line upsert/pull race.
const syncPath = 'src/lib/useGeneratorCloudSync.ts';
let sync = read(syncPath);
if (!sync.includes('MOLDATK_LINE_TOMBSTONE_DELETE_V2')) {
  const adminAnchor = "        if (session?.role === 'generator_admin') {";
  must(sync.includes(adminAnchor), 'generator admin cloud push branch missing');
  sync = sync.replace(
    adminAnchor,
    `${adminAnchor}\n          // MOLDATK_LINE_TOMBSTONE_DELETE_V2: remove deleted cabinets from Supabase before any realtime refresh.\n          if (deletedLineIds.size) {\n            const { error: deleteLinesError } = await supabase\n              .from('generator_lines')\n              .delete()\n              .eq('generator_id', generatorId)\n              .in('id', Array.from(deletedLineIds));\n            if (deleteLinesError) throw deleteLinesError;\n          }`
  );
}
write(syncPath, sync);

const finalSync = read(syncPath);
must(finalSync.includes('MOLDATK_CAPTURE_DELETED_LINES_V1'), 'cabinet deletion tombstone capture missing');
must(finalSync.includes('MOLDATK_LINE_TOMBSTONE_DELETE_V2'), 'cabinet cloud delete missing');
must(finalSync.includes('sort_order'), 'cabinet sort order missing');

console.log('Applied hardened Google Play/cabinet/collector patch v2.');
