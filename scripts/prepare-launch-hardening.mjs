import fs from 'node:fs';

const file = 'scripts/apply-launch-hardening.mjs';
let src = fs.readFileSync(file, 'utf8');

const start = src.indexOf('  const cloudCollectorCallback = `onUpdateCollectors=');
const endMarker = "  if (!app.includes('collectorPermissions={userSession.collectorPermissions}')) {";
const end = src.indexOf(endMarker);

if (start !== -1 && end !== -1 && end > start) {
  src = src.slice(0, start) + '  // Unsafe cross-component collector callback rewrite disabled.\n' + src.slice(end);
}

fs.writeFileSync(file, src);
console.log('Prepared launch hardening safely');
