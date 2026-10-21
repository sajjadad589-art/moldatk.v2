import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // بعض أجهزة SUNMI V2 تعمل بنظام Android قديم ومعه WebView قديم لا يدعم
      // صيغ الجافاسكربت الحديثة (مثل ?. و ??) بشكل أصلي. استهداف es2015 يجعل Vite
      // يحوّل هذه الصيغ لكود متوافق بدل الاعتماد على دعم المتصفح المباشر.
      target: 'es2015',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.endsWith('/src/components/SuperAdminDashboard.tsx')) return 'super-admin';
            if (id.includes('/src/components/mobile/')) return 'mobile-ui';
            if (
              id.endsWith('/src/components/SettingsFolderView.tsx')
              || id.endsWith('/src/components/FolderDetailModal.tsx')
            ) return 'settings-ui';
            if (
              id.endsWith('/src/components/DashboardView.tsx')
              || id.endsWith('/src/components/WalletView.tsx')
              || id.endsWith('/src/components/DonutChartWidget.tsx')
            ) return 'dashboard-ui';
            if (!id.includes('/node_modules/')) return;
            if (id.includes('/node_modules/xlsx/')) return 'xlsx';
            if (id.includes('/node_modules/recharts/')) return 'charts';
            if (id.includes('/node_modules/@google/genai/')) return 'google-genai';
            if (id.includes('/node_modules/@supabase/')) return 'supabase';
            if (id.includes('/node_modules/motion/')) return 'motion';
            if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
            return 'vendor';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
