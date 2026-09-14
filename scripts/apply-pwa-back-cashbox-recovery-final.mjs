import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8').replaceAll('\r\n', '\n');
const write = (p, s) => fs.writeFileSync(p, s, 'utf8');
const must = (ok, message) => { if (!ok) throw new Error(`PWA back/cashbox recovery: ${message}`); };

// ---------------------------------------------------------------------------
// 1) PWA/mobile-browser back navigation.
//    - left edge -> swipe right = back
//    - right edge -> swipe left = back
//    - browser/system back uses the same logical close/back path
//    Android native keeps its existing double-back-to-exit behavior on dashboard.
// ---------------------------------------------------------------------------
{
  const p = 'src/App.tsx';
  let s = read(p);
  const start = s.indexOf('  const lastBackPressRef = useRef(0);');
  const endMarker = '\n\n  // تسجيل جهاز صاحب المولدة';
  const end = start >= 0 ? s.indexOf(endMarker, start) : -1;
  must(start >= 0 && end > start, 'Android back block anchor missing');

  const block = `  const lastBackPressRef = useRef(0);
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
  }, [isReceiptModalOpen, isSubscriberModalOpen, pricingModalOpen, activeSettingsFolderKey, activeTab, isMobileViewport]);`;

  s = s.slice(0, start) + block + s.slice(end);
  must(s.includes("touchEdge: 'left' | 'right' | null"), 'bidirectional edge gesture missing');
  must(s.includes("window.addEventListener('popstate', onPopState)"), 'browser/system back listener missing');
  must(s.includes("window.addEventListener('moldatk-android-back', handleAndroidBack)"), 'native Android back listener lost');
  write(p, s);
}

// ---------------------------------------------------------------------------
// 2) Cashbox UI: while a successful local payment is still being uploaded, never
//    let an older server 0 overwrite the freshly collected amount. Once cloud sync
//    applies, the shared server balance takes over again.
// ---------------------------------------------------------------------------
{
  const p = 'src/lib/useCashboxBalance.ts';
  write(p, `import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

type CashboxResponse = { reset_at?: string | null; balance?: number | string | null } | null;

const sessionContext = () => {
  try {
    const session = JSON.parse(localStorage.getItem('moldatk_session') || 'null');
    const generatorId = String(session?.generatorId || '');
    return {
      generatorId,
      cacheKey: generatorId ? \`moldatk_cashbox_server_\${generatorId}\` : '',
      pendingKey: generatorId ? \`moldatk_pending_sync_\${generatorId}\` : '',
    };
  } catch {
    return { generatorId: '', cacheKey: '', pendingKey: '' };
  }
};

const readCachedBalance = (): number | null => {
  const { cacheKey } = sessionContext();
  if (!cacheKey) return null;
  try {
    const state = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    const value = Number(state?.balance);
    return state?.balance != null && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
};

/**
 * Shared cashbox balance for dashboard + cashbox screen.
 * Local fallback is used only while this device has an unsynced local write, so a
 * just-completed payment appears immediately instead of briefly reverting to stale 0.
 */
export function useCashboxBalance(fallback: number) {
  const [serverBalance, setServerBalance] = useState<number | null>(() => readCachedBalance());
  const [preferLocalPending, setPreferLocalPending] = useState<boolean>(() => {
    const { pendingKey } = sessionContext();
    try { return Boolean(pendingKey && localStorage.getItem(pendingKey) === '1'); } catch { return false; }
  });

  const refresh = useCallback(async () => {
    const { generatorId, cacheKey } = sessionContext();
    if (!generatorId) return;
    try {
      const { data, error } = await supabase.rpc('get_generator_cashbox', { p_generator_id: generatorId });
      if (error) throw error;
      const value = Number((data as CashboxResponse)?.balance);
      if ((data as CashboxResponse)?.balance != null && Number.isFinite(value)) {
        setServerBalance(value);
        if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(data));
      }
    } catch (error) {
      console.warn('Cashbox server refresh failed:', error);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const onLocalSync = (event: Event) => {
      const detail = (event as CustomEvent)?.detail;
      if (detail?.source === 'cloud') {
        const cached = readCachedBalance();
        if (cached != null) setServerBalance(cached);
        setPreferLocalPending(false);
      } else {
        setPreferLocalPending(true);
      }
      void refresh();
    };

    const onCashboxChanged = () => {
      const cached = readCachedBalance();
      if (cached != null) setServerBalance(cached);
      setPreferLocalPending(false);
      void refresh();
    };

    const onStorage = (event: StorageEvent) => {
      const { cacheKey, pendingKey } = sessionContext();
      if (cacheKey && event.key === cacheKey) {
        const cached = readCachedBalance();
        if (cached != null) setServerBalance(cached);
      }
      if (pendingKey && event.key === pendingKey) setPreferLocalPending(event.newValue === '1');
    };

    window.addEventListener('moldatk-local-sync', onLocalSync);
    window.addEventListener('moldatk-cashbox-changed', onCashboxChanged);
    window.addEventListener('storage', onStorage);
    window.addEventListener('moldatk-sync-now', onCashboxChanged);
    window.addEventListener('online', onCashboxChanged);
    return () => {
      window.removeEventListener('moldatk-local-sync', onLocalSync);
      window.removeEventListener('moldatk-cashbox-changed', onCashboxChanged);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('moldatk-sync-now', onCashboxChanged);
      window.removeEventListener('online', onCashboxChanged);
    };
  }, [refresh]);

  return preferLocalPending ? fallback : (serverBalance ?? fallback);
}
`);
}

// Wallet must show the same shared balance as dashboard when no filter is active.
{
  const p = 'src/components/WalletView.tsx';
  let s = read(p);
  s = s.replace(
    `{totalCollected.toLocaleString('en-US')} {currency}`,
    `{(isWalletFilterActive ? totalCollected : authoritativeCashbox).toLocaleString('en-US')} {currency}`
  );
  must(s.includes('(isWalletFilterActive ? totalCollected : authoritativeCashbox).toLocaleString'), 'wallet headline parity missing');
  write(p, s);
}

// Legacy receipt "mark paid" fallback must also create a cashbox event. The normal
// SubscriberModal payment flow already logs its own payment and is left unchanged.
{
  const p = 'src/App.tsx';
  let s = read(p);
  const legacy = `            const calc = calculateSubscriberBill(target.amperes, target.tier, pricingTiers);
            handleSaveSubscriber({ ...target, paymentStatus: 'paid', amountPaid: calc.total });`;
  const fixed = `            const calc = calculateSubscriberBill(target.amperes, target.tier, pricingTiers);
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
            });`;
  const occurrences = (s.match(/const calc = calculateSubscriberBill\(target\.amperes, target\.tier, pricingTiers\);\n\s*handleSaveSubscriber\(\{ \.\.\.target, paymentStatus: 'paid', amountPaid: calc\.total \}\);/g) || []).length;
  if (occurrences > 0) s = s.replaceAll(legacy, fixed);
  must(!s.includes(legacy), 'legacy mark-paid path can still bypass cashbox audit');
  write(p, s);
}

console.log('PWA edge/back navigation and immediate cashbox payment recovery installed.');
