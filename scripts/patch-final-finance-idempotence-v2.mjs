import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');

// 1) Collector dashboard finalizer: if the final owner/collector parity block already
// exists from the lint pass, do not inject a second dashboard accounting block during
// the build pass. Accept either marker in the final invariant.
{
  const p = 'scripts/apply-collector-dashboard-accounting-fix.mjs';
  let s = read(p);
  const gate = "if (!source.includes('COLLECTOR_DASHBOARD_ACCOUNTING_SINGLE_SOURCE_V1')) {";
  const safeGate = "if (!source.includes('COLLECTOR_DASHBOARD_ACCOUNTING_SINGLE_SOURCE_V1') && !source.includes('COLLECTOR_OWNER_ACCOUNTING_PARITY_V2')) {";
  if (s.includes(gate)) s = s.replace(gate, safeGate);

  const markerInvariant = "if (!source.includes('COLLECTOR_DASHBOARD_ACCOUNTING_SINGLE_SOURCE_V1')) {\n  throw new Error('Collector dashboard accounting: source-of-truth marker missing');\n}";
  const safeMarkerInvariant = "if (!source.includes('COLLECTOR_DASHBOARD_ACCOUNTING_SINGLE_SOURCE_V1') && !source.includes('COLLECTOR_OWNER_ACCOUNTING_PARITY_V2')) {\n  throw new Error('Collector dashboard accounting: source-of-truth marker missing');\n}";
  if (s.includes(markerInvariant)) s = s.replace(markerInvariant, safeMarkerInvariant);

  if (!s.includes("!source.includes('COLLECTOR_OWNER_ACCOUNTING_PARITY_V2')")) {
    throw new Error('Final finance idempotence v2: collector dashboard parity guard missing');
  }
  write(p, s);
}

// 2) Cross-interface parity finalizer: refresh whichever accounting block is present.
// First execution receives the legacy collector-dashboard block; second execution receives
// the already-final parity block. In both cases replace exactly one block in-place.
{
  const p = 'scripts/apply-final-financial-interface-parity.mjs';
  let s = read(p);
  const oldStart = "  const start = s.indexOf('  // COLLECTOR_DASHBOARD_ACCOUNTING_SINGLE_SOURCE_V1');\n  const end = start >= 0 ? s.indexOf('\\n\\n  return (', start) : -1;";
  const newStart = "  const legacyAccountingStart = s.indexOf('  // COLLECTOR_DASHBOARD_ACCOUNTING_SINGLE_SOURCE_V1');\n  const parityAccountingStart = s.indexOf('  // COLLECTOR_OWNER_ACCOUNTING_PARITY_V2');\n  const start = legacyAccountingStart >= 0 ? legacyAccountingStart : parityAccountingStart;\n  const end = start >= 0 ? s.indexOf('\\n\\n  return (', start) : -1;";
  if (s.includes(oldStart)) s = s.replace(oldStart, newStart);

  if (!s.includes('const parityAccountingStart =')) {
    throw new Error('Final finance idempotence v2: parity block fallback missing');
  }
  write(p, s);
}

console.log('Final finance scripts made idempotent: collector parity block is replaced, never duplicated, across lint -> build.');
