import React, { useState } from 'react';
import { CalendarDays, Phone, ShieldCheck, TriangleAlert, ChevronLeft, X, PauseCircle } from 'lucide-react';

export type SubscriptionInfo = {
  generatorId: string;
  generatorName: string;
  ownerName: string;
  phone: string | null;
  startsAt: string;
  endsAt: string;
  subscriptionStatus: string;
  accountStatus: string;
  suspensionReason?: string | null;
};

const formatDate = (value: string) => new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
const whatsappUrl = 'https://wa.me/9647766334555';

export const daysUntilExpiry = (endsAt: string) => Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000);

export const SubscriptionWarningBanner: React.FC<{ info: SubscriptionInfo }> = ({ info }) => {
  const days = Math.max(0, daysUntilExpiry(info.endsAt));
  if (info.accountStatus === 'suspended' || days > 10 || days <= 0) return null;
  return (
    <div dir="rtl" className="w-full bg-red-600 text-white px-4 py-2.5 text-center text-sm font-black shadow-lg z-[90] relative">
      سينتهي اشتراكك بعد {days} {days === 1 ? 'يوم' : 'أيام'} — يرجى التجديد لتجنب توقف الخدمة
    </div>
  );
};

export const SuspendedAccountScreen: React.FC<{ reason?: string | null; onLogout?: () => void }> = ({ reason, onLogout }) => (
  <div dir="rtl" className="min-h-screen bg-slate-100 dark:bg-[#070d1e] flex items-center justify-center p-5 font-['Cairo',sans-serif]">
    <div className="w-full max-w-lg bg-white dark:bg-[#111c38] rounded-3xl border border-amber-200 dark:border-amber-950 shadow-2xl p-8 text-center">
      <div className="w-20 h-20 mx-auto rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mb-5"><PauseCircle className="w-10 h-10" /></div>
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">حسابك مقيد مؤقتاً</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-7">{reason || 'يرجى التواصل مع خدمة العملاء لمعرفة سبب التقييد وإعادة تفعيل الحساب.'}</p>
      <a href={whatsappUrl} target="_blank" rel="noreferrer" className="mt-7 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 font-black"><Phone className="w-5 h-5" /> التواصل عبر واتساب</a>
      {onLogout && <button onClick={onLogout} className="mt-3 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white">تسجيل الخروج</button>}
    </div>
  </div>
);

export const ExpiredSubscriptionScreen: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => (
  <div dir="rtl" className="min-h-screen bg-slate-100 dark:bg-[#070d1e] flex items-center justify-center p-5 font-['Cairo',sans-serif]">
    <div className="w-full max-w-lg bg-white dark:bg-[#111c38] rounded-3xl border border-red-200 dark:border-red-950 shadow-2xl p-8 text-center">
      <div className="w-20 h-20 mx-auto rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 flex items-center justify-center mb-5"><TriangleAlert className="w-10 h-10" /></div>
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">انتهى اشتراكك، الرجاء التفعيل</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-7">يمكنك التواصل مع إدارة تطبيق مولدتك لتجديد وتفعيل الاشتراك.</p>
      <a href={whatsappUrl} target="_blank" rel="noreferrer" className="mt-7 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 font-black"><Phone className="w-5 h-5" /> التواصل عبر واتساب</a>
      {onLogout && <button onClick={onLogout} className="mt-3 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white">تسجيل الخروج</button>}
    </div>
  </div>
);

export const SubscriptionInfoButton: React.FC<{ info: SubscriptionInfo | null; loading?: boolean }> = ({ info, loading }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="w-full flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111c38] p-4 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
        <div className="flex items-center gap-3 text-right">
          <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-600"><ShieldCheck className="w-5 h-5" /></div>
          <div><div className="font-black text-sm text-slate-900 dark:text-white">معلومات الاشتراك</div><div className="text-[11px] text-slate-500 mt-0.5">تاريخ التفعيل والانتهاء وبيانات صاحب المولدة</div></div>
        </div>
        <ChevronLeft className="w-5 h-5 text-slate-400" />
      </button>
      {open && <div dir="rtl" className="fixed inset-0 z-[160] bg-black/50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl relative">
          <button type="button" onClick={() => setOpen(false)} className="absolute z-10 left-3 top-3 p-2 rounded-xl bg-white/90 dark:bg-slate-900 text-slate-700 dark:text-white shadow"><X className="w-5 h-5" /></button>
          <SubscriptionInfoCard info={info} loading={loading} />
        </div>
      </div>}
    </>
  );
};

export const SubscriptionInfoCard: React.FC<{ info: SubscriptionInfo | null; loading?: boolean }> = ({ info, loading }) => {
  if (loading) return <div className="rounded-2xl border p-5 bg-white dark:bg-[#111c38] text-sm font-bold">جاري تحميل معلومات الاشتراك...</div>;
  if (!info) return <div className="rounded-2xl border p-5 bg-white dark:bg-[#111c38] text-sm font-bold text-slate-500">لا توجد معلومات اشتراك مرتبطة بهذا الحساب.</div>;
  const days = daysUntilExpiry(info.endsAt);
  const isSuspended = info.accountStatus === 'suspended';
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111c38] p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-5"><div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-600"><ShieldCheck className="w-5 h-5" /></div><div><h3 className="font-black text-slate-900 dark:text-white">معلومات الاشتراك</h3><p className="text-[11px] text-slate-500">تفاصيل ترخيص حساب المولدة</p></div></div>
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3"><span className="text-slate-500 text-xs">اسم المولدة</span><div className="font-black mt-1">{info.generatorName}</div></div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3"><span className="text-slate-500 text-xs">صاحب المولدة</span><div className="font-black mt-1">{info.ownerName}</div></div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3"><span className="text-slate-500 text-xs">رقم الهاتف</span><div className="font-black mt-1">{info.phone || '—'}</div></div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3"><span className="text-slate-500 text-xs">الحالة</span><div className={`font-black mt-1 ${isSuspended || days <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>{isSuspended ? 'مقيد مؤقتاً' : days <= 0 ? 'منتهي' : 'فعال'}</div></div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3"><span className="text-slate-500 text-xs">تاريخ التفعيل</span><div className="font-black mt-1 flex items-center gap-1"><CalendarDays className="w-4 h-4" />{formatDate(info.startsAt)}</div></div>
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3"><span className="text-slate-500 text-xs">تاريخ الانتهاء</span><div className="font-black mt-1 flex items-center gap-1"><CalendarDays className="w-4 h-4" />{formatDate(info.endsAt)}</div></div>
      </div>
      <a href={whatsappUrl} target="_blank" rel="noreferrer" className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-3 font-black"><Phone className="w-4 h-4" /> مراسلة صاحب التطبيق عبر واتساب</a>
    </div>
  );
};
