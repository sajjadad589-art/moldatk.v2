import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, BadgeCheck, Banknote, Check, CircleDollarSign, Copy, CreditCard,
  Loader2, LockKeyhole, MessageCircle, Phone, RefreshCw, Send, ShieldCheck,
  Sparkles, UploadCloud, UserRound, WalletCards, Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type PaidPlan = {
  id: string;
  name: string;
  plan_code: string | null;
  duration_months: number;
  duration_days: number | null;
  is_custom_duration: boolean;
  price_iqd: number;
};

type PaymentSettings = {
  qi_card_number: string | null;
  qi_card_account_name: string | null;
  qi_card_enabled: boolean;
  zain_cash_phone: string | null;
  zain_cash_account_name: string | null;
  zain_cash_enabled: boolean;
  instructions: string | null;
};

type OrderSummary = {
  id?: string;
  order_number: string;
  tracking_token?: string;
  plan_name_snapshot: string;
  amount_iqd: number;
  payment_method: 'qi_card' | 'zain_cash';
  payment_destination_snapshot: string;
  payment_account_name_snapshot: string | null;
  status: string;
};

type RenewalCustomer = {
  name: string;
  email: string;
  phone: string | null;
  generator_id: string;
  generator_name: string;
  area: string | null;
  status: string;
  latest_subscription: { ends_at: string; status: string } | null;
};

type Stage = 'choose' | 'details' | 'plans' | 'payment' | 'receipt' | 'review' | 'approved' | 'rejected';
type Mode = 'new_subscription' | 'renewal';

const iqd = (value: number) => `${new Intl.NumberFormat('ar-IQ').format(value)} د.ع`;
const daysForPlan = (plan: PaidPlan) => Number(plan.duration_days || plan.duration_months * 30 || 0);
const TRACKING_KEY = 'moldatk_customer_order_tracking';

