import React, { useEffect, useState } from 'react';
import { Bell, BellRing, Megaphone, Wrench, RefreshCw, X, Smartphone, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { enableWebPush, refreshExistingWebPushSubscription, webPushSupported, isIosDevice, isStandaloneWebApp } from '../lib/webPush';
import { Capacitor } from '@capacitor/core';

type AppNotification = {
  id: string;
  title: string;
  body: string;
  category: 'maintenance' | 'offer' | 'update' | 'general';
  created_at: string;
};

const iconFor = (category: AppNotification['category']) => {
  if (category === 'maintenance') return <Wrench className="w-5 h-5" />;
  if (category === 'offer') return <Megaphone className="w-5 h-5" />;
  return <Bell className="w-5 h-5" />;
};

interface GeneratorNotificationsProps {
  hideFloatingTriggers?: boolean;
}

export const GeneratorNotifications: React.FC<GeneratorNotificationsProps> = ({ hideFloatingTriggers = false }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => typeof Notification !== 'undefined' && Notification.permission === 'granted');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const isNative = Capacitor.isNativePlatform();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('app_notifications')
      .select('id,title,body,category,created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    setItems((data || []) as AppNotification[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOpen = () => {
      setOpen(true);
      void load();
    };
    window.addEventListener('moldatk-open-notifications', handleOpen);
    return () => window.removeEventListener('moldatk-open-notifications', handleOpen);
  }, []);

  useEffect(() => {
    if (isNative || !webPushSupported()) return;
    void refreshExistingWebPushSubscription()
      .then(ok => { if (ok) setPushEnabled(true); })
      .catch(() => {});
  }, [isNative]);

  const handleEnablePush = async () => {
    setPushBusy(true);
    setPushMessage(null);
    try {
      const result = await enableWebPush();
      setPushEnabled(result.ok);
      setPushMessage(result.message);
    } catch (e) {
      setPushEnabled(false);
      setPushMessage(e instanceof Error ? e.message : 'تعذر تفعيل الإشعارات');
    } finally {
      setPushBusy(false);
    }
  };

  const iosNeedsInstall = !isNative && isIosDevice() && !isStandaloneWebApp();

  return (
    <>
      {!hideFloatingTriggers && !isNative && !pushEnabled && webPushSupported() && (
        <button
          type="button"
          onClick={() => void handleEnablePush()}
          className="fixed left-5 bottom-36 z-[94] px-3.5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xl flex items-center gap-2 text-xs font-black"
          title="تفعيل إشعارات الجهاز"
        >
          <BellRing className="w-4 h-4" />
          {iosNeedsInstall ? 'ثبّت التطبيق للإشعارات' : 'فعّل إشعارات الجهاز'}
        </button>
      )}

      {!hideFloatingTriggers && <button
        type="button"
        onClick={() => { setOpen(true); void load(); }}
        className="fixed left-5 bottom-20 z-[95] w-12 h-12 rounded-full bg-blue-700 hover:bg-blue-800 text-white shadow-xl flex items-center justify-center"
        title="إشعارات الإدارة"
>
        <Bell className="w-5 h-5" />
        {items.length > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-[10px] font-black flex items-center justify-center">{Math.min(items.length, 99)}</span>}
      </button>}

      {open && <div className="fixed inset-0 z-[150] bg-black/50 flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-2xl max-h-[86vh] overflow-hidden bg-white dark:bg-[#111c38] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="font-black text-lg text-slate-900 dark:text-white">إشعارات الإدارة</h2>
              <p className="text-xs text-slate-500 mt-1">الصيانة، العروض وتحديثات التطبيق</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => void load()} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
            </div>
          </div>

          {!isNative && (
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${pushEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {pushEnabled ? <CheckCircle2 className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">إشعارات الجهاز</h3>
                  <p className="text-xs leading-5 text-slate-500 mt-1">
                    {pushEnabled
                      ? 'مفعّلة. ستصلك إشعارات النظام حتى لو لم تكن الصفحة مفتوحة.'
                      : iosNeedsInstall
                        ? 'على الآيفون أضف مولدتك إلى الشاشة الرئيسية، افتحه من الأيقونة، ثم فعّل الإشعارات.'
                        : 'فعّلها حتى تستلم إشعارات الصيانة والعروض والتحديثات خارج الصفحة.'}
                  </p>
                  {!pushEnabled && (
                    <button
                      onClick={() => void handleEnablePush()}
                      disabled={pushBusy}
                      className="mt-3 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-black"
                    >
                      {pushBusy ? 'جاري التفعيل...' : 'تفعيل الإشعارات'}
                    </button>
                  )}
                  {pushMessage && (
                    <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold flex items-start gap-2 ${pushEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
                      {!pushEnabled && <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                      <span>{pushMessage}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="overflow-y-auto max-h-[64vh] divide-y divide-slate-100 dark:divide-slate-800">
            {items.length === 0 ? <div className="p-10 text-center text-sm font-bold text-slate-500">لا توجد إشعارات حالياً</div> : items.map(n => (
              <div key={n.id} className="p-5 flex gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">{iconFor(n.category)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-black text-slate-900 dark:text-white">{n.title}</h3>
                    <span className="text-[10px] text-slate-400 shrink-0">{new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'medium' }).format(new Date(n.created_at))}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-6 whitespace-pre-wrap">{n.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>}
    </>
  );
};
