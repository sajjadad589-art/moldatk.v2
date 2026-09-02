import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

// Mobile header: replace pricing shortcut with a functional notifications button.
{
  const p = 'src/components/mobile/MobileHeader.tsx';
  let c = read(p);

  c = c.replace('  Sliders,\n', '  Bell,\n');

  const pricingBlock = `          {/* Pricing Quick Button */}\n          <button\n            onClick={onOpenPricingModal}\n            className="px-2.5 py-1 rounded-xl bg-blue-950/70 hover:bg-blue-900 border border-blue-800 text-blue-100 hover:text-white transition-all flex items-center gap-1 text-[11px] font-bold"\n            title="تسعيرة الأمبير"\n          >\n            <Sliders className="w-3 h-3 text-yellow-400" />\n            <span>التسعيرة</span>\n          </button>`;

  const notificationBlock = `          {/* Notifications Quick Button */}\n          <button\n            type="button"\n            onClick={() => window.dispatchEvent(new Event('moldatk-open-notifications'))}\n            className="relative w-9 h-9 rounded-xl bg-blue-950/75 hover:bg-blue-900 border border-blue-700/80 text-white transition-all flex items-center justify-center shadow-sm"\n            title="الإشعارات"\n            aria-label="فتح الإشعارات"\n          >\n            <Bell className="w-5 h-5" />\n            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-blue-950" />\n          </button>`;

  if (c.includes(pricingBlock)) {
    c = c.replace(pricingBlock, notificationBlock);
  } else if (!c.includes("moldatk-open-notifications")) {
    throw new Error('MobileHeader pricing button block not found');
  }

  write(p, c);
  console.log('Applied mobile header notifications button in place of pricing');
}

// Unpaid subscriber card palette: solid calm burgundy/red, not a dim tint and not a harsh bright red.
{
  const p = 'src/components/SubscribersView.tsx';
  let c = read(p);

  c = c.replace(
    /return \{ cardBg: 'bg-rose-50\/70 dark:bg\[?#?[^']*'?,?[^\n]*?\};/,
    "return { cardBg: 'bg-[#8A2F3E] dark:bg-[#742837]', cardBorderAccent: 'border border-[#B85B69] dark:border-[#A44A5A]', avatarBg: 'bg-white/15 text-white dark:bg-white/10 dark:text-white', nameText: 'text-white dark:text-white', badgeBg: 'bg-black/15 text-white dark:bg-black/20 dark:text-white', innerSubBox: 'bg-[#641F2C]/55 dark:bg-[#551A26]/60' };"
  );

  // Fallback for the exact currently-patched style.
  c = c.replace(
    "  // mobile-subscriber-compact-muted-red-v1\n  return { cardBg: 'bg-rose-50/70 dark:bg-[#2A1820]', cardBorderAccent: 'border border-[#B55A68]/70 dark:border-[#7F3B48]', avatarBg: 'bg-[#B55A68]/15 text-[#8E3344] dark:bg-[#7F3B48]/45 dark:text-[#E3A4AE]', nameText: 'text-slate-900 dark:text-white', badgeBg: 'bg-white/75 dark:bg-[#1A2236]/80', innerSubBox: 'bg-white/75 dark:bg-[#121A2D]/80' };",
    "  // mobile-subscriber-final-solid-red-v1\n  return { cardBg: 'bg-[#8A2F3E] dark:bg-[#742837]', cardBorderAccent: 'border border-[#B85B69] dark:border-[#A44A5A]', avatarBg: 'bg-white/15 text-white dark:bg-white/10 dark:text-white', nameText: 'text-white dark:text-white', badgeBg: 'bg-black/15 text-white dark:bg-black/20 dark:text-white', innerSubBox: 'bg-[#641F2C]/55 dark:bg-[#551A26]/60' };"
  );

  write(p, c);
  console.log('Applied calm solid burgundy unpaid subscriber palette');
}

// Enlarge primary subscriber card typography while keeping the compact layout.
{
  const p = 'src/components/mobile/MobileSubscribers.tsx';
  let c = read(p);

  c = c.replace(
    'className={`rounded-2xl px-3 py-2.5 transition-all cursor-pointer group ${styles.cardBg} ${styles.cardBorderAccent}`}',
    'className={`rounded-2xl px-4 py-3.5 transition-all cursor-pointer group shadow-sm ${styles.cardBg} ${styles.cardBorderAccent}`}'
  );

  c = c.replace(
    'className={`grid grid-cols-[1.3fr_0.7fr_1fr] items-center gap-2 p-2.5 rounded-2xl ${styles.innerSubBox}`}',
    'className={`grid grid-cols-[1.35fr_0.7fr_1fr] items-center gap-2.5 p-3 rounded-2xl ${styles.innerSubBox}`}'
  );

  c = c.replaceAll('text-[9px] font-bold text-slate-400 block', 'text-[10px] sm:text-[11px] font-bold text-white/75 dark:text-white/75 block');
  c = c.replace('text-base font-black truncate block leading-tight', 'text-lg sm:text-xl font-black truncate block leading-tight');
  c = c.replace('text-base font-black text-blue-500 tabular-nums', 'text-lg sm:text-xl font-black text-sky-300 tabular-nums');
  c = c.replace('text-base font-black text-slate-900 dark:text-white tabular-nums truncate block', 'text-lg sm:text-xl font-black text-white dark:text-white tabular-nums truncate block');
  c = c.replace('mt-1.5 flex items-center justify-between gap-2 px-1 text-[9px] text-slate-400', 'mt-2 flex items-center justify-between gap-2 px-1 text-[10px] text-white/75 dark:text-white/75');

  write(p, c);
  console.log('Enlarged mobile subscriber card name, amperes and amount typography');
}

console.log('Applied final subscriber header/card design v1');
