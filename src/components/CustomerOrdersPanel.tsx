import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck, Banknote, CheckCircle2, Clock3, Copy, CreditCard, Eye,
  Loader2, RefreshCw, Save, Settings2, ShieldCheck, Store, WalletCards, XCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type CustomerOrder = {
  id: string;
  order_number: string;
  order_type: 'new_subscription' | 'renewal';
  status: 'awaiting_payment' | 'awaiting_review' | 'approved' | 'rejected' | 'cancelled' | 'failed';
  customer_name: string;
  phone: string;
  email: string;
  generator_name: string | null;
  area: string | null;
  plan_name_snapshot: string;
  amount_iqd: number;
  payment_method: 'qi_card' | 'zain_cash';
  payment_destination_snapshot: string;
  payment_account_name_snapshot: string | null;
  receipt_path: string | null;
  customer_notes: string | null;
  admin_notes: string | null;
  rejection_reason: string | null;
  activated_until: string | null;
  approved_at: string | null;
  created_at: string;
};

type Settings = {
  id: number;
  qi_card_number: string | null;
  qi_card_account_name: string | null;
  qi_card_enabled: boolean;
  zain_cash_phone: string | null;
  zain_cash_account_name: string | null;
  zain_cash_enabled: boolean;
  instructions: string | null;
};

const iqd = (value: number) => `${new Intl.NumberFormat('ar-IQ').format(value)} د.ع`;
const fmt = (value: string | null) => value ? new Intl.DateTimeFormat('ar-IQ', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value)) : '—';

const statusMeta: Record<CustomerOrder['status'], { label: string; cls: string }> = {
  awaiting_payment: { label:'بانتظار الوصل', cls:'bg-slate-100 text-slate-700' },
  awaiting_review: { label:'بانتظار تأكيد المبلغ', cls:'bg-amber-100 text-amber-800' },
  approved: { label:'مفعّل', cls:'bg-emerald-100 text-emerald-800' },
  rejected: { label:'مرفوض', cls:'bg-rose-100 text-rose-800' },
  cancelled: { label:'ملغي', cls:'bg-slate-100 text-slate-600' },
  failed: { label:'فشل التفعيل', cls:'bg-red-100 text-red-800' },
};

