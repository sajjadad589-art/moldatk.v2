import { supabase } from './supabase';

export const WEB_PUSH_VAPID_PUBLIC_KEY = 'BF0RyOTwx_Cvu8APpq7JP18HCzBO_4UVi-e64aoTbP-YGytDh3szjwBrPrTRH4dKSA0OnASOKQu1D4zTvIVTjvU';
const WEB_PUSH_KEY_STORAGE = 'moldatk_web_push_vapid_key';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
};

export const isIosDevice = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export const isStandaloneWebApp = () => {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia?.('(display-mode: standalone)').matches || iosStandalone;
};

export const webPushSupported = () =>
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

const rememberCurrentKey = () => {
  try { localStorage.setItem(WEB_PUSH_KEY_STORAGE, WEB_PUSH_VAPID_PUBLIC_KEY); } catch {}
};

async function ensureCurrentSubscription(registration: ServiceWorkerRegistration) {
  let subscription = await registration.pushManager.getSubscription();
  let storedKey = '';
  try { storedKey = localStorage.getItem(WEB_PUSH_KEY_STORAGE) || ''; } catch {}

  // A PushSubscription is bound to the VAPID application-server key. After a key
  // rotation the old subscription must be explicitly removed before subscribing again.
  if (subscription && storedKey !== WEB_PUSH_VAPID_PUBLIC_KEY) {
    try { await subscription.unsubscribe(); } catch {}
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_VAPID_PUBLIC_KEY),
    });
  }
  return subscription;
}

async function saveSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!p256dh || !auth) throw new Error('تعذر قراءة مفاتيح اشتراك الإشعارات');

  const { data, error } = await supabase.functions.invoke('register-web-push', {
    body: {
      endpoint: subscription.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
      vapid_public_key: WEB_PUSH_VAPID_PUBLIC_KEY,
    },
  });
  if (error || !data?.ok) throw new Error(data?.error || error?.message || 'تعذر حفظ اشتراك الإشعارات');
  rememberCurrentKey();
}

export async function refreshExistingWebPushSubscription() {
  if (!webPushSupported() || Notification.permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const subscription = await ensureCurrentSubscription(registration);
  await saveSubscription(subscription);
  return true;
}

export async function enableWebPush() {
  if (!webPushSupported()) {
    return { ok: false, message: 'هذا المتصفح لا يدعم إشعارات الويب أو أن الموقع غير مفتوح عبر HTTPS.' };
  }

  if (isIosDevice() && !isStandaloneWebApp()) {
    return {
      ok: false,
      needsInstall: true,
      message: 'على الآيفون: أضف مولدتك إلى الشاشة الرئيسية أولاً، ثم افتحه من الأيقونة واضغط تفعيل الإشعارات.',
    };
  }

  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  let permission = Notification.permission;
  if (permission !== 'granted') permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, message: 'لم يتم السماح بالإشعارات. يمكنك تفعيلها لاحقاً من إعدادات المتصفح/الجهاز.' };
  }

  const subscription = await ensureCurrentSubscription(registration);
  await saveSubscription(subscription);
  return { ok: true, message: 'تم تفعيل إشعارات الجهاز بنجاح.' };
}
