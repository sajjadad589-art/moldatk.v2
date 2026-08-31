import fs from 'node:fs';

const appPath = 'src/App.tsx';
let source = fs.readFileSync(appPath, 'utf8');
let changed = false;

if (source.includes("import React, { useState, useEffect } from 'react';")) {
  source = source.replace(
    "import React, { useState, useEffect } from 'react';",
    "import React, { useState, useEffect, useRef } from 'react';"
  );
  changed = true;
}

if (source.includes("import { Capacitor } from '@capacitor/core';")) {
  source = source.replace(
    "import { Capacitor } from '@capacitor/core';",
    "import { Capacitor, registerPlugin } from '@capacitor/core';"
  );
  changed = true;
}

const pluginDecl = "const BackNavigation = registerPlugin<{ exitApp(): Promise<void> }>('BackNavigation');";
if (!source.includes(pluginDecl)) {
  const marker = "import { FolderDetailModal } from './components/FolderDetailModal';";
  if (!source.includes(marker)) throw new Error('Back navigation import marker not found');
  source = source.replace(marker, `${marker}\n\n${pluginDecl}`);
  changed = true;
}

if (!source.includes("window.addEventListener('moldatk-android-back', handleAndroidBack);")) {
  const marker = `  const showToast = (msg: string) => {\n    setToastMessage(msg);\n    setTimeout(() => setToastMessage(null), 3500);\n  };`;
  if (!source.includes(marker)) throw new Error('showToast marker not found for Android back navigation patch');

  const handler = `${marker}\n\n  const lastBackPressRef = useRef(0);\n\n  useEffect(() => {\n    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;\n\n    const handleAndroidBack = () => {\n      // ضغطة واحدة تغلق النافذة/القائمة الحالية أولاً.\n      if (isReceiptModalOpen) {\n        setIsReceiptModalOpen(false);\n        setSelectedReceiptSubscriber(null);\n        setSelectedReceiptInvoice(null);\n        return;\n      }\n      if (isSubscriberModalOpen) {\n        setIsSubscriberModalOpen(false);\n        setSubscriberToEdit(null);\n        return;\n      }\n      if (pricingModalOpen) {\n        setPricingModalOpen(false);\n        return;\n      }\n      if (activeSettingsFolderKey) {\n        setActiveSettingsFolderKey(null);\n        return;\n      }\n      if (activeTab !== 'dashboard') {\n        setActiveTab('dashboard');\n        return;\n      }\n\n      // إذا نحن بالواجهة الرئيسية: أول ضغطة تنبه، والثانية خلال ثانيتين تغلق التطبيق.\n      const now = Date.now();\n      if (now - lastBackPressRef.current <= 2000) {\n        lastBackPressRef.current = 0;\n        void BackNavigation.exitApp();\n        return;\n      }\n\n      lastBackPressRef.current = now;\n      showToast('اضغط رجوع مرة ثانية للخروج من التطبيق');\n    };\n\n    window.addEventListener('moldatk-android-back', handleAndroidBack);\n    return () => window.removeEventListener('moldatk-android-back', handleAndroidBack);\n  }, [isReceiptModalOpen, isSubscriberModalOpen, pricingModalOpen, activeSettingsFolderKey, activeTab]);`;

  source = source.replace(marker, handler);
  changed = true;
}

if (changed) {
  fs.writeFileSync(appPath, source);
  console.log('Applied Android single-back navigation and double-back exit behavior');
} else {
  console.log('Android back navigation behavior already applied');
}
