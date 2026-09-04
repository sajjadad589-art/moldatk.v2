import fs from 'node:fs';

const path = 'src/components/mobile/MobileSettings.tsx';
if (fs.existsSync(path)) {
  let c = fs.readFileSync(path, 'utf8');

  // Remove unused light/dark theme icons after hiding the card.
  c = c.replace(/\n  Moon,\n  Sun,/, '');

  // Remove the Appearance/Dark-Light card completely, regardless of previous script injections.
  const cardPattern = /\n\s*\{\/\* 2\. Appearance & Theme Toggle \(Dark \/ Light\) \*\/\}[\s\S]*?\n\s*<SubscriptionInfoButton info=\{subscriptionInfo\} loading=\{subscriptionLoading\} \/>/;
  c = c.replace(cardPattern, '\n\n      <SubscriptionInfoButton info={subscriptionInfo} loading={subscriptionLoading} />');

  // Safety fallback for Arabic title if comments changed.
  const title = 'المظهر (Dark / Light)';
  if (c.includes(title)) {
    const titleIndex = c.indexOf(title);
    const start = c.lastIndexOf('\n      <div className="bg-white', titleIndex);
    const end = c.indexOf('\n\n      <SubscriptionInfoButton', titleIndex);
    if (start !== -1 && end !== -1) {
      c = c.slice(0, start) + c.slice(end);
    }
  }

  fs.writeFileSync(path, c);
  console.log('Removed mobile Appearance/Dark-Light card from settings');
}
