import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Copy, ExternalLink, History, Loader2, RefreshCw, Share2, ShieldCheck, WalletCards, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PortalInvoice {
  monthId?: string;
  monthNameAr?: string;
  issueDate?: string;
  paymentDate?: string;
  amperes?: number;
  totalAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  status?: string;
  receiptNumber?: string;
}

interface PortalPayment {
  receivedAt?: string;
  amount?: number;
  receiptNumber?: string;
  collectorName?: string;
  source?: 'receipt' | 'invoice' | 'audit' | string;
  title?: string;
  cancelled?: boolean;
  receiptSnapshot?: PortalInvoice & {
    collectorName?: string;
    previousDebtBefore?: number;
    currentCharge?: number;
    totalBeforePayment?: number;
    appliedToPreviousDebt?: number;
    appliedToCurrentMonth?: number;
    totalOutstandingAfter?: number;
  };
}

interface PortalPayload {
  ok: boolean;
  reason?: string;
  generator?: { name?: string; currency?: string };
  subscriber?: {
    name?: string;
    code?: string;
    lineName?: string;
    amperes?: number;
    ampereDiscount?: number;
    paymentStatus?: string;
    lastPaymentDate?: string;
  };
  summary?: {
    totalOutstanding?: number;
    currentMonthPaid?: number;
    totalPaidRecorded?: number;
  };
  currentMonth?: PortalInvoice | null;
  invoices?: PortalInvoice[];
  payments?: PortalPayment[];
  generatedAt?: string;
}

const money = (value: unknown, currency = 'د.ع') =>
  `${new Intl.NumberFormat('ar-IQ-u-nu-latn').format(Math.max(0, Number(value) || 0))} ${currency}`;

const dateText = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
};

const statusLabel = (status?: string) => {
  if (status === 'paid') return 'مسدد';
  if (status === 'partial') return 'تسديد جزئي';
  if (status === 'free') return 'مجاني';
  if (status === 'unpaid') return 'غير مسدد';
  return 'حساب فعال';
};

