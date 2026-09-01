import fs from 'node:fs';

const marker = 'mobile-subscriber-compact-muted-red-v1';

// Make unpaid status visible with a calm burgundy red instead of a bright red.
{
  const p = 'src/components/SubscribersView.tsx';
  let c = fs.readFileSync(p, 'utf8');

  if (!c.includes(marker)) {
    const oldStyle = "  return { cardBg: 'bg-white dark:bg-[#131E38]', cardBorderAccent: 'border border-rose-200 dark:border-rose-900/40', avatarBg: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300', nameText: 'text-slate-900 dark:text-white', badgeBg: 'bg-white/70 dark:bg-slate-900/50', innerSubBox: 'bg-white/70 dark:bg-slate-900/40' };";
    const newStyle = "  // mobile-subscriber-compact-muted-red-v1\n  return { cardBg: 'bg-rose-50/70 dark:bg-[#2A1820]', cardBorderAccent: 'border border-[#B55A68]/70 dark:border-[#7F3B48]', avatarBg: 'bg-[#B55A68]/15 text-[#8E3344] dark:bg-[#7F3B48]/45 dark:text-[#E3A4AE]', nameText: 'text-slate-900 dark:text-white', badgeBg: 'bg-white/75 dark:bg-[#1A2236]/80', innerSubBox: 'bg-white/75 dark:bg-[#121A2D]/80' };";
    if (c.includes(oldStyle)) c = c.replace(oldStyle, newStyle);
    else console.log('skip muted unpaid palette: source marker not found');
    fs.writeFileSync(p, c);
  }
}

// Reduce vertical height of each subscriber row/card while keeping all useful data readable.
{
  const p = 'src/components/mobile/MobileSubscribers.tsx';
  let c = fs.readFileSync(p, 'utf8');

  c = c.replace('        <div className="space-y-3">', '        <div className="space-y-2">');
  c = c.replace('className={`rounded-3xl p-4 transition-all cursor-pointer group ${styles.cardBg} ${styles.cardBorderAccent}`}', 'className={`rounded-2xl px-3 py-2.5 transition-all cursor-pointer group ${styles.cardBg} ${styles.cardBorderAccent}`}');
  c = c.replace('className="flex items-start justify-between gap-2"', 'className="flex items-start justify-between gap-1.5"');
  c = c.replace('className="flex items-center gap-2.5 min-w-0"', 'className="flex items-center gap-2 min-w-0"');
  c = c.replace('w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm', 'w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs');
  c = c.replace('grid grid-cols-3 gap-1.5 p-2 rounded-2xl my-2 text-center', 'grid grid-cols-3 gap-1 p-1.5 rounded-xl my-1.5 text-center');
  c = c.replace('className="px-2 py-1 mb-2 rounded-xl bg-amber-200/60', 'className="px-2 py-0.5 mb-1.5 rounded-lg bg-amber-200/60');
  c = c.replace('className="flex items-center justify-between gap-2 pt-0.5"', 'className="flex items-center justify-between gap-1.5 pt-0"');
  c = c.replace('className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl text-xs font-black bg-rose-50', 'className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-black bg-rose-50');
  c = c.replace('className="text-[11px] font-bold text-slate-500 flex items-center gap-1 shrink-0 px-2.5 py-1.5 rounded-xl', 'className="text-[10px] font-bold text-slate-500 flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg');

  fs.writeFileSync(p, c);
}

console.log('Applied compact mobile subscriber cards with muted burgundy unpaid status v1');