export const CustomerOrderAssistant: React.FC = () => {
  const [plans, setPlans] = useState<PaidPlan[]>([]);
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [stage, setStage] = useState<Stage>('choose');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'qi_card' | 'zain_cash' | ''>('');
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [renewalCustomer, setRenewalCustomer] = useState<RenewalCustomer | null>(null);
  const [question, setQuestion] = useState('');
  const [qa, setQa] = useState<Array<{ who: 'user' | 'agent'; text: string }>>([]);

  const [newForm, setNewForm] = useState({
    customer_name: '', phone: '', generator_name: '', area: '', email: '', password: '', password2: '', notes: ''
  });
  const [renewForm, setRenewForm] = useState({ email: '', password: '', notes: '' });

  const selectedPlan = plans.find(p => p.id === selectedPlanId) || null;
  const bestValuePlan = useMemo(() => {
    return [...plans].filter(p => daysForPlan(p) > 0).sort((a, b) => {
      const aRate = Number(a.price_iqd) / daysForPlan(a);
      const bRate = Number(b.price_iqd) / daysForPlan(b);
      return aRate - bRate;
    })[0] || null;
  }, [plans]);

  const invokeOrders = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('customer-orders', { body });
    if (error || !data?.ok) throw new Error(data?.error || error?.message || 'تعذر تنفيذ الطلب');
    return data;
  };

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await invokeOrders({ action: 'public_config' });
      setPlans((data.plans || []) as PaidPlan[]);
      setSettings(data.settings as PaymentSettings);
    } catch (e: any) {
      setMessage(e?.message || 'تعذر تحميل الباقات');
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async (trackingToken?: string) => {
    const token = trackingToken || order?.tracking_token || localStorage.getItem(TRACKING_KEY) || '';
    if (!token) return;
    try {
      const data = await invokeOrders({ action: 'order_status', tracking_token: token });
      const row = data.order;
      setStatusNote(row.rejection_reason || '');
      setOrder(prev => ({
        id: prev?.id,
        order_number: row.order_number,
        tracking_token: token,
        plan_name_snapshot: row.plan_name_snapshot,
        amount_iqd: Number(row.amount_iqd || 0),
        payment_method: row.payment_method,
        payment_destination_snapshot: prev?.payment_destination_snapshot || '',
        payment_account_name_snapshot: prev?.payment_account_name_snapshot || null,
        status: row.status,
      }));
      if (row.status === 'approved') setStage('approved');
      else if (row.status === 'rejected') setStage('rejected');
      else if (row.status === 'awaiting_review') setStage('review');
      else if (row.status === 'awaiting_payment') setStage('receipt');
    } catch {
      localStorage.removeItem(TRACKING_KEY);
    }
  };

  useEffect(() => {
    void loadConfig();
    const existing = localStorage.getItem(TRACKING_KEY);
    if (existing) void refreshStatus(existing);
  }, []);

  useEffect(() => {
    if (stage !== 'review') return;
    const timer = window.setInterval(() => void refreshStatus(), 15000);
    return () => window.clearInterval(timer);
  }, [stage, order?.tracking_token]);

  const agentText = useMemo(() => {
    if (stage === 'choose') return 'هلا بيك بمولدتك. أني مساعد الاشتراكات، أكملك الطلب من هنا للنهاية. إذا حسابك جديد أسويلك طلب جديد، وإذا اشتراكك خلص أجددلك نفس الحساب بدون ما تضيع بياناتك.';
    if (stage === 'details' && mode === 'new_subscription') return 'تمام. خل نثبت معلومات الحساب الجديد أولاً. راح أراجعها وياك قبل الدفع حتى ما يصير أي خطأ.';
    if (stage === 'details' && mode === 'renewal') return 'حتى أتأكد أن التجديد إلك فعلاً، سجل دخولك بنفس إيميل وكلمة مرور حساب المولدة. بعدها أجيبلك معلومات حسابك والباقات المتاحة.';
    if (stage === 'plans') {
      const hint = bestValuePlan ? ` وإذا تريد ترشيحي: ${bestValuePlan.name} حالياً هي الأوفر حسب السعر مقابل المدة.` : '';
      return `هاي الباقات المدفوعة المتاحة حالياً. باقة الفحص ما تنباع من الموقع نهائياً.${hint}`;
    }
    if (stage === 'payment') return 'اختيار مرتب. هسه اختار طريقة التحويل، وأنا أطلعلك المبلغ ورقم الحساب الصحيح مباشرة. السعر مثبت من النظام وما يتغير من المتصفح.';
    if (stage === 'receipt') return 'باقي آخر خطوة: حوّل نفس المبلغ الظاهر وارفع الوصل. من ترفعه، الطلب يروح مباشرة للإدارة للتأكد من وصول المبلغ.';
    if (stage === 'review') return 'وصلني الوصل وتم إرسال الطلب للإدارة. أبقى أتحقق من حالته تلقائياً؛ أول ما يتم تأكيد استلام المبلغ يتحول حسابك إلى فعال.';
    if (stage === 'approved') return 'تمت العملية بنجاح. حسابك صار فعال وتكدر تدخل للنظام بنفس البريد وكلمة المرور اللي ثبتتها.';
    if (stage === 'rejected') return 'الإدارة ما كدرت تأكد الدفع على هذا الطلب. شوف الملاحظة أدناه، وإذا تحتاج تقدر تبدأ طلب جديد بعد تصحيح التحويل.';
    return '';
  }, [stage, mode, bestValuePlan]);

  const continueNewDetails = () => {
    setMessage(null);
    const f = newForm;
    if (f.customer_name.trim().length < 2) return setMessage('اكتب اسم صاحب المولدة بصورة صحيحة');
    if (f.phone.trim().length < 8) return setMessage('اكتب رقم هاتف صحيح');
    if (f.generator_name.trim().length < 2) return setMessage('اكتب اسم المولدة');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setMessage('اكتب بريد إلكتروني صحيح');
    if (f.password.length < 6) return setMessage('كلمة المرور لازم تكون 6 خانات أو أكثر');
    if (f.password !== f.password2) return setMessage('تأكيد كلمة المرور غير مطابق');
    setStage('plans');
  };

  const verifyRenewal = async () => {
    setMessage(null);
    if (!renewForm.email.trim() || !renewForm.password) return setMessage('اكتب البريد وكلمة المرور');
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: renewForm.email.trim().toLowerCase(), password: renewForm.password });
      if (error) throw new Error('البريد أو كلمة المرور غير صحيحة');
      const data = await invokeOrders({ action: 'renewal_context' });
      setRenewalCustomer(data.customer as RenewalCustomer);
      setStage('plans');
    } catch (e: any) {
      await supabase.auth.signOut().catch(() => undefined);
      setMessage(e?.message || 'تعذر التحقق من الحساب');
    } finally {
      setBusy(false);
    }
  };

  const goPayment = (planId: string) => {
    setSelectedPlanId(planId);
    setPaymentMethod('');
    setStage('payment');
    setMessage(null);
  };

  const createOrder = async () => {
    if (!selectedPlan || !paymentMethod) return setMessage('اختار الباقة وطريقة الدفع');
    setBusy(true);
    setMessage(null);
    try {
      let data: any;
      if (mode === 'new_subscription') {
        const email = newForm.email.trim().toLowerCase();
        const { data: signup, error: signupError } = await supabase.auth.signUp({
          email,
          password: newForm.password,
          options: { data: { full_name: newForm.customer_name.trim() } },
        });
        if (signupError || !signup.user) {
          throw new Error(signupError?.message?.toLowerCase().includes('already') ? 'هذا البريد مستخدم مسبقاً. إذا عندك حساب اختار تجديد اشتراك.' : (signupError?.message || 'تعذر تجهيز حساب الدخول'));
        }
        data = await invokeOrders({
          action: 'create_new_order',
          customer_name: newForm.customer_name.trim(),
          phone: newForm.phone.trim(),
          generator_name: newForm.generator_name.trim(),
          area: newForm.area.trim(),
          email,
          pending_user_id: signup.user.id,
          plan_id: selectedPlan.id,
          payment_method: paymentMethod,
          customer_notes: newForm.notes.trim(),
        });
      } else {
        data = await invokeOrders({
          action: 'create_renewal_order',
          plan_id: selectedPlan.id,
          payment_method: paymentMethod,
          customer_notes: renewForm.notes.trim(),
        });
      }

      const nextOrder = data.order as OrderSummary;
      setOrder(nextOrder);
      if (nextOrder.tracking_token) localStorage.setItem(TRACKING_KEY, nextOrder.tracking_token);
      setStage('receipt');
      await supabase.auth.signOut().catch(() => undefined);
    } catch (e: any) {
      setMessage(e?.message || 'تعذر إنشاء الطلب');
    } finally {
      setBusy(false);
    }
  };

  const uploadReceipt = async () => {
    if (!order?.tracking_token) return setMessage('رمز الطلب غير موجود');
    if (!receiptFile) return setMessage('ارفع صورة أو PDF لوصل التحويل');
    if (receiptFile.size > 5 * 1024 * 1024) return setMessage('حجم الوصل يجب أن يكون أقل من 5MB');
    setBusy(true);
    setMessage(null);
    try {
      const prep = await invokeOrders({
        action: 'create_receipt_upload',
        tracking_token: order.tracking_token,
        content_type: receiptFile.type || 'image/jpeg',
      });
      const { error: uploadError } = await supabase.storage
        .from('customer-order-receipts')
        .uploadToSignedUrl(prep.path, prep.token, receiptFile, { contentType: receiptFile.type || 'image/jpeg' });
      if (uploadError) throw uploadError;
      await invokeOrders({ action: 'finalize_receipt', tracking_token: order.tracking_token, receipt_path: prep.path });
      setOrder({ ...order, status: 'awaiting_review' });
      setStage('review');
    } catch (e: any) {
      setMessage(e?.message || 'تعذر رفع الوصل');
    } finally {
      setBusy(false);
    }
  };

  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setMessage('تم نسخ الرقم'); } catch { setMessage('انسخ الرقم يدوياً'); }
  };

  const restart = async () => {
    localStorage.removeItem(TRACKING_KEY);
    await supabase.auth.signOut().catch(() => undefined);
    setMode(null); setStage('choose'); setSelectedPlanId(''); setPaymentMethod(''); setOrder(null);
    setReceiptFile(null); setStatusNote(''); setRenewalCustomer(null); setMessage(null);
  };

  const askAgent = () => {
    const q = question.trim();
    if (!q) return;
    const t = q.toLowerCase();
    let answer = 'أكدر أساعدك بالباقات، التجديد، طرق الدفع، الأجهزة، وطريقة تفعيل الحساب. وإذا تريد نكمل الطلب، اختار من الخطوات الظاهرة فوق.';
    if (t.includes('فحص') || t.includes('test')) answer = 'باقة الفحص ما تنطلب من الموقع. الطلب الآلي مخصص للباقات المدفوعة فقط.';
    else if (t.includes('سعر') || t.includes('باق')) answer = plans.length ? `حالياً عدنا ${plans.length} باقات مدفوعة، والأسعار الظاهرة عند اختيار الباقة هي الأسعار الرسمية المثبتة بالنظام.` : 'حالياً ماكو باقات مدفوعة مفعلة للطلب من الموقع.';
    else if (t.includes('تجديد') || t.includes('منتهي') || t.includes('خلص')) answer = 'إي، إذا اشتراكك منتهي اختار «تجديد اشتراك»، سجل دخولك، وبعد تأكيد الدفع تتجدد نفس المولدة وتبقى بياناتك مثل ما هي.';
    else if (t.includes('كي') || t.includes('qi')) answer = 'إذا تختار كي كارد أطلعلك رقم الحساب المسجل بالإدارة والمبلغ المطلوب، وبعد التحويل ترفع الوصل هنا.';
    else if (t.includes('زين') || t.includes('cash')) answer = 'إذا تختار زين كاش أطلعلك رقم الهاتف المخصص للتحويل والمبلغ المطلوب، وبعدها ترفع الوصل.';
    else if (t.includes('ايفون') || t.includes('iphone')) answer = 'تقدر تستخدم مولدتك على iPhone من Safari وتضيفه للشاشة الرئيسية.';
    else if (t.includes('اندرويد') || t.includes('android') || t.includes('sunmi')) answer = 'مولدتك يشتغل على Android وأجهزة SUNMI، ونسخة Android تدعم خصائص الجهاز مثل الطباعة.';
    setQa(prev => [...prev, { who: 'user', text: q }, { who: 'agent', text: answer }].slice(-8));
    setQuestion('');
  };

  if (loading) {
    return <div className="min-h-[70vh] flex items-center justify-center text-white"><Loader2 className="w-7 h-7 animate-spin" /></div>;
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#071126] text-white font-['Cairo',sans-serif]">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <a href="/download" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white mb-5"><ArrowLeft className="w-4 h-4" /> رجوع للموقع</a>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] overflow-hidden shadow-2xl">
          <div className="p-5 sm:p-7 border-b border-white/10 bg-gradient-to-l from-amber-400/10 to-blue-500/5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center"><MessageCircle className="w-6 h-6" /></div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black">مساعد اشتراكات مولدتك</h1>
                <p className="text-xs text-slate-400 mt-1">طلب جديد أو تجديد — من المحادثة إلى التفعيل</p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-7 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 shrink-0 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center"><Sparkles className="w-4 h-4" /></div>
              <div className="max-w-2xl rounded-2xl rounded-tr-md bg-white/10 border border-white/10 px-4 py-3 text-sm leading-7 text-slate-100">{agentText}</div>
            </div>

            {message && <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{message}</div>}

            {stage === 'choose' && (
              <div className="grid sm:grid-cols-2 gap-3 mr-0 sm:mr-12">
                <button onClick={() => { setMode('new_subscription'); setStage('details'); }} className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 text-right hover:bg-emerald-400/15 transition-all">
                  <UserRound className="w-7 h-7 text-emerald-300 mb-3" />
                  <div className="font-black">اشتراك جديد</div>
                  <div className="text-xs text-slate-400 mt-1">حساب جديد ومولدة جديدة</div>
                </button>
                <button onClick={() => { setMode('renewal'); setStage('details'); }} className="rounded-3xl border border-blue-400/20 bg-blue-400/10 p-5 text-right hover:bg-blue-400/15 transition-all">
                  <RefreshCw className="w-7 h-7 text-blue-300 mb-3" />
                  <div className="font-black">تجديد اشتراك</div>
                  <div className="text-xs text-slate-400 mt-1">تفعيل نفس حسابك وبياناتك</div>
                </button>
              </div>
            )}

            {stage === 'details' && mode === 'new_subscription' && (
              <div className="mr-0 sm:mr-12 rounded-3xl border border-white/10 bg-[#0b1731] p-5 grid sm:grid-cols-2 gap-3">
                <input value={newForm.customer_name} onChange={e => setNewForm({ ...newForm, customer_name:e.target.value })} placeholder="اسم صاحب المولدة" className="input-order" />
                <input value={newForm.phone} onChange={e => setNewForm({ ...newForm, phone:e.target.value })} placeholder="رقم الهاتف" className="input-order" />
                <input value={newForm.generator_name} onChange={e => setNewForm({ ...newForm, generator_name:e.target.value })} placeholder="اسم المولدة" className="input-order" />
                <input value={newForm.area} onChange={e => setNewForm({ ...newForm, area:e.target.value })} placeholder="المنطقة / العنوان (اختياري)" className="input-order" />
                <input type="email" value={newForm.email} onChange={e => setNewForm({ ...newForm, email:e.target.value })} placeholder="إيميل تسجيل الدخول" className="input-order sm:col-span-2" />
                <input type="password" value={newForm.password} onChange={e => setNewForm({ ...newForm, password:e.target.value })} placeholder="كلمة المرور (6 خانات أو أكثر)" className="input-order" />
                <input type="password" value={newForm.password2} onChange={e => setNewForm({ ...newForm, password2:e.target.value })} placeholder="تأكيد كلمة المرور" className="input-order" />
                <textarea value={newForm.notes} onChange={e => setNewForm({ ...newForm, notes:e.target.value })} placeholder="ملاحظة للطلب (اختياري)" className="input-order sm:col-span-2 min-h-24" />
                <button onClick={continueNewDetails} className="sm:col-span-2 rounded-2xl bg-amber-400 text-slate-950 font-black py-3">متابعة للباقات</button>
              </div>
            )}

            {stage === 'details' && mode === 'renewal' && (
              <div className="mr-0 sm:mr-12 rounded-3xl border border-white/10 bg-[#0b1731] p-5 space-y-3">
                <input type="email" value={renewForm.email} onChange={e => setRenewForm({ ...renewForm, email:e.target.value })} placeholder="إيميل حساب المولدة" className="input-order" />
                <input type="password" value={renewForm.password} onChange={e => setRenewForm({ ...renewForm, password:e.target.value })} placeholder="كلمة المرور" className="input-order" />
                <textarea value={renewForm.notes} onChange={e => setRenewForm({ ...renewForm, notes:e.target.value })} placeholder="ملاحظة للطلب (اختياري)" className="input-order min-h-20" />
                <button disabled={busy} onClick={() => void verifyRenewal()} className="w-full rounded-2xl bg-blue-500 disabled:opacity-60 text-white font-black py-3 flex items-center justify-center gap-2">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} تحقق من حسابي
                </button>
              </div>
            )}

            {stage === 'plans' && (
              <div className="mr-0 sm:mr-12 space-y-4">
                {renewalCustomer && <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4 text-sm"><b>{renewalCustomer.generator_name}</b><span className="text-slate-400"> — تم التحقق من الحساب بنجاح</span></div>}
                {plans.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/20 p-6 text-center text-slate-400">ماكو باقات مدفوعة مفعلة حالياً. الإدارة تحتاج تثبت أسعار الباقات أولاً.</div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {plans.map(plan => {
                      const best = bestValuePlan?.id === plan.id && plans.length > 1;
                      return <button key={plan.id} onClick={() => goPayment(plan.id)} className={`relative rounded-3xl border p-5 text-right transition-all ${best ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                        {best && <span className="absolute left-3 top-3 text-[10px] px-2 py-1 rounded-full bg-amber-400 text-slate-950 font-black">الأوفر</span>}
                        <div className="font-black text-lg">{plan.name}</div>
                        <div className="text-2xl font-black text-amber-300 mt-3">{iqd(Number(plan.price_iqd))}</div>
                        <div className="text-xs text-slate-400 mt-1">مدة تقريبية: {daysForPlan(plan)} يوم</div>
                      </button>;
                    })}
                  </div>
                )}
              </div>
            )}

            {stage === 'payment' && selectedPlan && (
              <div className="mr-0 sm:mr-12 space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 flex items-center justify-between gap-4">
                  <div><div className="text-xs text-slate-400">الباقة المختارة</div><div className="font-black mt-1">{selectedPlan.name}</div></div>
                  <div className="text-xl font-black text-amber-300">{iqd(Number(selectedPlan.price_iqd))}</div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {settings?.qi_card_enabled && settings.qi_card_number && <button onClick={() => setPaymentMethod('qi_card')} className={`rounded-3xl border p-5 text-right ${paymentMethod==='qi_card'?'border-emerald-400 bg-emerald-400/10':'border-white/10 bg-white/5'}`}><CreditCard className="w-7 h-7 text-emerald-300 mb-3"/><b>كي كارد</b><div className="text-xs text-slate-400 mt-1">تحويل إلى رقم الحساب المسجل</div></button>}
                  {settings?.zain_cash_enabled && settings.zain_cash_phone && <button onClick={() => setPaymentMethod('zain_cash')} className={`rounded-3xl border p-5 text-right ${paymentMethod==='zain_cash'?'border-purple-400 bg-purple-400/10':'border-white/10 bg-white/5'}`}><WalletCards className="w-7 h-7 text-purple-300 mb-3"/><b>زين كاش</b><div className="text-xs text-slate-400 mt-1">تحويل إلى رقم الهاتف المسجل</div></button>}
                </div>
                {paymentMethod && <button disabled={busy} onClick={() => void createOrder()} className="w-full rounded-2xl bg-amber-400 disabled:opacity-60 text-slate-950 font-black py-3 flex items-center justify-center gap-2">{busy?<Loader2 className="w-4 h-4 animate-spin"/>:<Check className="w-4 h-4"/>} تثبيت الطلب وإظهار معلومات التحويل</button>}
              </div>
            )}

            {stage === 'receipt' && order && (
              <div className="mr-0 sm:mr-12 rounded-3xl border border-amber-400/20 bg-amber-400/[0.07] p-5 space-y-4">
                <div className="flex items-center justify-between gap-3"><div><div className="text-xs text-slate-400">رقم الطلب</div><div className="font-black font-mono">{order.order_number}</div></div><div className="text-2xl font-black text-amber-300">{iqd(order.amount_iqd)}</div></div>
                <div className="rounded-2xl bg-black/20 border border-white/10 p-4">
                  <div className="text-xs text-slate-400 mb-2">{order.payment_method === 'qi_card' ? 'رقم حساب كي كارد' : 'رقم هاتف زين كاش'}</div>
                  <div className="flex items-center gap-2"><div className="flex-1 text-xl font-black font-mono break-all">{order.payment_destination_snapshot}</div><button onClick={() => void copyText(order.payment_destination_snapshot)} className="p-2 rounded-xl bg-white/10"><Copy className="w-4 h-4"/></button></div>
                  {order.payment_account_name_snapshot && <div className="text-xs text-slate-400 mt-2">اسم الحساب: {order.payment_account_name_snapshot}</div>}
                </div>
                <label className="block rounded-2xl border border-dashed border-white/20 p-5 text-center cursor-pointer hover:bg-white/5"><UploadCloud className="w-7 h-7 mx-auto text-amber-300 mb-2"/><div className="font-bold text-sm">ارفع وصل التحويل</div><div className="text-xs text-slate-500 mt-1">صورة أو PDF — أقصى حجم 5MB</div><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={e => setReceiptFile(e.target.files?.[0] || null)} /></label>
                {receiptFile && <div className="text-xs text-emerald-300"><BadgeCheck className="w-4 h-4 inline ml-1"/>{receiptFile.name}</div>}
                <button disabled={busy || !receiptFile} onClick={() => void uploadReceipt()} className="w-full rounded-2xl bg-emerald-500 disabled:opacity-50 text-slate-950 font-black py-3 flex items-center justify-center gap-2">{busy?<Loader2 className="w-4 h-4 animate-spin"/>:<Send className="w-4 h-4"/>} إرسال الوصل للإدارة</button>
              </div>
            )}

            {stage === 'review' && order && (
              <div className="mr-0 sm:mr-12 rounded-3xl border border-blue-400/20 bg-blue-400/10 p-6 text-center">
                <Loader2 className="w-9 h-9 animate-spin mx-auto text-blue-300"/>
                <div className="font-black mt-3">طلبك بانتظار تأكيد استلام المبلغ</div>
                <div className="text-xs text-slate-400 mt-2">{order.order_number} — {order.plan_name_snapshot} — {iqd(order.amount_iqd)}</div>
                <button onClick={() => void refreshStatus()} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-xs font-bold"><RefreshCw className="w-4 h-4"/> تحقق الآن</button>
              </div>
            )}

            {stage === 'approved' && order && (
              <div className="mr-0 sm:mr-12 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-6 text-center">
                <BadgeCheck className="w-12 h-12 mx-auto text-emerald-300"/>
                <div className="text-xl font-black mt-3">تم تفعيل حسابك</div>
                <div className="text-sm text-slate-300 mt-2">الدخول يكون بنفس البريد وكلمة المرور اللي استخدمتها أثناء الطلب.</div>
                <a href="/" className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-400 text-slate-950 font-black">دخول مولدتك <ArrowLeft className="w-4 h-4"/></a>
              </div>
            )}

            {stage === 'rejected' && order && (
              <div className="mr-0 sm:mr-12 rounded-3xl border border-rose-400/20 bg-rose-400/10 p-6 text-center">
                <div className="text-lg font-black">الطلب يحتاج تصحيح</div>
                <div className="text-sm text-rose-100 mt-2">{statusNote || 'تعذر تأكيد استلام المبلغ.'}</div>
                <button onClick={() => void restart()} className="mt-5 px-5 py-3 rounded-2xl bg-white/10 font-black">بدء طلب جديد</button>
              </div>
            )}

            <div className="border-t border-white/10 pt-5">
              <div className="flex items-center gap-2 mb-3 text-xs text-slate-400"><Zap className="w-4 h-4 text-amber-300"/> عندك سؤال قبل ما تكمل؟ احچي وياي.</div>
              {qa.length > 0 && <div className="space-y-2 mb-3">{qa.map((x,i)=><div key={i} className={`text-sm px-3 py-2 rounded-2xl max-w-[85%] ${x.who==='user'?'mr-auto bg-blue-500/15 border border-blue-400/20':'ml-auto bg-white/10 border border-white/10'}`}>{x.text}</div>)}</div>}
              <div className="flex gap-2"><input value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();askAgent();}}} placeholder="مثلاً: شنو الباقة الأوفر؟" className="flex-1 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-amber-400/50 text-sm"/><button onClick={askAgent} className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center"><Send className="w-4 h-4"/></button></div>
            </div>
          </div>
        </div>
      </div>
      <style>{`.input-order{width:100%;border-radius:1rem;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);padding:.8rem 1rem;color:white;outline:none}.input-order:focus{border-color:rgba(251,191,36,.55)}.input-order::placeholder{color:#64748b}`}</style>
    </div>
  );
};