export default function SubscriberPortalPage({ token }: { token: string }) {
  const [data, setData] = useState<PortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (soft = false) => {
    if (!token) {
      setError('الرابط غير صالح.');
      setLoading(false);
      return;
    }
    soft ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const { data: payload, error: rpcError } = await supabase.rpc('get_public_subscriber_account', { p_token: token });
      if (rpcError) throw rpcError;
      const account = (payload || null) as PortalPayload | null;
      if (!account?.ok) {
        setData(null);
        setError('رابط الحساب غير صالح أو تم إيقافه.');
        return;
      }
      setData(account);
    } catch (e: any) {
      setError(e?.message ? 'تعذر تحميل الحساب حالياً. حاول مرة ثانية.' : 'تعذر تحميل الحساب.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { void load(false); }, [load]);

  const currency = data?.generator?.currency || 'د.ع';
  const current = data?.currentMonth || null;
  const totalOutstanding = Math.max(0, Number(data?.summary?.totalOutstanding || 0));
  const currentPaid = Math.max(0, Number(data?.summary?.currentMonthPaid || current?.paidAmount || 0));
  const currentCharge = Math.max(0, Number(current?.totalAmount || 0));
  const currentRemaining = Math.max(0, Number(current?.remainingAmount ?? totalOutstanding));
  const isClear = totalOutstanding <= 0;

  const recentRows = useMemo(() => {
    const payments = Array.isArray(data?.payments) ? data!.payments! : [];
    if (payments.length) return payments.slice(0, 12).map((p, index) => ({
      key: `p-${index}-${p.receivedAt || ''}-${p.receiptNumber || ''}`,
      date: p.receivedAt,
      amount: p.amount || 0,
      receipt: p.receiptNumber || '',
      collector: p.collectorName || '',
      source: p.source || 'audit',
      title: p.title || 'تسديد',
      cancelled: Boolean(p.cancelled),
      snapshot: p.receiptSnapshot,
    }));

    return (data?.invoices || [])
      .filter(inv => Number(inv.paidAmount || 0) > 0)
      .slice(0, 8)
      .map((inv, index) => ({
        key: `i-${index}-${inv.monthId || ''}`,
        date: inv.paymentDate || inv.issueDate,
        amount: inv.paidAmount || 0,
        receipt: inv.receiptNumber || '',
        collector: '',
        source: 'invoice',
        title: 'وصل مسدد محفوظ بالفاتورة',
        cancelled: false,
        snapshot: inv,
      }));
  }, [data]);

  const receiptRows = useMemo(
    () => recentRows.filter(row => !row.cancelled && Boolean(row.receipt)),
    [recentRows],
  );
  const legacyOnlyRows = useMemo(
    () => recentRows.filter(row => row.source === 'audit' && !row.receipt),
    [recentRows],
  );
  const effectiveLastPaymentDate = data?.subscriber?.lastPaymentDate
    || recentRows.find(row => !row.cancelled && Number(row.amount || 0) > 0)?.date;

  const shareText = data
    ? [
        data.generator?.name || 'مولدتك',
        `المشترك: ${data.subscriber?.name || ''}`,
        `المتبقي: ${money(totalOutstanding, currency)}`,
        window.location.href,
      ].join('\n')
    : window.location.href;

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'حسابي - مولدتك', text: shareText, url: window.location.href });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#eef4fb] flex items-center justify-center p-6 font-['Cairo']">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 px-8 py-10 text-center w-full max-w-sm">
          <Loader2 className="w-9 h-9 animate-spin mx-auto text-blue-600 mb-4" />
          <div className="font-black text-slate-900">جاري تحميل حسابك</div>
          <div className="text-xs text-slate-500 mt-2">يتم جلب آخر حالة مسجلة من مولدتك</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#eef4fb] flex items-center justify-center p-6 font-['Cairo']">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-7 text-center w-full max-w-md">
          <img src="/brand/moldatk-mark.svg" alt="مولدتك" className="w-16 h-16 mx-auto mb-3" />
          <h1 className="font-black text-xl text-slate-950">مولدتك</h1>
          <p className="text-sm text-slate-600 mt-4 leading-7">{error || 'تعذر العثور على الحساب.'}</p>
          <button onClick={() => void load(false)} className="mt-6 w-full rounded-2xl bg-[#0B1F3B] text-white py-3 font-black flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" /> إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#eef4fb] text-slate-950 font-['Cairo']">
      <header className="bg-gradient-to-l from-[#0B1F3B] to-[#1267b8] text-white">
        <div className="max-w-3xl mx-auto px-4 pt-5 pb-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/brand/moldatk-mark.svg" alt="مولدتك" className="w-10 h-10 rounded-xl bg-white p-1.5" />
              <div>
                <div className="font-black text-xl leading-none">مولدتك</div>
                <div className="text-[11px] text-blue-100 mt-1">بوابة المشترك</div>
              </div>
            </div>
            <button onClick={share} className="rounded-xl bg-white/12 border border-white/20 px-3 py-2 text-xs font-black flex items-center gap-1.5">
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              {copied ? 'تم النسخ' : 'مشاركة'}
            </button>
          </div>

          <div className="mt-6">
            <div className="text-blue-100 text-xs">المولدة</div>
            <h1 className="font-black text-2xl mt-1">{data.generator?.name || 'المولدة'}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 -mt-14 pb-12">
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-black text-xl shrink-0">
              {(data.subscriber?.name || 'م').trim().charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-black text-xl truncate">{data.subscriber?.name || 'المشترك'}</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                {data.subscriber?.code && <span>رقم المشترك: <b className="text-slate-800">{data.subscriber.code}</b></span>}
                {data.subscriber?.lineName && <span>الخط: <b className="text-slate-800">{data.subscriber.lineName}</b></span>}
              </div>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-[11px] font-black ${isClear ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {isClear ? 'الحساب مسدد' : statusLabel(data.subscriber?.paymentStatus)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
              <div className="text-[11px] text-slate-500">الأمبيرات</div>
              <div className="font-black text-lg mt-1">{Number(data.subscriber?.amperes || 0)}A</div>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
              <div className="text-[11px] text-slate-500">آخر تسديد</div>
              <div className="font-black text-sm mt-1">{dateText(effectiveLastPaymentDate)}</div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 mt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs text-slate-500">حساب الشهر الحالي</div>
              <h3 className="font-black text-lg mt-0.5">{current?.monthNameAr || current?.monthId || 'الحساب الحالي'}</h3>
            </div>
            <WalletCards className="w-6 h-6 text-blue-600" />
          </div>

          <div className="divide-y divide-slate-100 text-sm">
            <div className="flex justify-between py-3"><span className="text-slate-500">قيمة الشهر</span><b>{money(currentCharge, currency)}</b></div>
            <div className="flex justify-between py-3"><span className="text-slate-500">المسدد هذا الشهر</span><b className="text-emerald-700">{money(currentPaid, currency)}</b></div>
            <div className="flex justify-between py-3"><span className="text-slate-500">المتبقي من الشهر</span><b>{money(currentRemaining, currency)}</b></div>
          </div>

          <div className={`rounded-2xl p-4 mt-4 flex items-center justify-between ${isClear ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
            <div>
              <div className={`text-xs font-black ${isClear ? 'text-emerald-700' : 'text-red-700'}`}>إجمالي المبلغ المتبقي</div>
              <div className={`font-black text-2xl mt-1 ${isClear ? 'text-emerald-800' : 'text-red-700'}`}>{money(totalOutstanding, currency)}</div>
            </div>
            {isClear ? <CheckCircle2 className="w-9 h-9 text-emerald-600" /> : <Zap className="w-9 h-9 text-red-500" />}
          </div>
        </section>

        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-blue-600" />
            <h3 className="font-black text-lg">آخر التسديدات</h3>
          </div>

          {recentRows.length ? (
            <div className="space-y-2">
              {recentRows.map(row => (
                <div key={row.key} className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${row.cancelled ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                  <div>
                    <div className={`font-black text-sm ${row.cancelled ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {row.cancelled ? (row.title || 'إلغاء تسديد') : money(row.amount, currency)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">{dateText(row.date)}</div>
                    {row.collector && <div className="text-[10px] text-slate-400 mt-1">بواسطة {row.collector}</div>}
                  </div>
                  <div className="text-left">
                    <div className="text-[11px] text-slate-500">{row.receipt ? 'رقم الوصل' : 'نوع العملية'}</div>
                    <div className="font-bold text-xs mt-1" dir={row.receipt ? 'ltr' : 'rtl'}>{row.receipt || row.title || 'تسديد سابق'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 text-center text-sm text-slate-500">لا توجد تسديدات مسجلة بعد.</div>
          )}
        </section>

        {receiptRows.length > 0 && (
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 mt-4">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h3 className="font-black text-lg">الإيصالات المسددة السابقة</h3>
            </div>
            <div className="space-y-3">
              {receiptRows.map(row => {
                const receipt = row.snapshot || {};
                return (
                  <div key={`receipt-${row.key}`} className="rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] text-slate-500">رقم الوصل</div>
                        <div className="font-black text-sm mt-1" dir="ltr">{row.receipt}</div>
                        <div className="text-[11px] text-slate-500 mt-2">{dateText(row.date)}</div>
                      </div>
                      <div className="text-left">
                        <div className="text-[11px] text-slate-500">المبلغ المسدد</div>
                        <div className="font-black text-lg text-emerald-700 mt-1">{money(row.amount, currency)}</div>
                      </div>
                    </div>
                    {(receipt.monthNameAr || receipt.monthId) && (
                      <div className="mt-3 pt-3 border-t border-emerald-100 text-xs text-slate-600 flex justify-between gap-3">
                        <span>الشهر</span>
                        <b>{receipt.monthNameAr || receipt.monthId}</b>
                      </div>
                    )}
                    {Number(receipt.totalOutstandingAfter || 0) > 0 && (
                      <div className="mt-2 text-xs text-slate-600 flex justify-between gap-3">
                        <span>المتبقي بعد التسديد</span>
                        <b>{money(receipt.totalOutstandingAfter, currency)}</b>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {legacyOnlyRows.length > 0 && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 leading-6">
            بعض التسديدات القديمة تمت قبل تفعيل حفظ رقم الوصل في السحابة، لذلك تظهر تفاصيل المبلغ والتاريخ من سجل الحركات بدون رقم وصل قديم.
          </div>
        )}

        {(data.invoices || []).length > 0 && (
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 mt-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock3 className="w-5 h-5 text-blue-600" />
              <h3 className="font-black text-lg">الحساب حسب الأشهر</h3>
            </div>
            <div className="space-y-2">
              {(data.invoices || []).slice(0, 12).map((inv, index) => (
                <div key={`${inv.monthId || index}-${inv.receiptNumber || ''}`} className="rounded-2xl border border-slate-100 px-4 py-3">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <div className="font-black text-sm">{inv.monthNameAr || inv.monthId || 'شهر'}</div>
                      <div className="text-[11px] text-slate-500 mt-1">المطلوب {money(inv.totalAmount, currency)}</div>
                    </div>
                    <div className="text-left">
                      <div className="text-[11px] text-slate-500">المتبقي</div>
                      <div className={`font-black text-sm mt-1 ${Number(inv.remainingAmount || 0) > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{money(inv.remainingAmount, currency)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-4 rounded-3xl bg-[#0B1F3B] text-white p-5">
          <div className="flex gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <h3 className="font-black">صفحة للقراءة فقط</h3>
              <p className="text-xs text-slate-300 leading-6 mt-1">هذه الصفحة تعرض معلومات حسابك فقط. لا يمكن تعديل الاشتراك أو تنفيذ أي تسديد من هذا الرابط.</p>
            </div>
          </div>
        </section>

        <div className="flex gap-2 mt-4">
          <button onClick={() => void load(true)} disabled={refreshing} className="flex-1 bg-white border border-slate-200 rounded-2xl py-3 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60">
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            تحديث الحساب
          </button>
          <button onClick={share} className="flex-1 bg-blue-600 text-white rounded-2xl py-3 font-black text-sm flex items-center justify-center gap-2">
            {copied ? <Copy className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
            {copied ? 'تم نسخ الرابط' : 'مشاركة الرابط'}
          </button>
        </div>

        <footer className="text-center text-[11px] text-slate-400 mt-7">مولدتك — إدارة المولدات والجباية</footer>
      </main>
    </div>
  );
}
