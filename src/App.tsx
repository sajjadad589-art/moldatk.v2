import { useEventDrivenGeneratorSync as useGeneratorCloudSync, flushGeneratorSync } from './lib/useEventDrivenGeneratorSync';
import { resetCashbox } from './lib/cashboxCloud';
import { hasMonthlyPricing, suspendSubscriberBilling } from './utils/pricingAvailability';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import {
  INITIAL_PRICING_TIERS,
  INITIAL_MONTHLY_TARIFFS,
  INITIAL_LINES,
  INITIAL_COLLECTORS,
  INITIAL_GENERATOR_SPECS,
  INITIAL_SUBSCRIBERS,
  INITIAL_SETTINGS_FOLDERS,
  INITIAL_INVOICE_TEMPLATE,
} from './data/initialData';
import {
  Subscriber,
  SubscriptionTierPricing,
  MonthlyTariffRecord,
  GeneratorSpecs,
  LineDistribution,
  Collector,
  ActiveUserSession,
  SubscriberInvoice,
  AuditLogEntry,
  InvoiceTemplateSettings,
  SettingsFolderItem,
} from './types';
import { LoginView } from './components/LoginView';
import { POSQuickView } from './components/POSQuickView';
import { InvoiceReceiptModal } from './components/InvoiceReceiptModal';
import { SubscriberModal } from './components/SubscriberModal';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { SubscribersView } from './components/SubscribersView';
import { WalletView } from './components/WalletView';
import { SettingsFolderView } from './components/SettingsFolderView';
import { GeneratorMonitorView } from './components/GeneratorMonitorView';
import { MobileLayout } from './components/mobile/MobileLayout';
import { MobileMonthlyReports } from './components/mobile/MobileMonthlyReports';
import { Sparkles } from 'lucide-react';
import { calculateSubscriberBill } from './utils/formatters';
import { activateMonthlyTariffForSubscribers, calculateMonthlyCharge, getInvoiceRemaining } from './utils/monthlyAccounting';
import { normalizeMonthlyTariffs, startFreshMonthlyCycle, repriceActiveMonthlyCycle, summarizeExistingMonthlyCycle, zeroLiveMonthlyCycle } from './utils/monthlyCycleEngine';
import { hasPaymentsInMonth, removeUnpaidMonthLedger, extinguishDeletedTariffLiabilities } from './utils/monthlyTariffDeletion';
const SuperAdminDashboard = lazy(() => import('./components/SuperAdminDashboard').then(module => ({ default: module.SuperAdminDashboard })));
import { supabase } from './lib/supabase';
import { loadCloudCollectors, syncCloudCollectorRoster } from './lib/collectorCloud';
import { persistCollectorSubscriber } from './lib/subscriberCloud';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { ExpiredSubscriptionScreen, SuspendedAccountScreen, SubscriptionUnavailableScreen, SubscriptionWarningBanner, SubscriptionInfo, daysUntilExpiry } from './components/SubscriptionStatusUI';
import { GeneratorNotifications } from './components/GeneratorNotifications';
import { OwnerAIWatcher } from './components/OwnerAIWatcher';
import { PricingModal } from './components/PricingModal';
import { FolderDetailModal } from './components/FolderDetailModal';
import type { SecureResetResult } from './components/SecureSystemReset';
import { normalizeInvoiceTemplate } from './lib/invoiceTemplate';

const BackNavigation = registerPlugin<{ exitApp(): Promise<void> }>('BackNavigation');

const ENABLE_NATIVE_PUSH = import.meta.env.VITE_ENABLE_NATIVE_PUSH === 'true';

// نافذة العرض الحقيقية للجهاز (مثل شاشة SUNMI V2 الصغيرة جداً) تُستخدم لتحديد
// متى تُعرض واجهة الهاتف المخصصة بدل واجهة سطح المكتب ذات الشريط الجانبي الواسع.
function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

interface AppProps {
  forceSuperAdmin?: boolean;
}

