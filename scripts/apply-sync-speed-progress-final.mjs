import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8').replaceAll('\r\n','\n');
const write = (p,s) => fs.writeFileSync(p,s,'utf8');
const must = (ok,msg) => { if (!ok) throw new Error('Sync speed finalizer: ' + msg); };

// Keep scheduler responsive. The live-sync finalizer owns percentage UI and transport
// stages so this final pass never rewrites accounting or synchronization semantics.
{
  const p = 'src/lib/eventSyncScheduler.ts';
  let s = read(p);
  s = s.replace('const debounce = options.debounceMs ?? 350;', 'const debounce = options.debounceMs ?? 120;');
  s = s.replace('const cooldown = options.cooldownMs ?? 1500;', 'const cooldown = options.cooldownMs ?? 300;');
  s = s.replace('(options.errorCooldownMs ?? 15000)', '(options.errorCooldownMs ?? 8000)');
  must(s.includes('options.debounceMs ?? 120'), 'fast debounce missing');
  must(s.includes('options.cooldownMs ?? 300'), 'fast cooldown missing');
  write(p,s);
}

console.log('Sync speed finalizer applied: faster single-flight debounce/cooldown; progress UI remains owned by live-sync runtime.');
