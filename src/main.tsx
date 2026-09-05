import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LandingPage from './LandingPage';
import { AndroidUpdateChecker } from './components/AndroidUpdateChecker';
import { SeasonalCampaignRuntime } from './components/SeasonalCampaignRuntime';
import { CustomerOrderAssistant } from './components/CustomerOrderAssistant';
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

  if (window.location.pathname === '/download' || window.location.pathname === '/about') {
    return <LandingPage />;
  }

  if (window.location.pathname === '/order') {
    return <CustomerOrderAssistant />;
  }

  // بوابة Super Admin منفصلة عن جلسة الأدمن المحلية القديمة.
  if (window.location.pathname === '/super-admin' || route.includes('#super-admin')) {
    return <App forceSuperAdmin />;
  }

  // جميع المستخدمين، بما فيهم الجباة، يدخلون من البوابة الرئيسية حتى يمروا
  // بمصادقة Supabase الموحدة ولا يمكن الرجوع لمسار الجباة المحلي القديم.
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SeasonalCampaignRuntime />
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