export default function App({ forceSuperAdmin = false }: AppProps) {
  const [userSession, setUserSession] = useState<ActiveUserSession | null>(() => {
    try {
      const saved = localStorage.getItem('moldatk_session');
      if (!saved) return null;
      const parsed = JSON.parse(saved) as ActiveUserSession;
      // المسار /super-admin لا يسمح بإعادة استخدام جلسة الأدمن القديمة المحلية.
      if (forceSuperAdmin && parsed.role !== 'super_admin' && parsed.role !== 'super_admin_manager') return null;
      return parsed;
    } catch (e) {
      return null;
    }
  });


  // مزامنة مركزية: أي إضافة/تعديل/حذف للمشتركين تنتقل بين كل الأجهزة التابعة لنفس المولدة.
  useGeneratorCloudSync(userSession);

  const getStorageKey = (baseKey: string, session: ActiveUserSession | null = userSession) => {
    // كل حساب مرتبط بمولدة واحدة لديه مخزن مستقل: مالك المولدة + الجباة التابعون له.
    if ((session?.role === 'generator_admin' || session?.role === 'collector') && session.generatorId) {
      return `${baseKey}_${session.generatorId}`;
    }
    return baseKey;
  };

  const readLocalJson = <T,>(baseKey: string, fallback: T, session: ActiveUserSession | null = userSession): T => {
    try {
      const saved = localStorage.getItem(getStorageKey(baseKey, session));
      if (!saved) return fallback;
      return JSON.parse(saved) as T;
    } catch (e) {
      return fallback;
    }
  };


  const readGeneratorSpecsForSession = (session: ActiveUserSession | null = userSession): GeneratorSpecs => {
    const stored = readLocalJson<GeneratorSpecs>('moldatk_generator', INITIAL_GENERATOR_SPECS, session);
    if ((session?.role === 'generator_admin' || session?.role === 'collector') && session.generatorId) {
      try {
        const rawAccounts = localStorage.getItem('moldatk_generator_accounts');
        const accounts = rawAccounts ? JSON.parse(rawAccounts) : [];
        const account = Array.isArray(accounts) ? accounts.find((x: any) => x?.generatorId === session.generatorId) : null;
        return {
          ...INITIAL_GENERATOR_SPECS,
          ...stored,
          generatorName: account?.generatorName || stored.generatorName || INITIAL_GENERATOR_SPECS.generatorName,
          ownerName: account?.ownerName || stored.ownerName || INITIAL_GENERATOR_SPECS.ownerName,
        };
      } catch (e) {
        return stored;
      }
    }
    return stored;
  };

  const rememberGeneratorAccount = (session: ActiveUserSession | null = userSession, specs?: Partial<GeneratorSpecs>) => {
    if (!session?.generatorId) return;
    try {
      const raw = localStorage.getItem('moldatk_generator_accounts');
      const list = raw ? JSON.parse(raw) : [];
      const safeList = Array.isArray(list) ? list : [];
      const record = {
        generatorId: session.generatorId,
        generatorName: specs?.generatorName || generatorSpecs?.generatorName || 'مولدتك',
        ownerName: specs?.ownerName || generatorSpecs?.ownerName || 'صاحب المولدة',
        updatedAt: new Date().toISOString(),
      };
      const next = [record, ...safeList.filter((x: any) => x?.generatorId !== session.generatorId)];
      localStorage.setItem('moldatk_generator_accounts', JSON.stringify(next));
    } catch (e) {}
  };

  const loadCollectorLoginIndex = () => {
    const result: Collector[] = [];
    const seen = new Set<string>();

    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i) || '';
        const match = key.match(/^moldatk_collectors_(.+)$/);
        if (!match) continue;

        const generatorId = match[1];
        const saved = localStorage.getItem(key);
        if (!saved) continue;

        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) continue;

        for (const c of parsed) {
          if (!c?.phone) continue;
          const identity = `${generatorId}:${c.phone}:${c.id || ''}`;
          if (seen.has(identity)) continue;
          seen.add(identity);
          result.push({ ...c, generatorId: c.generatorId || generatorId });
        }
      }

      const legacy = localStorage.getItem('moldatk_collectors');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed)) {
          for (const c of parsed) {
            if (!c?.phone) continue;
            const identity = `${c.generatorId || 'legacy'}:${c.phone}:${c.id || ''}`;
            if (seen.has(identity)) continue;
            seen.add(identity);
            result.push(c);
          }
        }
      }
    } catch (e) {}

    return result;
  };

  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(() => {
    try {
      if (!userSession?.generatorId) return null;
      const cached = localStorage.getItem(`moldatk_subscription_info_${userSession.generatorId}`);
      return cached ? JSON.parse(cached) as SubscriptionInfo : null;
    } catch (e) {
      return null;
    }
  });
  const [subscriptionLoading, setSubscriptionLoading] = useState(() => Boolean(userSession?.generatorId && (userSession.role === 'generator_admin' || userSession.role === 'collector')));
  const [subscriptionUnavailable, setSubscriptionUnavailable] = useState(false);

  const [darkMode, setDarkMode] = useState<boolean>(false);
  const isMobileViewport = useIsMobileViewport();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [viewMode, setViewMode] = useState<any>(() => {
    try {
      return localStorage.getItem('moldatk_view_mode') || 'auto';
    } catch (e) {
      return 'auto';
    }
  });

  // WORKMODE_APP_MOBILE_THEME_STATE
  const [mobileTheme, setMobileTheme] = useState<string>(() => {
    try { return localStorage.getItem('moldatk_mobile_theme') || 'ocean-calm'; } catch (e) { return 'ocean-calm'; }
  });

  const markLocalWrite = () => {
    try {
      if (userSession?.generatorId) localStorage.setItem(getStorageKey('moldatk_last_local_write'), String(Date.now()));
    } catch (e) {}
  };

  // تطبيق الثيم فعلياً على عنصر html حتى تعمل جميع dark: classes وتبقى ألوان الواجهة صحيحة.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem('moldatk_view_mode', viewMode);
    } catch (e) {}
  }, [viewMode]);

  useEffect(() => {
    try {
      localStorage.setItem('moldatk_mobile_theme', mobileTheme);
      document.documentElement.setAttribute('data-moldatk-theme', mobileTheme);
    } catch (e) {}
  }, [mobileTheme]);

  useEffect(() => {
    const expired = () => showToast('انتهت الجلسة، سجل دخولك من جديد حتى تستمر المزامنة');
    window.addEventListener('moldatk-auth-expired', expired as EventListener);
    return () => window.removeEventListener('moldatk-auth-expired', expired as EventListener);
  }, []);

  const [subscribers, setSubscribers] = useState<Subscriber[]>(() =>
    readLocalJson<Subscriber[]>(
      'moldatk_subscribers',
      userSession?.role === 'generator_admin' ? [] : INITIAL_SUBSCRIBERS
    )
  );

  const [monthlyTariffs, setMonthlyTariffs] = useState<MonthlyTariffRecord[]>(() =>
    readLocalJson<MonthlyTariffRecord[]>('moldatk_monthly_tariffs', INITIAL_MONTHLY_TARIFFS)
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() =>
    readLocalJson<AuditLogEntry[]>('moldatk_audit_logs', [])
  );
  const [walletResetTimestamp, setWalletResetTimestamp] = useState<string>(() => {
    try { return localStorage.getItem(getStorageKey('moldatk_wallet_reset_timestamp')) || ''; }
    catch (e) { return ''; }
  });
  const [generatorSpecs, setGeneratorSpecs] = useState<GeneratorSpecs>(() =>
    readLocalJson<GeneratorSpecs>('moldatk_generator', INITIAL_GENERATOR_SPECS)
  );
  const [lines, setLines] = useState<LineDistribution[]>(() =>
    readLocalJson<LineDistribution[]>(
      'moldatk_lines',
      userSession?.role === 'generator_admin' ? [] : INITIAL_LINES
    )
  );
  const [collectors, setCollectors] = useState<Collector[]>(() =>
    readLocalJson<Collector[]>(
      'moldatk_collectors',
      userSession?.role === 'generator_admin' ? [] : INITIAL_COLLECTORS
    )
  );

  // حسابات الجباة مصدرها Supabase، وليس localStorage فقط.
  // هذا يمنع ظهور جابي وهمي بالواجهة بدون Auth/Profile حقيقي في السيرفر.
  useEffect(() => {
    if (userSession?.role !== 'generator_admin' || !userSession.generatorId) return;
    let cancelled = false;
    void loadCloudCollectors(userSession.generatorId)
      .then(remoteCollectors => {
        if (cancelled) return;
        const scopedCollectors = remoteCollectors.map(c => ({ ...c, generatorId: userSession.generatorId }));
        setCollectors(scopedCollectors);
        try {
          localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(scopedCollectors));
          markLocalWrite();
        window.dispatchEvent(new Event('moldatk-local-sync'));
        } catch (e) {}
      })
      .catch(error => {
        console.error('Failed to load cloud collectors:', error);
        showToast('تعذر تحميل حسابات الجباة من السيرفر');
      });
    return () => { cancelled = true; };
  }, [userSession?.role, userSession?.generatorId]);

  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [activeSettingsFolderKey, setActiveSettingsFolderKey] = useState<string | null>(null);
  const [invoiceTemplate, setInvoiceTemplate] = useState<InvoiceTemplateSettings>(() => {
    try {
      const saved = localStorage.getItem(getStorageKey('moldatk_invoice_template'));
      return normalizeInvoiceTemplate(saved ? JSON.parse(saved) : INITIAL_INVOICE_TEMPLATE);
    } catch (e) {
      return normalizeInvoiceTemplate(INITIAL_INVOICE_TEMPLATE);
    }
  });

  const settingsFolders: SettingsFolderItem[] = INITIAL_SETTINGS_FOLDERS;


  useEffect(() => {
    if (!userSession) return;

    const isScopedAccount = (userSession.role === 'generator_admin' || userSession.role === 'collector') && !!userSession.generatorId;

    setSubscribers(readLocalJson<Subscriber[]>(
      'moldatk_subscribers',
      isScopedAccount ? [] : INITIAL_SUBSCRIBERS,
      userSession
    ));

    setCollectors(readLocalJson<Collector[]>(
      'moldatk_collectors',
      isScopedAccount ? [] : INITIAL_COLLECTORS,
      userSession
    ));

    setLines(readLocalJson<LineDistribution[]>(
      'moldatk_lines',
      isScopedAccount ? [] : INITIAL_LINES,
      userSession
    ));

    setMonthlyTariffs(readLocalJson<MonthlyTariffRecord[]>(
      'moldatk_monthly_tariffs',
      INITIAL_MONTHLY_TARIFFS,
      userSession
    ));

    setAuditLogs(readLocalJson<AuditLogEntry[]>('moldatk_audit_logs', [], userSession));

    try {
      setWalletResetTimestamp(localStorage.getItem(getStorageKey('moldatk_wallet_reset_timestamp', userSession)) || '');
    } catch (e) {
      setWalletResetTimestamp('');
    }

    setGeneratorSpecs(readGeneratorSpecsForSession(userSession));
    setInvoiceTemplate(normalizeInvoiceTemplate(
      readLocalJson<InvoiceTemplateSettings>('moldatk_invoice_template', INITIAL_INVOICE_TEMPLATE, userSession)
    ));
  }, [userSession?.role, userSession?.generatorId]);

  useEffect(() => {
    if (!userSession?.generatorId || (userSession.role !== 'generator_admin' && userSession.role !== 'collector')) return;

    const refreshScopedData = () => {
      setSubscribers(readLocalJson<Subscriber[]>('moldatk_subscribers', [], userSession));
      setCollectors(readLocalJson<Collector[]>('moldatk_collectors', [], userSession));
      setLines(readLocalJson<LineDistribution[]>('moldatk_lines', [], userSession));
      setMonthlyTariffs(readLocalJson<MonthlyTariffRecord[]>('moldatk_monthly_tariffs', INITIAL_MONTHLY_TARIFFS, userSession));
      setAuditLogs(readLocalJson<AuditLogEntry[]>('moldatk_audit_logs', [], userSession));
      setGeneratorSpecs(readGeneratorSpecsForSession(userSession));
      setInvoiceTemplate(normalizeInvoiceTemplate(
        readLocalJson<InvoiceTemplateSettings>('moldatk_invoice_template', INITIAL_INVOICE_TEMPLATE, userSession)
      ));
      try {
        setWalletResetTimestamp(localStorage.getItem(getStorageKey('moldatk_wallet_reset_timestamp', userSession)) || '');
      } catch (e) {
        setWalletResetTimestamp('');
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key.endsWith(`_${userSession.generatorId}`)) refreshScopedData();
    };
    const handleLocalSync = () => refreshScopedData();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('moldatk-local-sync', handleLocalSync);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('moldatk-local-sync', handleLocalSync);
    };
  }, [userSession?.role, userSession?.generatorId]);

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedReceiptSubscriber, setSelectedReceiptSubscriber] = useState<Subscriber | null>(null);
  const [selectedReceiptInvoice, setSelectedReceiptInvoice] = useState<SubscriberInvoice | null>(null);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(true);

  const [isSubscriberModalOpen, setIsSubscriberModalOpen] = useState(false);
  const [subscriberToEdit, setSubscriberToEdit] = useState<Subscriber | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const lastBackPressRef = useRef(0);
  const pwaBackLockRef = useRef(0);

  useEffect(() => {
    const performLogicalBack = () => {
      if (isReceiptModalOpen) {
        setIsReceiptModalOpen(false);
        setSelectedReceiptSubscriber(null);
        setSelectedReceiptInvoice(null);
        return true;
      }
      if (isSubscriberModalOpen) {
        setIsSubscriberModalOpen(false);
        setSubscriberToEdit(null);
        return true;
      }
      if (pricingModalOpen) {
        setPricingModalOpen(false);
        return true;
      }
      if (activeSettingsFolderKey) {
        setActiveSettingsFolderKey(null);
        return true;
      }
      if (activeTab !== 'dashboard') {
        setActiveTab('dashboard');
        return true;
      }
      return false;
    };

    const handleAndroidBack = () => {
      if (performLogicalBack()) return;
      const now = Date.now();
      if (now - lastBackPressRef.current <= 2000) {
        lastBackPressRef.current = 0;
        void BackNavigation.exitApp();
        return;
      }
      lastBackPressRef.current = now;
      showToast('اضغط رجوع مرة ثانية للخروج من التطبيق');
    };

    const nativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    if (nativeAndroid) window.addEventListener('moldatk-android-back', handleAndroidBack);

    const browserMobile = !Capacitor.isNativePlatform() && isMobileViewport;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartAt = 0;
    let touchEdge: 'left' | 'right' | null = null;

    const handlePwaBack = () => {
      const now = Date.now();
      if (now - pwaBackLockRef.current < 450) return false;
      const handled = performLogicalBack();
      if (handled) pwaBackLockRef.current = now;
      return handled;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) { touchEdge = null; return; }
      const touch = event.touches[0];
      const edgeWidth = Math.min(34, Math.max(24, window.innerWidth * 0.07));
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartAt = Date.now();
      touchEdge = touchStartX <= edgeWidth ? 'left' : touchStartX >= window.innerWidth - edgeWidth ? 'right' : null;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!touchEdge || event.changedTouches.length !== 1) { touchEdge = null; return; }
      const touch = event.changedTouches[0];
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      const duration = Date.now() - touchStartAt;
      const inwardSwipe = touchEdge === 'left' ? dx >= 68 : dx <= -68;
      const mostlyHorizontal = Math.abs(dx) >= Math.max(68, Math.abs(dy) * 1.25);
      if (duration <= 800 && inwardSwipe && mostlyHorizontal) handlePwaBack();
      touchEdge = null;
    };

    const pushPwaGuard = () => {
      const current = window.history.state && typeof window.history.state === 'object' ? window.history.state : {};
      if (!(current as any).moldatkPwaBackGuard) {
        window.history.pushState({ ...current, moldatkPwaBackGuard: true }, document.title, window.location.href);
      }
    };

    const onPopState = () => {
      if (handlePwaBack()) {
        const current = window.history.state && typeof window.history.state === 'object' ? window.history.state : {};
        window.history.pushState({ ...current, moldatkPwaBackGuard: true }, document.title, window.location.href);
      }
      // On dashboard, do not trap the browser/system back action.
    };

    if (browserMobile) {
      pushPwaGuard();
      window.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('touchend', onTouchEnd, { passive: true });
      window.addEventListener('popstate', onPopState);
    }

    return () => {
      if (nativeAndroid) window.removeEventListener('moldatk-android-back', handleAndroidBack);
      if (browserMobile) {
        window.removeEventListener('touchstart', onTouchStart);
        window.removeEventListener('touchend', onTouchEnd);
        window.removeEventListener('popstate', onPopState);
      }
    };
  }, [isReceiptModalOpen, isSubscriberModalOpen, pricingModalOpen, activeSettingsFolderKey, activeTab, isMobileViewport]);

  // تسجيل جهاز صاحب المولدة في Firebase Cloud Messaging وحفظ Token في Supabase.
  // يعمل فقط داخل تطبيق Android الحقيقي، ولا يشتغل عند فتح النسخة من المتصفح.
  useEffect(() => {
    if (!ENABLE_NATIVE_PUSH || !['generator_admin', 'collector', 'super_admin', 'super_admin_manager'].includes(String(userSession?.role || '')) || !Capacitor.isNativePlatform()) return;

    let disposed = false;
    const listenerHandles: Array<{ remove: () => Promise<void> }> = [];

    const setupPushNotifications = async () => {
      try {
        let permission = await PushNotifications.checkPermissions();
        if (permission.receive === 'prompt') {
          permission = await PushNotifications.requestPermissions();
        }

        if (permission.receive !== 'granted') {
          showToast('فعّل إذن الإشعارات حتى تستلم تنبيهات الصيانة والتحديثات');
          return;
        }

        if (Capacitor.getPlatform() === 'android') {
          try {
            await PushNotifications.createChannel({
              id: 'molidatk_general',
              name: 'إشعارات مولدتك',
              description: 'الصيانة والعروض وتحديثات النظام',
              importance: 5,
              visibility: 1,
              vibration: true,
            });
          } catch (channelError) {
            console.warn('Could not create Android notification channel:', channelError);
          }
        }

        listenerHandles.push(await PushNotifications.addListener('registration', async ({ value }) => {
          if (disposed || !value) return;
          const { error } = await supabase.functions.invoke('register-device-token', {
            body: {
              token: value,
              platform: Capacitor.getPlatform(),
              device_name: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 180) : 'Android',
            },
          });
          if (error) {
            console.error('Push token registration failed:', error);
            showToast('تعذر ربط الجهاز بالإشعارات، حاول تسجيل الدخول مرة أخرى');
          } else {
            console.info('Push notifications device registered successfully');
          }
        }));

        listenerHandles.push(await PushNotifications.addListener('registrationError', (error) => {
          console.error('Push notification registration error:', error);
          showToast('تعذر تفعيل إشعارات الجهاز');
        }));

        listenerHandles.push(await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          const title = notification.title || 'إشعار جديد من مولدتك';
          showToast(title);
        }));

        listenerHandles.push(await PushNotifications.addListener('pushNotificationActionPerformed', () => {
          // يفتح التطبيق بشكل طبيعي عند الضغط على الإشعار.
        }));

        await PushNotifications.register();
      } catch (error) {
        console.error('Push notifications setup failed:', error);
      }
    };

    void setupPushNotifications();

    return () => {
      disposed = true;
      for (const handle of listenerHandles) void handle.remove();
    };
  }, [userSession?.role, userSession?.generatorId]);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUserSession(null);
      setSubscriptionInfo(null);
      try { localStorage.removeItem('moldatk_session'); } catch {}
      void supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      showToast('انتهت جلسة الدخول، سجل الدخول مرة أخرى');
    };

    window.addEventListener('moldatk-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('moldatk-auth-expired', handleAuthExpired);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // SUBSCRIPTION_ACCESS_RPC_V2
    // Owner and collector use the exact same server-authoritative subscription decision.
    // The RPC evaluates starts_at/ends_at with Postgres now(), so a device clock or stale
    // local cache cannot falsely mark an active account as expired.
    const loadSubscription = async (showBlockingLoader = false) => {
      if (!userSession || (userSession.role !== 'generator_admin' && userSession.role !== 'collector') || !userSession.generatorId) {
        setSubscriptionInfo(null);
        setSubscriptionUnavailable(false);
        setSubscriptionLoading(false);
        return;
      }

      if (showBlockingLoader) setSubscriptionLoading(true);

      const { data, error } = await supabase.rpc('get_my_subscription_access_state');
      if (cancelled) return;

      if (error || !data?.ok) {
        setSubscriptionUnavailable(true);
        try {
          const cached = localStorage.getItem(`moldatk_subscription_info_${userSession.generatorId}`);
          if (cached) setSubscriptionInfo(JSON.parse(cached) as SubscriptionInfo);
        } catch (e) {}
        if (showBlockingLoader) setSubscriptionLoading(false);
        return;
      }

      setSubscriptionUnavailable(false);

      const generator = data.generator || {};
      const subscription = data.subscription || null;
      const serverNow = String(data.serverNow || new Date().toISOString());

      const nextSubscriptionInfo: SubscriptionInfo = {
        generatorId: String(generator.id || userSession.generatorId),
        generatorName: String(generator.name || 'مولدتك'),
        ownerName: String(generator.ownerName || 'صاحب المولدة'),
        phone: generator.phone ? String(generator.phone) : null,
        startsAt: String(subscription?.startsAt || serverNow),
        endsAt: String(subscription?.endsAt || serverNow),
        subscriptionStatus: String(subscription?.status || 'missing'),
        accountStatus: String(generator.status || 'active'),
        suspensionReason: generator.suspensionReason ? String(generator.suspensionReason) : null,
        serverAccessActive: Boolean(data.accessActive),
        serverNow,
      };

      setSubscriptionInfo(nextSubscriptionInfo);
      try {
        localStorage.setItem(`moldatk_subscription_info_${userSession.generatorId}`, JSON.stringify(nextSubscriptionInfo));
      } catch (e) {}

      setGeneratorSpecs(prev => {
        const updated = {
          ...prev,
          generatorName: nextSubscriptionInfo.generatorName,
          ownerName: nextSubscriptionInfo.ownerName,
          location: generator.area || prev.location,
        };

        try {
          localStorage.setItem(getStorageKey('moldatk_generator'), JSON.stringify(updated));
          rememberGeneratorAccount(userSession, updated);

          const rawInvoiceSettings = localStorage.getItem(getStorageKey('moldatk_invoice_custom_settings'));
          if (rawInvoiceSettings) {
            const parsedInvoiceSettings = JSON.parse(rawInvoiceSettings);
            localStorage.setItem(
              getStorageKey('moldatk_invoice_custom_settings'),
              JSON.stringify({ ...parsedInvoiceSettings, headerTitle: nextSubscriptionInfo.generatorName })
            );
          }
        } catch (e) {}

        return updated;
      });

      setSubscriptionLoading(false);
    };

    void loadSubscription(true);
    const timer = window.setInterval(() => void loadSubscription(false), 30 * 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [userSession?.role, userSession?.generatorId]);

  const activeMonthRecord = monthlyTariffs.find(m => m.isCurrentActive) || monthlyTariffs[0];
  const pricingTiers: SubscriptionTierPricing[] = activeMonthRecord?.tiers || [];

  const generateUniqueSubscriberCode = (existingSubscribers: Subscriber[]) => {
    const rawPrefix = userSession?.generatorId ? userSession.generatorId.replace(/-/g, '').slice(0, 5).toUpperCase() : 'LOCAL';
    let nextNumber = existingSubscribers.length + 1;
    let code = `MW-${rawPrefix}-${String(nextNumber).padStart(4, '0')}`;
    const used = new Set(existingSubscribers.map(s => s.code || s.subscriberCode).filter(Boolean));
    while (used.has(code)) {
      nextNumber += 1;
      code = `MW-${rawPrefix}-${String(nextNumber).padStart(4, '0')}`;
    }
    return code;
  };



  const handleLoginSuccess = (session: ActiveUserSession) => {
    const accessControlled = session.role === 'generator_admin' || session.role === 'collector';
    setSubscriptionInfo(null);
    setSubscriptionUnavailable(false);
    setSubscriptionLoading(accessControlled);
    setUserSession(session);
    try {
      localStorage.setItem('moldatk_session', JSON.stringify(session));
    } catch (e) {}
    showToast('مرحباً بك! تم تسجيل الدخول بنجاح');
  };

  const handleLogout = () => {
    setSubscriptionInfo(null);
    setSubscriptionUnavailable(false);
    setSubscriptionLoading(false);
    setUserSession(null);
    try {
      localStorage.removeItem('moldatk_session');
    } catch (e) {}
    void supabase.auth.signOut();
    showToast('تم تسجيل الخروج بنجاح');
  };

  const handleOpenPricingModal = () => setPricingModalOpen(true);

  const handleSaveMonthlyTariffs = (updatedTariffs: MonthlyTariffRecord[], activeMonthId: string, shouldRecalculateBills: boolean) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const previousActiveRecord = monthlyTariffs.find(record => record.isCurrentActive) || monthlyTariffs[0];
    const previousActiveId = previousActiveRecord?.id || '';
    const previousTariffIds = new Set(monthlyTariffs.map(record => record.id));

    const normalized = normalizeMonthlyTariffs(updatedTariffs, activeMonthId, now);
    const activeRecord = normalized.find(record => record.isCurrentActive);
    const incomingIds = new Set(normalized.map(record => record.id));

    // Tariff deletions are authoritative and must not return after a realtime/cloud pull.
    try {
      const tombstoneKey = getStorageKey('moldatk_deleted_tariffs');
      const raw = localStorage.getItem(tombstoneKey);
      const parsed = raw ? JSON.parse(raw) : [];
      const tombstones = new Set<string>(Array.isArray(parsed) ? parsed.map(String) : []);
      for (const oldRecord of monthlyTariffs) {
        if (!incomingIds.has(oldRecord.id)) tombstones.add(oldRecord.id);
      }
      for (const currentRecord of normalized) tombstones.delete(currentRecord.id);
      localStorage.setItem(tombstoneKey, JSON.stringify(Array.from(tombstones)));
    } catch (e) {}

    const activationKey = getStorageKey('moldatk_active_monthly_cycle');
    let lastActivatedId = previousActiveId;
    try {
      lastActivatedId = localStorage.getItem(activationKey) || previousActiveId;
    } catch (e) {}

    const requestedAccountingUpdate = Boolean(shouldRecalculateBills && activeRecord);
    const isBrandNewMonth = Boolean(
      requestedAccountingUpdate &&
      activeRecord &&
      (!previousTariffIds.has(activeRecord.id) || activeRecord.id !== lastActivatedId)
    );
    const isSameActiveMonthEdit = Boolean(
      requestedAccountingUpdate &&
      activeRecord &&
      activeRecord.id === previousActiveId &&
      activeRecord.id === lastActivatedId
    );
    const activeMonthChangedWithoutNewCycle = Boolean(
      activeRecord && previousActiveId && activeRecord.id !== previousActiveId && !isBrandNewMonth
    );

    let nextSubscribers = subscribers;
    let subscribersChanged = false;

    // FINANCIAL_DELETE_LOCAL_CLEANUP_V2
    const deletedTariffIds = monthlyTariffs.filter(record => !incomingIds.has(record.id)).map(record => record.id);
    if (deletedTariffIds.length) {
      nextSubscribers = extinguishDeletedTariffLiabilities(nextSubscribers, deletedTariffIds, activeRecord?.id || '');
      subscribersChanged = true;
    }

    if (!activeRecord || normalized.length === 0) {
      // Empty tariff list = no current monthly billing cycle. Historical invoices stay intact.
      nextSubscribers = zeroLiveMonthlyCycle(nextSubscribers);
      subscribersChanged = true;
      try { localStorage.removeItem(activationKey); } catch (e) {}
    } else if (isBrandNewMonth) {
      // THIS is the only place where paid/partial counters are reset.
      // Old unpaid balances remain in historical invoices and become carried debt.
      nextSubscribers = startFreshMonthlyCycle(nextSubscribers, previousActiveRecord, activeRecord, now);
      subscribersChanged = true;
      try { localStorage.setItem(activationKey, activeRecord.id); } catch (e) {}
    } else if (isSameActiveMonthEdit) {
      // Editing prices in the already-active month must NEVER erase payments.
      nextSubscribers = repriceActiveMonthlyCycle(nextSubscribers, activeRecord, now);
      subscribersChanged = true;
    } else if (activeMonthChangedWithoutNewCycle || (previousActiveId && !incomingIds.has(previousActiveId))) {
      // Deleting the active tariff and falling back to an older remaining month restores that
      // month's existing ledger instead of inventing a new bill or keeping the deleted month live.
      nextSubscribers = summarizeExistingMonthlyCycle(nextSubscribers, activeRecord);
      subscribersChanged = true;
      try { localStorage.setItem(activationKey, activeRecord.id); } catch (e) {}
    }

    setMonthlyTariffs(normalized);
    if (subscribersChanged) setSubscribers(nextSubscribers);

    try {
      localStorage.setItem(getStorageKey('moldatk_monthly_tariffs'), JSON.stringify(normalized));
      if (subscribersChanged) {
        localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(nextSubscribers));
      }
      // Persist BOTH snapshots before sync can pull an older server state back into the UI.
      window.dispatchEvent(new Event('moldatk-local-sync'));
    } catch (e) {}

    addAuditLog({
      category: 'pricing',
      title: !activeRecord
        ? 'إيقاف الدورة الشهرية'
        : isBrandNewMonth
        ? 'اعتماد دورة شهرية جديدة'
        : isSameActiveMonthEdit
        ? 'تعديل تسعيرة الشهر النشط'
        : 'تحديث سجل التسعيرات',
      details: !activeRecord
        ? 'تم حذف جميع التسعيرات وتصفير الحالة الشهرية الحالية مع إبقاء السجل التاريخي محفوظاً'
        : isBrandNewMonth
        ? 'تم اعتماد ' + (activeRecord.monthNameAr || activeRecord.id) + ' كدورة جديدة: تصفير المسدد للشهر الجديد، إعادة المشتركين غير المجانيين إلى غير مسدد، وترحيل الديون السابقة بدون حذفها'
        : isSameActiveMonthEdit
        ? 'تم تعديل أسعار ' + (activeRecord.monthNameAr || activeRecord.id) + ' بدون تصفير أو حذف أي تسديد مسجل في نفس الشهر'
        : 'تم تحديث سجل التسعيرات مع الحفاظ على السجل المحاسبي',
      entityName: activeRecord?.monthNameAr || activeRecord?.id || 'بدون تسعيرة',
      newValue: JSON.stringify({
        activeMonthId: activeRecord?.id || null,
        monthlyCycleReset: isBrandNewMonth,
        tariffsCount: normalized.length,
        updatedAt: nowIso,
      }),
      actorName: userSession?.username || userSession?.collectorName || 'مدير المنظومة',
    });

    showToast(!activeRecord
      ? 'تم حذف جميع التسعيرات وتصفير الحالة الشهرية الحالية'
      : isBrandNewMonth
      ? 'تم اعتماد الشهر الجديد وتصفير المسدد وترحيل الديون السابقة'
      : isSameActiveMonthEdit
      ? 'تم حفظ التسعيرة بدون المساس بالتسديدات الحالية'
      : 'تم تحديث سجل التسعيرات');
  };


  const handleUpdateCollectors = async (newCollectors: Collector[]) => {
    const normalizePhone = (value: string) => String(value || '').replace(/\D/g, '');
    const seenPhones = new Set<string>();
    const scopedCollectors = newCollectors.map(item => ({
      ...item,
      generatorId: userSession?.generatorId || item.generatorId || undefined,
      phone: normalizePhone(item.phone),
    }));

    for (const collector of scopedCollectors) {
      if (collector.phone.length < 10) throw new Error('invalid_collector_phone');
      if (seenPhones.has(collector.phone)) throw new Error('duplicate_collector_phone');
      seenPhones.add(collector.phone);
      const pin = String(collector.passcode || '').trim();
      if (pin && !/^\d{4,8}$/.test(pin)) throw new Error('invalid_collector_pin');
    }

    const previous = collectors;
    if (userSession?.role !== 'generator_admin' || !userSession.generatorId) {
      setCollectors(scopedCollectors);
      localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(scopedCollectors));
      window.dispatchEvent(new Event('moldatk-local-sync'));
      return;
    }

    try {
      const saved = await syncCloudCollectorRoster(scopedCollectors);
      setCollectors(saved);
      localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(saved));
      window.dispatchEvent(new Event('moldatk-local-sync'));
      showToast('تم حفظ بيانات الجباة وتحديث تسجيل الدخول');
    } catch (error) {
      setCollectors(previous);
      try { localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(previous)); } catch (e) {}
      throw error;
    }
  };

  const handleOpenFolderModal = (folderKey: string) => setActiveSettingsFolderKey(folderKey);

  const handleExportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      subscribers,
      collectors,
      lines,
      generatorSpecs,
      monthlyTariffs,
      invoiceTemplate,
      auditLogs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'molidatk-backup.json';
    link.click();
    URL.revokeObjectURL(url);
    showToast('تم تصدير النسخة الاحتياطية');
  };

  const handleImportBackup = (jsonData: any) => {
    if (!jsonData || typeof jsonData !== 'object') return;

    if (Array.isArray(jsonData.subscribers)) {
      setSubscribers(jsonData.subscribers);
      localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(jsonData.subscribers));
    }
    if (Array.isArray(jsonData.collectors)) {
      setCollectors(jsonData.collectors);
      localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(jsonData.collectors));
    }
    if (Array.isArray(jsonData.lines)) {
      setLines(jsonData.lines);
      localStorage.setItem(getStorageKey('moldatk_lines'), JSON.stringify(jsonData.lines));
    }
    if (jsonData.generatorSpecs) {
      setGeneratorSpecs(jsonData.generatorSpecs);
      localStorage.setItem(getStorageKey('moldatk_generator'), JSON.stringify(jsonData.generatorSpecs));
    }
    if (Array.isArray(jsonData.monthlyTariffs)) {
      setMonthlyTariffs(jsonData.monthlyTariffs);
      localStorage.setItem(getStorageKey('moldatk_monthly_tariffs'), JSON.stringify(jsonData.monthlyTariffs));
    }
    if (jsonData.invoiceTemplate) {
      const restoredTemplate = normalizeInvoiceTemplate(jsonData.invoiceTemplate);
      setInvoiceTemplate(restoredTemplate);
      localStorage.setItem(getStorageKey('moldatk_invoice_template'), JSON.stringify(restoredTemplate));
    }
    if (Array.isArray(jsonData.auditLogs)) {
      setAuditLogs(jsonData.auditLogs);
      localStorage.setItem(getStorageKey('moldatk_audit_logs'), JSON.stringify(jsonData.auditLogs));
    }

    showToast('تمت استعادة النسخة الاحتياطية بنجاح');
  };

  const handleResetFactoryData = () => {
    const resetSubscribers: Subscriber[] = [];
    const resetCollectors: Collector[] = [];
    const resetLines: LineDistribution[] = [];
    const resetTariffs = INITIAL_MONTHLY_TARIFFS.map((m, index) => ({ ...m, isCurrentActive: index === 0 }));
    const resetGenerator = generatorSpecs;
    const resetInvoiceTemplate = INITIAL_INVOICE_TEMPLATE;

    setSubscribers(resetSubscribers);
    setCollectors(resetCollectors);
    setLines(resetLines);
    setMonthlyTariffs(resetTariffs);
    setGeneratorSpecs(resetGenerator);
    setInvoiceTemplate(resetInvoiceTemplate);
    setAuditLogs([]);

    localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(resetSubscribers));
    localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(resetCollectors));
    localStorage.setItem(getStorageKey('moldatk_lines'), JSON.stringify(resetLines));
    localStorage.setItem(getStorageKey('moldatk_monthly_tariffs'), JSON.stringify(resetTariffs));
    localStorage.setItem(getStorageKey('moldatk_generator'), JSON.stringify(resetGenerator));
    localStorage.setItem(getStorageKey('moldatk_invoice_template'), JSON.stringify(resetInvoiceTemplate));
    localStorage.setItem(getStorageKey('moldatk_audit_logs'), JSON.stringify([]));

    showToast('تم تصفير بيانات هذا الحساب بنجاح');
  };

  const handleUpdateInvoiceTemplate = (template: InvoiceTemplateSettings) => {
    const normalized = normalizeInvoiceTemplate(template);
    setInvoiceTemplate(normalized);
    try {
      localStorage.setItem(getStorageKey('moldatk_invoice_template'), JSON.stringify(normalized));
      // Keep one canonical source and wake the event-driven cloud synchronizer.
      markLocalWrite();
      window.dispatchEvent(new Event('moldatk-local-sync'));
    } catch (e) {}
    showToast('تم حفظ إعدادات الفواتير والطباعة وتطبيقها فعلياً');
  };

  const handleSaveSubscriber = async (newSub: Subscriber) => {
    const matchedTier = pricingTiers.find(t => t.id === newSub.tier || t.type === newSub.tier);
    const matchedLine = lines.find(l => l.id === newSub.lineId || l.name === newSub.lineName || l.name === newSub.line);
    const rawTier = String(newSub.tier || 'normal').replace(/^tier-/, '');
    const normalizedTier = (matchedTier?.type || (['normal', 'commercial', 'golden', 'free', 'custom'].includes(rawTier) ? rawTier : 'normal')) as Subscriber['tier'];
    const normalizedSub: Subscriber = {
      ...newSub,
      code: newSub.code || newSub.subscriberCode || generateUniqueSubscriberCode(subscribers),
      subscriberCode: newSub.subscriberCode || newSub.code || generateUniqueSubscriberCode(subscribers),
      tier: normalizedTier,
      lineId: matchedLine?.id || newSub.lineId,
      line: matchedLine?.name || newSub.line || newSub.lineName,
      lineName: matchedLine?.name || newSub.lineName || newSub.line,
    };

    // Local-first: payment/status changes become visible immediately and never wait for network.
    setSubscribers(prev => {
      const exists = prev.some(s => s.id === normalizedSub.id);
      const updated = exists ? prev.map(s => (s.id === normalizedSub.id ? normalizedSub : s)) : [normalizedSub, ...prev];
      try {
        localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated));
        window.dispatchEvent(new Event('moldatk-local-sync'));
      } catch (e) {}
      return updated;
    });
    setSubscriberToEdit(normalizedSub);

    const shouldSyncCloud = (userSession?.role === 'generator_admin' || userSession?.role === 'collector') && Boolean(userSession.generatorId);
    const onlineNow = typeof navigator === 'undefined' ? true : navigator.onLine;
    let cloudSynced = false;

    if (shouldSyncCloud && onlineNow && userSession?.generatorId) {
      try {
        await persistCollectorSubscriber(userSession.generatorId, normalizedSub);
        cloudSynced = true;
      } catch (error: any) {
        console.error('Subscriber cloud save deferred:', error);
      }
    }

    if (shouldSyncCloud && !cloudSynced) {
      try {
        window.dispatchEvent(new CustomEvent('moldatk-sync-progress', { detail: { active: false, progress: 0, pending: true, message: 'محفوظ محلياً — بانتظار المزامنة' } }));
      } catch (e) {}
      showToast(onlineNow ? 'تم الحفظ محلياً وستتم إعادة المزامنة تلقائياً' : 'تم الحفظ بدون إنترنت وسيتم رفعه عند رجوع الاتصال');
    } else {
      showToast('تم حفظ بيانات المشترك ومزامنتها بنجاح');
    }
  };

  const handleDeleteSubscriberPermanent = async (subId: string) => {
    if (!subId) return;

    // Legacy local-only admin mode has no cloud account. Production generator
    // owners always use the protected permanent server purge below.
    if (userSession?.role === 'admin' && !userSession.generatorId) {
      setSubscribers(prev => {
        const updated = prev.filter(sub => sub.id !== subId);
        try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
      setIsSubscriberModalOpen(false);
      showToast('تم حذف المشترك محلياً');
      return;
    }

    if (userSession?.role !== 'generator_admin' || !userSession.generatorId) {
      showToast('حذف المشترك متاح لصاحب المولدة فقط');
      return;
    }

    const { data, error } = await supabase.functions.invoke('generator-data-admin', {
      body: { action: 'delete_subscriber', subscriber_id: subId },
    });
    if (error || !data?.ok) {
      showToast('تعذر حذف المشترك نهائياً: ' + (data?.error || error?.message || 'خطأ غير معروف'));
      return;
    }
    const { data: cleanupData, error: cleanupError } = await supabase.functions.invoke('generator-data-cleanup', {
      body: { action: 'delete_subscriber_extras', subscriber_id: subId },
    });
    if (cleanupError || !cleanupData?.ok) {
      console.error('Subscriber extra-data cleanup failed:', cleanupError || cleanupData?.error);
    }

    setSubscribers(prev => {
      const updated = prev.filter(sub => sub.id !== subId);
      try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    setAuditLogs(prev => {
      const updated = prev.filter(log => log.entityId !== subId);
      try { localStorage.setItem(getStorageKey('moldatk_audit_logs'), JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    try {
      const tombstoneKey = getStorageKey('moldatk_deleted_subscribers');
      const deleted = JSON.parse(localStorage.getItem(tombstoneKey) || '[]') as string[];
      localStorage.setItem(tombstoneKey, JSON.stringify([...new Set([...deleted, subId])]));
    } catch (e) {}

    if (subscriberToEdit?.id === subId) setSubscriberToEdit(null);
    if (selectedReceiptSubscriber?.id === subId) {
      setSelectedReceiptSubscriber(null);
      setSelectedReceiptInvoice(null);
      setIsReceiptModalOpen(false);
    }
    setIsSubscriberModalOpen(false);
    window.dispatchEvent(new Event('moldatk-local-sync'));
    showToast('تم حذف المشترك وجميع فواتيره وديونه وتسديداته نهائياً');
  };

  const addAuditLog = (entry: any) => {
    if (!hasMonthlyPricing(pricingTiers) && ['payment', 'cancellation'].includes(entry.category)) return;
    const newLog = {
      ...entry,
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs(prev => {
      const updated = [newLog, ...prev] as AuditLogEntry[];
      try {
        localStorage.setItem(getStorageKey('moldatk_audit_logs'), JSON.stringify(updated));
        markLocalWrite();
        window.dispatchEvent(new Event('moldatk-local-sync'));
      } catch (e) {}
      return updated;
    });
  };

  if (!userSession) {
    return <LoginView collectors={forceSuperAdmin ? [] : loadCollectorLoginIndex()} onLoginSuccess={handleLoginSuccess} />;
  }

  if (forceSuperAdmin && userSession.role !== 'super_admin' && userSession.role !== 'super_admin_manager') {
    return <LoginView collectors={[]} onLoginSuccess={handleLoginSuccess} />;
  }

  if (userSession.role === 'super_admin' || userSession.role === 'super_admin_manager') {
    return <Suspense fallback={<div role="status">جاري التحميل...</div>}><SuperAdminDashboard onLogout={handleLogout} /></Suspense>;
  }

  const subscriptionAccessControlled = userSession.role === 'generator_admin' || userSession.role === 'collector';

  // SUBSCRIPTION_LOCK_STABILITY_V1: a refresh may update data, but it can never temporarily expose the app.
  if (subscriptionAccessControlled && subscriptionInfo?.accountStatus === 'suspended') {
    return <SuspendedAccountScreen reason={subscriptionInfo.suspensionReason} onLogout={handleLogout} />;
  }

  if (subscriptionAccessControlled && subscriptionInfo) {
    const legacyExpired = subscriptionInfo.serverAccessActive == null
      && (subscriptionInfo.subscriptionStatus !== 'active' || daysUntilExpiry(subscriptionInfo.endsAt) <= 0);
    if (subscriptionInfo.serverAccessActive === false || legacyExpired) {
      return <ExpiredSubscriptionScreen onLogout={handleLogout} />;
    }
  }

  if (subscriptionAccessControlled && !subscriptionInfo) {
    if (subscriptionLoading) {
      return (
        <div dir="rtl" className="min-h-screen bg-[#F7F9FC] dark:bg-[#081521] flex items-center justify-center p-5 font-['Cairo',sans-serif]">
          <div className="w-full max-w-md bg-white dark:bg-[#111c38] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-8 text-center">
            <div className="w-10 h-10 mx-auto rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin mb-4" />
            <div className="font-black text-slate-900 dark:text-white">جاري التحقق من حالة الاشتراك...</div>
          </div>
        </div>
      );
    }
    if (subscriptionUnavailable) {
      return <SubscriptionUnavailableScreen onRetry={() => window.location.reload()} onLogout={handleLogout} />;
    }
    return <ExpiredSubscriptionScreen onLogout={handleLogout} />;
  }

  const reportResetMarkers = auditLogs
    .filter(log => log.title === 'تصفير تقارير السنة' && log.newValue)
    .map(log => {
      try { return JSON.parse(log.newValue || '{}') as { year: number; resetAt: string }; } catch { return null; }
    })
    .filter((x): x is { year: number; resetAt: string } => Boolean(x && Number.isFinite(Number(x.year)) && x.resetAt));

  const handleResetReportYear = (year: number) => {
    if (userSession?.role !== 'generator_admin') {
      showToast('هذه الصلاحية متاحة لصاحب المولدة فقط');
      return;
    }
    const marker = { year, resetAt: new Date().toISOString() };
    addAuditLog({
      category: 'system',
      title: 'تصفير تقارير السنة',
      details: 'تم تصفير عرض حسابات التقارير لسنة ' + year + ' بدون حذف الديون أو الفواتير الأصلية',
      entityName: String(year),
      newValue: JSON.stringify(marker),
      actorName: userSession?.username || 'صاحب المولدة',
    });
    showToast('تم تصفير حسابات التقارير لسنة ' + year);
  };

  const handleSecureSystemReset = async (password: string): Promise<SecureResetResult> => {
    if (userSession?.role !== 'generator_admin' || !userSession.generatorId) {
      return { ok: false, message: 'هذه العملية متاحة لصاحب المولدة فقط.' };
    }
    const generatorId = userSession.generatorId;
    const markerKey = getStorageKey('moldatk_factory_reset_in_progress');

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const email = userData.user?.email || userSession.email;
      if (!email) return { ok: false, message: 'تعذر تحديد بريد حساب صاحب المولدة.' };

      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) return { ok: false, message: 'كلمة المرور غير صحيحة. لم يتم حذف أي بيانات.' };

      const backup = {
        exportedAt: new Date().toISOString(),
        generatorId,
        generatorSpecs,
        subscribers,
        monthlyTariffs,
        auditLogs,
        lines,
        collectors,
        invoiceTemplate,
        walletResetTimestamp,
      };
      try {
        localStorage.setItem('moldatk_emergency_backup_last_' + generatorId + '_SAFE', JSON.stringify(backup));
      } catch (backupError) {
        console.warn('Could not keep local emergency backup:', backupError);
      }

      const isIOSBrowser = /iPad|iPhone|iPod/i.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const shouldAutoDownloadBackup = !isIOSBrowser && !Capacitor.isNativePlatform();
      if (shouldAutoDownloadBackup) {
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'moldatk-backup-before-reset-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        console.info('Reset backup kept safely inside Moldatk; automatic file preview skipped on iOS/native app.');
      }

      // Freeze both push and pull before the server purge starts. The marker is
      // removed only after the local scoped cache is empty as well.
      localStorage.setItem(markerKey, '1');

      const { data: resetData, error: resetError } = await supabase.functions.invoke('generator-data-admin', {
        body: { action: 'reset_generator_data' },
      });
      if (resetError || !resetData?.ok) {
        throw new Error(resetData?.error || resetError?.message || 'تعذر تصفير البيانات السحابية');
      }
      const { data: cleanupData, error: cleanupError } = await supabase.functions.invoke('generator-data-cleanup', {
        body: { action: 'reset_extras' },
      });
      if (cleanupError || !cleanupData?.ok) throw new Error(cleanupData?.error || cleanupError?.message || 'تعذر تنظيف البيانات الملحقة');

      const scopedSuffix = '_' + generatorId;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const currentKey = localStorage.key(i);
        if (currentKey && currentKey.endsWith(scopedSuffix) && currentKey !== markerKey) keysToRemove.push(currentKey);
      }
      keysToRemove.forEach(currentKey => localStorage.removeItem(currentKey));

      setSubscribers([]);
      setMonthlyTariffs([]);
      setAuditLogs([]);
      setLines([]);
      setCollectors([]);
      setWalletResetTimestamp('');
      setGeneratorSpecs(prev => ({
        ...INITIAL_GENERATOR_SPECS,
        generatorName: prev.generatorName,
        ownerName: prev.ownerName,
        location: prev.location,
      }));
      setInvoiceTemplate(INITIAL_INVOICE_TEMPLATE);
      setSubscriberToEdit(null);
      setSelectedReceiptSubscriber(null);
      setSelectedReceiptInvoice(null);

      localStorage.removeItem(markerKey);
      window.dispatchEvent(new Event('moldatk-local-sync'));
      showToast('تم تصفير بيانات النظام سحابياً ومحلياً بالكامل وإنشاء نسخة احتياطية');
      window.setTimeout(() => window.location.reload(), 900);
      return { ok: true };
    } catch (e: any) {
      localStorage.removeItem(markerKey);
      console.error('Secure Moldatk reset failed:', e);
      return { ok: false, message: 'تعذر إكمال التصفير بأمان: ' + (e?.message || 'خطأ غير معروف') };
    }
  };

  const isAdmin = userSession.role === 'admin' || userSession.role === 'generator_admin';
  const shouldShowMobileLayout =
    isAdmin && (viewMode === 'mobile' || (viewMode === 'auto' && isMobileViewport));

  // إذا كان المستخدم جابي (collector) تفتح واجهة الكادر/POS الميدانية
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#070d1e] text-white">
        {toastMessage && (
          <div className="fixed bottom-20 left-5 z-50 bg-blue-600 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{toastMessage}</span>
          </div>
        )}
        <POSQuickView
          subscribers={subscribers}
          pricingTiers={pricingTiers}
          generatorSpecs={generatorSpecs}
          collectorName={userSession.collectorName || 'جابي ميداني'}
          allowedLineIds={userSession.assignedLineIds || (userSession.assignedLineId ? [userSession.assignedLineId] : [])}
          assignedAllLines={userSession.assignedAllLines === true || (!userSession.assignedLineId && !(userSession.assignedLineIds || []).length)}
          activeMonthId={activeMonthRecord?.id}
          activeMonthNameAr={activeMonthRecord?.monthNameAr}
          collectorPermissions={userSession.collectorPermissions}
          assignedLineId={userSession.assignedLineId}
          collectors={collectors}
          lines={lines}
          onSaveSubscriber={handleSaveSubscriber}
          onAddAuditLog={addAuditLog}
          onLogout={handleLogout}
          onOpenReceiptModal={(sub, inv, autoP) => {
            setSelectedReceiptSubscriber(sub);
            setSelectedReceiptInvoice(inv || null);
            setAutoPrintReceipt(autoP);
            setIsReceiptModalOpen(true);
          }}
          onOpenNewSubscriberModal={() => {
            setSubscriberToEdit(null);
            setIsSubscriberModalOpen(true);
          }}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
        />

        <InvoiceReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => {
            setIsReceiptModalOpen(false);
            setSelectedReceiptSubscriber(null);
            setSelectedReceiptInvoice(null);
          }}
          subscriber={selectedReceiptSubscriber}
          generatorSpecs={generatorSpecs}
          generatorId={userSession?.generatorId}
          pricingTiers={pricingTiers}
          invoiceTemplate={invoiceTemplate}
          autoPrint={autoPrintReceipt}
          invoice={selectedReceiptInvoice}
          onMarkAsPaid={subId => {
            const target = subscribers.find(s => s.id === subId);
            if (target) {
              const calc = calculateSubscriberBill(target.amperes, target.tier, pricingTiers);
              handleSaveSubscriber({ ...target, paymentStatus: 'paid', amountPaid: calc.total });
            }
          }}
        />

        <SubscriberModal
          isOpen={isSubscriberModalOpen}
          onClose={() => setIsSubscriberModalOpen(false)}
          subscriberToEdit={subscriberToEdit}
          pricingTiers={pricingTiers}
          monthlyTariffs={monthlyTariffs}
          lines={userSession.assignedLineId ? lines.filter(l => l.id === userSession.assignedLineId) : lines}
          onSaveSubscriber={handleSaveSubscriber}
          isReadOnlyAmperes={false}
        />
      </div>
    );
  }

  // إذا كانت الشاشة صغيرة (مثل أجهزة SUNMI الميدانية) تُعرض واجهة الهاتف المخصصة
  // بدل واجهة سطح المكتب ذات الشريط الجانبي الواسع التي لا تناسب هذا الحجم.
  if (shouldShowMobileLayout) {
    return (
      <div dir="rtl">
        {subscriptionInfo && <SubscriptionWarningBanner info={subscriptionInfo} />}
        {userSession.role === 'generator_admin' && <GeneratorNotifications hideFloatingTriggers={activeTab === 'settings'} />}
        {userSession.role === 'generator_admin' && <OwnerAIWatcher onOpenAssistant={() => { setActiveTab('settings'); window.setTimeout(() => window.dispatchEvent(new Event('moldatk-open-owner-ai')), 220); }} />}
        {toastMessage && (
          <div className="fixed bottom-20 left-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        <MobileLayout
          activeTab={activeTab}
          onTabChange={setActiveTab}
          subscribers={subscribers}
          pricingTiers={pricingTiers}
              activeMonthId={activeMonthRecord?.id}
          generatorSpecs={generatorSpecs}
          lines={lines}
          folders={settingsFolders}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode(!darkMode)}
          onLogout={handleLogout}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          onOpenPricingModal={handleOpenPricingModal}
          onOpenFolderModal={handleOpenFolderModal}
          onOpenNewSubscriberModal={() => {
            setSubscriberToEdit(null);
            setIsSubscriberModalOpen(true);
          }}
          onOpenSubscriberModal={sub => {
            setSubscriberToEdit(sub || null);
            setIsSubscriberModalOpen(true);
          }}
          onOpenReceiptModal={sub => {
            setSelectedReceiptSubscriber(sub);
            setSelectedReceiptInvoice(null);
            setAutoPrintReceipt(true);
            setIsReceiptModalOpen(true);
          }}
          onDeleteSubscriber={handleDeleteSubscriberPermanent}
          onTogglePaymentStatus={() => {}}
          onUpdateSpecs={newSpecs => setGeneratorSpecs(prev => ({ ...prev, ...newSpecs }))}
          onExportData={handleExportBackup}
          onResetData={handleResetFactoryData}
          subscriptionInfo={subscriptionInfo}
          subscriptionLoading={subscriptionLoading}
          collectors={collectors}
          auditLogs={auditLogs}
          walletResetTimestamp={walletResetTimestamp}
          onClearWalletLogs={async () => {
                const generatorId = userSession?.generatorId;
                if (!generatorId || userSession?.role !== 'generator_admin') return;
                try {
                  // Cashbox reset is a server-authoritative operation and must not be
                  // blocked by an unrelated subscriber/tariff sync failure. Give pending
                  // writes a short best-effort flush window, then reset independently.
                  try {
                    await Promise.race([
                      flushGeneratorSync(generatorId),
                      new Promise((_, reject) => window.setTimeout(() => reject(new Error('sync_flush_timeout')), 2500)),
                    ]);
                  } catch (syncError) {
                    console.warn('Cashbox reset continuing after sync flush warning:', syncError);
                  }
                  const confirmed = await resetCashbox(generatorId);
                  setWalletResetTimestamp(confirmed.reset_at || '');
                  showToast('تم تصفير القاصة وحفظه في السحابة');
                } catch (error) {
                  console.error('Cashbox reset failed:', error);
                  const reason = String((error as any)?.message || (error as any)?.code || '');
                  if (/jwt|auth|token|not_authorized|42501|401|403/i.test(reason)) {
                    showToast('تعذر تأكيد التصفير بسبب الجلسة. سجل الدخول من جديد ثم أعد المحاولة');
                  } else {
                    showToast('تعذر تأكيد تصفير القاصة من السيرفر. أعد المحاولة');
                  }
                }
              }}
          monthlyTariffs={monthlyTariffs}
          reportResetMarkers={reportResetMarkers}
          onResetReportYear={handleResetReportYear}
          isOwner={userSession?.role === 'generator_admin'}
          onSecureReset={handleSecureSystemReset}
        />

        <SubscriberModal
          isOpen={isSubscriberModalOpen}
          onClose={() => { setIsSubscriberModalOpen(false); setSubscriberToEdit(null); }}
          subscriberToEdit={subscriberToEdit}
          pricingTiers={pricingTiers}
          monthlyTariffs={monthlyTariffs}
          activeMonthId={activeMonthRecord?.id}
          activeMonthNameAr={activeMonthRecord?.monthNameAr}
          lines={lines}
          onSaveSubscriber={handleSaveSubscriber}
          onDeleteSubscriber={handleDeleteSubscriberPermanent}
          onTogglePaymentStatus={() => {}}
          onOpenReceiptModal={(sub, inv, shouldAutoPrint = false) => {
            setSelectedReceiptSubscriber(sub);
            setSelectedReceiptInvoice(inv || null);
            setAutoPrintReceipt(shouldAutoPrint);
            setIsReceiptModalOpen(true);
          }}
          onAddAuditLog={addAuditLog}
        />


        <InvoiceReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => { setIsReceiptModalOpen(false); setSelectedReceiptSubscriber(null); setSelectedReceiptInvoice(null); }}
          subscriber={selectedReceiptSubscriber}
          generatorSpecs={generatorSpecs}
          generatorId={userSession?.generatorId}
          pricingTiers={pricingTiers}
          invoiceTemplate={invoiceTemplate}
          autoPrint={autoPrintReceipt}
          invoice={selectedReceiptInvoice}
          onMarkAsPaid={subId => {
            const target = subscribers.find(s => s.id === subId);
            if (target) {
              const calc = calculateSubscriberBill(target.amperes, target.tier, pricingTiers);
              handleSaveSubscriber({ ...target, paymentStatus: 'paid', amountPaid: calc.total });
            }
          }}
        />

        <PricingModal
          isOpen={pricingModalOpen}
          onClose={() => setPricingModalOpen(false)}
          pricingTiers={pricingTiers}
          monthlyTariffs={monthlyTariffs}
          onSaveMonthlyTariffs={handleSaveMonthlyTariffs}
          currency={generatorSpecs.currency}
        />

        <FolderDetailModal
          isOpen={!!activeSettingsFolderKey}
          onClose={() => setActiveSettingsFolderKey(null)}
          folderKey={activeSettingsFolderKey}
          folders={settingsFolders}
          generatorSpecs={generatorSpecs}
          lines={lines}
          collectors={collectors}
          invoiceTemplate={invoiceTemplate}
          auditLogs={auditLogs}
          onUpdateGeneratorSpecs={(specs) => {
            setGeneratorSpecs(specs);
            localStorage.setItem(getStorageKey('moldatk_generator'), JSON.stringify(specs));
          }}
          onUpdateLines={(newLines) => {
            setLines(newLines);
            localStorage.setItem(getStorageKey('moldatk_lines'), JSON.stringify(newLines));
            markLocalWrite();
            window.dispatchEvent(new Event('moldatk-local-sync'));
          }}
          onUpdateCollectors={newCollectors => {
                const scopedCollectors = newCollectors.map(c => ({ ...c, generatorId: userSession?.generatorId || c.generatorId || null }));
                void syncCloudCollectorRoster(scopedCollectors)
                  .then(savedCollectors => {
                    const persistedCollectors = savedCollectors.map(c => ({ ...c, generatorId: userSession?.generatorId || c.generatorId || null }));
                    setCollectors(persistedCollectors);
                    try {
                      localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(persistedCollectors));
                      window.dispatchEvent(new Event('moldatk-local-sync'));
                    } catch (e) {}
                    showToast('تم إنشاء وحفظ حسابات الجباة بنجاح');
                  })
                  .catch(error => {
                    console.error('Collector account sync failed:', error);
                    showToast('فشل إنشاء حساب الجابي على السيرفر. تأكد من رقم الهاتف والرمز السري ثم أعد المحاولة');
                  });
              }}
              onUpdateInvoiceTemplate={handleUpdateInvoiceTemplate}
          onClearAuditLogs={() => {
            setAuditLogs([]);
            localStorage.setItem(getStorageKey('moldatk_audit_logs'), JSON.stringify([]));
          try { window.dispatchEvent(new Event('moldatk-local-sync')); } catch (e) {}
          showToast('تم مسح سجل الحركات');
          }}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          onResetFactoryData={handleResetFactoryData}
        />
      </div>
    );
  }

  // واجهة لوحة تحكم المدير الكاملة (شاشات واسعة: حاسوب / تابلت)
  return (
    <div className="min-h-screen bg-[#F7F9FC] dark:bg-[#081521] text-slate-900 dark:text-slate-100 flex flex-col font-['Cairo',sans-serif]" dir="rtl">
      {subscriptionInfo && <SubscriptionWarningBanner info={subscriptionInfo} />}
        {userSession.role === 'generator_admin' && <GeneratorNotifications hideFloatingTriggers={activeTab === 'settings'} />}
        {userSession.role === 'generator_admin' && <OwnerAIWatcher onOpenAssistant={() => { setActiveTab('settings'); window.setTimeout(() => window.dispatchEvent(new Event('moldatk-open-owner-ai')), 220); }} />}
      {toastMessage && (
        <div className="fixed bottom-20 left-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <Navbar
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(!darkMode)}
        generatorSpecs={generatorSpecs}
        onOpenPricingModal={handleOpenPricingModal}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="flex-1 flex max-w-[1700px] w-full mx-auto">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          generatorSpecs={generatorSpecs}
          totalSubscribersCount={subscribers.length}
          isAdmin={isAdmin}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
        />

        <main className="flex-1 p-4 pb-24 lg:pb-4 overflow-y-auto min-w-0">
          {activeTab === 'dashboard' && (
            <DashboardView
              subscribers={subscribers}
              pricingTiers={pricingTiers}
              generatorSpecs={generatorSpecs}
              lines={lines}
              auditLogs={auditLogs}
              walletResetTimestamp={walletResetTimestamp}
              activeMonthId={activeMonthRecord?.id}
              onOpenPricingModal={handleOpenPricingModal}
              onNavigateToSubscribersTab={() => setActiveTab('subscribers')}
              onNavigateToWalletTab={() => setActiveTab('wallet')}
            />
          )}

          {activeTab === 'subscribers' && (
            <SubscribersView
              subscribers={subscribers}
              pricingTiers={pricingTiers}
              lines={lines}
              onTogglePaymentStatus={() => {}}
              onOpenSubscriberModal={sub => { setSubscriberToEdit(sub || null); setIsSubscriberModalOpen(true); }}
              onOpenReceiptModal={(sub, inv) => {
                setSelectedReceiptSubscriber(sub);
                setSelectedReceiptInvoice(inv || null);
                setAutoPrintReceipt(true);
                setIsReceiptModalOpen(true);
              }}
              onDeleteSubscriber={handleDeleteSubscriberPermanent}
            />
          )}

          {activeTab === 'reports' && (
            <div className="max-w-6xl mx-auto">
              <MobileMonthlyReports
                subscribers={subscribers}
                currency={generatorSpecs.currency}
                monthlyTariffs={monthlyTariffs}
                reportResetMarkers={reportResetMarkers}
                onResetYear={userSession?.role === 'generator_admin' ? handleResetReportYear : undefined}
              />
            </div>
          )}

          {activeTab === 'wallet' && (
            <WalletView
              subscribers={subscribers}
              pricingTiers={pricingTiers}
              collectors={collectors}
              auditLogs={auditLogs}
              walletResetTimestamp={walletResetTimestamp}
              activeMonthId={activeMonthRecord?.id}
              currency={generatorSpecs.currency}
              onBack={() => setActiveTab('dashboard')}
              onClearWalletLogs={async () => {
                const generatorId = userSession?.generatorId;
                if (!generatorId || userSession?.role !== 'generator_admin') return;
                try {
                  // Cashbox reset is a server-authoritative operation and must not be
                  // blocked by an unrelated subscriber/tariff sync failure. Give pending
                  // writes a short best-effort flush window, then reset independently.
                  try {
                    await Promise.race([
                      flushGeneratorSync(generatorId),
                      new Promise((_, reject) => window.setTimeout(() => reject(new Error('sync_flush_timeout')), 2500)),
                    ]);
                  } catch (syncError) {
                    console.warn('Cashbox reset continuing after sync flush warning:', syncError);
                  }
                  const confirmed = await resetCashbox(generatorId);
                  setWalletResetTimestamp(confirmed.reset_at || '');
                  showToast('تم تصفير القاصة وحفظه في السحابة');
                } catch (error) {
                  console.error('Cashbox reset failed:', error);
                  const reason = String((error as any)?.message || (error as any)?.code || '');
                  if (/jwt|auth|token|not_authorized|42501|401|403/i.test(reason)) {
                    showToast('تعذر تأكيد التصفير بسبب الجلسة. سجل الدخول من جديد ثم أعد المحاولة');
                  } else {
                    showToast('تعذر تأكيد تصفير القاصة من السيرفر. أعد المحاولة');
                  }
                }
              }}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsFolderView
              folders={settingsFolders}
              pricingTiers={pricingTiers}
              generatorSpecs={generatorSpecs}
              lines={lines}
              auditLogs={auditLogs}
              collectors={collectors}
              onOpenFolderModal={handleOpenFolderModal}
              onExportData={handleExportBackup}
              onResetData={handleResetFactoryData}
              viewMode={viewMode}
              onChangeViewMode={setViewMode}
              onUpdateLines={newLines => {
                setLines(newLines);
                try {
                  localStorage.setItem(getStorageKey('moldatk_lines'), JSON.stringify(newLines));
                  markLocalWrite();
        window.dispatchEvent(new Event('moldatk-local-sync'));
                } catch (e) {}
              }}
              onUpdateCollectors={handleUpdateCollectors}
              onOpenPricingModal={handleOpenPricingModal}
              subscriptionInfo={subscriptionInfo}
              subscriptionLoading={subscriptionLoading}
            />
          )}

          {activeTab === 'monitor' && (
            <GeneratorMonitorView
              generatorSpecs={generatorSpecs}
              onUpdateSpecs={newSpecs => setGeneratorSpecs(prev => ({ ...prev, ...newSpecs }))}
            />
          )}
        </main>
      </div>

      <SubscriberModal
        isOpen={isSubscriberModalOpen}
        onClose={() => { setIsSubscriberModalOpen(false); setSubscriberToEdit(null); }}
        subscriberToEdit={subscriberToEdit}
        pricingTiers={pricingTiers}
          monthlyTariffs={monthlyTariffs}
        lines={lines}
        onSaveSubscriber={handleSaveSubscriber}
        onDeleteSubscriber={handleDeleteSubscriberPermanent}
        onTogglePaymentStatus={() => {}}
        onOpenReceiptModal={(sub, inv, shouldAutoPrint = false) => {
            setSelectedReceiptSubscriber(sub);
            setSelectedReceiptInvoice(inv || null);
            setAutoPrintReceipt(shouldAutoPrint);
            setIsReceiptModalOpen(true);
          }}
        onAddAuditLog={addAuditLog}
      />

      <InvoiceReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => { setIsReceiptModalOpen(false); setSelectedReceiptSubscriber(null); setSelectedReceiptInvoice(null); }}
        subscriber={selectedReceiptSubscriber}
        generatorSpecs={generatorSpecs}
        generatorId={userSession?.generatorId}
        pricingTiers={pricingTiers}
          invoiceTemplate={invoiceTemplate}
        autoPrint={autoPrintReceipt}
        invoice={selectedReceiptInvoice}
        onMarkAsPaid={subId => {
          const target = subscribers.find(s => s.id === subId);
          if (target) {
            const calc = calculateSubscriberBill(target.amperes, target.tier, pricingTiers);
            const collectedNow = Math.max(0, Number(target.amountDue) || Math.max(0, calc.total - Number(target.amountPaid || 0)));
            handleSaveSubscriber({ ...target, paymentStatus: 'paid', amountDue: 0, amountPaid: Math.max(Number(target.amountPaid || 0), calc.total), lastPaymentDate: new Date().toISOString() });
            if (collectedNow > 0) addAuditLog({
              category: 'payment',
              title: 'تسديد المشترك',
              details: 'تم تسجيل التسديد من الإيصال وإضافته إلى القاصة',
              entityId: target.id,
              entityName: target.fullName + ' (' + (target.code || target.subscriberCode || '') + ')',
              actorName: userSession?.collectorName || userSession?.username || 'الإدارة العامة',
              amount: collectedNow,
            });
          }
        }}
      />

      <PricingModal
        isOpen={pricingModalOpen}
        onClose={() => setPricingModalOpen(false)}
        pricingTiers={pricingTiers}
        monthlyTariffs={monthlyTariffs}
        onSaveMonthlyTariffs={handleSaveMonthlyTariffs}
        currency={generatorSpecs.currency}
      />

      <FolderDetailModal
        isOpen={!!activeSettingsFolderKey}
        onClose={() => setActiveSettingsFolderKey(null)}
        folderKey={activeSettingsFolderKey}
        folders={settingsFolders}
        generatorSpecs={generatorSpecs}
        lines={lines}
        collectors={collectors}
        invoiceTemplate={invoiceTemplate}
        auditLogs={auditLogs}
        onUpdateGeneratorSpecs={(specs) => {
          setGeneratorSpecs(specs);
          localStorage.setItem(getStorageKey('moldatk_generator'), JSON.stringify(specs));
        }}
        onUpdateLines={(newLines) => {
          const fixedLines = newLines.map(line => ({ ...line, updatedAt: (line as any).updatedAt || new Date().toISOString() } as any));
          setLines(fixedLines);
          try {
            localStorage.setItem(getStorageKey('moldatk_lines'), JSON.stringify(fixedLines));
            localStorage.setItem(getStorageKey('moldatk_lines_updated_at'), new Date().toISOString());
            window.dispatchEvent(new Event('moldatk-local-sync'));
          } catch (e) {}
        }}
        onUpdateCollectors={newCollectors => {
                const scopedCollectors = newCollectors.map(c => ({ ...c, generatorId: userSession?.generatorId || c.generatorId || null }));
                void syncCloudCollectorRoster(scopedCollectors)
                  .then(savedCollectors => {
                    const persistedCollectors = savedCollectors.map(c => ({ ...c, generatorId: userSession?.generatorId || c.generatorId || null }));
                    setCollectors(persistedCollectors);
                    try {
                      localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(persistedCollectors));
                      window.dispatchEvent(new Event('moldatk-local-sync'));
                    } catch (e) {}
                    showToast('تم إنشاء وحفظ حسابات الجباة بنجاح');
                  })
                  .catch(error => {
                    console.error('Collector account sync failed:', error);
                    showToast('فشل إنشاء حساب الجابي على السيرفر. تأكد من رقم الهاتف والرمز السري ثم أعد المحاولة');
                  });
              }}
              onUpdateInvoiceTemplate={handleUpdateInvoiceTemplate}
        onClearAuditLogs={() => {
          setAuditLogs([]);
          localStorage.setItem(getStorageKey('moldatk_audit_logs'), JSON.stringify([]));
          try { window.dispatchEvent(new Event('moldatk-local-sync')); } catch (e) {}
          showToast('تم مسح سجل الحركات');
        }}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onResetFactoryData={handleResetFactoryData}
      />
    </div>
  );
}
