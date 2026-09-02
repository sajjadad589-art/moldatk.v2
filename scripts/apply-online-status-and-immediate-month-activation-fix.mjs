import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

// 1) إنشاء شهر تسعيرة جديد يجب أن يطبّق الدورة الشهرية فوراً، لا أن يحفظ الشكل فقط.
{
  const p = 'src/components/PricingModal.tsx';
  let c = read(p);
  c = c.replace(
    '    onSaveMonthlyTariffs(updatedTariffs, monthId, false);',
    '    onSaveMonthlyTariffs(updatedTariffs, monthId, true);'
  );
  write(p, c);
}

// 2) لا نعتبر pending = انقطاع إنترنت. pending يعني فقط أن عندنا تغييرات تنتظر المزامنة.
// كما لا نعتمد على navigator.onLine وحده داخل Android WebView لأنه قد يعطي false رغم وجود 4G/Wi‑Fi.
{
  const p = 'src/components/SyncProgressIndicator.tsx';
  let c = read(p);

  if (!c.includes("import { Capacitor } from '@capacitor/core';")) {
    c = c.replace(
      "import React, { useEffect, useState } from 'react';",
      "import React, { useEffect, useState } from 'react';\nimport { Capacitor } from '@capacitor/core';"
    );
  }

  c = c.replace(
    "    online: typeof navigator !== 'undefined' ? navigator.onLine : true,",
    "    online: Capacitor.isNativePlatform() ? true : (typeof navigator !== 'undefined' ? navigator.onLine : true),"
  );

  c = c.replace(
    "      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;",
    "      const online = Capacitor.isNativePlatform() ? state.online : (typeof navigator !== 'undefined' ? navigator.onLine : true);"
  );

  c = c.replace(
    "  const label = !state.online || state.pending\n    ? 'غير متصل بالإنترنت'\n    : state.syncing || completed\n      ? `جاري المزامنة ${Math.max(1, state.progress)}%`\n      : 'متصل بالإنترنت';",
    "  const label = !state.online\n    ? 'غير متصل بالإنترنت'\n    : state.syncing || completed\n      ? `جاري المزامنة ${Math.max(1, state.progress)}%`\n      : state.pending\n        ? 'بانتظار المزامنة'\n        : 'متصل بالإنترنت';"
  );

  c = c.replace(
    "  const tone = !state.online || state.pending",
    "  const tone = !state.online"
  );
  c = c.replace(
    "  const dotTone = !state.online || state.pending",
    "  const dotTone = !state.online"
  );

  write(p, c);
}

console.log('Applied immediate month activation and native-safe online status fix');
