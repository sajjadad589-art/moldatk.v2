import fs from 'node:fs';

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

const injectMobileSettings = () => {
  const path = 'src/components/mobile/MobileSettings.tsx';
  let src = read(path);
  if (!src) return;
  if (!src.includes("from '../OwnerAIAssistant'")) {
    src = src.replace("import React from 'react';", "import React from 'react';\nimport { OwnerAIAssistant } from '../OwnerAIAssistant';\nimport { HelpCenter } from '../HelpCenter';");
  }
  const marker = '      <section className="rounded-[24px] bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-4 shadow-sm">\n        <button type="button" onClick={onOpenPricingModal}';
  if (!src.includes('<OwnerAIAssistant />')) {
    src = src.replace(marker, '      <OwnerAIAssistant />\n      <HelpCenter />\n\n' + marker);
  }
  write(path, src);
};

const injectDesktopSettings = () => {
  const path = 'src/components/SettingsFolderView.tsx';
  let src = read(path);
  if (!src) return;
  if (!src.includes("from './OwnerAIAssistant'")) {
    src = src.replace("import { SubscriptionInfoButton, SubscriptionInfo } from './SubscriptionStatusUI';", "import { SubscriptionInfoButton, SubscriptionInfo } from './SubscriptionStatusUI';\nimport { OwnerAIAssistant } from './OwnerAIAssistant';\nimport { HelpCenter } from './HelpCenter';");
  }
  const returnMarker = '  return (\n';
  if (!src.includes('<OwnerAIAssistant compact />')) {
    const divMarker = '<div className="';
    const returnAt = src.lastIndexOf(returnMarker);
    if (returnAt >= 0) {
      const divAt = src.indexOf(divMarker, returnAt);
      const closeAt = divAt >= 0 ? src.indexOf('>', divAt) : -1;
      if (closeAt >= 0) {
        src = src.slice(0, closeAt + 1) + '\n        <div className="grid lg:grid-cols-2 gap-3 mb-5"><OwnerAIAssistant compact /><HelpCenter /></div>' + src.slice(closeAt + 1);
      }
    }
  }
  write(path, src);
};

injectMobileSettings();
injectDesktopSettings();

const mobile = read('src/components/mobile/MobileSettings.tsx');
const desktop = read('src/components/SettingsFolderView.tsx');
if (!mobile.includes('<OwnerAIAssistant />') || !mobile.includes('<HelpCenter />')) throw new Error('Owner AI/help center missing from mobile settings');
if (!desktop.includes('<OwnerAIAssistant compact />') || !desktop.includes('<HelpCenter />')) throw new Error('Owner AI/help center missing from desktop settings');
console.log('Owner AI and help center injected into settings.');
