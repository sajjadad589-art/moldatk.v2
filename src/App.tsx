/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import { Sparkles } from 'lucide-react';
import { calculateSubscriberBill } from './utils/formatters';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { supabase } from './lib/supabase';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { ExpiredSubscriptionScreen, SuspendedAccountScreen, SubscriptionWarningBanner, SubscriptionInfo, daysUntilExpiry } from './components/SubscriptionStatusUI';
import { GeneratorNotifications } from './components/GeneratorNotifications';
import { PricingModal } from './components/PricingModal';
import { FolderDetailModal } from './components/FolderDetailModal';

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
      if (forceSuperAdmin && parsed.role !== 'super_admin') return null;
      return parsed;
    } catch (e) {
      return null;
    }
  });


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

  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  const [darkMode, setDarkMode] = useState<boolean>(true);
  const isMobileViewport = useIsMobileViewport();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [viewMode, setViewMode] = useState<any>(() => {
    try {
      return localStorage.getItem('moldatk_view_mode') || 'auto';
    } catch (e) {
      return 'auto';
    }
  });

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

  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [activeSettingsFolderKey, setActiveSettingsFolderKey] = useState<string | null>(null);
  const [invoiceTemplate, setInvoiceTemplate] = useState<InvoiceTemplateSettings>(() => {
    try {
      const saved = localStorage.getItem(getStorageKey('moldatk_invoice_template'));
      return saved ? JSON.parse(saved) : INITIAL_INVOICE_TEMPLATE;
    } catch (e) {
      return INITIAL_INVOICE_TEMPLATE;
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

  // تسجيل جهاز صاحب المولدة في Firebase Cloud Messaging وحفظ Token في Supabase.
  // يعمل فقط داخل تطبيق Android الحقيقي، ولا يشتغل عند فتح النسخة من المتصفح.
  useEffect(() => {
    if (userSession?.role !== 'generator_admin' || !Capacitor.isNativePlatform()) return;

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
    let cancelled = false;
    const loadSubscription = async () => {
      if (!userSession || (userSession.role !== 'generator_admin' && userSession.role !== 'collector') || !userSession.generatorId) {
        setSubscriptionInfo(null);
        return;
      }
      setSubscriptionLoading(userSession.role === 'generator_admin');
      const [g, sub] = await Promise.all([
        supabase.from('generators').select('id,name,owner_name,phone,area,status,suspension_reason').eq('id', userSession.generatorId).single(),
        userSession.role === 'generator_admin'
          ? supabase.from('subscriptions').select('starts_at,ends_at,status').eq('generator_id', userSession.generatorId).order('ends_at', { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ error: null, data: null } as any),
      ]);
      if (!cancelled) {
        if (!g.error && g.data && (userSession.role === 'collector' || (!sub.error && sub.data))) {
          const serverGeneratorName = g.data.name || 'مولدتك';
          const serverOwnerName = g.data.owner_name || 'صاحب المولدة';

          if (userSession.role === 'generator_admin' && sub.data) {
            setSubscriptionInfo({
              generatorId: g.data.id,
              generatorName: serverGeneratorName,
              ownerName: serverOwnerName,
              phone: g.data.phone,
              startsAt: sub.data.starts_at,
              endsAt: sub.data.ends_at,
              subscriptionStatus: sub.data.status,
              accountStatus: g.data.status,
              suspensionReason: g.data.suspension_reason,
            });
          } else {
            setSubscriptionInfo(null);
          }

          setGeneratorSpecs(prev => {
            const updated = {
              ...prev,
              generatorName: serverGeneratorName,
              ownerName: serverOwnerName,
              location: g.data.area || prev.location,
            };

            try {
              localStorage.setItem(getStorageKey('moldatk_generator'), JSON.stringify(updated));
              rememberGeneratorAccount(userSession, updated);

              const rawInvoiceSettings = localStorage.getItem(getStorageKey('moldatk_invoice_custom_settings'));
              if (rawInvoiceSettings) {
                const parsedInvoiceSettings = JSON.parse(rawInvoiceSettings);
                localStorage.setItem(
                  getStorageKey('moldatk_invoice_custom_settings'),
                  JSON.stringify({ ...parsedInvoiceSettings, headerTitle: serverGeneratorName })
                );
              }
            } catch (e) {}

            return updated;
          });
        } else {
          setSubscriptionInfo(null);
        }
        setSubscriptionLoading(false);
      }
    };
    void loadSubscription();
    const timer = window.setInterval(() => void loadSubscription(), 30 * 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [userSession?.role, userSession?.generatorId]);

  const activeMonthRecord = monthlyTariffs.find(m => m.isCurrentActive) || monthlyTariffs[0];
  const pricingTiers: SubscriptionTierPricing[] = activeMonthRecord?.tiers || INITIAL_PRICING_TIERS;

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
    setUserSession(session);
    try {
      localStorage.setItem('moldatk_session', JSON.stringify(session));
    } catch (e) {}
    showToast('مرحباً بك! تم تسجيل الدخول بنجاح');
  };

  const handleLogout = () => {
    setUserSession(null);
    try {
      localStorage.removeItem('moldatk_session');
    } catch (e) {}
    void supabase.auth.signOut();
    showToast('تم تسجيل الخروج بنجاح');
  };

  const handleOpenPricingModal = () => setPricingModalOpen(true);

  const handleSaveMonthlyTariffs = (updatedTariffs: MonthlyTariffRecord[], activeMonthId: string, shouldRecalculateBills: boolean) => {
    const normalized = updatedTariffs.map(record => ({
      ...record,
      isCurrentActive: record.id === activeMonthId,
    }));

    setMonthlyTariffs(normalized);
    try {
      localStorage.setItem(getStorageKey('moldatk_monthly_tariffs'), JSON.stringify(normalized));
      window.dispatchEvent(new Event('moldatk-local-sync'));
    } catch (e) {}

    const activeRecord = normalized.find(m => m.id === activeMonthId) || normalized[0];

    if (shouldRecalculateBills && activeRecord) {
      setSubscribers(prev => {
        const recalculated = prev.map(sub => {
          const calc = calculateSubscriberBill(sub.amperes, sub.tier, activeRecord.tiers);

          if (sub.paymentStatus === 'paid') {
            return sub;
          }

          if (sub.paymentStatus === 'free' || sub.tier === 'free') {
            return { ...sub, amountDue: 0, amountPaid: 0 };
          }

          if (sub.paymentStatus === 'partial') {
            const remaining = Math.max(calc.total - (sub.amountPaid || 0), 0);
            return { ...sub, amountDue: remaining };
          }

          return { ...sub, amountDue: calc.total };
        });

        try {
          localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(recalculated));
        } catch (e) {}

        return recalculated;
      });
    }

    addAuditLog({
      category: 'pricing',
      title: 'تعديل تسعيرة الأمبير',
      details: `تم حفظ تسعيرة ${activeRecord?.monthNameAr || 'الشهر الحالي'} بنجاح`,
      entityName: activeRecord?.monthNameAr || 'تسعيرة الشهر',
      actorName: userSession?.username || userSession?.collectorName || 'مدير المنظومة',
    });

    showToast('تم حفظ تسعيرة الأمبير بنجاح');
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
      setInvoiceTemplate(jsonData.invoiceTemplate);
      localStorage.setItem(getStorageKey('moldatk_invoice_template'), JSON.stringify(jsonData.invoiceTemplate));
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
    setInvoiceTemplate(template);
    try {
      localStorage.setItem(getStorageKey('moldatk_invoice_template'), JSON.stringify(template));
    } catch (e) {}
    showToast('تم حفظ إعدادات القالب');
  };

  const handleSaveSubscriber = (newSub: Subscriber) => {
    setSubscribers(prev => {
      const exists = prev.some(s => s.id === newSub.id);
      const normalizedSub: Subscriber = {
        ...newSub,
        code: newSub.code || newSub.subscriberCode || generateUniqueSubscriberCode(prev),
        subscriberCode: newSub.subscriberCode || newSub.code || generateUniqueSubscriberCode(prev),
        line: newSub.line || newSub.lineName,
        lineName: newSub.lineName || newSub.line,
      };
      const updated = exists ? prev.map(s => (s.id === normalizedSub.id ? normalizedSub : s)) : [normalizedSub, ...prev];
      try {
        localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated));
        window.dispatchEvent(new Event('moldatk-local-sync'));
      } catch (e) {}
      return updated;
    });
    setSubscriberToEdit(newSub);
    showToast('تم حفظ بيانات المشترك بنجاح');
  };

  const addAuditLog = (entry: any) => {
    const newLog = {
      ...entry,
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs(prev => {
      const updated = [newLog, ...prev] as AuditLogEntry[];
      try { localStorage.setItem(getStorageKey('moldatk_audit_logs'), JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
  };

  if (!userSession) {
    return <LoginView collectors={forceSuperAdmin ? [] : loadCollectorLoginIndex()} onLoginSuccess={handleLoginSuccess} />;
  }

  if (forceSuperAdmin && userSession.role !== 'super_admin') {
    return <LoginView collectors={[]} onLoginSuccess={handleLoginSuccess} />;
  }

  if (userSession.role === 'super_admin') {
    return <SuperAdminDashboard onLogout={handleLogout} />;
  }

  if (userSession.role === 'generator_admin' && !subscriptionLoading && subscriptionInfo?.accountStatus === 'suspended') {
    return <SuspendedAccountScreen reason={subscriptionInfo.suspensionReason} onLogout={handleLogout} />;
  }

  if (userSession.role === 'generator_admin' && !subscriptionLoading && (!subscriptionInfo || subscriptionInfo.subscriptionStatus !== 'active' || daysUntilExpiry(subscriptionInfo.endsAt) <= 0)) {
    return <ExpiredSubscriptionScreen onLogout={handleLogout} />;
  }

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
          pricingTiers={pricingTiers}
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
          lines={lines}
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
          onDeleteSubscriber={subId => {
            setSubscribers(prev => {
              const updated = prev.filter(s => s.id !== subId);
              try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}
              window.dispatchEvent(new Event('moldatk-local-sync'));
              return updated;
            });
            showToast('تم حذف المشترك بنجاح');
          }}
          onTogglePaymentStatus={() => {}}
          onUpdateSpecs={newSpecs => setGeneratorSpecs(prev => ({ ...prev, ...newSpecs }))}
          onExportData={handleExportBackup}
          onResetData={handleResetFactoryData}
          subscriptionInfo={subscriptionInfo}
          subscriptionLoading={subscriptionLoading}
        />

        <SubscriberModal
          isOpen={isSubscriberModalOpen}
          onClose={() => { setIsSubscriberModalOpen(false); setSubscriberToEdit(null); }}
          subscriberToEdit={subscriberToEdit}
          pricingTiers={pricingTiers}
          lines={lines}
          onSaveSubscriber={handleSaveSubscriber}
          onDeleteSubscriber={(subId) => {
            setSubscribers(prev => {
              const updated = prev.filter(s => s.id !== subId);
              try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}
              return updated;
            });
            setIsSubscriberModalOpen(false);
          }}
          onTogglePaymentStatus={() => {}}
          onOpenReceiptModal={(sub, inv) => {
            setSelectedReceiptSubscriber(sub);
            setSelectedReceiptInvoice(inv || null);
            setAutoPrintReceipt(false);
            setIsReceiptModalOpen(true);
          }}
          onAddAuditLog={addAuditLog}
        />


        <InvoiceReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={() => { setIsReceiptModalOpen(false); setSelectedReceiptSubscriber(null); setSelectedReceiptInvoice(null); }}
          subscriber={selectedReceiptSubscriber}
          generatorSpecs={generatorSpecs}
          pricingTiers={pricingTiers}
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
          }}
          onUpdateCollectors={(newCollectors) => {
            setCollectors(newCollectors);
            localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(newCollectors));
          }}
          onUpdateInvoiceTemplate={handleUpdateInvoiceTemplate}
          onClearAuditLogs={() => {
            setAuditLogs([]);
            localStorage.setItem(getStorageKey('moldatk_audit_logs'), JSON.stringify([]));
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
    <div className="min-h-screen bg-slate-100 dark:bg-[#070d1e] text-slate-900 dark:text-slate-100 flex flex-col font-['Cairo',sans-serif]" dir="rtl">
      {subscriptionInfo && <SubscriptionWarningBanner info={subscriptionInfo} />}
        {userSession.role === 'generator_admin' && <GeneratorNotifications hideFloatingTriggers={activeTab === 'settings'} />}
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
              onDeleteSubscriber={isAdmin ? (subId) => {
                setSubscribers(prev => {
                  const updated = prev.filter(s => s.id !== subId);
                  try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}
                  window.dispatchEvent(new Event('moldatk-local-sync'));
                  return updated;
                });
                showToast('تم حذف المشترك بنجاح');
              } : undefined}
            />
          )}

          {activeTab === 'wallet' && (
            <WalletView
              subscribers={subscribers}
              collectors={collectors}
              auditLogs={auditLogs}
              walletResetTimestamp={walletResetTimestamp}
              currency={generatorSpecs.currency}
              onBack={() => setActiveTab('dashboard')}
              onClearWalletLogs={() => {
                const resetAt = new Date().toISOString();
                setWalletResetTimestamp(resetAt);
                try { localStorage.setItem(getStorageKey('moldatk_wallet_reset_timestamp'), resetAt); } catch (e) {}
                showToast('تم تصفير القاصة بنجاح');
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
                  window.dispatchEvent(new Event('moldatk-local-sync'));
                } catch (e) {}
              }}
              onUpdateCollectors={newCollectors => {
                const scopedCollectors = newCollectors.map(c => ({ ...c, generatorId: userSession?.generatorId || c.generatorId || null }));
                setCollectors(scopedCollectors);
                try {
                  localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(scopedCollectors));
                  window.dispatchEvent(new Event('moldatk-local-sync'));
                } catch (e) {}
              }}
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
        lines={lines}
        onSaveSubscriber={handleSaveSubscriber}
        onDeleteSubscriber={(subId) => {
          setSubscribers(prev => {
            const updated = prev.filter(s => s.id !== subId);
            try { localStorage.setItem(getStorageKey('moldatk_subscribers'), JSON.stringify(updated)); } catch (e) {}
            return updated;
          });
          setIsSubscriberModalOpen(false);
        }}
        onTogglePaymentStatus={() => {}}
        onOpenReceiptModal={(sub, inv) => {
          setSelectedReceiptSubscriber(sub);
          setSelectedReceiptInvoice(inv || null);
          setAutoPrintReceipt(false);
          setIsReceiptModalOpen(true);
        }}
        onAddAuditLog={addAuditLog}
      />

      <InvoiceReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => { setIsReceiptModalOpen(false); setSelectedReceiptSubscriber(null); setSelectedReceiptInvoice(null); }}
        subscriber={selectedReceiptSubscriber}
        generatorSpecs={generatorSpecs}
        pricingTiers={pricingTiers}
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
        }}
        onUpdateCollectors={(newCollectors) => {
          const scopedCollectors = newCollectors.map(c => ({ ...c, generatorId: userSession?.generatorId || c.generatorId || null }));
          setCollectors(scopedCollectors);
          localStorage.setItem(getStorageKey('moldatk_collectors'), JSON.stringify(scopedCollectors));
          window.dispatchEvent(new Event('moldatk-local-sync'));
        }}
        onUpdateInvoiceTemplate={handleUpdateInvoiceTemplate}
        onClearAuditLogs={() => {
          setAuditLogs([]);
          localStorage.setItem(getStorageKey('moldatk_audit_logs'), JSON.stringify([]));
          showToast('تم مسح سجل الحركات');
        }}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onResetFactoryData={handleResetFactoryData}
      />
    </div>
  );
}
