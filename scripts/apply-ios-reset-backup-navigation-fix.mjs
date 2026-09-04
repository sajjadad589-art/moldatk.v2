import fs from 'node:fs';

const p = 'src/App.tsx';
let c = fs.readFileSync(p, 'utf8');

const legacy = `      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });\n      const url = URL.createObjectURL(blob);\n      const a = document.createElement('a');\n      a.href = url;\n      a.download = 'moldatk-backup-before-reset-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';\n      document.body.appendChild(a);\n      a.click();\n      a.remove();\n      window.setTimeout(() => URL.revokeObjectURL(url), 1000);`;

const guarded = `      // iOS Safari/WebView opens Blob downloads as a document preview and takes the user\n      // away from Moldatk. The emergency backup is already persisted in localStorage by the\n      // secure-reset safety patch, so only desktop/browser environments auto-download a file.\n      const isIOSBrowser = /iPad|iPhone|iPod/i.test(navigator.userAgent)\n        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);\n      const shouldAutoDownloadBackup = !isIOSBrowser && !Capacitor.isNativePlatform();\n\n      if (shouldAutoDownloadBackup) {\n        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });\n        const url = URL.createObjectURL(blob);\n        const a = document.createElement('a');\n        a.href = url;\n        a.download = 'moldatk-backup-before-reset-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';\n        document.body.appendChild(a);\n        a.click();\n        a.remove();\n        window.setTimeout(() => URL.revokeObjectURL(url), 1000);\n      } else {\n        console.info('Reset backup kept safely inside Moldatk; automatic file preview skipped on iOS/native app.');\n      }`;

if (c.includes(legacy)) {
  c = c.replace(legacy, guarded);
} else if (!c.includes('const shouldAutoDownloadBackup = !isIOSBrowser')) {
  throw new Error('Secure reset backup download block not found');
}

fs.writeFileSync(p, c);
console.log('Prevented iOS/native reset backup preview while preserving emergency backup and desktop download');
