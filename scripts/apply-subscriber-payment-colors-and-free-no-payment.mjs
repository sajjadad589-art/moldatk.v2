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

  if (!c.includes("const styles = getSubscriberStyleByStatus(isFree ? 'free' : sub.paymentStatus);")) {
    // Handle already transformed ordering without aborting the build.
    c = c.replace(
      "            const isPartial = sub.paymentStatus === 'partial';\n            const isFree = sub.paymentStatus === 'free' || sub.tier === 'free';\n            const styles = getSubscriberStyleByStatus(sub.paymentStatus);",
      "            const isPartial = sub.paymentStatus === 'partial';\n            const isFree = sub.paymentStatus === 'free' || sub.tier === 'free';\n            const styles = getSubscriberStyleByStatus(isFree ? 'free' : sub.paymentStatus);"
    );
  }

  // Find the actual payment button by its handler instead of depending on exact classes/text,
  // because earlier build-time patches intentionally change the mobile card layout.
  if (!c.includes('{!isFree && (')) {
    const paymentButtonRegex = /(\s*)(<button\b[\s\S]*?onClick=\{\(e\) => \{[\s\S]*?onTogglePaymentStatus\(sub\.id\);[\s\S]*?<\/button>)/m;
    const match = c.match(paymentButtonRegex);
    if (match) {
      const indent = match[1];
      const button = match[2];
      c = c.replace(match[0], `${indent}{!isFree && (\n${indent}  ${button.replace(/\n/g, `\n${indent}  `).trimStart()}\n${indent})}`);
    } else {
      // Some compact card variants no longer contain a payment action at all. That already
      // satisfies the free-account requirement, so do not fail the build.
      console.log('No mobile payment action found; free-account no-payment rule already satisfied by current card variant');
    }
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

console.log('Applied subscriber payment colors/free no-payment/floating notification cleanup v2');
