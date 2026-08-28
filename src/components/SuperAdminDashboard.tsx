import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Bell, Building2, CalendarClock, CircleDollarSign, LogOut, Megaphone,
  Plus, RefreshCw, ShieldCheck, Users, WalletCards, Wrench, X, UserPlus, Eye, CreditCard, Power, Pencil, KeyRound, PauseCircle, Save, Clock3, Trash2, FileSpreadsheet, UploadCloud
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Subscriber, SubscriptionTierType, PaymentStatus, MonthlyTariffRecord, LineDistribution } from '../types';
import { INITIAL_MONTHLY_TARIFFS } from '../data/initialData';
import { calculateSubscriberBill } from '../utils/formatters';

type Generator = {
  id: string;
  name: string;
  owner_name: string;
  phone: string | null;
  area: string | null;
  status: 'active' | 'suspended' | 'expired';
  created_at: string;
  email: string | null;
  suspension_reason: string | null;
  suspended_at: string | null;
};

type Subscription = {
  id: string;
  generator_id: string;
  starts_at: string;
  ends_at: string;
  price_iqd: number;
  status: 'active' | 'suspended' | 'expired';
  plan_id: string | null;
};

type SubscriptionPlan = { id: string; name: string; duration_months: number; duration_days: number | null; plan_code: string | null; is_custom_duration: boolean; price_iqd: number; is_active: boolean; };

type AdminTransaction = {
  id: string;
  generator_id: string | null;
  direction: 'income' | 'refund';
  category: 'subscription' | 'renewal' | 'setup' | 'other';
  amount_iqd: number;
  payment_method: string | null;
  notes: string | null;
  received_at: string;
};

type AppNotification = {
  id: string;
  title: string;
  body: string;
  category: 'maintenance' | 'offer' | 'update' | 'general';
  target_type: 'all_generators' | 'single_generator';
  generator_id: string | null;
  is_active: boolean;
  created_at: string;
};

type Tab = 'overview' | 'generators' | 'finance' | 'notifications';
interface Props { onLogout: () => void; }

type ExcelImportReport = {
  status: 'idle' | 'processing' | 'success' | 'error';
  title: string;
  generatorName?: string;
  fileName?: string;
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  totalColumns: number;
  mappedColumns: number;
  unmappedColumns: string[];
  cellsRead: number;
  cellsImported: number;
  warnings: string[];
  errors: string[];
};

const EMPTY_EXCEL_REPORT: ExcelImportReport = {
  status: 'idle',
  title: '',
  totalRows: 0,
  importedRows: 0,
  skippedRows: 0,
  totalColumns: 0,
  mappedColumns: 0,
  unmappedColumns: [],
  cellsRead: 0,
  cellsImported: 0,
  warnings: [],
  errors: [],
};

const iqd = (value: number) => `${new Intl.NumberFormat('ar-IQ').format(value)} د.ع`;
const dateText = (value: string) => new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const localDateTimeValue = (date = new Date()) => { const d = new Date(date.getTime() - date.getTimezoneOffset()*60000); return d.toISOString().slice(0,16); };
const customMinutes = (days: string, hours: string, minutes: string) => Math.max(0, Number(days||0)*1440 + Number(hours||0)*60 + Number(minutes||0));
const planLabel = (p: SubscriptionPlan) => p.is_custom_duration ? p.name : p.name;
const planDurationMs = (p: SubscriptionPlan, days='0', hours='0', minutes='0') => p.is_custom_duration ? customMinutes(days,hours,minutes)*60000 : Number(p.duration_days || p.duration_months*30)*86400000;

const scopedKey = (baseKey: string, generatorId: string) => `${baseKey}_${generatorId}`;
const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) as T : fallback;
  } catch (e) {
    return fallback;
  }
};

const normalizeText = (value: unknown) => String(value ?? '').trim();
const normalizeHeader = (value: unknown) => normalizeText(value)
  .replace(/[ً-ْ]/g, '')
  .replace(/[أإآ]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ى/g, 'ي')
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  .replace(/\s+/g, '')
  .replace(/[ـ_\-.\/\:،,()\[\]]/g, '')
  .toLowerCase();

const rowValue = (row: Record<string, unknown>, aliases: string[]) => {
  const wanted = aliases.map(normalizeHeader);
  for (const key of Object.keys(row)) {
    if (wanted.includes(normalizeHeader(key))) return row[key];
  }
  return undefined;
};

const EXCEL_FIELD_ALIASES: Record<string, string[]> = {
  fullName: ['اسم المشترك', 'اسم المشترك الكامل', 'الاسم', 'اسم الزبون', 'اسم العميل', 'المشترك', 'المستهلك', 'fullName', 'name', 'subscriberName'],
  phone: ['رقم الهاتف', 'الهاتف', 'رقم الموبايل', 'موبايل', 'الموبايل', 'رقم العميل', 'phone', 'mobile', 'mobileNumber'],
  amperes: ['الأمبير', 'الامبير', 'امبير', 'عدد الامبير', 'عدد الأمبيرات', 'amperes', 'amps', 'amp'],
  tier: ['نوع الاشتراك', 'نوع المشترك', 'الفئة', 'التصنيف', 'tier', 'type', 'subscriptionType'],
  line: ['الخط', 'اسم الخط', 'خط', 'المنطقة/الخط', 'line', 'lineName', 'zone'],
  address: ['العنوان', 'الموقع', 'الدار', 'عنوان السكن', 'address', 'location'],
  boxNumber: ['رقم الصندوق', 'رقم الجوزة', 'الجوزة', 'الكابينة', 'البورد', 'boxNumber', 'box', 'cabinet'],
  amountPaid: ['المبلغ المدفوع', 'المدفوع', 'المسدد', 'الواصل', 'paid', 'amountPaid'],
  amountDue: ['المبلغ المستحق', 'المستحق', 'الدين', 'الباقي', 'remaining', 'due', 'amountDue'],
  paymentStatus: ['حالة الدفع', 'حالة التسديد', 'الحالة', 'status', 'paymentStatus'],
  code: ['كود المشترك', 'الكود', 'رقم المشترك', 'رمز المشترك', 'code', 'subscriberCode'],
  notes: ['ملاحظات', 'ملاحظة', 'notes', 'note'],
  exemptReason: ['سبب المجاني', 'سبب الاعفاء', 'سبب الإعفاء', 'exemptReason'],
  joiningDate: ['تاريخ الاشتراك', 'تاريخ الانضمام', 'joiningDate', 'createdAt'],
};

const knownHeaderSet = new Set(Object.values(EXCEL_FIELD_ALIASES).flat().map(normalizeHeader));
const isEmptyCell = (value: unknown) => normalizeText(value) === '';

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = normalizeText(value).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^0-9.]/g, '');
  return Number(cleaned || 0);
};

const parseTier = (value: unknown): SubscriptionTierType => {
  const text = normalizeText(value).toLowerCase();
  if (!text) return 'normal';
  if (text.includes('مجاني') || text.includes('معفي') || text.includes('free')) return 'free';
  if (text.includes('تجاري') || text.includes('commercial')) return 'commercial';
  if (text.includes('ذهبي') || text.includes('vip') || text.includes('gold')) return 'golden';
  if (text.includes('مخصص') || text.includes('custom')) return 'custom';
  return 'normal';
};

const parsePaymentStatus = (value: unknown, paid: number, total: number): PaymentStatus => {
  const text = normalizeText(value).toLowerCase();
  if (text.includes('مجاني') || text.includes('معفي') || text.includes('free')) return 'free';
  if (text.includes('مسدد') || text.includes('مدفوع') || text.includes('paid')) return 'paid';
  if (text.includes('جزئي') || text.includes('partial')) return 'partial';
  if (paid > 0 && paid < total) return 'partial';
  if (paid >= total && total > 0) return 'paid';
  return 'unpaid';
};

const generateImportCode = (generatorId: string, existing: Subscriber[]) => {
  const prefix = generatorId.replace(/-/g, '').slice(0, 5).toUpperCase() || 'GEN';
  const used = new Set(existing.map(s => s.code || s.subscriberCode).filter(Boolean));
  let index = existing.length + 1;
  let code = `MW-${prefix}-${String(index).padStart(4, '0')}`;
  while (used.has(code)) {
    index += 1;
    code = `MW-${prefix}-${String(index).padStart(4, '0')}`;
  }
  return code;
};

