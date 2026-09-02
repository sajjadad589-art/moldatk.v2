import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

// 1) Use clear, calm solid colors by payment status.
{
  const p = 'src/components/SubscribersView.tsx';
  let c = read(p);

  const start = c.indexOf("export const getSubscriberStyleByStatus = (status: Subscriber['paymentStatus']) => {");
  const end = start >= 0 ? c.indexOf('\n};', start) : -1;
  if (start < 0 || end < 0) throw new Error('getSubscriberStyleByStatus not found');

  const replacement = `export const getSubscriberStyleByStatus = (status: Subscriber['paymentStatus']) => {\n  if (status === 'paid') return { cardBg: 'bg-[#176B45] dark:bg-[#14583A]', cardBorderAccent: 'border border-[#2F8E65] dark:border-[#287A57]', avatarBg: 'bg-white/14 text-white', nameText: 'text-white', badgeBg: 'bg-black/15 text-white', innerSubBox: 'bg-[#105238]/55 dark:bg-[#0F472F]/65' };\n  if (status === 'partial') return { cardBg: 'bg-[#9A741B] dark:bg-[#7D5E16]', cardBorderAccent: 'border border-[#C49A32] dark:border-[#A47F28]', avatarBg: 'bg-white/14 text-white', nameText: 'text-white', badgeBg: 'bg-black/15 text-white', innerSubBox: 'bg-[#765710]/55 dark:bg-[#654A0E]/65' };\n  if (status === 'free') return { cardBg: 'bg-[#46515F] dark:bg-[#394451]', cardBorderAccent: 'border border-[#657180] dark:border-[#586474]', avatarBg: 'bg-white/12 text-white', nameText: 'text-white', badgeBg: 'bg-black/15 text-white', innerSubBox: 'bg-[#303A46]/60 dark:bg-[#2B3540]/70' };\n  return { cardBg: 'bg-[#8A2F3E] dark:bg-[#742837]', cardBorderAccent: 'border border-[#B85B69] dark:border-[#A44A5A]', avatarBg: 'bg-white/15 text-white', nameText: 'text-white', badgeBg: 'bg-black/15 text-white', innerSubBox: 'bg-[#641F2C]/55 dark:bg-[#551A26]/60' };\n}`;

  c = c.slice(0, start) + replacement + c.slice(end + 3);
  write(p, c);
  console.log('Applied solid subscriber colors: paid green, partial amber, free gray, unpaid burgundy');
}

// 2) Free subscribers never show payment/receipt action; style free tier as free even if old status is inconsistent.
{
  const p = 'src/components/mobile/MobileSubscribers.tsx';
  let c = read(p);

  c = c.replace(
    "            const styles = getSubscriberStyleByStatus(sub.paymentStatus);\n            const isPartial = sub.paymentStatus === 'partial';\n            const isFree = sub.paymentStatus === 'free' || sub.tier === 'free';",
    "            const isPartial = sub.paymentStatus === 'partial';\n            const isFree = sub.paymentStatus === 'free' || sub.tier === 'free';\n            const styles = getSubscriberStyleByStatus(isFree ? 'free' : sub.paymentStatus);"
  );

  // Wrap the payment action so free subscribers have no payment button at all.
  const paymentButtonStart = `                  <button\n                    onClick={(e) => {\n                      e.stopPropagation();\n                      onTogglePaymentStatus(sub.id);\n                    }}\n                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all bg-[#1E3A8A] hover:bg-blue-900 text-white shadow-xs cursor-pointer active:scale-98"\n                    title="تغيير طريقة التسديد"\n                  >\n                    <CreditCard className="w-3.5 h-3.5 text-yellow-300" />\n                    <span>تسديد / خيارات الدفع 💳</span>\n                  </button>`;

  if (c.includes(paymentButtonStart)) {
    c = c.replace(paymentButtonStart, `{!isFree && (\n                  <button\n                    onClick={(e) => {\n                      e.stopPropagation();\n                      onTogglePaymentStatus(sub.id);\n                    }}\n                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all bg-[#1E3A8A] hover:bg-blue-900 text-white shadow-xs cursor-pointer active:scale-98"\n                    title="تغيير طريقة التسديد"\n                  >\n                    <CreditCard className="w-3.5 h-3.5 text-yellow-300" />\n                    <span>تسديد / خيارات الدفع 💳</span>\n                  </button>\n                )}`);
  } else if (!c.includes('{!isFree && (')) {
    throw new Error('Mobile free payment button target not found');
  }

  write(p, c);
  console.log('Hidden payment action for free subscribers');
}

// 3) Remove the bottom-left floating notifications button. Header notification button remains the only trigger.
{
  const p = 'src/components/GeneratorNotifications.tsx';
  let c = read(p);
  c = c.replace('{!hideFloatingTriggers && <button', '{false && !hideFloatingTriggers && <button');
  c = c.replace('{!hideFloatingTriggers && !isNative && !pushEnabled && webPushSupported() && (', '{false && !hideFloatingTriggers && !isNative && !pushEnabled && webPushSupported() && (');
  write(p, c);
  console.log('Removed floating notification triggers; header notification button remains');
}

console.log('Applied subscriber payment colors/free no-payment/floating notification cleanup v1');
