import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LandingPage from './LandingPage';
import { AndroidUpdateChecker } from './components/AndroidUpdateChecker';
import { SyncProgressIndicator } from './components/SyncProgressIndicator';
import { SeasonalCampaignRuntime } from './components/SeasonalCampaignRuntime';
import { CustomerOrderAssistant } from './components/CustomerOrderAssistant';
import LegalPage from './components/LegalPage';
import SubscriberPortalPage from './components/SubscriberPortalPage';
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

  const subscriberPortalMatch = window.location.pathname.match(/^\/s\/([0-9a-fA-F-]{36})$/);
  if (subscriberPortalMatch) return <SubscriberPortalPage token={subscriberPortalMatch[1]} />;

  if (window.location.pathname === '/privacy') return <LegalPage kind="privacy" />;
  if (window.location.pathname === '/terms') return <LegalPage kind="terms" />;
  if (window.location.pathname === '/delete-account') return <LegalPage kind="delete-account" />;

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
    <SyncProgressIndicator />
  </React.StrictMode>
);

// تفعيل نسخة الويب المصغرة على iPhone/Android. لا نعتمد عليها داخل Capacitor للطباعة أو الميزات الأصلية.
if ('serviceWorker' in navigator && !window.location.protocol.startsWith('file')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=1.3.28', { updateViaCache: 'none' }).then(registration => {
      const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
      let lastUpdateCheck = 0;
      const checkForUpdate = () => {
        if (document.visibilityState !== 'visible') return;
        const now = Date.now();
        if (now - lastUpdateCheck < UPDATE_INTERVAL_MS) return;
        lastUpdateCheck = now;
        void registration.update();
      };
      checkForUpdate();
      document.addEventListener('visibilitychange', checkForUpdate);
    }).catch(error => {
      console.warn('PWA service worker registration failed:', error);
    });
  });
}
