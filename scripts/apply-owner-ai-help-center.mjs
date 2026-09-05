import fs from 'node:fs';

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
const write = (path, content) => fs.writeFileSync(path, content, 'utf8');

const injectAssistantOpenEvent = () => {
  const path = 'src/components/OwnerAIAssistant.tsx';
  let src = read(path);
  if (!src) return;
  if (!src.includes('moldatk-open-owner-ai')) {
    const marker = "  const inputRef = React.useRef<HTMLInputElement | null>(null);";
    src = src.replace(marker, `${marker}\n\n  React.useEffect(() => {\n    const openAssistant = () => setOpen(true);\n    window.addEventListener('moldatk-open-owner-ai', openAssistant);\n    return () => window.removeEventListener('moldatk-open-owner-ai', openAssistant);\n  }, []);`);
  }
  write(path, src);
};

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
  if (!src.includes('<OwnerAIAssistant compact />')) {
    const root = `    <div className="space-y-6 font-['Cairo'] pb-20" dir="rtl">`;
    src = src.replace(root, `${root}\n      <div className="grid lg:grid-cols-2 gap-3"><OwnerAIAssistant compact /><HelpCenter /></div>`);
  }
  write(path, src);
};

const injectGlobalWatcher = () => {
  const path = 'src/App.tsx';
  let src = read(path);
  if (!src) return;
  if (!src.includes("from './components/OwnerAIWatcher'")) {
    src = src.replace("import { GeneratorNotifications } from './components/GeneratorNotifications';", "import { GeneratorNotifications } from './components/GeneratorNotifications';\nimport { OwnerAIWatcher } from './components/OwnerAIWatcher';");
  }
  const notification = `{userSession.role === 'generator_admin' && <GeneratorNotifications hideFloatingTriggers={activeTab === 'settings'} />}`;
  const watcher = `{userSession.role === 'generator_admin' && <OwnerAIWatcher onOpenAssistant={() => { setActiveTab('settings'); window.setTimeout(() => window.dispatchEvent(new Event('moldatk-open-owner-ai')), 220); }} />}`;
  if (!src.includes('<OwnerAIWatcher onOpenAssistant=')) {
    src = src.split(notification).join(`${notification}\n        ${watcher}`);
  }
  write(path, src);
};

injectAssistantOpenEvent();
injectMobileSettings();
injectDesktopSettings();
injectGlobalWatcher();

const assistant = read('src/components/OwnerAIAssistant.tsx');
const mobile = read('src/components/mobile/MobileSettings.tsx');
const desktop = read('src/components/SettingsFolderView.tsx');
const app = read('src/App.tsx');
if (!assistant.includes('moldatk-open-owner-ai')) throw new Error('Owner AI open event missing');
if (!mobile.includes('<OwnerAIAssistant />') || !mobile.includes('<HelpCenter />')) throw new Error('Owner AI/help center missing from mobile settings');
if (!desktop.includes('<OwnerAIAssistant compact />') || !desktop.includes('<HelpCenter />')) throw new Error('Owner AI/help center missing from desktop settings');
if (!app.includes('<OwnerAIWatcher onOpenAssistant=')) throw new Error('Owner AI proactive watcher missing from app');
console.log('Owner AI, proactive watcher, and help center injected into settings/app.');
