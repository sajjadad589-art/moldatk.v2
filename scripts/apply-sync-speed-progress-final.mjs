import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8').replaceAll('\r\n','\n');
const write = (p,s) => fs.writeFileSync(p,s,'utf8');
const must = (ok,msg) => { if (!ok) throw new Error('Sync speed/progress finalizer: ' + msg); };

// 1) Make the single-flight scheduler responsive without changing retry semantics.
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

// 2) Report real stage progress. Keep transport/accounting logic untouched.
{
  const p = 'src/lib/useEventDrivenGeneratorSync.ts';
  let s = read(p);

  s = s.replace(
/const progress = \\(active: boolean, pending = false\\) => window\\.dispatchEvent\\(new CustomEvent\\('moldatk-sync-progress', \\{[\\s\\S]*?\\n\\}\\)\\);/,
`const progress = (value: number, active = true, pending = false, message = 'جاري المزامنة') =>
  window.dispatchEvent(new CustomEvent('moldatk-sync-progress', {
    detail: { active, pending, progress: Math.max(0, Math.min(100, Math.round(value))), message },
  }));`
  );

  // Make the generated scheduler stage-aware regardless of whether the performance
  // finalizer has already added lastCompletedSyncAt.
  if (!s.includes("progress(5, true, false, 'بدء المزامنة')")) {
    s = s.replace(
      '    progress(true);\\n    try {\\n      if (pending()) await push(snapshot());',
      "    progress(5, true, false, 'بدء المزامنة');\\n    try {\\n      const hadPending = pending();\\n      if (hadPending) {\\n        progress(15, true, false, 'رفع التغييرات');\\n        await push(snapshot());\\n        progress(55, true, false, 'تم رفع التغييرات');\\n      } else {\\n        progress(35, true, false, 'قراءة التحديثات');\\n      }"
    );
    s = s.replace(
      '      if (!disposed && !pending()) await pull();',
      "      if (!disposed && !pending()) {\\n        progress(hadPending ? 65 : 45, true, false, 'تحديث البيانات');\\n        await pull();\\n        progress(95, true, false, 'إنهاء المزامنة');\\n      }"
    );
    s = s.replace(
      '      if (!disposed) { lastCompletedSyncAt = Date.now(); progress(false, pending()); }',
      "      if (!disposed) {\\n        lastCompletedSyncAt = Date.now();\\n        const stillPending = pending();\\n        progress(stillPending ? 0 : 100, false, stillPending, stillPending ? 'تعديلات بانتظار المزامنة' : 'اكتملت المزامنة');\\n      }"
    );
    s = s.replace(
      '      if (!disposed) progress(false, pending());',
      "      if (!disposed) {\\n        const stillPending = pending();\\n        progress(stillPending ? 0 : 100, false, stillPending, stillPending ? 'تعديلات بانتظار المزامنة' : 'اكتملت المزامنة');\\n      }"
    );
  }

  s = s.replace(/progress\\(false, true\\);/g, "progress(0, false, true, 'تعذر إكمال المزامنة');");

  must(s.includes("progress(5, true, false, 'بدء المزامنة')"), 'staged progress start missing');
  must(s.includes("progress(95, true, false, 'إنهاء المزامنة')"), 'staged progress finish missing');
  must(s.includes("stillPending ? 0 : 100"), '100 percent completion missing');
  write(p,s);
}

// 3) Indicator: percentage while working, then clear connected state immediately after success.
{
  const p = 'src/components/SyncProgressIndicator.tsx';
  let s = read(p);
  s = s.replace("? \`جاري المزامنة \${Math.max(1, state.progress)}%\`", "? \`المزامنة \${Math.max(1, state.progress)}%\`");
  s = s.replace('}, 900);', '}, 450);');
  must(s.includes('المزامنة ${Math.max(1, state.progress)}%'), 'percentage label missing');
  must(s.includes("'متصل بالإنترنت'"), 'connected label missing');
  write(p,s);
}

console.log('Sync speed/progress finalizer applied: responsive single-flight scheduling and staged percentage UI.');
