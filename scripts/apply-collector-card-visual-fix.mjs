import fs from 'node:fs';

const path = 'src/components/POSQuickView.tsx';
let c = fs.readFileSync(path, 'utf8');
let changed = false;

const replacements = [
  [
    'className="text-sm font-black text-amber-400 tabular-nums" dir="ltr"',
    'className="text-xl sm:text-2xl font-black text-white tabular-nums leading-none" dir="ltr"'
  ],
  [
    'className="relative overflow-hidden flex items-center justify-between gap-2 p-3.5 sm:p-4 rounded-3xl',
    'className="relative overflow-hidden grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 p-3.5 sm:p-4 rounded-3xl'
  ],
  [
    'className="flex items-center gap-2 sm:gap-4 shrink-0"',
    'className="contents"'
  ],
  [
    '<span>{sub.amperes} أمبير</span>',
    '<span className="font-black text-white">{sub.amperes} أمبير</span>'
  ],
];

for (const [from, to] of replacements) {
  if (c.includes(from)) {
    c = c.replace(from, to);
    changed = true;
  }
}

if (!c.includes('collector-card-amount-label')) {
  c = c.replace(
    `{dueAmount.toLocaleString()} {generatorSpecs.currency || 'د.ع'}`,
    `{dueAmount.toLocaleString()} <span className="collector-card-amount-label text-xs sm:text-sm font-bold text-slate-200">{generatorSpecs.currency || 'د.ع'}</span>`
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(path, c);
  console.log('Applied collector card visual fix');
} else {
  console.log('Collector card visual fix already applied');
}
