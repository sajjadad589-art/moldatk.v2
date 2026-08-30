import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CollectorApp from './CollectorApp';
import { AndroidUpdateChecker } from './components/AndroidUpdateChecker';
import './index.css';

function RootRouter() {
  const [route, setRoute] = useState<string>(() => window.location.pathname + window.location.hash);

  useEffect(() => {
    const handleLocationChange = () => {
      setRoute(window.location.pathname + window.location.hash);
    };
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // بوابة Super Admin منفصلة عن جلسة الأدمن المحلية القديمة.
  if (window.location.pathname === '/super-admin' || route.includes('#super-admin')) {
    return <App forceSuperAdmin />;
  }

  // إذا كان الرابط يحتوي على #collector يتم عرض تطبيق الجباة، وإلا يتم عرض لوحة التحكم الرئيسية
  if (route.includes('collector') || route.includes('col')) {
    return <CollectorApp />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootRouter />
    <AndroidUpdateChecker />
  </React.StrictMode>
);

// تفعيل نسخة الويب المصغرة على iPhone/Android. لا نعتمد عليها داخل Capacitor للطباعة أو الميزات الأصلية.
if ('serviceWorker' in navigator && !window.location.protocol.startsWith('file')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('PWA service worker registration failed:', error);
    });
  });
}