export const SuperAdminDashboard: React.FC<Props> = ({ onLogout }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [generators, setGenerators] = useState<Generator[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resettingAllData, setResettingAllData] = useState(false);

  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [selectedGeneratorId, setSelectedGeneratorId] = useState<string | null>(null);
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [editSubscriptionOpen, setEditSubscriptionOpen] = useState(false);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [renewalForm, setRenewalForm] = useState({ plan_id:'', price_iqd:'', payment_method:'نقدي', notes:'', test_days:'0', test_hours:'0', test_minutes:'30' });
  const [credentialForm, setCredentialForm] = useState({ email:'', password:'' });
  const [editSubscriptionForm, setEditSubscriptionForm] = useState({ plan_id:'', starts_at:'', ends_at:'', price_iqd:'', notes:'' });
  const [creatingGenerator, setCreatingGenerator] = useState(false);
  const [generatorForm, setGeneratorForm] = useState({ name:'', owner_name:'', phone:'', area:'', email:'', password:'', plan_id:'', starts_at:localDateTimeValue(), price_iqd:'', test_days:'0', test_hours:'0', test_minutes:'30' });

  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [excelImporting, setExcelImporting] = useState(false);
  const [excelImportProgress, setExcelImportProgress] = useState(0);
  const [excelImportReport, setExcelImportReport] = useState<ExcelImportReport>(EMPTY_EXCEL_REPORT);
  const [excelImportForm, setExcelImportForm] = useState<{ generator_id: string; file: File | null }>({ generator_id: '', file: null });

  const [financeOpen, setFinanceOpen] = useState(false);
  const [financeForm, setFinanceForm] = useState({
    generator_id: '', amount_iqd: '', category: 'subscription', payment_method: 'نقدي', notes: ''
  });

  const [notificationForm, setNotificationForm] = useState({
    title: '', body: '', category: 'maintenance', target_type: 'all_generators', generator_id: ''
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    const [g, s, p, t, n] = await Promise.all([
      supabase.from('generators').select('*').order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*').order('ends_at', { ascending: true }),
      supabase.from('subscription_plans').select('*').eq('is_active', true).order('created_at'),
      supabase.from('admin_transactions').select('*').order('received_at', { ascending: false }),
      supabase.from('app_notifications').select('*').order('created_at', { ascending: false }),
    ]);
    const firstError = g.error || s.error || p.error || t.error || n.error;
    if (firstError) setError(firstError.message || 'تعذر تحميل البيانات');
    else {
      setGenerators((g.data || []) as Generator[]);
      setSubscriptions((s.data || []) as Subscription[]);
      const order: Record<string,number> = { test:0, weekly:1, monthly:2, quarterly:3, semiannual:4, annual:5 };
      setPlans(((p.data || []) as SubscriptionPlan[]).sort((a,b)=>(order[a.plan_code||'']??99)-(order[b.plan_code||'']??99)));
      setTransactions((t.data || []) as AdminTransaction[]);
      setNotifications((n.data || []) as AppNotification[]);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const signed = (x: AdminTransaction) => x.direction === 'refund' ? -x.amount_iqd : x.amount_iqd;
    return {
      total: generators.length,
      active: generators.filter(g => g.status === 'active').length,
      suspended: generators.filter(g => g.status === 'suspended').length,
      expiring: subscriptions.filter(s => {
        const end = new Date(s.ends_at);
        return s.status === 'active' && end >= now && end <= weekEnd;
      }).length,
      allRevenue: transactions.reduce((sum, x) => sum + signed(x), 0),
      monthRevenue: transactions.filter(x => new Date(x.received_at) >= monthStart).reduce((sum, x) => sum + signed(x), 0),
      yearRevenue: transactions.filter(x => new Date(x.received_at) >= yearStart).reduce((sum, x) => sum + signed(x), 0),
    };
  }, [generators, subscriptions, transactions]);

  const generatorName = (id: string | null) => generators.find(g => g.id === id)?.name || '—';
  const latestSubscriptionFor = (generatorId: string) => subscriptions
    .filter(s => s.generator_id === generatorId)
    .sort((a,b) => new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime())[0] || null;
  const selectedGenerator = selectedGeneratorId ? generators.find(g => g.id === selectedGeneratorId) || null : null;
  const selectedSubscription = selectedGeneratorId ? latestSubscriptionFor(selectedGeneratorId) : null;


  const createGeneratorAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generatorForm.name.trim() || !generatorForm.owner_name.trim() || !generatorForm.email.trim() || !generatorForm.password.trim()) {
      return setMessage('أكمل اسم المولدة، اسم المالك، البريد وكلمة المرور');
    }
    const plan = plans.find(x => x.id === generatorForm.plan_id);
    if (!plan) return setMessage('اختر نوع الاشتراك');
    const start = new Date(generatorForm.starts_at);
    const durationMs = planDurationMs(plan, generatorForm.test_days, generatorForm.test_hours, generatorForm.test_minutes);
    if (!Number.isFinite(start.getTime()) || durationMs <= 0) return setMessage('حدد مدة اشتراك صحيحة');
    const end = new Date(start.getTime() + durationMs);
    setCreatingGenerator(true);
    const { data, error } = await supabase.functions.invoke('create-generator-account', {
      body: {
        name: generatorForm.name.trim(), owner_name: generatorForm.owner_name.trim(),
        phone: generatorForm.phone.trim() || null, area: generatorForm.area.trim() || null,
        email: generatorForm.email.trim().toLowerCase(), password: generatorForm.password,
        plan_id: plan.id, starts_at: start.toISOString(), ends_at: end.toISOString(),
        price_iqd: Number(generatorForm.price_iqd || plan.price_iqd || 0),
      }
    });
    setCreatingGenerator(false);
    if (error || !data?.ok) return setMessage(`تعذر إنشاء الحساب: ${data?.error || error?.message || 'خطأ غير معروف'}`);
    setGeneratorForm({ name:'', owner_name:'', phone:'', area:'', email:'', password:'', plan_id:'', starts_at:localDateTimeValue(), price_iqd:'', test_days:'0', test_hours:'0', test_minutes:'30' });
    setGeneratorOpen(false);
    setMessage('تم إنشاء صاحب المولدة وحساب الدخول والاشتراك بنجاح');
    await load();
  };

  const renewSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGeneratorId) return;
    const plan = plans.find(p => p.id === renewalForm.plan_id);
    if (!plan) return setMessage('اختر مدة التجديد');
    const custom = plan.is_custom_duration ? customMinutes(renewalForm.test_days, renewalForm.test_hours, renewalForm.test_minutes) : 0;
    if (plan.is_custom_duration && custom <= 0) return setMessage('حدد مدة الفحص بالأيام أو الساعات أو الدقائق');
    const amount = Number(renewalForm.price_iqd || plan.price_iqd || 0);
    if (amount < 0) return setMessage('أدخل مبلغاً صحيحاً');
    setRenewing(true);
    const { data, error } = await supabase.functions.invoke('renew-generator-subscription', {
      body: {
        generator_id: selectedGeneratorId, plan_id: plan.id, price_iqd: amount,
        payment_method: renewalForm.payment_method || 'نقدي', notes: renewalForm.notes || null,
        custom_duration_minutes: custom || null,
      }
    });
    setRenewing(false);
    if (error || !data?.ok) return setMessage(`تعذر التجديد: ${data?.error || error?.message || 'خطأ غير معروف'}`);
    setRenewalOpen(false);
    setRenewalForm({ plan_id:'', price_iqd:'', payment_method:'نقدي', notes:'', test_days:'0', test_hours:'0', test_minutes:'30' });
    setMessage('تم تجديد الاشتراك وتسجيل المبلغ في الواردات بنجاح');
    await load();
  };

  const openCredentials = () => {
    if (!selectedGenerator) return;
    setCredentialForm({ email: selectedGenerator.email || '', password: '' });
    setCredentialsOpen(true);
  };

  const saveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGeneratorId) return;
    if (!credentialForm.email.trim() && !credentialForm.password.trim()) return setMessage('أدخل الإيميل أو كلمة مرور جديدة');
    setSavingAccount(true);
    const { data, error } = await supabase.functions.invoke('manage-generator-account', {
      body: { action:'update_credentials', generator_id:selectedGeneratorId, email:credentialForm.email.trim() || null, password:credentialForm.password || null }
    });
    setSavingAccount(false);
    if (error || !data?.ok) return setMessage(`تعذر تعديل بيانات الدخول: ${data?.error || error?.message || 'خطأ غير معروف'}`);
    setCredentialsOpen(false);
    setCredentialForm(f=>({...f,password:''}));
    setMessage('تم تحديث بيانات تسجيل الدخول');
    await load();
  };

  const setGeneratorStatus = async (status: 'active' | 'suspended') => {
    if (!selectedGeneratorId) return;
    setSavingAccount(true);
    const { data, error } = await supabase.functions.invoke('manage-generator-account', {
      body: { action:'set_status', generator_id:selectedGeneratorId, status, reason: status === 'suspended' ? 'مقيد مؤقتاً من الإدارة' : null }
    });
    setSavingAccount(false);
    if (error || !data?.ok) return setMessage(`تعذر تحديث الحالة: ${data?.error || error?.message || 'خطأ غير معروف'}`);
    setMessage(status === 'active' ? 'تم رفع التقييد وتفعيل الحساب' : 'تم تقييد الحساب مؤقتاً');
    await load();
  };

  const openEditSubscription = () => {
    if (!selectedSubscription) return setMessage('لا يوجد اشتراك لتعديله');
    setEditSubscriptionForm({
      plan_id: selectedSubscription.plan_id || '',
      starts_at: localDateTimeValue(new Date(selectedSubscription.starts_at)),
      ends_at: localDateTimeValue(new Date(selectedSubscription.ends_at)),
      price_iqd: String(selectedSubscription.price_iqd || 0), notes: ''
    });
    setEditSubscriptionOpen(true);
  };

  const saveSubscriptionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGeneratorId || !selectedSubscription) return;
    const start = new Date(editSubscriptionForm.starts_at);
    const end = new Date(editSubscriptionForm.ends_at);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return setMessage('تاريخ نهاية الاشتراك يجب أن يكون بعد البداية');
    setSavingAccount(true);
    const { data, error } = await supabase.functions.invoke('manage-generator-account', {
      body: {
        action:'edit_subscription', generator_id:selectedGeneratorId, subscription_id:selectedSubscription.id,
        plan_id:editSubscriptionForm.plan_id || null, starts_at:start.toISOString(), ends_at:end.toISOString(),
        price_iqd:Number(editSubscriptionForm.price_iqd||0), notes:editSubscriptionForm.notes || null,
      }
    });
    setSavingAccount(false);
    if (error || !data?.ok) return setMessage(`تعذر تعديل الاشتراك: ${data?.error || error?.message || 'خطأ غير معروف'}`);
    setEditSubscriptionOpen(false);
    setMessage('تم تعديل الاشتراك بنجاح');
    await load();
  };

  const addTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(financeForm.amount_iqd);
    if (!amount || amount <= 0) return setMessage('أدخل مبلغاً صحيحاً');
    const { error } = await supabase.from('admin_transactions').insert({
      generator_id: financeForm.generator_id || null,
      direction: 'income',
      category: financeForm.category,
      amount_iqd: amount,
      payment_method: financeForm.payment_method || null,
      notes: financeForm.notes || null,
      received_at: new Date().toISOString(),
    });
    if (error) return setMessage(`تعذر الحفظ: ${error.message}`);
    setFinanceForm({ generator_id: '', amount_iqd: '', category: 'subscription', payment_method: 'نقدي', notes: '' });
    setFinanceOpen(false);
    setMessage('تم تسجيل المبلغ بنجاح');
    await load();
  };

  const importSubscribersFromExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelImportForm.generator_id) return setMessage('اختر حساب صاحب المولدة قبل الرفع');
    if (!excelImportForm.file) return setMessage('اختر ملف Excel أولاً');

    setExcelImporting(true);
    setExcelImportProgress(5);
    setExcelImportReport({ ...EMPTY_EXCEL_REPORT, status: 'processing', title: 'جاري قراءة ملف Excel...', fileName: excelImportForm.file.name });
    setMessage(null);

    try {
      const generator = generators.find(g => g.id === excelImportForm.generator_id);
      const buffer = await excelImportForm.file.arrayBuffer();
      setExcelImportProgress(15);

      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error('ملف Excel فارغ');

      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
      const headerRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
      const headers = ((headerRows[0] || []) as unknown[]).map(h => normalizeText(h)).filter(Boolean);
      const totalColumns = headers.length || Object.keys(rows[0] || {}).length;
      const unmappedColumns = headers.filter(h => !knownHeaderSet.has(normalizeHeader(h)));
      const mappedColumns = Math.max(0, totalColumns - unmappedColumns.length);
      const cellsRead = rows.reduce((sum, row) => sum + Object.values(row).filter(v => !isEmptyCell(v)).length, 0);

      if (!rows.length) throw new Error('لا توجد بيانات مشتركين داخل الملف');

      setExcelImportProgress(25);
      setExcelImportReport({
        ...EMPTY_EXCEL_REPORT,
        status: 'processing',
        title: 'تمت قراءة الملف، جاري تحويل البيانات...',
        generatorName: generator?.name || excelImportForm.generator_id,
        fileName: excelImportForm.file.name,
        totalRows: rows.length,
        totalColumns,
        mappedColumns,
        unmappedColumns,
        cellsRead,
      });

      const subscribersKey = scopedKey('moldatk_subscribers', excelImportForm.generator_id);
      const tariffsKey = scopedKey('moldatk_monthly_tariffs', excelImportForm.generator_id);
      const linesKey = scopedKey('moldatk_lines', excelImportForm.generator_id);
      const auditKey = scopedKey('moldatk_audit_logs', excelImportForm.generator_id);
      const generatorKey = scopedKey('moldatk_generator', excelImportForm.generator_id);

      const existing = readJson<Subscriber[]>(subscribersKey, []);
      const tariffs = readJson<MonthlyTariffRecord[]>(tariffsKey, INITIAL_MONTHLY_TARIFFS);
      const activeTariff = tariffs.find(t => t.isCurrentActive) || tariffs[0] || INITIAL_MONTHLY_TARIFFS[0];
      const lines = readJson<LineDistribution[]>(linesKey, []);
      const now = new Date().toISOString();
      const imported: Subscriber[] = [];
      const warnings: string[] = [];
      const errors: string[] = [];
      const usedPhones = new Set(existing.map(s => normalizeText(s.phone)).filter(Boolean));
      const usedCodes = new Set(existing.map(s => s.code || s.subscriberCode).filter(Boolean));
      const importedCellKeys = ['fullName', 'phone', 'amperes', 'tier', 'line', 'address', 'boxNumber', 'amountPaid', 'amountDue', 'paymentStatus', 'code', 'notes', 'joiningDate'];
      let cellsImported = 0;
      let skippedRows = 0;

      rows.forEach((row, rowIndex) => {
        try {
          const fullName = normalizeText(rowValue(row, EXCEL_FIELD_ALIASES.fullName));
          const phone = normalizeText(rowValue(row, EXCEL_FIELD_ALIASES.phone));
          if (!fullName && !phone) {
            skippedRows += 1;
            warnings.push(`السطر ${rowIndex + 2}: لم يتم رفعه لأن اسم المشترك ورقم الهاتف فارغين.`);
            return;
          }

          const tier = parseTier(rowValue(row, EXCEL_FIELD_ALIASES.tier));
          const amperes = Math.max(0, toNumber(rowValue(row, EXCEL_FIELD_ALIASES.amperes)) || 1);
          const calc = calculateSubscriberBill(amperes, tier, activeTariff?.tiers || []);
          const paid = toNumber(rowValue(row, EXCEL_FIELD_ALIASES.amountPaid));
          const explicitDue = toNumber(rowValue(row, EXCEL_FIELD_ALIASES.amountDue));
          const total = explicitDue > 0 ? explicitDue + paid : calc.total;
          const paymentStatus = parsePaymentStatus(rowValue(row, EXCEL_FIELD_ALIASES.paymentStatus), paid, total);
          const lineName = normalizeText(rowValue(row, EXCEL_FIELD_ALIASES.line));
          const lineMatch = lines.find(l => normalizeText(l.name) === lineName || normalizeText(l.zone) === lineName);
          const givenCode = normalizeText(rowValue(row, EXCEL_FIELD_ALIASES.code));
          let code = givenCode && !usedCodes.has(givenCode) ? givenCode : generateImportCode(excelImportForm.generator_id, [...existing, ...imported]);
          while (usedCodes.has(code)) code = generateImportCode(excelImportForm.generator_id, [...existing, ...imported]);
          usedCodes.add(code);

          if (phone && usedPhones.has(phone)) {
            skippedRows += 1;
            warnings.push(`السطر ${rowIndex + 2}: لم يتم رفعه لأن رقم الهاتف مكرر (${phone}).`);
            return;
          }
          if (phone) usedPhones.add(phone);

          const address = normalizeText(rowValue(row, EXCEL_FIELD_ALIASES.address));
          const boxNumber = normalizeText(rowValue(row, EXCEL_FIELD_ALIASES.boxNumber));
          const notes = normalizeText(rowValue(row, EXCEL_FIELD_ALIASES.notes));
          const joiningDate = normalizeText(rowValue(row, EXCEL_FIELD_ALIASES.joiningDate)) || now.slice(0, 10);
          const dueAmount = paymentStatus === 'free' || tier === 'free' ? 0 : Math.max(total - paid, 0);
          const subscriber: Subscriber = {
            id: (crypto as any)?.randomUUID?.() || `sub-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            code,
            subscriberCode: code,
            fullName: fullName || `مشترك ${existing.length + imported.length + 1}`,
            phone,
            tier,
            amperes,
            lineId: lineMatch?.id,
            lineName: lineName || lineMatch?.name || '',
            line: lineName || lineMatch?.name || '',
            address,
            boxNumber,
            paymentStatus,
            lastPaymentDate: normalizeText(rowValue(row, ['تاريخ آخر دفع', 'تاريخ التسديد', 'lastPaymentDate', 'paymentDate'])) || undefined,
            amountDue: dueAmount,
            amountPaid: paymentStatus === 'free' ? 0 : paid,
            notes,
            isExempted: paymentStatus === 'free' || tier === 'free',
            exemptReason: paymentStatus === 'free' || tier === 'free' ? normalizeText(rowValue(row, EXCEL_FIELD_ALIASES.exemptReason)) || 'استيراد من Excel' : undefined,
            invoicesHistory: [],
            createdAt: now,
            joiningDate,
          };
          imported.push(subscriber);
          cellsImported += importedCellKeys.filter(key => {
            const value = (subscriber as any)[key] ?? (key === 'code' ? subscriber.code : undefined);
            return !isEmptyCell(value);
          }).length;
        } catch (rowErr: any) {
          skippedRows += 1;
          errors.push(`السطر ${rowIndex + 2}: ${rowErr?.message || 'تعذر قراءة السطر'}`);
        }

        const progress = 25 + Math.round(((rowIndex + 1) / Math.max(rows.length, 1)) * 55);
        setExcelImportProgress(Math.min(progress, 85));
      });

      if (!imported.length) throw new Error('لم يتم رفع أي مشترك. تأكد من وجود عمود اسم المشترك أو رقم الهاتف وعدم تكرار الأرقام.');

      const nextSubscribers = [...existing, ...imported];
      localStorage.setItem(subscribersKey, JSON.stringify(nextSubscribers));
      if (generator) {
        const oldGenerator = readJson<any>(generatorKey, {});
        localStorage.setItem(generatorKey, JSON.stringify({
          ...oldGenerator,
          generatorName: generator.name,
          ownerName: generator.owner_name,
          phone: generator.phone || oldGenerator.phone || '',
          area: generator.area || oldGenerator.area || '',
        }));
        const accounts = readJson<any[]>('moldatk_generator_accounts', []);
        if (!accounts.some(x => x?.generatorId === generator.id)) {
          localStorage.setItem('moldatk_generator_accounts', JSON.stringify([
            ...accounts,
            { generatorId: generator.id, generatorName: generator.name, ownerName: generator.owner_name, email: generator.email || '', createdAt: now },
          ]));
        }
      }
      localStorage.setItem(auditKey, JSON.stringify([
        {
          id: `audit-${Date.now()}`,
          timestamp: now,
          category: 'subscriber',
          title: 'رفع مشتركين من Excel عبر السوبر أدمن',
          details: `تم رفع ${imported.length} مشترك إلى حساب ${generator?.name || excelImportForm.generator_id}. تم تخطي ${skippedRows} سطر.`,
          entityName: generator?.name || excelImportForm.generator_id,
          actorName: 'Super Admin',
        },
        ...readJson<any[]>(auditKey, []),
      ]));

      setExcelImportProgress(100);
      setExcelImportReport({
        status: 'success',
        title: 'تم رفع ملف Excel بنجاح',
        generatorName: generator?.name || excelImportForm.generator_id,
        fileName: excelImportForm.file.name,
        totalRows: rows.length,
        importedRows: imported.length,
        skippedRows,
        totalColumns,
        mappedColumns,
        unmappedColumns,
        cellsRead,
        cellsImported,
        warnings,
        errors,
      });
      window.dispatchEvent(new Event('moldatk-local-sync'));
      setMessage(`تم رفع ${imported.length} مشترك إلى حساب ${generator?.name || 'صاحب المولدة'} بنجاح — تم تخطي ${skippedRows} سطر.`);
    } catch (err: any) {
      const errorMessage = err?.message || 'خطأ غير معروف';
      setExcelImportProgress(100);
      setExcelImportReport(prev => ({
        ...prev,
        status: 'error',
        title: 'فشل رفع ملف Excel',
        errors: [...prev.errors, errorMessage],
      }));
      setMessage(`تعذر رفع ملف Excel: ${errorMessage}`);
    } finally {
      setExcelImporting(false);
    }
  };

  const sendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notificationForm.title.trim() || !notificationForm.body.trim()) return setMessage('اكتب عنوان ونص الإشعار');
    if (notificationForm.target_type === 'single_generator' && !notificationForm.generator_id) return setMessage('اختر المولدة المستهدفة');

    const { data, error } = await supabase.functions.invoke('publish-notification', {
      body: {
        title: notificationForm.title.trim(),
        body: notificationForm.body.trim(),
        category: notificationForm.category,
        target_type: notificationForm.target_type,
        generator_id: notificationForm.target_type === 'single_generator' ? notificationForm.generator_id : null,
      },
    });
    if (error || !data?.ok) return setMessage(`تعذر إرسال الإشعار: ${data?.error || error?.message || 'خطأ غير معروف'}`);

    const webSent = Number(data?.web?.sent || 0);
    const nativeSent = Number(data?.android?.sent || 0);
    const nativeConfigured = Boolean(data?.android?.configured);
    setNotificationForm({ title: '', body: '', category: 'maintenance', target_type: 'all_generators', generator_id: '' });
    setMessage(nativeConfigured
      ? `تم نشر الإشعار — وصل Web Push إلى ${webSent} جهاز وAndroid إلى ${nativeSent} جهاز`
      : `تم نشر الإشعار — وصل Web Push إلى ${webSent} جهاز. إرسال Android جاهز بالكود ويحتاج فقط مفاتيح Firebase Server في Supabase.`
    );
    await load();
  };

  const resetAllDataForRelease = async () => {
    const first = window.confirm('تحذير: سيتم تصفير بيانات التجربة والحسابات من لوحة السوبر أدمن. هل تريد المتابعة؟');
    if (!first) return;
    const second = window.confirm('تأكيد نهائي: سيتم حذف أصحاب المولدات واشتراكاتهم والواردات والإشعارات والتوكنات. سيتم إبقاء حساب السوبر أدمن حتى لا تفقد الدخول.');
    if (!second) return;

    setResettingAllData(true);
    setMessage(null);

    const errors: string[] = [];
    const deleteAllById = async (table: string) => {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) errors.push(`${table}: ${error.message}`);
    };

    await deleteAllById('notification_reads');
    await deleteAllById('web_push_subscriptions');
    await deleteAllById('device_push_tokens');
    await deleteAllById('app_notifications');
    await deleteAllById('admin_transactions');
    await deleteAllById('subscriptions');

    const { error: profilesError } = await supabase.from('profiles').delete().neq('role', 'super_admin');
    if (profilesError) errors.push(`profiles: ${profilesError.message}`);

    await deleteAllById('generators');

    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith('moldatk_') && key !== 'moldatk_session')
        .forEach(key => localStorage.removeItem(key));
    } catch (e) {}

    setResettingAllData(false);
    await load();

    if (errors.length) {
      setMessage(`تم تصفير البيانات المحلية، لكن بعض جداول Supabase لم تُحذف بسبب الصلاحيات: ${errors.join(' | ')}`);
    } else {
      setMessage('تم تصفير بيانات المشروع بنجاح مع إبقاء دخول السوبر أدمن.');
    }
  };

  const signOut = async () => { await supabase.auth.signOut(); onLogout(); };

  const nav = [
    ['overview', 'الرئيسية', ShieldCheck],
    ['generators', 'أصحاب المولدات', Users],
    ['finance', 'الحسابات', CircleDollarSign],
    ['notifications', 'الإشعارات', Bell],
  ] as const;

  return (
    <div dir="rtl" className="min-h-screen bg-slate-100 text-slate-900 font-['Cairo',sans-serif] min-w-[1100px]">
      <header className="h-20 bg-[#0b1530] text-white flex items-center justify-between px-8 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-700 flex items-center justify-center"><ShieldCheck className="w-6 h-6" /></div>
          <div><h1 className="text-xl font-black">molidatk — Super Admin</h1><p className="text-xs text-slate-400">إدارة الحسابات، الإيرادات والإشعارات</p></div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20" title="تحديث"><RefreshCw className="w-4 h-4" /></button>
          <button
            onClick={() => void resetAllDataForRelease()}
            disabled={resettingAllData}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-sm font-bold"
            title="تصفير بيانات التجربة قبل الإطلاق"
          >
            <Trash2 className="w-4 h-4" />{resettingAllData ? 'جاري التصفير...' : 'تصفير بيانات التجربة'}
          </button>
          <button onClick={signOut} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold"><LogOut className="w-4 h-4" />تسجيل الخروج</button>
        </div>
      </header>

      <div className="flex max-w-[1700px] mx-auto">
        <aside className="w-64 p-5 shrink-0">
          <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm sticky top-5">
            {nav.map(([key, label, Icon]) => (
              <button key={key} onClick={() => setTab(key)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black mb-1 ${tab === key ? 'bg-blue-700 text-white' : 'hover:bg-slate-100 text-slate-600'}`}>
                <Icon className="w-5 h-5" />{label}
              </button>
            ))}
          </div>
        </aside>

        <main className="p-5 pl-8 flex-1 min-w-0">
          {message && <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 font-bold text-sm">{message}</div>}
          {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-bold text-sm">{error}</div>}

          {tab === 'overview' && <>
            <div className="grid grid-cols-4 gap-5 mb-5">
              {[
                ['إجمالي أصحاب المولدات', stats.total, Building2],
                ['الحسابات الفعالة', stats.active, ShieldCheck],
                ['تنتهي خلال 7 أيام', stats.expiring, CalendarClock],
                ['إيراد هذا الشهر', iqd(stats.monthRevenue), WalletCards],
              ].map(([label, value, Icon]: any) => (
                <div key={label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                  <div><p className="text-sm text-slate-500 font-bold">{label}</p><p className="text-2xl font-black mt-2">{value}</p></div>
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center"><Icon className="w-6 h-6 text-blue-700" /></div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"><p className="text-slate-500 font-bold">إجمالي المستحصل</p><p className="text-3xl font-black mt-3">{iqd(stats.allRevenue)}</p></div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"><p className="text-slate-500 font-bold">إيراد السنة</p><p className="text-3xl font-black mt-3">{iqd(stats.yearRevenue)}</p></div>
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"><p className="text-slate-500 font-bold">إشعارات منشورة</p><p className="text-3xl font-black mt-3">{notifications.length}</p></div>
            </div>
          </>}

          {tab === 'generators' && <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <div><h2 className="text-lg font-black flex items-center gap-2"><Users className="w-5 h-5" />أصحاب المولدات</h2><p className="text-xs text-slate-500 mt-1">الحسابات المرتبطة بمنصة molidatk</p></div>
              <div className="flex items-center gap-3"><span className="text-xs text-slate-500">{subscriptions.length} اشتراك مسجل</span><button onClick={() => { setExcelImportProgress(0); setExcelImportReport(EMPTY_EXCEL_REPORT); setExcelImportOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" />رفع مشتركين Excel</button><button onClick={() => setGeneratorOpen(true)} className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-2"><UserPlus className="w-4 h-4" />إضافة صاحب مولدة</button></div>
            </div>
            {loading ? <div className="p-10 text-center font-bold text-slate-500">جاري تحميل البيانات...</div> : generators.length === 0 ? <div className="p-14 text-center text-slate-500 font-bold">لا يوجد أصحاب مولدات بعد</div> :
              <table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4 text-right">اسم المولدة</th><th className="p-4 text-right">صاحب الحساب</th><th className="p-4 text-right">الهاتف</th><th className="p-4 text-right">المنطقة</th><th className="p-4 text-right">ينتهي الاشتراك</th><th className="p-4 text-right">الحالة</th><th className="p-4 text-right">الإجراءات</th></tr></thead><tbody>{generators.map(g => { const sub = latestSubscriptionFor(g.id); return <tr key={g.id} className="border-t border-slate-100"><td className="p-4 font-black">{g.name}</td><td className="p-4">{g.owner_name}</td><td className="p-4">{g.phone || '—'}</td><td className="p-4">{g.area || '—'}</td><td className="p-4 font-bold">{sub ? dateText(sub.ends_at) : '—'}</td><td className="p-4"><span className={`px-2.5 py-1 rounded-lg font-bold ${g.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{g.status === 'active' ? 'فعال' : g.status === 'suspended' ? 'موقوف' : 'منتهي'}</span></td><td className="p-4"><button onClick={() => setSelectedGeneratorId(g.id)} className="px-3 py-2 rounded-lg bg-slate-900 text-white font-black text-xs inline-flex items-center gap-2"><Eye className="w-4 h-4" />تفاصيل</button></td></tr>})}</tbody></table>}
          </section>}

          {tab === 'finance' && <>
            <div className="grid grid-cols-3 gap-5 mb-5">
              <div className="bg-white border rounded-2xl p-5"><p className="text-slate-500 font-bold">إيراد الشهر</p><p className="text-3xl font-black mt-2">{iqd(stats.monthRevenue)}</p></div>
              <div className="bg-white border rounded-2xl p-5"><p className="text-slate-500 font-bold">إيراد السنة</p><p className="text-3xl font-black mt-2">{iqd(stats.yearRevenue)}</p></div>
              <div className="bg-white border rounded-2xl p-5"><p className="text-slate-500 font-bold">الإجمالي</p><p className="text-3xl font-black mt-2">{iqd(stats.allRevenue)}</p></div>
            </div>
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b flex items-center justify-between"><div><h2 className="text-lg font-black">الحسابات والواردات</h2><p className="text-xs text-slate-500 mt-1">كل مبلغ تستحصله من بيع أو تجديد الحسابات</p></div><button onClick={() => setFinanceOpen(v => !v)} className="bg-blue-700 text-white px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-2"><Plus className="w-4 h-4" />تسجيل مبلغ</button></div>
              {financeOpen && <form onSubmit={addTransaction} className="p-5 bg-slate-50 grid grid-cols-3 gap-4 border-b">
                <select value={financeForm.generator_id} onChange={e => setFinanceForm(f => ({...f, generator_id:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white"><option value="">بدون ربط بمولدة</option>{generators.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
                <input inputMode="numeric" placeholder="المبلغ بالدينار" value={financeForm.amount_iqd} onChange={e => setFinanceForm(f => ({...f, amount_iqd:e.target.value.replace(/\D/g,'')}))} className="border rounded-xl px-3 py-3" />
                <select value={financeForm.category} onChange={e => setFinanceForm(f => ({...f, category:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white"><option value="subscription">بيع اشتراك</option><option value="renewal">تجديد</option><option value="setup">تهيئة/تنصيب</option><option value="other">أخرى</option></select>
                <input placeholder="طريقة الدفع" value={financeForm.payment_method} onChange={e => setFinanceForm(f => ({...f, payment_method:e.target.value}))} className="border rounded-xl px-3 py-3" />
                <input placeholder="ملاحظات" value={financeForm.notes} onChange={e => setFinanceForm(f => ({...f, notes:e.target.value}))} className="border rounded-xl px-3 py-3" />
                <button className="bg-emerald-600 text-white rounded-xl font-black">حفظ المبلغ</button>
              </form>}
              <table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4 text-right">التاريخ</th><th className="p-4 text-right">المولدة</th><th className="p-4 text-right">النوع</th><th className="p-4 text-right">طريقة الدفع</th><th className="p-4 text-right">المبلغ</th></tr></thead><tbody>{transactions.map(x => <tr key={x.id} className="border-t"><td className="p-4">{dateText(x.received_at)}</td><td className="p-4 font-bold">{generatorName(x.generator_id)}</td><td className="p-4">{x.category}</td><td className="p-4">{x.payment_method || '—'}</td><td className="p-4 font-black text-emerald-700">{x.direction === 'refund' ? '-' : ''}{iqd(x.amount_iqd)}</td></tr>)}</tbody></table>
              {transactions.length === 0 && <div className="p-10 text-center text-slate-500 font-bold">لا توجد حركات مالية بعد</div>}
            </section>
          </>}

          {tab === 'notifications' && <div className="grid grid-cols-[420px_1fr] gap-5">
            <form onSubmit={sendNotification} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 h-fit">
              <h2 className="text-lg font-black flex items-center gap-2"><Megaphone className="w-5 h-5" />إرسال إشعار</h2>
              <p className="text-xs text-slate-500 mt-1 mb-5">صيانة، عروض، أو تحديثات التطبيق</p>
              <label className="text-xs font-black text-slate-500">نوع الإشعار</label>
              <select value={notificationForm.category} onChange={e => setNotificationForm(f => ({...f, category:e.target.value}))} className="w-full border rounded-xl px-3 py-3 mt-1 mb-3 bg-white"><option value="maintenance">صيانة</option><option value="offer">عرض</option><option value="update">تحديث</option><option value="general">عام</option></select>
              <label className="text-xs font-black text-slate-500">المستلمين</label>
              <select value={notificationForm.target_type} onChange={e => setNotificationForm(f => ({...f, target_type:e.target.value, generator_id:''}))} className="w-full border rounded-xl px-3 py-3 mt-1 mb-3 bg-white"><option value="all_generators">كل أصحاب المولدات</option><option value="single_generator">مولدة محددة</option></select>
              {notificationForm.target_type === 'single_generator' && <select value={notificationForm.generator_id} onChange={e => setNotificationForm(f => ({...f, generator_id:e.target.value}))} className="w-full border rounded-xl px-3 py-3 mb-3 bg-white"><option value="">اختر المولدة</option>{generators.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>}
              <input placeholder="عنوان الإشعار" value={notificationForm.title} onChange={e => setNotificationForm(f => ({...f, title:e.target.value}))} className="w-full border rounded-xl px-3 py-3 mb-3" />
              <textarea rows={5} placeholder="نص الإشعار" value={notificationForm.body} onChange={e => setNotificationForm(f => ({...f, body:e.target.value}))} className="w-full border rounded-xl px-3 py-3 mb-3 resize-none" />
              <button className="w-full bg-blue-700 text-white rounded-xl py-3 font-black flex items-center justify-center gap-2"><Bell className="w-4 h-4" />نشر الإشعار</button>
            </form>
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b"><h2 className="text-lg font-black">سجل الإشعارات</h2><p className="text-xs text-slate-500 mt-1">الإشعارات المنشورة من الإدارة</p></div>
              <div className="divide-y">{notifications.map(n => <div key={n.id} className="p-5 flex gap-4"><div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">{n.category === 'maintenance' ? <Wrench className="w-5 h-5" /> : <Bell className="w-5 h-5" />}</div><div className="flex-1"><div className="flex items-center justify-between"><h3 className="font-black">{n.title}</h3><span className="text-xs text-slate-400">{dateText(n.created_at)}</span></div><p className="text-sm text-slate-600 mt-1 leading-6">{n.body}</p><p className="text-xs text-slate-400 mt-2">إلى: {n.target_type === 'all_generators' ? 'كل أصحاب المولدات' : generatorName(n.generator_id)}</p></div></div>)}</div>
              {notifications.length === 0 && <div className="p-10 text-center text-slate-500 font-bold">لا توجد إشعارات بعد</div>}
            </section>
          </div>}
        </main>
      </div>

      {selectedGenerator && <div className="fixed inset-0 z-[115] bg-black/50 flex items-center justify-center p-6">
        <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[94vh] overflow-y-auto">
          <div className="px-6 py-5 border-b flex items-center justify-between sticky top-0 bg-white z-10"><div><h2 className="text-xl font-black">{selectedGenerator.name}</h2><p className="text-xs text-slate-500 mt-1">تفاصيل الحساب والاشتراك</p></div><button onClick={() => { setSelectedGeneratorId(null); setRenewalOpen(false); setCredentialsOpen(false); setEditSubscriptionOpen(false); }} className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button></div>
          <div className="p-6 grid grid-cols-3 gap-4">
            <div className="bg-slate-50 rounded-2xl p-4"><p className="text-xs text-slate-500 font-bold">صاحب المولدة</p><p className="font-black mt-1">{selectedGenerator.owner_name}</p></div>
            <div className="bg-slate-50 rounded-2xl p-4"><p className="text-xs text-slate-500 font-bold">رقم الهاتف</p><p className="font-black mt-1">{selectedGenerator.phone || '—'}</p></div>
            <div className="bg-slate-50 rounded-2xl p-4"><p className="text-xs text-slate-500 font-bold">المنطقة</p><p className="font-black mt-1">{selectedGenerator.area || '—'}</p></div>
            <div className="bg-violet-50 rounded-2xl p-4"><p className="text-xs text-violet-600 font-bold">اسم المستخدم / الإيميل</p><p className="font-black mt-1 break-all">{selectedGenerator.email || '—'}</p><button onClick={openCredentials} className="mt-2 text-xs font-black text-violet-700 inline-flex items-center gap-1"><Pencil className="w-3.5 h-3.5"/>تعديل</button></div>
            <div className="bg-violet-50 rounded-2xl p-4"><p className="text-xs text-violet-600 font-bold">كلمة المرور</p><p className="font-black mt-1 tracking-widest">••••••••</p><button onClick={openCredentials} className="mt-2 text-xs font-black text-violet-700 inline-flex items-center gap-1"><KeyRound className="w-3.5 h-3.5"/>تغيير كلمة المرور</button></div>
            <div className={`rounded-2xl p-4 ${selectedGenerator.status === 'suspended' ? 'bg-amber-50' : 'bg-emerald-50'}`}><p className={`text-xs font-bold ${selectedGenerator.status === 'suspended' ? 'text-amber-700' : 'text-emerald-700'}`}>حالة الحساب</p><p className="font-black mt-1">{selectedGenerator.status === 'suspended' ? 'مقيد مؤقتاً' : 'فعال'}</p></div>
            <div className="bg-blue-50 rounded-2xl p-4"><p className="text-xs text-blue-600 font-bold">بداية الاشتراك الحالي</p><p className="font-black mt-1">{selectedSubscription ? dateText(selectedSubscription.starts_at) : '—'}</p></div>
            <div className="bg-blue-50 rounded-2xl p-4"><p className="text-xs text-blue-600 font-bold">نهاية الاشتراك الحالي</p><p className="font-black mt-1">{selectedSubscription ? dateText(selectedSubscription.ends_at) : '—'}</p></div>
            <div className="bg-blue-50 rounded-2xl p-4"><p className="text-xs text-blue-600 font-bold">آخر مبلغ اشتراك</p><p className="font-black mt-1">{selectedSubscription ? iqd(selectedSubscription.price_iqd || 0) : '—'}</p></div>
          </div>

          {credentialsOpen && <form onSubmit={saveCredentials} className="mx-6 mb-6 bg-violet-50/60 border border-violet-100 rounded-2xl p-5 grid grid-cols-2 gap-4">
            <div className="col-span-2"><h3 className="font-black text-lg">تعديل بيانات الدخول</h3><p className="text-xs text-slate-500 mt-1">لأسباب أمنية لا يمكن عرض كلمة المرور الحالية؛ يمكنك استبدالها بكلمة جديدة.</p></div>
            <input required type="email" placeholder="إيميل تسجيل الدخول" value={credentialForm.email} onChange={e=>setCredentialForm(f=>({...f,email:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white" />
            <input type="text" minLength={6} placeholder="كلمة مرور جديدة (اختياري)" value={credentialForm.password} onChange={e=>setCredentialForm(f=>({...f,password:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white" />
            <div className="col-span-2 flex justify-end gap-3"><button type="button" onClick={()=>setCredentialsOpen(false)} className="px-4 py-2.5 rounded-xl border font-black bg-white">إلغاء</button><button disabled={savingAccount} className="px-5 py-2.5 rounded-xl bg-violet-700 text-white font-black disabled:opacity-50 inline-flex items-center gap-2"><Save className="w-4 h-4"/>حفظ بيانات الدخول</button></div>
          </form>}

          {renewalOpen && <form onSubmit={renewSubscription} className="mx-6 mb-6 bg-slate-50 border rounded-2xl p-5 grid grid-cols-2 gap-4">
            <div className="col-span-2"><h3 className="font-black text-lg">تجديد الاشتراك</h3><p className="text-xs text-slate-500 mt-1">إذا الاشتراك فعال، التجديد يبدأ من تاريخ انتهائه الحالي. اشتراك الفحص يقبل أيام/ساعات/دقائق.</p></div>
            <select required value={renewalForm.plan_id} onChange={e => { const id=e.target.value; const p=plans.find(x=>x.id===id); setRenewalForm(f=>({...f, plan_id:id, price_iqd:p?.price_iqd ? String(p.price_iqd) : f.price_iqd})) }} className="border rounded-xl px-3 py-3 bg-white"><option value="">اختر نوع الاشتراك</option>{plans.map(p => <option key={p.id} value={p.id}>{planLabel(p)}</option>)}</select>
            <input inputMode="numeric" placeholder="المبلغ المستحصل بالدينار" value={renewalForm.price_iqd} onChange={e=>setRenewalForm(f=>({...f,price_iqd:e.target.value.replace(/\D/g,'')}))} className="border rounded-xl px-3 py-3" />
            {plans.find(p=>p.id===renewalForm.plan_id)?.is_custom_duration && <div className="col-span-2 grid grid-cols-3 gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4"><label className="text-xs font-bold">الأيام<input inputMode="numeric" value={renewalForm.test_days} onChange={e=>setRenewalForm(f=>({...f,test_days:e.target.value.replace(/\D/g,'')}))} className="mt-1 w-full border rounded-xl px-3 py-2 bg-white"/></label><label className="text-xs font-bold">الساعات<input inputMode="numeric" value={renewalForm.test_hours} onChange={e=>setRenewalForm(f=>({...f,test_hours:e.target.value.replace(/\D/g,'')}))} className="mt-1 w-full border rounded-xl px-3 py-2 bg-white"/></label><label className="text-xs font-bold">الدقائق<input inputMode="numeric" value={renewalForm.test_minutes} onChange={e=>setRenewalForm(f=>({...f,test_minutes:e.target.value.replace(/\D/g,'')}))} className="mt-1 w-full border rounded-xl px-3 py-2 bg-white"/></label></div>}
            <input placeholder="طريقة الدفع" value={renewalForm.payment_method} onChange={e=>setRenewalForm(f=>({...f,payment_method:e.target.value}))} className="border rounded-xl px-3 py-3" />
            <input placeholder="ملاحظات اختيارية" value={renewalForm.notes} onChange={e=>setRenewalForm(f=>({...f,notes:e.target.value}))} className="border rounded-xl px-3 py-3" />
            <div className="col-span-2 flex justify-end gap-3"><button type="button" onClick={() => setRenewalOpen(false)} className="px-4 py-2.5 rounded-xl border font-black">إلغاء</button><button disabled={renewing} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-black disabled:opacity-50">{renewing ? 'جاري التجديد...' : 'تأكيد التجديد'}</button></div>
          </form>}

          {editSubscriptionOpen && selectedSubscription && <form onSubmit={saveSubscriptionEdit} className="mx-6 mb-6 bg-blue-50/50 border border-blue-100 rounded-2xl p-5 grid grid-cols-2 gap-4">
            <div className="col-span-2"><h3 className="font-black text-lg">تعديل الاشتراك الحالي</h3><p className="text-xs text-slate-500 mt-1">يمكنك تغيير نوع الاشتراك أو تاريخ البداية والنهاية في أي وقت.</p></div>
            <select value={editSubscriptionForm.plan_id} onChange={e=>setEditSubscriptionForm(f=>({...f,plan_id:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white"><option value="">بدون باقة</option>{plans.map(p=><option key={p.id} value={p.id}>{planLabel(p)}</option>)}</select>
            <input inputMode="numeric" placeholder="مبلغ الاشتراك" value={editSubscriptionForm.price_iqd} onChange={e=>setEditSubscriptionForm(f=>({...f,price_iqd:e.target.value.replace(/\D/g,'')}))} className="border rounded-xl px-3 py-3 bg-white" />
            <label className="text-xs font-black text-slate-600">تاريخ ووقت البداية<input type="datetime-local" value={editSubscriptionForm.starts_at} onChange={e=>setEditSubscriptionForm(f=>({...f,starts_at:e.target.value}))} className="mt-1 w-full border rounded-xl px-3 py-3 bg-white"/></label>
            <label className="text-xs font-black text-slate-600">تاريخ ووقت النهاية<input type="datetime-local" value={editSubscriptionForm.ends_at} onChange={e=>setEditSubscriptionForm(f=>({...f,ends_at:e.target.value}))} className="mt-1 w-full border rounded-xl px-3 py-3 bg-white"/></label>
            <input className="col-span-2 border rounded-xl px-3 py-3 bg-white" placeholder="ملاحظات التعديل (اختياري)" value={editSubscriptionForm.notes} onChange={e=>setEditSubscriptionForm(f=>({...f,notes:e.target.value}))}/>
            <div className="col-span-2 flex justify-end gap-3"><button type="button" onClick={()=>setEditSubscriptionOpen(false)} className="px-4 py-2.5 rounded-xl border font-black bg-white">إلغاء</button><button disabled={savingAccount} className="px-5 py-2.5 rounded-xl bg-blue-700 text-white font-black disabled:opacity-50 inline-flex items-center gap-2"><Save className="w-4 h-4"/>حفظ تعديل الاشتراك</button></div>
          </form>}

          <div className="px-6 py-4 border-t bg-slate-50 flex items-center justify-between gap-3 flex-wrap">
            <button disabled={savingAccount} onClick={() => void setGeneratorStatus(selectedGenerator.status === 'suspended' ? 'active' : 'suspended')} className={`px-4 py-2.5 rounded-xl font-black inline-flex items-center gap-2 ${selectedGenerator.status === 'suspended' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}><PauseCircle className="w-4 h-4" />{selectedGenerator.status === 'suspended' ? 'رفع التقييد' : 'إيقاف مؤقت للحساب'}</button>
            <div className="flex gap-3"><button onClick={openEditSubscription} className="px-4 py-2.5 rounded-xl bg-white border border-blue-200 text-blue-700 font-black inline-flex items-center gap-2"><Pencil className="w-4 h-4"/>تعديل الاشتراك</button><button onClick={() => setRenewalOpen(true)} className="px-5 py-2.5 rounded-xl bg-blue-700 text-white font-black inline-flex items-center gap-2"><CreditCard className="w-4 h-4" />تجديد الاشتراك</button></div>
          </div>
        </div>
      </div>}

      {excelImportOpen && <div className="fixed inset-0 z-[118] bg-black/50 flex items-center justify-center p-6">
        <form onSubmit={importSubscribersFromExcel} className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] overflow-y-auto">
          <div className="px-6 py-5 border-b flex items-center justify-between bg-white">
            <div>
              <h2 className="text-xl font-black flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-emerald-600" />رفع بيانات المشتركين من Excel</h2>
              <p className="text-xs text-slate-500 mt-1">اختر ملف Excel ثم حساب صاحب المولدة حتى تُضاف البيانات داخل حسابه فقط.</p>
            </div>
            <button type="button" onClick={() => setExcelImportOpen(false)} className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-6 grid grid-cols-1 gap-4">
            <label className="text-sm font-black text-slate-700">ملف Excel الخاص بالمشتركين
              <input
                required
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={e => { setExcelImportProgress(0); setExcelImportReport(EMPTY_EXCEL_REPORT); setExcelImportForm(f => ({ ...f, file: e.target.files?.[0] || null })); }}
                className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-3 bg-slate-50 text-sm"
              />
            </label>
            <label className="text-sm font-black text-slate-700">حساب صاحب المولدة الذي تريد رفع البيانات له
              <select
                required
                value={excelImportForm.generator_id}
                onChange={e => { setExcelImportProgress(0); setExcelImportReport(EMPTY_EXCEL_REPORT); setExcelImportForm(f => ({ ...f, generator_id: e.target.value })); }}
                className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-3 bg-white"
              >
                <option value="">اختر صاحب المولدة</option>
                {generators.map(g => <option key={g.id} value={g.id}>{g.name} — {g.owner_name}</option>)}
              </select>
            </label>
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-xs leading-6 text-emerald-900 font-bold">
              الأعمدة المقبولة: اسم المشترك، رقم الهاتف، الأمبير، نوع الاشتراك، الخط، العنوان، رقم الصندوق، المبلغ المدفوع، المبلغ المستحق، حالة الدفع، ملاحظات. إذا لم يوجد كود مشترك، النظام يولد كود فريد داخل حساب هذه المولدة.
            </div>

            {(excelImporting || excelImportReport.status !== 'idle') && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={`font-black ${excelImportReport.status === 'error' ? 'text-rose-700' : excelImportReport.status === 'success' ? 'text-emerald-700' : 'text-blue-700'}`}>
                    {excelImportReport.title || (excelImporting ? 'جاري رفع البيانات...' : 'تقرير رفع Excel')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{excelImportReport.generatorName ? `الحساب: ${excelImportReport.generatorName}` : 'سيظهر التقرير بعد بدء الرفع'}</p>
                </div>
                <span className="text-sm font-black text-slate-700">{excelImportProgress}%</span>
              </div>
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full transition-all ${excelImportReport.status === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${excelImportProgress}%` }} />
              </div>
              {excelImportReport.status !== 'idle' && <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="bg-white rounded-xl p-3 border"><p className="text-slate-500">الأسطر الكلية</p><p className="font-black text-slate-900">{excelImportReport.totalRows}</p></div>
                <div className="bg-white rounded-xl p-3 border"><p className="text-slate-500">المشتركين المرفوعين</p><p className="font-black text-emerald-700">{excelImportReport.importedRows}</p></div>
                <div className="bg-white rounded-xl p-3 border"><p className="text-slate-500">الأسطر المتروكة</p><p className="font-black text-amber-700">{excelImportReport.skippedRows}</p></div>
                <div className="bg-white rounded-xl p-3 border"><p className="text-slate-500">الخلايا المرفوعة</p><p className="font-black text-blue-700">{excelImportReport.cellsImported}</p></div>
                <div className="bg-white rounded-xl p-3 border"><p className="text-slate-500">الأعمدة الكلية</p><p className="font-black text-slate-900">{excelImportReport.totalColumns}</p></div>
                <div className="bg-white rounded-xl p-3 border"><p className="text-slate-500">الأعمدة المطابقة</p><p className="font-black text-emerald-700">{excelImportReport.mappedColumns}</p></div>
                <div className="bg-white rounded-xl p-3 border"><p className="text-slate-500">الأعمدة غير المرفوعة</p><p className="font-black text-rose-700">{excelImportReport.unmappedColumns.length}</p></div>
                <div className="bg-white rounded-xl p-3 border"><p className="text-slate-500">الخلايا المقروءة</p><p className="font-black text-slate-900">{excelImportReport.cellsRead}</p></div>
              </div>}
              {!!excelImportReport.unmappedColumns.length && <div className="bg-white rounded-xl border border-amber-200 p-3 text-xs text-amber-900">
                <p className="font-black mb-1">أعمدة موجودة بالملف لكن لم تُرفع لأنها غير معروفة:</p>
                <p>{excelImportReport.unmappedColumns.join('، ')}</p>
              </div>}
              {!!excelImportReport.warnings.length && <div className="bg-white rounded-xl border border-amber-200 p-3 text-xs text-amber-900 max-h-28 overflow-y-auto">
                <p className="font-black mb-1">تنبيهات:</p>
                {excelImportReport.warnings.slice(0, 20).map((w, i) => <p key={i}>• {w}</p>)}
              </div>}
              {!!excelImportReport.errors.length && <div className="bg-white rounded-xl border border-rose-200 p-3 text-xs text-rose-900 max-h-28 overflow-y-auto">
                <p className="font-black mb-1">أخطاء:</p>
                {excelImportReport.errors.slice(0, 20).map((w, i) => <p key={i}>• {w}</p>)}
              </div>}
            </div>}
          </div>
          <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
            <button type="button" onClick={() => setExcelImportOpen(false)} className="px-5 py-2.5 rounded-xl border font-black bg-white">{excelImportReport.status === 'success' ? 'إغلاق' : 'إلغاء'}</button>
            <button disabled={excelImporting} className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black disabled:opacity-50 inline-flex items-center gap-2">
              <UploadCloud className="w-4 h-4" />{excelImporting ? 'جاري الرفع...' : 'رفع البيانات'}
            </button>
          </div>
        </form>
      </div>}


      {generatorOpen && <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-6">
        <form onSubmit={createGeneratorAccount} className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[94vh] overflow-y-auto">
          <div className="px-6 py-5 border-b flex items-center justify-between sticky top-0 bg-white z-10"><div><h2 className="text-xl font-black">إضافة صاحب مولدة</h2><p className="text-xs text-slate-500 mt-1">إنشاء المولدة، حساب الدخول والاشتراك دفعة واحدة</p></div><button type="button" onClick={() => setGeneratorOpen(false)} className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button></div>
          <div className="p-6 grid grid-cols-2 gap-4">
            <input required placeholder="اسم المولدة" value={generatorForm.name} onChange={e=>setGeneratorForm(f=>({...f,name:e.target.value}))} className="border rounded-xl px-3 py-3" />
            <input required placeholder="اسم صاحب المولدة" value={generatorForm.owner_name} onChange={e=>setGeneratorForm(f=>({...f,owner_name:e.target.value}))} className="border rounded-xl px-3 py-3" />
            <input placeholder="رقم الهاتف" value={generatorForm.phone} onChange={e=>setGeneratorForm(f=>({...f,phone:e.target.value}))} className="border rounded-xl px-3 py-3" />
            <input placeholder="المنطقة" value={generatorForm.area} onChange={e=>setGeneratorForm(f=>({...f,area:e.target.value}))} className="border rounded-xl px-3 py-3" />
            <input required type="email" placeholder="إيميل تسجيل الدخول" value={generatorForm.email} onChange={e=>setGeneratorForm(f=>({...f,email:e.target.value}))} className="border rounded-xl px-3 py-3" />
            <input required type="text" minLength={6} placeholder="كلمة المرور الأولية" value={generatorForm.password} onChange={e=>setGeneratorForm(f=>({...f,password:e.target.value}))} className="border rounded-xl px-3 py-3" />
            <select required value={generatorForm.plan_id} onChange={e=>{const id=e.target.value; const plan=plans.find(p=>p.id===id); setGeneratorForm(f=>({...f,plan_id:id,price_iqd:plan?.price_iqd ? String(plan.price_iqd) : f.price_iqd}))}} className="border rounded-xl px-3 py-3 bg-white"><option value="">اختر نوع الاشتراك</option>{plans.map(p=><option key={p.id} value={p.id}>{planLabel(p)}</option>)}</select>
            <label className="text-xs font-black text-slate-600">تاريخ ووقت التفعيل<input type="datetime-local" value={generatorForm.starts_at} onChange={e=>setGeneratorForm(f=>({...f,starts_at:e.target.value}))} className="mt-1 w-full border rounded-xl px-3 py-3" /></label>
            {plans.find(p=>p.id===generatorForm.plan_id)?.is_custom_duration && <div className="col-span-2 grid grid-cols-3 gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4"><div className="col-span-3 text-xs font-black text-amber-800 flex items-center gap-2"><Clock3 className="w-4 h-4"/>مدة اشتراك الفحص — حددها بدقة</div><label className="text-xs font-bold">الأيام<input inputMode="numeric" value={generatorForm.test_days} onChange={e=>setGeneratorForm(f=>({...f,test_days:e.target.value.replace(/\D/g,'')}))} className="mt-1 w-full border rounded-xl px-3 py-2 bg-white"/></label><label className="text-xs font-bold">الساعات<input inputMode="numeric" value={generatorForm.test_hours} onChange={e=>setGeneratorForm(f=>({...f,test_hours:e.target.value.replace(/\D/g,'')}))} className="mt-1 w-full border rounded-xl px-3 py-2 bg-white"/></label><label className="text-xs font-bold">الدقائق<input inputMode="numeric" value={generatorForm.test_minutes} onChange={e=>setGeneratorForm(f=>({...f,test_minutes:e.target.value.replace(/\D/g,'')}))} className="mt-1 w-full border rounded-xl px-3 py-2 bg-white"/></label></div>}
            <input inputMode="numeric" placeholder="المبلغ المستحصل بالدينار" value={generatorForm.price_iqd} onChange={e=>setGeneratorForm(f=>({...f,price_iqd:e.target.value.replace(/\D/g,'')}))} className="border rounded-xl px-3 py-3" />
            <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs font-bold text-blue-800 flex items-center">الاشتراكات: فحص مخصص، أسبوعي 7 أيام، شهر، 3 شهور، 6 شهور، سنوي.</div>
          </div>
          <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3"><button type="button" onClick={()=>setGeneratorOpen(false)} className="px-5 py-2.5 rounded-xl border font-black">إلغاء</button><button disabled={creatingGenerator} className="px-6 py-2.5 rounded-xl bg-blue-700 text-white font-black disabled:opacity-50">{creatingGenerator ? 'جاري الإنشاء...' : 'إنشاء الحساب'}</button></div>
        </form>
      </div>}
    </div>
  );
};