export const CustomerOrdersPanel: React.FC = () => {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | CustomerOrder['status']>('awaiting_review');
  const [receiptUrls, setReceiptUrls] = useState<Record<string,string>>({});

  const load = async () => {
    setLoading(true);
    setMessage(null);
    const [o, s] = await Promise.all([
      supabase.from('customer_orders').select('*').order('created_at', { ascending:false }).limit(300),
      supabase.from('customer_order_payment_settings').select('*').eq('id', 1).single(),
    ]);
    if (o.error || s.error) setMessage(o.error?.message || s.error?.message || 'تعذر تحميل طلبات الموقع');
    else {
      setOrders((o.data || []) as CustomerOrder[]);
      setSettings(s.data as Settings);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => ({
    review: orders.filter(x => x.status === 'awaiting_review').length,
    payment: orders.filter(x => x.status === 'awaiting_payment').length,
    approved: orders.filter(x => x.status === 'approved').length,
    rejected: orders.filter(x => x.status === 'rejected').length,
  }), [orders]);

  const shown = filter === 'all' ? orders : orders.filter(x => x.status === filter);

  const saveSettings = async () => {
    if (!settings) return;
    if (settings.qi_card_enabled && !String(settings.qi_card_number || '').trim()) return setMessage('أدخل رقم حساب كي كارد أو عطّل الطريقة');
    if (settings.zain_cash_enabled && !String(settings.zain_cash_phone || '').trim()) return setMessage('أدخل رقم هاتف زين كاش أو عطّل الطريقة');
    setSaving(true); setMessage(null);
    const { data: user } = await supabase.auth.getUser();
    const { error } = await supabase.from('customer_order_payment_settings').update({
      qi_card_number: String(settings.qi_card_number || '').trim() || null,
      qi_card_account_name: String(settings.qi_card_account_name || '').trim() || null,
      qi_card_enabled: settings.qi_card_enabled,
      zain_cash_phone: String(settings.zain_cash_phone || '').trim() || null,
      zain_cash_account_name: String(settings.zain_cash_account_name || '').trim() || null,
      zain_cash_enabled: settings.zain_cash_enabled,
      instructions: String(settings.instructions || '').trim() || null,
      updated_by: user.user?.id || null,
    }).eq('id', 1);
    setSaving(false);
    setMessage(error ? `تعذر حفظ معلومات الدفع: ${error.message}` : 'تم حفظ أرقام الدفع الجديدة، وستظهر للطلبات الجديدة فقط');
  };

  const openReceipt = async (order: CustomerOrder) => {
    if (!order.receipt_path) return setMessage('هذا الطلب لا يحتوي على وصل');
    if (receiptUrls[order.id]) return window.open(receiptUrls[order.id], '_blank', 'noopener,noreferrer');
    const { data, error } = await supabase.storage.from('customer-order-receipts').createSignedUrl(order.receipt_path, 900);
    if (error || !data?.signedUrl) return setMessage('تعذر فتح الوصل');
    setReceiptUrls(prev => ({ ...prev, [order.id]: data.signedUrl }));
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const approve = async (order: CustomerOrder) => {
    if (!window.confirm(`تأكيد استلام مبلغ ${iqd(order.amount_iqd)} للطلب ${order.order_number} وتفعيل الحساب؟`)) return;
    setBusyId(order.id); setMessage(null);
    const { data, error } = await supabase.functions.invoke('approve-customer-order', { body: { action:'approve', order_id:order.id } });
    setBusyId(null);
    if (error || !data?.ok) return setMessage(`تعذر تفعيل الطلب: ${data?.error || error?.message || 'خطأ غير معروف'}`);
    setMessage(`تم تأكيد ${order.order_number} وتفعيل الحساب/الاشتراك بنجاح`);
    await load();
  };

  const reject = async (order: CustomerOrder) => {
    const reason = window.prompt('سبب الرفض الذي سيظهر للزبون:', 'المبلغ غير مستلم أو معلومات التحويل غير مطابقة');
    if (reason === null) return;
    setBusyId(order.id); setMessage(null);
    const { data, error } = await supabase.functions.invoke('approve-customer-order', { body: { action:'reject', order_id:order.id, reason } });
    setBusyId(null);
    if (error || !data?.ok) return setMessage(`تعذر رفض الطلب: ${data?.error || error?.message || 'خطأ غير معروف'}`);
    setMessage(`تم رفض ${order.order_number}`);
    await load();
  };

  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setMessage('تم النسخ'); } catch { setMessage('تعذر النسخ تلقائياً'); }
  };

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[28px] border-2 border-amber-300 bg-gradient-to-l from-amber-50 via-white to-blue-50 shadow-lg">
        <div className="absolute -left-16 -top-20 w-56 h-56 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="relative p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950 text-white text-xs font-black"><Store className="w-4 h-4 text-amber-300" /> طلبات الموقع — صندوق مستقل</div>
              <h2 className="text-2xl font-black mt-3">البيع والتجديد من الموقع</h2>
              <p className="text-sm text-slate-600 mt-1">الزبون يختار الباقة، يحول كي كارد أو زين كاش، ويرفع الوصل. أنت فقط تؤكد وصول المبلغ، والنظام يكمل التفعيل.</p>
            </div>
            <button onClick={() => void load()} className="p-3 rounded-2xl bg-white border shadow-sm"><RefreshCw className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-4 gap-3 mt-5">
            <button onClick={() => setFilter('awaiting_review')} className="rounded-2xl bg-amber-500 text-white p-4 text-right"><div className="text-xs opacity-80">تحتاج قرارك</div><div className="text-3xl font-black mt-1">{counts.review}</div></button>
            <button onClick={() => setFilter('awaiting_payment')} className="rounded-2xl bg-white border p-4 text-right"><div className="text-xs text-slate-500">بانتظار الوصل</div><div className="text-3xl font-black mt-1">{counts.payment}</div></button>
            <button onClick={() => setFilter('approved')} className="rounded-2xl bg-emerald-600 text-white p-4 text-right"><div className="text-xs opacity-80">تم تفعيلها</div><div className="text-3xl font-black mt-1">{counts.approved}</div></button>
            <button onClick={() => setFilter('rejected')} className="rounded-2xl bg-white border p-4 text-right"><div className="text-xs text-slate-500">مرفوضة</div><div className="text-3xl font-black mt-1">{counts.rejected}</div></button>
          </div>
        </div>
      </section>

      {message && <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">{message}</div>}

      {settings && <section className="bg-white border border-slate-200 rounded-3xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4"><div><h3 className="font-black flex items-center gap-2"><Settings2 className="w-5 h-5" /> معلومات التحويل التي تظهر للزبون</h3><p className="text-xs text-slate-500 mt-1">التغيير يؤثر على الطلبات الجديدة فقط؛ كل طلب يحفظ رقم التحويل المستخدم وقت إنشائه.</p></div><button disabled={saving} onClick={() => void saveSettings()} className="px-4 py-2.5 rounded-xl bg-slate-950 text-white font-black text-sm flex items-center gap-2 disabled:opacity-60">{saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>} حفظ</button></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex items-center justify-between mb-3"><b className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-emerald-700"/> كي كارد</b><label className="text-xs font-bold flex items-center gap-2"><input type="checkbox" checked={settings.qi_card_enabled} onChange={e=>setSettings({...settings,qi_card_enabled:e.target.checked})}/> فعال</label></div>
            <input value={settings.qi_card_number || ''} onChange={e=>setSettings({...settings,qi_card_number:e.target.value})} placeholder="رقم حساب كي كارد" className="w-full border rounded-xl px-3 py-3 mb-2 bg-white" />
            <input value={settings.qi_card_account_name || ''} onChange={e=>setSettings({...settings,qi_card_account_name:e.target.value})} placeholder="اسم صاحب الحساب (اختياري)" className="w-full border rounded-xl px-3 py-3 bg-white" />
          </div>
          <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-4">
            <div className="flex items-center justify-between mb-3"><b className="flex items-center gap-2"><WalletCards className="w-4 h-4 text-purple-700"/> زين كاش</b><label className="text-xs font-bold flex items-center gap-2"><input type="checkbox" checked={settings.zain_cash_enabled} onChange={e=>setSettings({...settings,zain_cash_enabled:e.target.checked})}/> فعال</label></div>
            <input value={settings.zain_cash_phone || ''} onChange={e=>setSettings({...settings,zain_cash_phone:e.target.value})} placeholder="رقم هاتف زين كاش" className="w-full border rounded-xl px-3 py-3 mb-2 bg-white" />
            <input value={settings.zain_cash_account_name || ''} onChange={e=>setSettings({...settings,zain_cash_account_name:e.target.value})} placeholder="اسم صاحب المحفظة (اختياري)" className="w-full border rounded-xl px-3 py-3 bg-white" />
          </div>
          <textarea value={settings.instructions || ''} onChange={e=>setSettings({...settings,instructions:e.target.value})} placeholder="تعليمات إضافية للتحويل (اختياري)" className="col-span-2 border rounded-xl px-3 py-3 min-h-20" />
        </div>
      </section>}

      <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between gap-3">
          <div><h3 className="font-black">كل الطلبات</h3><p className="text-xs text-slate-500 mt-1">كل معلومات الزبون، الباقة، المبلغ، طريقة التحويل والوصل محفوظة داخل الطلب.</p></div>
          <div className="flex items-center gap-2">
            {(['awaiting_review','awaiting_payment','approved','rejected','all'] as const).map(k => <button key={k} onClick={()=>setFilter(k)} className={`px-3 py-2 rounded-xl text-xs font-black ${filter===k?'bg-slate-950 text-white':'bg-slate-100 text-slate-600'}`}>{k==='awaiting_review'?'تحتاج قرار':k==='awaiting_payment'?'بانتظار الدفع':k==='approved'?'مفعلة':k==='rejected'?'مرفوضة':'الكل'}</button>)}
          </div>
        </div>
        {loading ? <div className="p-12 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto" /></div> : shown.length === 0 ? <div className="p-12 text-center text-slate-500 font-bold">لا توجد طلبات ضمن هذا التصنيف</div> : <div className="divide-y divide-slate-100">{shown.map(order => {
          const meta = statusMeta[order.status];
          return <div key={order.id} className={`p-5 ${order.status==='awaiting_review'?'bg-amber-50/35':''}`}>
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap"><span className="font-black font-mono">{order.order_number}</span><span className={`px-2.5 py-1 rounded-lg text-[11px] font-black ${meta.cls}`}>{meta.label}</span><span className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-blue-50 text-blue-700">{order.order_type==='new_subscription'?'اشتراك جديد':'تجديد'}</span></div>
                <div className="grid grid-cols-4 gap-x-5 gap-y-3 mt-4 text-sm">
                  <div><div className="text-[11px] text-slate-400">الزبون</div><b>{order.customer_name}</b></div>
                  <div><div className="text-[11px] text-slate-400">الهاتف</div><b>{order.phone}</b></div>
                  <div><div className="text-[11px] text-slate-400">الإيميل</div><b className="text-xs">{order.email}</b></div>
                  <div><div className="text-[11px] text-slate-400">المولدة</div><b>{order.generator_name || '—'}</b></div>
                  <div><div className="text-[11px] text-slate-400">الباقة</div><b>{order.plan_name_snapshot}</b></div>
                  <div><div className="text-[11px] text-slate-400">المبلغ</div><b className="text-emerald-700">{iqd(order.amount_iqd)}</b></div>
                  <div><div className="text-[11px] text-slate-400">طريقة الدفع</div><b>{order.payment_method==='qi_card'?'كي كارد':'زين كاش'}</b></div>
                  <div><div className="text-[11px] text-slate-400">وقت الطلب</div><b className="text-xs">{fmt(order.created_at)}</b></div>
                </div>
                <div className="mt-4 rounded-2xl bg-slate-50 border p-3 flex items-center gap-3 text-sm"><Banknote className="w-4 h-4 text-slate-500"/><span className="text-slate-500">حوّل إلى:</span><b className="font-mono">{order.payment_destination_snapshot}</b><button onClick={()=>void copy(order.payment_destination_snapshot)} className="p-1.5 rounded-lg bg-white border"><Copy className="w-3.5 h-3.5"/></button>{order.payment_account_name_snapshot&&<span className="text-xs text-slate-500">({order.payment_account_name_snapshot})</span>}</div>
                {order.customer_notes && <div className="mt-3 text-xs text-slate-600"><b>ملاحظة الزبون:</b> {order.customer_notes}</div>}
                {order.rejection_reason && <div className="mt-3 text-xs text-rose-700"><b>سبب الرفض:</b> {order.rejection_reason}</div>}
                {order.activated_until && <div className="mt-3 text-xs text-emerald-700"><b>فعال لغاية:</b> {fmt(order.activated_until)}</div>}
              </div>
              <div className="w-48 shrink-0 space-y-2">
                {order.receipt_path && <button onClick={()=>void openReceipt(order)} className="w-full px-3 py-2.5 rounded-xl bg-white border font-black text-xs flex items-center justify-center gap-2"><Eye className="w-4 h-4"/> فتح الوصل</button>}
                {order.status==='awaiting_review' && <>
                  <button disabled={busyId===order.id} onClick={()=>void approve(order)} className="w-full px-3 py-3 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center gap-2 disabled:opacity-60">{busyId===order.id?<Loader2 className="w-4 h-4 animate-spin"/>:<CheckCircle2 className="w-4 h-4"/>} تم استلام المبلغ وتفعيل الحساب</button>
                  <button disabled={busyId===order.id} onClick={()=>void reject(order)} className="w-full px-3 py-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-black text-xs flex items-center justify-center gap-2"><XCircle className="w-4 h-4"/> رفض الطلب</button>
                </>}
                {order.status==='approved' && <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 text-center text-xs font-black"><BadgeCheck className="w-5 h-5 mx-auto mb-1"/> تم التسليم تلقائياً</div>}
              </div>
            </div>
          </div>;
        })}</div>}
      </section>
    </div>
  );
};
