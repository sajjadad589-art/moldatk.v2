import fs from 'node:fs';

const path = 'scripts/apply-permanent-data-purge-final.mjs';
let source = fs.readFileSync(path, 'utf8');

const legacy = `    const insertion = source.indexOf('  const handleSaveSubscriber = (newSub: Subscriber) => {');\n    must(insertion >= 0, 'handleSaveSubscriber insertion point missing');\n    source = source.slice(0, insertion) + permanentSubscriberDelete + source.slice(insertion);`;
const hardened = `    let insertion = source.indexOf('  const handleSaveSubscriber = (newSub: Subscriber) => {');\n    if (insertion < 0) insertion = source.indexOf('  const addAuditLog = (entry: any) => {');\n    if (insertion < 0) insertion = source.indexOf('  if (!userSession) {');\n    must(insertion >= 0, 'subscriber delete handler insertion point missing');\n    source = source.slice(0, insertion) + permanentSubscriberDelete + source.slice(insertion);`;

if (source.includes(legacy)) {
  source = source.replace(legacy, hardened);
  fs.writeFileSync(path, source, 'utf8');
}

const final = fs.readFileSync(path, 'utf8');
if (!final.includes("subscriber delete handler insertion point missing")) {
  throw new Error('Permanent purge finalizer insertion hardening missing');
}

await import('./apply-permanent-data-purge-final.mjs');
