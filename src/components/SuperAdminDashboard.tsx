import React, { useEffect, useMemo, useState } from 'react';
import type * as XLSXTypes from 'xlsx';
import {
  Bell, Building2, CalendarClock, CircleDollarSign, LogOut, Megaphone,
  Plus, RefreshCw, ShieldCheck, Users, WalletCards, Wrench, X, UserPlus, Eye, CreditCard, Power, Pencil, KeyRound, PauseCircle, Save, Clock3, Trash2, FileSpreadsheet, UploadCloud
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SuperAdminStorageCard } from './SuperAdminStorageCard';
import { Subscriber, SubscriptionTierType, PaymentStatus, MonthlyTariffRecord, LineDistribution } from '../types';
import { INITIAL_MONTHLY_TARIFFS } from '../data/initialData';
import { calculateSubscriberBill } from '../utils/formatters';
import { AdminAdSlidesPanel } from './AdminAdSlidesPanel';
import { CustomerOrdersPanel } from './CustomerOrdersPanel';
import { SeasonalCampaignsPanel } from './SeasonalCampaignsPanel';
import { WebsiteReleaseManager } from './WebsiteReleaseManager';

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
  media_url?: string | null;
  media_type?: 'image' | 'video' | null;
  action_url?: string | null;
  priority?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
};
type SuperAdminManager = {
  id: string;
  full_name: string;
  email: string;
  can_activate: boolean;
  can_edit: boolean;
  can_create_generator: boolean;
  is_owner: boolean;
  is_active: boolean;
  created_at: string;
};

type Tab = 'overview' | 'generators' | 'finance' | 'orders' | 'notifications' | 'managers';
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

const iqd = (value: number) => `${new Intl.NumberFormat('ar-IQ-u-nu-latn').format(value)} د.ع`;
const dateText = (value: string) => new Intl.DateTimeFormat('ar-IQ-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const localDateTimeValue = (date = new Date()) => { const d = new Date(date.getTime() - date.getTimezoneOffset()*60000); return d.toISOString().slice(0,16); };
const customMinutes = (days: string, hours: string, minutes: string) => Math.max(0, Number(days||0)*1440 + Number(hours||0)*60 + Number(minutes||0));
const planLabel = (p: SubscriptionPlan) => p.is_custom_duration ? p.name : p.name;
const planDurationMs = (p: SubscriptionPlan, days='0', hours='0', minutes='0') => p.is_custom_duration ? customMinutes(days,hours,minutes)*60000 : Number(p.duration_days || p.duration_months*30)*86400000;
const effectiveGeneratorStatus = (generator: Generator, subscription: Subscription | null, now = new Date()): Generator['status'] => {
  if (generator.status === 'suspended' || subscription?.status === 'suspended') return 'suspended';
  if (!subscription) return 'expired';
  const endMs = new Date(subscription.ends_at).getTime();
  if (!Number.isFinite(endMs)) return generator.status === 'active' ? 'expired' : generator.status;
  if (endMs <= now.getTime() || subscription.status === 'expired') return 'expired';
  return 'active';
};

const subscriptionRemainingText = (subscription: Subscription | null, now = new Date()) => {
  if (!subscription) return 'لا يوجد اشتراك';
  const endMs = new Date(subscription.ends_at).getTime();
  if (!Number.isFinite(endMs)) return 'تاريخ الاشتراك غير صالح';
  const diff = endMs - now.getTime();
  if (diff <= 0) {
    const elapsedDays = Math.max(0, Math.ceil(Math.abs(diff) / 86400000));
    return elapsedDays === 0 ? 'انتهى اليوم' : `انتهى منذ ${elapsedDays} يوم`;
  }
  const hours = Math.ceil(diff / 3600000);
  if (hours < 24) return `متبقي أقل من يوم (${hours} ساعة)`;
  const days = Math.ceil(diff / 86400000);
  return `متبقي ${days} يوم`;
};

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
  .replace(/[0-9]/g, d => String('0123456789'.indexOf(d)))
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
  const cleaned = normalizeText(value).replace(/[0-9]/g, d => String('0123456789'.indexOf(d))).replace(/[^0-9.]/g, '');
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
  // SUPERADMIN_AD_UPLOAD_UI_FINAL_V2
  // SUPERADMIN_AD_UPLOAD_UI_FINAL_V2
  // SUPERADMIN_AD_UPLOAD_UI_FINAL_V2
  // SUPERADMIN_AD_UPLOAD_UI_FINAL_V2
  // SUPERADMIN_AD_UPLOAD_UI_FINAL_V2
  // SUPERADMIN_AD_UPLOAD_UI_FINAL_V2
  // SUPERADMIN_AD_UPLOAD_UI_FINAL_V2
  // SUPERADMIN_AD_UPLOAD_UI_FINAL_V2
  // SUPERADMIN_AD_UPLOAD_UI_FINAL_V2
  // SUPERADMIN_AD_UPLOAD_UI_FINAL_V2
  // SUPERADMIN_AD_UPLOAD_UI_FINAL_V2
  // SUPERADMIN_AD_UPLOAD_UI_FINAL_V2
  // SUPERADMIN_AD_UPLOAD_UI_FINAL_V2
  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});
  const [totalSubscribers, setTotalSubscribers] = useState(0);
  const [managers, setManagers] = useState<SuperAdminManager[]>([]);
  const [currentManager, setCurrentManager] = useState<SuperAdminManager | null>(null);
  const [isOwnerSuperAdmin, setIsOwnerSuperAdmin] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [savingManager, setSavingManager] = useState(false);
  const [managerForm, setManagerForm] = useState({ full_name:'', email:'', password:'', can_activate:false, can_edit:false, can_create_generator:false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [generatorFormError, setGeneratorFormError] = useState<string | null>(null);
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

  // WORKMODE_SUPER_ADMIN_AD_FIELDS
  const [notificationMediaFile, setNotificationMediaFile] = useState<File | null>(null);
  const [notificationForm, setNotificationForm] = useState({
    title: '', body: '', category: 'maintenance', target_type: 'all_generators', generator_id: '',
    media_url: '', media_type: 'image', action_url: '', priority: '0', starts_at: '', ends_at: ''
  });

  const load = async () => {
    setLoading(true);
    setError(null);

    // SUPER_ADMIN_AUTH_READY_V1: Android WebView may restore UI before Supabase JWT hydration.
    let authSession = (await supabase.auth.getSession()).data.session;
    if (!authSession) {
      await new Promise(resolve => window.setTimeout(resolve, 250));
      authSession = (await supabase.auth.getSession()).data.session;
    }
    if (!authSession) {
      try {
        const refreshed = await supabase.auth.refreshSession();
        authSession = refreshed.data.session;
      } catch {}
    }
    if (!authSession) {
      setError('جلسة السوبر أدمن غير جاهزة. سجّل الدخول من جديد إذا استمرت المشكلة.');
      setLoading(false);
      return;
    }
    const [g, s, p, t, n, gs] = await Promise.all([
      supabase.from('generators').select('*').order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('*').order('ends_at', { ascending: true }),
      supabase.from('subscription_plans').select('*').eq('is_active', true).order('created_at'),
      supabase.from('admin_transactions').select('*').order('received_at', { ascending: false }),
      supabase.from('app_notifications').select('*').order('created_at', { ascending: false }),
      supabase.from('generator_subscribers').select('generator_id'),
    ]);
    const firstError = g.error || s.error || p.error || t.error || n.error || gs.error;
    if (firstError) setError(firstError.message || 'تعذر تحميل البيانات');
    else {
      setGenerators((g.data || []) as Generator[]);
      setSubscriptions((s.data || []) as Subscription[]);
      const order: Record<string,number> = { test:0, weekly:1, monthly:2, quarterly:3, semiannual:4, annual:5 };
      setPlans(((p.data || []) as SubscriptionPlan[]).sort((a,b)=>(order[a.plan_code||'']??99)-(order[b.plan_code||'']??99)));
      setTransactions((t.data || []) as AdminTransaction[]);
      setNotifications((n.data || []) as AppNotification[]);
      const counts: Record<string, number> = {};
      for (const row of (gs.data || []) as Array<{ generator_id: string | null }>) {
        if (!row.generator_id) continue;
        counts[row.generator_id] = (counts[row.generator_id] || 0) + 1;
      }
      setSubscriberCounts(counts);
      setTotalSubscribers((gs.data || []).length);
    }
    setLoading(false);
  };

  const loadManagers = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data } = await supabase.functions.invoke('manage-super-admin-manager', { body: { action: 'list' } });
      if (data?.ok) {
        const list = (data.managers || []) as SuperAdminManager[];
        setManagers(list);
        const current = list.find(m => m.id === userData.user?.id) || null;
        setCurrentManager(current);
        setIsOwnerSuperAdmin(Boolean(data.is_owner || current?.is_owner));
      }
    } catch (e) {}
  };

  useEffect(() => { void load(); void loadManagers(); }, []);

  // SUPER_ADMIN_AUTH_LISTENER_V1
  useEffect(() => {
    let active = true;
    const runLoad = () => { if (active) void load(); };
    const firstTimer = window.setTimeout(runLoad, 180);

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) window.setTimeout(runLoad, 0);
    });

    const onVisible = () => {
      if (document.visibilityState === 'visible') runLoad();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      window.clearTimeout(firstTimer);
      authListener.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const signed = (x: AdminTransaction) => x.direction === 'refund' ? -x.amount_iqd : x.amount_iqd;
    return {
      total: generators.length,
      subscribers: totalSubscribers,
      active: generators.filter(g => { const latest = subscriptions.filter(s => s.generator_id === g.id).sort((a,b) => new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime())[0] || null; return effectiveGeneratorStatus(g, latest, now) === 'active'; }).length,
      suspended: generators.filter(g => g.status === 'suspended').length,
      expiring: subscriptions.filter(s => {
        const end = new Date(s.ends_at);
        return s.status === 'active' && end >= now && end <= weekEnd;
      }).length,
      allRevenue: transactions.reduce((sum, x) => sum + signed(x), 0),
      monthRevenue: transactions.filter(x => new Date(x.received_at) >= monthStart).reduce((sum, x) => sum + signed(x), 0),
      yearRevenue: transactions.filter(x => new Date(x.received_at) >= yearStart).reduce((sum, x) => sum + signed(x), 0),
    };
  }, [generators, subscriptions, transactions, totalSubscribers]);

  const generatorName = (id: string | null) => generators.find(g => g.id === id)?.name || '—';
  const latestSubscriptionFor = (generatorId: string) => subscriptions
    .filter(s => s.generator_id === generatorId)
    .sort((a,b) => new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime())[0] || null;
  const selectedGenerator = selectedGeneratorId ? generators.find(g => g.id === selectedGeneratorId) || null : null;
  const selectedSubscription = selectedGeneratorId ? latestSubscriptionFor(selectedGeneratorId) : null;
  const selectedEffectiveStatus = selectedGenerator ? effectiveGeneratorStatus(selectedGenerator, selectedSubscription) : 'expired';
  const selectedSubscriptionRemaining = subscriptionRemainingText(selectedSubscription);
  const canActivateGeneratorAccount = isOwnerSuperAdmin || Boolean(currentManager?.can_activate);
  const canEditGeneratorAccount = isOwnerSuperAdmin || Boolean(currentManager?.can_edit);
  const canCreateGeneratorAccount = isOwnerSuperAdmin || Boolean(currentManager?.can_create_generator);


  const createManagerAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnerSuperAdmin) return setMessage('إنشاء مدراء السوبر أدمن متاح للمدير الرئيسي فقط');
    if (!managerForm.full_name.trim() || !managerForm.email.trim() || !managerForm.password.trim()) return setMessage('أكمل اسم المدير والإيميل والرمز');
    if (managerForm.password.trim().length < 4) return setMessage('الرمز يجب أن يكون 4 أرقام أو أكثر');
    setSavingManager(true);
    const { data, error } = await supabase.functions.invoke('manage-super-admin-manager', { body: { action:'create', ...managerForm, email:managerForm.email.trim().toLowerCase(), password:managerForm.password.trim() } });
    setSavingManager(false);
    if (error || !data?.ok) return setMessage('تعذر إنشاء المدير: ' + (data?.error || error?.message || 'خطأ غير معروف'));
    setManagerForm({ full_name:'', email:'', password:'', can_activate:false, can_edit:false, can_create_generator:false });
    setManagerOpen(false);
    setMessage('تم إنشاء مدير السوبر أدمن وتحديد صلاحياته بنجاح');
    await loadManagers();
  };

  const updateManagerPermissions = async (manager: SuperAdminManager, patch: Partial<SuperAdminManager> & { password?: string }) => {
    if (!isOwnerSuperAdmin) return setMessage('تعديل صلاحيات المدراء متاح للمدير الرئيسي فقط');
    setSavingManager(true);
    const { data, error } = await supabase.functions.invoke('manage-super-admin-manager', { body: { action:'update', manager_id: manager.id, ...patch } });
    setSavingManager(false);
    if (error || !data?.ok) return setMessage('تعذر تعديل المدير: ' + (data?.error || error?.message || 'خطأ غير معروف'));
    setMessage('تم تحديث صلاحيات المدير');
    await loadManagers();
  };

  const createGeneratorAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratorFormError(null);
    setMessage(null);

    const cleanName = generatorForm.name.trim();
    const cleanOwner = generatorForm.owner_name.trim();
    const cleanEmail = generatorForm.email.trim().toLowerCase();
    const cleanPassword = generatorForm.password.trim();

    if (!cleanName || !cleanOwner || !cleanEmail || !cleanPassword) {
      setGeneratorFormError('أكمل اسم المولدة، اسم المالك، البريد وكلمة المرور');
      return;
    }

    const duplicateGenerator = generators.find(g => (g.email || '').trim().toLowerCase() === cleanEmail);
    if (duplicateGenerator) {
      setGeneratorFormError('إيميل تسجيل الدخول مستخدم مسبقاً لحساب ' + duplicateGenerator.name + '. استخدم إيميلاً مختلفاً.');
      return;
    }

    const plan = plans.find(x => x.id === generatorForm.plan_id);
    if (!plan) {
      setGeneratorFormError('اختر نوع الاشتراك');
      return;
    }

    const start = new Date(generatorForm.starts_at);
    const durationMs = planDurationMs(plan, generatorForm.test_days, generatorForm.test_hours, generatorForm.test_minutes);
    if (!Number.isFinite(start.getTime()) || durationMs <= 0) {
      setGeneratorFormError('حدد مدة اشتراك صحيحة');
      return;
    }

    const end = new Date(start.getTime() + durationMs);
    setCreatingGenerator(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-generator-account', {
        body: {
          name: cleanName,
          owner_name: cleanOwner,
          phone: generatorForm.phone.trim() || null,
          area: generatorForm.area.trim() || null,
          email: cleanEmail,
          password: cleanPassword,
          plan_id: plan.id,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          price_iqd: Number(generatorForm.price_iqd || plan.price_iqd || 0),
        }
      });

      let serverMessage = data?.error || '';
      if (error && !serverMessage) {
        const context = (error as any)?.context;
        if (context && typeof context.clone === 'function') {
          try {
            const payload = await context.clone().json();
            serverMessage = payload?.error || payload?.message || '';
          } catch {}
        }
        if (!serverMessage) serverMessage = (error as any)?.message || 'خطأ غير معروف';
      }

      if (error || !data?.ok) {
        const text = serverMessage || 'خطأ غير معروف';
        setGeneratorFormError(text.includes('مستخدم مسبقاً')
          ? 'إيميل تسجيل الدخول مستخدم مسبقاً. استخدم إيميلاً مختلفاً.'
          : 'تعذر إنشاء الحساب: ' + text);
        return;
      }

      setGeneratorForm({ name:'', owner_name:'', phone:'', area:'', email:'', password:'', plan_id:'', starts_at:localDateTimeValue(), price_iqd:'', test_days:'0', test_hours:'0', test_minutes:'30' });
      setGeneratorFormError(null);
      setGeneratorOpen(false);
      setMessage('تم إنشاء صاحب المولدة وحساب الدخول والاشتراك بنجاح');
      await load();
    } catch (err: any) {
      setGeneratorFormError('تعذر إنشاء الحساب: ' + (err?.message || 'خطأ غير معروف'));
    } finally {
      setCreatingGenerator(false);
    }
  };

  const renewSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGeneratorId) return;
    if (!canActivateGeneratorAccount) return setMessage('ليست لديك صلاحية التفعيل أو التجديد');
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
    if (!canEditGeneratorAccount) return setMessage('ليست لديك صلاحية تعديل معلومات الحساب');
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
    if (!canActivateGeneratorAccount) return setMessage('ليست لديك صلاحية التفعيل أو الإيقاف');
    setSavingAccount(true);
    const { data, error } = await supabase.functions.invoke('manage-generator-account', {
      body: { action:'set_status', generator_id:selectedGeneratorId, status, reason: status === 'suspended' ? 'مقيد مؤقتاً من الإدارة' : null }
    });
    setSavingAccount(false);
    if (error || !data?.ok) return setMessage(`تعذر تحديث الحالة: ${data?.error || error?.message || 'خطأ غير معروف'}`);
    setMessage(status === 'active' ? 'تم رفع التقييد وتفعيل الحساب' : 'تم تقييد الحساب مؤقتاً');
    await load();
  };

  const deleteGeneratorAccount = async () => {
    if (!selectedGeneratorId || !selectedGenerator) return;

    const firstConfirm = window.confirm(
      `تحذير: سيتم حذف حساب "${selectedGenerator.name}" نهائياً مع المشتركين والديون والتسديدات والتسعيرات والجباة المرتبطين به. لا يمكن التراجع عن العملية. هل تريد المتابعة؟`
    );
    if (!firstConfirm) return;

    const typedName = window.prompt(
      `للتأكيد النهائي اكتب اسم المولدة كما هو بالضبط:\n${selectedGenerator.name}`
    );
    if (typedName === null) return;
    if (typedName.trim() !== selectedGenerator.name.trim()) {
      setMessage('تم إلغاء الحذف لأن اسم المولدة المكتوب غير مطابق.');
      return;
    }

    setSavingAccount(true);
    setMessage(null);
    const { data, error } = await supabase.functions.invoke('purge-generator-account', {
      body: {
                generator_id: selectedGeneratorId,
        confirmation_name: typedName.trim(),
      },
    });
    setSavingAccount(false);

    if (error || !data?.ok) {
      setMessage(`تعذر حذف الحساب: ${data?.error || error?.message || 'خطأ غير معروف'}`);
      return;
    }

    setSelectedGeneratorId(null);
    setRenewalOpen(false);
    setCredentialsOpen(false);
    setEditSubscriptionOpen(false);
    setMessage('تم حذف حساب صاحب المولدة نهائياً مع بياناته وحسابات الدخول والملفات المرتبطة.');
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
    if (!canActivateGeneratorAccount) return setMessage('ليست لديك صلاحية تعديل الاشتراك');
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

  // SUPER_ADMIN_EXCEL_IMPORT_CLOUD_V5
  const importSubscribersFromExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelImportForm.generator_id) return setMessage('اختر حساب صاحب المولدة قبل الرفع');
    if (!excelImportForm.file) return setMessage('اختر ملف Excel أولاً');

    const XLSX = await import('xlsx');

    const idle = () => new Promise<void>(resolve => setTimeout(resolve, 0));
    const cellValue = (sheet: XLSXTypes.WorkSheet, rowIndex: number, colIndex: number) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: colIndex })];
      return cell?.w ?? cell?.v ?? '';
    };
    const normalizeImportPhone = (value: unknown) => {
      const raw = normalizeText(value)
        .replace(/[0-9]/g, d => String('0123456789'.indexOf(d)))
        .replace(/[0-9]/g, d => String('0123456789'.indexOf(d)));
      const digits = raw.replace(/\D/g, '');
      if (/^7\d{9}$/.test(digits)) return '0' + digits;
      return raw;
    };
    const toNullableNumber = (value: unknown) => isEmptyCell(value) ? null : toNumber(value);
    const toDateValue = (value: unknown) => {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const yyyy = value.getFullYear();
        const mm = String(value.getMonth() + 1).padStart(2, '0');
        const dd = String(value.getDate()).padStart(2, '0');
        return yyyy + '-' + mm + '-' + dd;
      }
      const raw = normalizeText(value);
      if (!raw) return null;
      const iso = raw.match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)/);
      if (iso) return iso[1] + '-' + String(Number(iso[2])).padStart(2, '0') + '-' + String(Number(iso[3])).padStart(2, '0');
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed.getFullYear() + '-' + String(parsed.getMonth() + 1).padStart(2, '0') + '-' + String(parsed.getDate()).padStart(2, '0');
    };
    const explicitPaymentStatus = (value: unknown): PaymentStatus | null => {
      const raw = normalizeText(value).toLowerCase();
      if (!raw) return null;
      if (raw.includes('مجاني') || raw.includes('معفي') || raw.includes('free')) return 'free';
      if (raw.includes('جزئي') || raw.includes('partial')) return 'partial';
      if (raw.includes('مسدد') || raw.includes('مدفوع') || raw.includes('paid')) return 'paid';
      if (raw.includes('غير') || raw.includes('unpaid')) return 'unpaid';
      return null;
    };
    const isTruthyExcel = (value: unknown) => {
      const raw = normalizeText(value).toLowerCase();
      return ['1', 'true', 'yes', 'y', 'نعم', 'معفي', 'مجاني'].includes(raw);
    };

    setExcelImporting(true);
    setExcelImportProgress(3);
    setExcelImportReport({ ...EMPTY_EXCEL_REPORT, status: 'processing', title: 'جاري تجهيز ملف Excel...', fileName: excelImportForm.file.name });
    setMessage(null);

    try {
      const generator = generators.find(g => g.id === excelImportForm.generator_id);
      const buffer = await excelImportForm.file.arrayBuffer();
      setExcelImportProgress(10);
      await idle();

      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: false, cellStyles: false, WTF: false });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error('ملف Excel فارغ');
      const sheet = workbook.Sheets[firstSheetName];
      const ref = sheet['!ref'];
      if (!ref) throw new Error('لا توجد بيانات مشتركين داخل الملف');
      const range = XLSX.utils.decode_range(ref);

      const headers = Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) => normalizeText(cellValue(sheet, range.s.r, range.s.c + index)));
      const extraKnownHeaders = [
        'الاسم الكامل', 'اسم الكابينة', 'رقم الجوزة / الصندوق', 'المبلغ المطلوب', 'المبلغ المسدد',
        'آخر تاريخ تسديد', 'معفي؟', 'سبب الإعفاء', 'تاريخ الانضمام'
      ].map(normalizeHeader);
      const importKnownHeaderSet = new Set([...knownHeaderSet, ...extraKnownHeaders]);
      const visibleHeaders = headers.filter(Boolean);
      const totalColumns = visibleHeaders.length;
      const unmappedColumns = visibleHeaders.filter(h => !importKnownHeaderSet.has(normalizeHeader(h)));
      const mappedColumns = Math.max(0, totalColumns - unmappedColumns.length);
      const readAny = (rowIndex: number, aliases: string[]) => {
        const wanted = aliases.map(normalizeHeader);
        const found = headers.findIndex(h => wanted.includes(normalizeHeader(h)));
        return found >= 0 ? cellValue(sheet, rowIndex, range.s.c + found) : '';
      };

      const dataStartRow = range.s.r + 1;
      const totalRows = Math.max(0, range.e.r - dataStartRow + 1);
      if (!totalRows) throw new Error('لا توجد بيانات مشتركين داخل الملف');

      setExcelImportProgress(18);
      setExcelImportReport({
        ...EMPTY_EXCEL_REPORT,
        status: 'processing',
        title: 'تمت قراءة الملف، جاري تجهيز البيانات للرفع السحابي...',
        generatorName: generator?.name || excelImportForm.generator_id,
        fileName: excelImportForm.file.name,
        totalRows,
        totalColumns,
        mappedColumns,
        unmappedColumns,
      });
      await idle();

      const rows: any[] = [];
      const parserWarnings: string[] = [];
      let parserSkipped = 0;
      let cellsRead = 0;

      for (let rowIndex = dataStartRow; rowIndex <= range.e.r; rowIndex += 1) {
        const rowValues = Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) => cellValue(sheet, rowIndex, range.s.c + index));
        if (!rowValues.some(v => !isEmptyCell(v))) {
          parserSkipped += 1;
          continue;
        }
        cellsRead += rowValues.filter(v => !isEmptyCell(v)).length;

        const fullName = normalizeText(readAny(rowIndex, ['الاسم الكامل', 'اسم المشترك', 'اسم المشترك الكامل', 'الاسم', 'اسم الزبون', 'اسم العميل', 'المشترك', 'المستهلك', 'fullName', 'name', 'subscriberName']));
        const phone = normalizeImportPhone(readAny(rowIndex, ['رقم الهاتف', 'الهاتف', 'رقم الموبايل', 'موبايل', 'الموبايل', 'رقم العميل', 'phone', 'mobile', 'mobileNumber']));
        if (!fullName && !phone) {
          parserSkipped += 1;
          parserWarnings.push('السطر ' + (rowIndex + 1) + ': الاسم ورقم الهاتف فارغان.');
          continue;
        }

        const tier = parseTier(readAny(rowIndex, ['نوع الاشتراك', 'نوع المشترك', 'الفئة', 'التصنيف', 'tier', 'type', 'subscriptionType']));
        const rawExempt = readAny(rowIndex, ['معفي؟', 'معفي', 'اعفاء', 'إعفاء', 'isExempted']);
        const isExempted = tier === 'free' || isTruthyExcel(rawExempt);
        const paidValue = readAny(rowIndex, ['المبلغ المسدد', 'المبلغ المدفوع', 'المدفوع', 'المسدد', 'الواصل', 'paid', 'amountPaid']);
        const dueValue = readAny(rowIndex, ['المبلغ المطلوب', 'المبلغ المستحق', 'المستحق', 'الدين', 'الباقي', 'remaining', 'due', 'amountDue']);

        rows.push({
          excel_row: rowIndex + 1,
          code: normalizeText(readAny(rowIndex, ['كود المشترك', 'الكود', 'رقم المشترك', 'رمز المشترك', 'code', 'subscriberCode'])),
          full_name: fullName,
          phone,
          tier,
          amperes: Math.max(0, toNumber(readAny(rowIndex, ['عدد الأمبيرات', 'عدد الامبيرات', 'الأمبير', 'الامبير', 'امبير', 'عدد الامبير', 'amperes', 'amps', 'amp'])) || 1),
          line_name: normalizeText(readAny(rowIndex, ['اسم الكابينة', 'الكابينة', 'كابينة', 'البورد', 'البورد/الكابينة', 'الخط', 'اسم الخط', 'خط', 'line', 'lineName', 'zone'])),
          address: normalizeText(readAny(rowIndex, ['العنوان', 'الموقع', 'الدار', 'عنوان السكن', 'address', 'location'])),
          box_number: normalizeText(readAny(rowIndex, ['رقم الجوزة / الصندوق', 'رقم الجوزة/الصندوق', 'رقم الصندوق', 'رقم الجوزة', 'الجوزة', 'boxNumber', 'box'])),
          payment_status: explicitPaymentStatus(readAny(rowIndex, ['حالة التسديد', 'حالة الدفع', 'الحالة', 'status', 'paymentStatus'])),
          amount_due: toNullableNumber(dueValue),
          amount_paid: toNullableNumber(paidValue) ?? 0,
          last_payment_date: toDateValue(readAny(rowIndex, ['آخر تاريخ تسديد', 'تاريخ آخر دفع', 'تاريخ التسديد', 'lastPaymentDate', 'paymentDate'])),
          is_exempted: isExempted,
          exempt_reason: normalizeText(readAny(rowIndex, ['سبب الإعفاء', 'سبب الاعفاء', 'سبب المجاني', 'exemptReason'])),
          notes: normalizeText(readAny(rowIndex, ['ملاحظات', 'ملاحظة', 'notes', 'note'])),
          joining_date: toDateValue(readAny(rowIndex, ['تاريخ الانضمام', 'تاريخ الاشتراك', 'joiningDate', 'createdAt'])),
        });

        const doneRows = rowIndex - dataStartRow + 1;
        if (doneRows % 30 === 0 || rowIndex === range.e.r) {
          const progress = 18 + Math.round((doneRows / Math.max(totalRows, 1)) * 47);
          setExcelImportProgress(Math.min(progress, 65));
          setExcelImportReport(prev => ({ ...prev, title: 'جاري قراءة وتجهيز السطور... ' + Math.min(doneRows, totalRows) + ' / ' + totalRows, cellsRead, skippedRows: parserSkipped }));
          await idle();
        }
      }

      if (!rows.length) throw new Error('لم يتم العثور على أي مشترك صالح داخل الملف');

      setExcelImportProgress(72);
      setExcelImportReport(prev => ({ ...prev, title: 'جاري رفع البيانات فعلياً إلى حساب صاحب المولدة في السحابة...', cellsRead, skippedRows: parserSkipped }));
      await idle();

      const { data: result, error: invokeError } = await supabase.functions.invoke('super-admin-import-subscribers', {
        body: { generator_id: excelImportForm.generator_id, rows },
      });
      if (invokeError) throw new Error((result as any)?.error || invokeError.message || 'فشل الاتصال بخدمة الرفع السحابي');
      if (!(result as any)?.ok) throw new Error((result as any)?.error || 'فشل حفظ المشتركين في السحابة');

      const importedCount = Number((result as any).imported_count || 0);
      const backendSkipped = Number((result as any).skipped_count || 0);
      const skippedRows = parserSkipped + backendSkipped;
      const createdCabinets = Array.isArray((result as any).created_cabinets) ? (result as any).created_cabinets : [];
      const backendWarnings = Array.isArray((result as any).warnings) ? (result as any).warnings : [];
      const warnings = [
        ...(createdCabinets.length ? ['تم إنشاء الكابينات الجديدة: ' + createdCabinets.join('، ')] : []),
        ...parserWarnings,
        ...backendWarnings,
      ].slice(0, 100);

      setExcelImportProgress(100);
      if (importedCount === 0) {
        setExcelImportReport({
          status: 'error',
          title: 'لم تتم إضافة أي مشترك جديد — جميع السطور مكررة أو غير صالحة',
          generatorName: (result as any).generator_name || generator?.name || excelImportForm.generator_id,
          fileName: excelImportForm.file.name,
          totalRows,
          importedRows: 0,
          skippedRows,
          totalColumns,
          mappedColumns,
          unmappedColumns,
          cellsRead,
          cellsImported: 0,
          warnings,
          errors: [],
        });
        setMessage('لم تتم إضافة أي مشترك جديد. تم تخطي ' + skippedRows + ' سطر، ومنها ' + Number((result as any).duplicate_names || 0) + ' اسم مطابق موجود مسبقاً.');
      } else {
        setExcelImportReport({
          status: 'success',
          title: 'تم رفع ملف Excel وحفظ المشتركين فعلياً في السحابة',
          generatorName: (result as any).generator_name || generator?.name || excelImportForm.generator_id,
          fileName: excelImportForm.file.name,
          totalRows,
          importedRows: importedCount,
          skippedRows,
          totalColumns,
          mappedColumns,
          unmappedColumns,
          cellsRead,
          cellsImported: importedCount * 13,
          warnings,
          errors: [],
        });
        setMessage('تم رفع ' + importedCount + ' مشترك فعلياً إلى حساب صاحب المولدة — تم تخطي ' + skippedRows + ' سطر، منها ' + Number((result as any).duplicate_names || 0) + ' اسم مطابق.');
      }

      window.dispatchEvent(new CustomEvent('moldatk-cloud-import-complete', { detail: { generatorId: excelImportForm.generator_id, importedCount } }));
      await load();
    } catch (err: any) {
      const errorMessage = err?.message || 'خطأ غير معروف';
      setExcelImportProgress(100);
      setExcelImportReport(prev => ({ ...prev, status: 'error', title: 'فشل رفع ملف Excel إلى السحابة', errors: [...prev.errors, errorMessage] }));
      setMessage('تعذر رفع ملف Excel: ' + errorMessage);
    } finally {
      setExcelImporting(false);
    }
  };


  const sendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notificationForm.title.trim() || !notificationForm.body.trim()) return setMessage('اكتب عنوان ونص الإعلان');
    if (notificationForm.target_type === 'single_generator' && !notificationForm.generator_id) return setMessage('اختر المولدة المستهدفة');

    try {
      let mediaUrl = notificationForm.media_url.trim() || null;
      let mediaType = (notificationForm.media_type || null) as 'image' | 'video' | null;

      if (notificationMediaFile) {
        const isVideo = notificationMediaFile.type.startsWith('video/');
        const ext = notificationMediaFile.name.split('.').pop()?.toLowerCase() || (isVideo ? 'mp4' : 'jpg');
        const safeName = notificationMediaFile.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
        const storagePath = `ads/${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName || 'ad.' + ext}`;
        const { error: uploadError } = await supabase.storage
          .from('app-ad-media')
          .upload(storagePath, notificationMediaFile, { contentType: notificationMediaFile.type || undefined, upsert: false });
        if (uploadError) throw uploadError;
        const { data: publicFile } = supabase.storage.from('app-ad-media').getPublicUrl(storagePath);
        mediaUrl = publicFile.publicUrl;
        mediaType = isVideo ? 'video' : 'image';
      }

      const startsAt = notificationForm.starts_at ? new Date(notificationForm.starts_at).toISOString() : new Date().toISOString();
      const endsAt = notificationForm.ends_at ? new Date(notificationForm.ends_at).toISOString() : null;
      const { error } = await supabase.from('app_notifications').insert({
        title: notificationForm.title.trim(),
        body: notificationForm.body.trim(),
        category: notificationForm.category || 'offer',
        target_type: notificationForm.target_type,
        generator_id: notificationForm.target_type === 'single_generator' ? notificationForm.generator_id : null,
        is_active: true,
        starts_at: startsAt,
        ends_at: endsAt,
        expires_at: endsAt,
        media_url: mediaUrl,
        media_type: mediaUrl ? mediaType : null,
        action_url: notificationForm.action_url.trim() || null,
        priority: Number(notificationForm.priority || 0),
      } as any);
      if (error) throw error;

      setNotificationMediaFile(null);
      setNotificationForm({ title: '', body: '', category: 'offer', target_type: 'all_generators', generator_id: '', media_url: '', media_type: '', action_url: '', priority: '0', starts_at: localDateTimeValue(), ends_at: '' });
      setMessage('تم ربط الإعلان وحفظه في Supabase وسيظهر داخل إعدادات التطبيق حسب الاستهداف');
      await load();
    } catch (err: any) {
      setMessage(`تعذر حفظ الإعلان في Supabase: ${err?.message || 'خطأ غير معروف'}`);
    }
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
    ['orders', 'طلبات الموقع', WalletCards],
    ...(isOwnerSuperAdmin ? ([['notifications', 'الإشعارات', Bell]] as const) : []),
    ...(isOwnerSuperAdmin ? ([['website', 'الموقع والتحديثات', Wrench]] as const) : []),
    ...(isOwnerSuperAdmin ? ([['managers', 'مدراء السوبر أدمن', ShieldCheck]] as const) : []),
  ] as const;

  return (
    <div dir="rtl" className="moldatk-responsive-screen min-h-screen bg-slate-100 text-slate-900 font-['Cairo',sans-serif] min-w-0 overflow-x-hidden">
      <header className="moldatk-superadmin-header bg-[#0b1530] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-8 pb-4 sm:pb-3 shadow-lg min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-blue-700 flex items-center justify-center shrink-0"><ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" /></div>
          <div className="min-w-0"><h1 className="text-base sm:text-xl leading-tight font-black break-words">molidatk — Super Admin</h1><p className="text-[11px] sm:text-xs text-slate-400 mt-1 leading-5">إدارة الحسابات، الإيرادات والإشعارات</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto moldatk-mobile-actions">
          <button onClick={() => void load()} className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 shrink-0" title="تحديث"><RefreshCw className="w-4 h-4" /></button>
          {isOwnerSuperAdmin && <button
            onClick={() => void resetAllDataForRelease()}
            disabled={resettingAllData}
            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-xs sm:text-sm font-bold min-w-0"
            title="تصفير بيانات التجربة قبل الإطلاق"
          >
            <Trash2 className="w-4 h-4" />{resettingAllData ? 'جاري التصفير...' : 'تصفير بيانات التجربة'}
          </button>}
          <button onClick={signOut} className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs sm:text-sm font-bold min-w-0"><LogOut className="w-4 h-4" />تسجيل الخروج</button>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row w-full max-w-[1700px] mx-auto min-w-0">
        <aside className="w-full lg:w-64 p-3 sm:p-5 shrink-0 min-w-0">
          <div className="moldatk-responsive-scroll bg-white border border-slate-200 rounded-2xl p-2 shadow-sm lg:sticky lg:top-5 flex lg:block gap-1 overflow-x-auto max-w-full">
            {nav.map(([key, label, Icon]) => (
              <button key={key} onClick={() => setTab(key)} className={`w-auto lg:w-full shrink-0 flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-3 rounded-xl text-sm font-black lg:mb-1 whitespace-nowrap ${tab === key ? 'bg-[#0B1F3B] text-white' : 'hover:bg-slate-100 text-slate-600'}`}>
                <Icon className="w-5 h-5" />{label}
              </button>
            ))}
          </div>
        </aside>

        <main className="p-3 sm:p-5 lg:pl-8 flex-1 w-full max-w-full min-w-0 overflow-x-hidden">
          {message && <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 font-bold text-sm">{message}</div>}
          {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-bold text-sm">{error}</div>}

          {tab === 'website' && isOwnerSuperAdmin && <WebsiteReleaseManager />}

          {/* super-admin-balanced-stats-v4 */}
          

          

          

          

          

          

          {tab === 'website' && isOwnerSuperAdmin && <WebsiteReleaseManager />}

          {tab === 'website' && <WebsiteReleaseManager />}

          {tab === 'overview' && <>
            <SuperAdminStorageCard />
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 mb-4">
              {[
                ['إجمالي أصحاب المولدات', stats.total, Building2],
                ['إجمالي المشتركين', stats.subscribers, Users],
                ['الحسابات الفعالة', stats.active, ShieldCheck],
                ['تنتهي خلال 7 أيام', stats.expiring, CalendarClock],
                ['إيراد هذا الشهر', iqd(stats.monthRevenue), WalletCards],
              ].map(([label, value, Icon]: any) => (
                <div key={label} className="min-h-[116px] bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between overflow-hidden last:col-span-2 sm:last:col-span-1">
                  <div className="min-w-0"><p className="text-xs sm:text-sm leading-5 text-slate-500 font-black">{label}</p><p className="text-lg sm:text-2xl leading-tight font-black mt-3 break-words tabular-nums">{value}</p></div>
                  <div className="w-9 h-9 mt-3 rounded-xl bg-blue-50 flex items-center justify-center self-end shrink-0"><Icon className="w-5 h-5 text-blue-700" /></div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5">
              <div className="min-h-[108px] bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center"><p className="text-slate-500 font-bold">إجمالي المستحصل</p><p className="text-xl sm:text-3xl font-black mt-3 break-words tabular-nums">{iqd(stats.allRevenue)}</p></div>
              <div className="min-h-[108px] bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center"><p className="text-slate-500 font-bold">إيراد السنة</p><p className="text-xl sm:text-3xl font-black mt-3 break-words tabular-nums">{iqd(stats.yearRevenue)}</p></div>
              <div className="min-h-[108px] bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-center"><p className="text-slate-500 font-bold">إشعارات منشورة</p><p className="text-xl sm:text-3xl font-black mt-3 break-words tabular-nums">{notifications.length}</p></div>
            </div>
          </>}
          {/* SUPER_ADMIN_SUBSCRIPTION_STATUS_V2 */}
          {/* SUPER_ADMIN_SUBSCRIPTION_STATUS_V2 */}
          {/* SUPER_ADMIN_SUBSCRIPTION_STATUS_V2 */}
          {/* SUPER_ADMIN_SUBSCRIPTION_STATUS_V2 */}
          {/* SUPER_ADMIN_SUBSCRIPTION_STATUS_V2 */}
          {/* SUPER_ADMIN_SUBSCRIPTION_STATUS_V2 */}
          {/* SUPER_ADMIN_SUBSCRIPTION_STATUS_V2 */}
          {/* SUPER_ADMIN_SUBSCRIPTION_STATUS_V2 */}
          {tab === 'orders' && <CustomerOrdersPanel />}

          {tab === 'generators' && <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-w-0">
            <div className="px-4 sm:px-6 py-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div><h2 className="text-lg font-black flex items-center gap-2"><Users className="w-5 h-5" />أصحاب المولدات</h2><p className="text-xs text-slate-500 mt-1">الحالة تعتمد على وقت انتهاء الاشتراك الفعلي أو الإيقاف الإداري.</p></div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3"><span className="text-xs text-slate-500">{subscriptions.length} اشتراك مسجل</span><button onClick={() => { setExcelImportProgress(0); setExcelImportReport(EMPTY_EXCEL_REPORT); setExcelImportOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" />رفع Excel</button><button onClick={() => { setGeneratorFormError(null); setGeneratorOpen(true); }} className="bg-[#0B1F3B] hover:bg-[#142A45] text-white px-3 sm:px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2"><UserPlus className="w-4 h-4" />إضافة صاحب مولدة</button></div>
            </div>
            {loading ? <div className="p-10 text-center font-bold text-slate-500">جاري تحميل البيانات...</div> : generators.length === 0 ? <div className="p-14 text-center text-slate-500 font-bold">لا يوجد أصحاب مولدات بعد</div> : <>
              <div className="hidden lg:block overflow-x-auto">
                <>
                {/* super-admin-mobile-generator-cards-v5 */}
                <div className="md:hidden space-y-3 p-3 bg-slate-50">
                  {generators.map(g => {
                    const sub = latestSubscriptionFor(g.id);
                    const statusLabel = g.status === 'active' ? 'فعال' : g.status === 'suspended' ? 'موقوف' : 'منتهي';
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedGeneratorId(g.id)}
                        className="w-full text-right bg-white border border-slate-200 rounded-2xl p-4 shadow-sm active:scale-[0.99] transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-black text-[15px] text-slate-900 truncate max-w-[170px]">{g.name}</h3>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${g.status === 'active' ? 'bg-emerald-100 text-emerald-700' : g.status === 'suspended' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{statusLabel}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1 truncate">{g.owner_name}</p>
                          </div>
                          <span className="shrink-0 px-2.5 py-1.5 rounded-lg bg-[#0B1F3B] text-white text-[11px] font-black">تفاصيل</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                          <div className="rounded-xl bg-slate-50 p-2.5 min-w-0"><span className="text-[10px] text-slate-400">الهاتف</span><p className="font-bold text-slate-700 truncate mt-0.5" dir="ltr">{g.phone || '—'}</p></div>
                          <div className="rounded-xl bg-slate-50 p-2.5"><span className="text-[10px] text-slate-400">المشتركين</span><p className="font-black text-slate-800 mt-0.5">{subscriberCounts[g.id] || 0}</p></div>
                          <div className="rounded-xl bg-slate-50 p-2.5 min-w-0"><span className="text-[10px] text-slate-400">المنطقة</span><p className="font-bold text-slate-700 truncate mt-0.5">{g.area || '—'}</p></div>
                          <div className="rounded-xl bg-slate-50 p-2.5 min-w-0"><span className="text-[10px] text-slate-400">انتهاء الاشتراك</span><p className="font-bold text-slate-700 truncate mt-0.5">{sub ? new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'short' }).format(new Date(sub.ends_at)) : '—'}</p></div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[980px] text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4 text-right">اسم المولدة</th><th className="p-4 text-right">صاحب الحساب</th><th className="p-4 text-right">الهاتف</th><th className="p-4 text-right">رمز الحساب الحالي</th><th className="p-4 text-right">عدد المشتركين</th><th className="p-4 text-right">ينتهي الاشتراك</th><th className="p-4 text-right">الوقت المتبقي</th><th className="p-4 text-right">الحالة</th><th className="p-4 text-right">الإجراءات</th></tr></thead>
                  <tbody>{generators.map(g => { const sub = latestSubscriptionFor(g.id); const effectiveStatus = effectiveGeneratorStatus(g, sub); const remaining = subscriptionRemainingText(sub); return <tr key={g.id} className="border-t border-slate-100 hover:bg-slate-50/70"><td className="p-4 font-black">{g.name}</td><td className="p-4">{g.owner_name}</td><td className="p-4">{g.phone || '—'}</td><td className="p-4">{g.area || '—'}</td><td className="p-4 font-black">{subscriberCounts[g.id] || 0}</td><td className="p-4 font-bold whitespace-nowrap">{sub ? dateText(sub.ends_at) : '—'}</td><td className={`p-4 font-black whitespace-nowrap ${effectiveStatus === 'expired' ? 'text-rose-700' : effectiveStatus === 'suspended' ? 'text-amber-700' : 'text-blue-700'}`}>{remaining}</td><td className="p-4"><span className={`px-3 py-1.5 rounded-full font-black whitespace-nowrap ${effectiveStatus === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : effectiveStatus === 'suspended' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>{effectiveStatus === 'active' ? 'فعال' : effectiveStatus === 'suspended' ? 'اشتراك متوقف' : 'اشتراك منتهي'}</span></td><td className="p-4"><button onClick={() => setSelectedGeneratorId(g.id)} className="px-3 py-2 rounded-lg bg-slate-900 text-white font-black text-xs inline-flex items-center gap-2"><Eye className="w-4 h-4" />تفاصيل</button></td></tr>})}</tbody>
                </table>
                </div>
              </>
              </div>
              <div className="lg:hidden p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {generators.map(g => { const sub = latestSubscriptionFor(g.id); const effectiveStatus = effectiveGeneratorStatus(g, sub); const remaining = subscriptionRemainingText(sub); return <article key={g.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm min-w-0">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-black text-base truncate">{g.name}</h3><p className="text-xs text-slate-500 mt-1 truncate">{g.owner_name} • {g.phone || 'بدون هاتف'} • {subscriberCounts[g.id] || 0} مشترك</p></div><span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-black ${effectiveStatus === 'active' ? 'bg-emerald-50 text-emerald-700' : effectiveStatus === 'suspended' ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-700'}`}>{effectiveStatus === 'active' ? 'فعال' : effectiveStatus === 'suspended' ? 'اشتراك متوقف' : 'اشتراك منتهي'}</span></div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500 block mb-1">ينتهي</span><b className="block leading-5">{sub ? dateText(sub.ends_at) : '—'}</b></div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-500 block mb-1">المدة</span><b className={effectiveStatus === 'expired' ? 'text-rose-700' : effectiveStatus === 'suspended' ? 'text-amber-700' : 'text-blue-700'}>{remaining}</b></div></div>
                  <button onClick={() => setSelectedGeneratorId(g.id)} className="mt-3 w-full px-3 py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs inline-flex items-center justify-center gap-2"><Eye className="w-4 h-4" />عرض التفاصيل</button>
                </article>})}
              </div>
            </>}
          </section>}

          {tab === 'finance' && <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5 mb-5">
              <div className="bg-white border rounded-2xl p-4 sm:p-5 min-w-0"><p className="text-slate-500 font-bold">إيراد الشهر</p><p className="text-xl sm:text-3xl font-black mt-2 break-words tabular-nums">{iqd(stats.monthRevenue)}</p></div>
              <div className="bg-white border rounded-2xl p-4 sm:p-5 min-w-0"><p className="text-slate-500 font-bold">إيراد السنة</p><p className="text-xl sm:text-3xl font-black mt-2 break-words tabular-nums">{iqd(stats.yearRevenue)}</p></div>
              <div className="bg-white border rounded-2xl p-4 sm:p-5 min-w-0"><p className="text-slate-500 font-bold">الإجمالي</p><p className="text-xl sm:text-3xl font-black mt-2 break-words tabular-nums">{iqd(stats.allRevenue)}</p></div>
            </div>
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="min-w-0"><h2 className="text-lg font-black">الحسابات والواردات</h2><p className="text-xs text-slate-500 mt-1">كل مبلغ تستحصله من بيع أو تجديد الحسابات</p></div><button onClick={() => setFinanceOpen(v => !v)} className="w-full sm:w-auto justify-center bg-[#0B1F3B] text-white px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-2"><Plus className="w-4 h-4" />تسجيل مبلغ</button></div>
              {financeOpen && <form onSubmit={addTransaction} className="p-4 sm:p-5 bg-slate-50 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 border-b">
                <select value={financeForm.generator_id} onChange={e => setFinanceForm(f => ({...f, generator_id:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white"><option value="">بدون ربط بمولدة</option>{generators.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
                <input inputMode="numeric" placeholder="المبلغ بالدينار" value={financeForm.amount_iqd} onChange={e => setFinanceForm(f => ({...f, amount_iqd:e.target.value.replace(/\D/g,'')}))} className="border rounded-xl px-3 py-3" />
                <select value={financeForm.category} onChange={e => setFinanceForm(f => ({...f, category:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white"><option value="subscription">بيع اشتراك</option><option value="renewal">تجديد</option><option value="setup">تهيئة/تنصيب</option><option value="other">أخرى</option></select>
                <input placeholder="طريقة الدفع" value={financeForm.payment_method} onChange={e => setFinanceForm(f => ({...f, payment_method:e.target.value}))} className="border rounded-xl px-3 py-3" />
                <input placeholder="ملاحظات" value={financeForm.notes} onChange={e => setFinanceForm(f => ({...f, notes:e.target.value}))} className="border rounded-xl px-3 py-3" />
                <button className="bg-emerald-600 text-white rounded-xl font-black">حفظ المبلغ</button>
              </form>}
              <div className="moldatk-responsive-scroll overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4 text-right">التاريخ</th><th className="p-4 text-right">المولدة</th><th className="p-4 text-right">النوع</th><th className="p-4 text-right">طريقة الدفع</th><th className="p-4 text-right">المبلغ</th></tr></thead><tbody>{transactions.map(x => <tr key={x.id} className="border-t"><td className="p-4">{dateText(x.received_at)}</td><td className="p-4 font-bold">{generatorName(x.generator_id)}</td><td className="p-4">{x.category}</td><td className="p-4">{x.payment_method || '—'}</td><td className="p-4 font-black text-emerald-700">{x.direction === 'refund' ? '-' : ''}{iqd(x.amount_iqd)}</td></tr>)}</tbody></table></div>
              {transactions.length === 0 && <div className="p-10 text-center text-slate-500 font-bold">لا توجد حركات مالية بعد</div>}
            </section>
          </>}

          {tab === 'managers' && isOwnerSuperAdmin && <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div><h2 className="text-lg font-black flex items-center gap-2"><ShieldCheck className="w-5 h-5" />مدراء السوبر أدمن</h2><p className="text-xs text-slate-500 mt-1">إنشاء مدراء بصلاحيات محددة بدون صلاحية حذف أصحاب المولدات أو إنشاء مدراء آخرين.</p></div>
              <button onClick={() => setManagerOpen(true)} className="w-full sm:w-auto justify-center bg-[#0B1F3B] hover:bg-[#142A45] text-white px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-2"><UserPlus className="w-4 h-4" />إضافة مدير</button>
            </div>
            {managerOpen && <form onSubmit={createManagerAccount} className="p-4 sm:p-5 bg-slate-50 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-b">
              <input required placeholder="اسم المدير" value={managerForm.full_name} onChange={e=>setManagerForm(f=>({...f,full_name:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white" />
              <input required type="email" placeholder="إيميل المدير" value={managerForm.email} onChange={e=>setManagerForm(f=>({...f,email:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white" />
              <input required minLength={4} placeholder="رمز الدخول / 4 أرقام" value={managerForm.password} onChange={e=>setManagerForm(f=>({...f,password:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white" />
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-black">
                <label><input type="checkbox" checked={managerForm.can_activate} onChange={e=>setManagerForm(f=>({...f,can_activate:e.target.checked}))}/> تفعيل وتجديد</label>
                <label><input type="checkbox" checked={managerForm.can_edit} onChange={e=>setManagerForm(f=>({...f,can_edit:e.target.checked}))}/> تعديل معلومات</label>
                <label><input type="checkbox" checked={managerForm.can_create_generator} onChange={e=>setManagerForm(f=>({...f,can_create_generator:e.target.checked}))}/> إنشاء حساب صاحب مولدة</label>
              </div>
              <div className="sm:col-span-2 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3"><button type="button" onClick={()=>setManagerOpen(false)} className="px-4 py-2.5 rounded-xl border font-black bg-white">إلغاء</button><button disabled={savingManager} className="px-5 py-2.5 rounded-xl bg-[#0B1F3B] text-white font-black disabled:opacity-50">حفظ المدير</button></div>
            </form>}
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4 text-right">المدير</th><th className="p-4 text-right">الإيميل</th><th className="p-4 text-center">تفعيل</th><th className="p-4 text-center">تعديل</th><th className="p-4 text-center">إنشاء حساب</th><th className="p-4 text-center">الحالة</th></tr></thead><tbody>{managers.map(m => <tr key={m.id} className="border-t"><td className="p-4 font-black">{m.full_name}{m.is_owner ? ' — المدير الرئيسي' : ''}</td><td className="p-4">{m.email}</td>{(['can_activate','can_edit','can_create_generator'] as const).map(k => <td key={k} className="p-4 text-center"><input type="checkbox" disabled={m.is_owner || savingManager} checked={Boolean(m[k])} onChange={e=>void updateManagerPermissions(m,{[k]:e.target.checked} as any)} /></td>)}<td className="p-4 text-center"><button disabled={m.is_owner || savingManager} onClick={()=>void updateManagerPermissions(m,{is_active:!m.is_active})} className={`px-3 py-1.5 rounded-lg text-xs font-black ${m.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{m.is_active ? 'فعال' : 'موقوف'}</button></td></tr>)}</tbody></table></div>
          </section>}

          {/* SUPER_ADMIN_RESPONSIVE_NOTIFICATION_CENTER_V2 */}
          {/* SUPER_ADMIN_RESPONSIVE_NOTIFICATION_CENTER_V2 */}
          {/* SUPER_ADMIN_RESPONSIVE_NOTIFICATION_CENTER_V2 */}
          {tab === 'notifications' && isOwnerSuperAdmin && <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            <div data-layout="SUPER_ADMIN_NOTIFICATIONS_LAYOUT_V2"><AdminAdSlidesPanel /></div>
            <SeasonalCampaignsPanel />
            <form onSubmit={sendNotification} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 h-fit text-slate-900">
              <h2 className="text-lg font-black flex items-center gap-2 text-slate-900"><Megaphone className="w-5 h-5" />اشعارات التطبيق</h2>
              <p className="text-xs text-slate-500 mt-1 mb-5">أرسل إشعار منبثق لأصحاب المولدات</p>
              <label className="text-xs font-black text-slate-700">نوع الإشعار</label>
              <select value={notificationForm.category} onChange={e => setNotificationForm(f => ({...f, category:e.target.value}))} className="w-full border border-slate-300 rounded-xl px-3 py-3 mt-1 mb-3 bg-white text-slate-900"><option value="maintenance">صيانة</option><option value="offer">عرض</option><option value="update">تحديث</option><option value="general">عام</option></select>
              <label className="text-xs font-black text-slate-700">المستلمين</label>
              <select value={notificationForm.target_type} onChange={e => setNotificationForm(f => ({...f, target_type:e.target.value, generator_id:''}))} className="w-full border border-slate-300 rounded-xl px-3 py-3 mt-1 mb-3 bg-white text-slate-900"><option value="all_generators">كل أصحاب المولدات</option><option value="single_generator">مولدة محددة</option></select>
              {notificationForm.target_type === 'single_generator' && <select value={notificationForm.generator_id} onChange={e => setNotificationForm(f => ({...f, generator_id:e.target.value}))} className="w-full border border-slate-300 rounded-xl px-3 py-3 mb-3 bg-white text-slate-900"><option value="">اختر المولدة</option>{generators.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>}
              <input placeholder="عنوان الإشعار" value={notificationForm.title} onChange={e => setNotificationForm(f => ({...f, title:e.target.value}))} className="w-full border border-slate-300 rounded-xl px-3 py-3 mb-3 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <textarea rows={5} placeholder="نص الإشعار" value={notificationForm.body} onChange={e => setNotificationForm(f => ({...f, body:e.target.value}))} className="w-full border border-slate-300 rounded-xl px-3 py-3 mb-3 bg-white text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button className="w-full bg-[#0B1F3B] hover:bg-[#142A45] text-white rounded-xl py-3 font-black flex items-center justify-center gap-2"><Bell className="w-4 h-4" />إرسال اشعار منبثق</button>
            </form>

            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden text-slate-900">
              <div className="p-5 border-b"><h2 className="text-lg font-black">سجل اشعارات التطبيق</h2><p className="text-xs text-slate-500 mt-1">الإشعارات المنشورة من الإدارة</p></div>
              <div className="divide-y">{notifications.map(n => <div key={n.id} className="p-5 flex gap-4"><div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">{n.category === 'maintenance' ? <Wrench className="w-5 h-5" /> : <Bell className="w-5 h-5" />}</div><div className="flex-1"><div className="flex items-center justify-between"><h3 className="font-black text-slate-900">{n.title}</h3><span className="text-xs text-slate-400">{dateText(n.created_at)}</span></div><p className="text-sm text-slate-600 mt-1 leading-6">{n.body}</p><p className="text-xs text-slate-400 mt-2">إلى: {n.target_type === 'all_generators' ? 'كل أصحاب المولدات' : generatorName(n.generator_id)}</p></div></div>)}</div>
              {notifications.length === 0 && <div className="p-10 text-center text-slate-500 font-bold">لا توجد إشعارات بعد</div>}
            </section>
          </div>}
        </main>
      </div>

      {selectedGenerator && <div className="moldatk-modal-viewport fixed inset-0 z-[115] bg-black/50 flex items-center justify-center p-2 sm:p-4 lg:p-6">
        <div className="moldatk-modal-surface w-full max-w-5xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[94vh] overflow-y-auto">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b flex items-center justify-between gap-3 sticky top-0 bg-white z-10"><div className="min-w-0"><h2 className="text-lg sm:text-xl font-black break-words">{selectedGenerator.name}</h2><p className="text-xs text-slate-500 mt-1">تفاصيل الحساب والاشتراك</p></div><button onClick={() => { setSelectedGeneratorId(null); setRenewalOpen(false); setCredentialsOpen(false); setEditSubscriptionOpen(false); }} className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button></div>
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-slate-50 rounded-2xl p-4"><p className="text-xs text-slate-500 font-bold">صاحب المولدة</p><p className="font-black mt-1">{selectedGenerator.owner_name}</p></div>
            <div className="bg-slate-50 rounded-2xl p-4"><p className="text-xs text-slate-500 font-bold">رقم الهاتف</p><p className="font-black mt-1">{selectedGenerator.phone || '—'}</p></div>
            <div className="bg-slate-50 rounded-2xl p-4"><p className="text-xs text-slate-500 font-bold">رمز الحساب الحالي</p><p className="font-black mt-1">{selectedGenerator.area || '—'}</p></div>
            <div className="bg-cyan-50 rounded-2xl p-4"><p className="text-xs text-cyan-700 font-bold">عدد المشتركين</p><p className="font-black mt-1 text-xl">{subscriberCounts[selectedGenerator.id] || 0}</p></div>
            <div className="bg-violet-50 rounded-2xl p-4"><p className="text-xs text-violet-600 font-bold">اسم المستخدم / الإيميل</p><p className="font-black mt-1 break-all">{selectedGenerator.email || '—'}</p>{canEditGeneratorAccount && <button onClick={openCredentials} className="mt-2 text-xs font-black text-violet-700 inline-flex items-center gap-1"><Pencil className="w-3.5 h-3.5"/>تعديل</button>}</div>
            <div className="bg-violet-50 rounded-2xl p-4"><p className="text-xs text-violet-600 font-bold">كلمة المرور</p><p className="font-black mt-1 tracking-widest">••••••••</p>{canEditGeneratorAccount && <button onClick={openCredentials} className="mt-2 text-xs font-black text-violet-700 inline-flex items-center gap-1"><KeyRound className="w-3.5 h-3.5"/>تغيير كلمة المرور</button>}</div>
            <div className={`rounded-2xl p-4 ${selectedEffectiveStatus === 'active' ? 'bg-emerald-50' : selectedEffectiveStatus === 'suspended' ? 'bg-amber-50' : 'bg-rose-50'}`}><p className={`text-xs font-bold ${selectedEffectiveStatus === 'active' ? 'text-emerald-700' : selectedEffectiveStatus === 'suspended' ? 'text-amber-700' : 'text-rose-700'}`}>حالة الاشتراك</p><p className="font-black mt-1">{selectedEffectiveStatus === 'active' ? 'فعال' : selectedEffectiveStatus === 'suspended' ? 'اشتراك متوقف' : 'اشتراك منتهي'}</p><p className="text-xs mt-1 text-slate-600 font-bold">{selectedSubscriptionRemaining}</p></div>
            <div className="bg-blue-50 rounded-2xl p-4"><p className="text-xs text-blue-600 font-bold">بداية الاشتراك الحالي</p><p className="font-black mt-1">{selectedSubscription ? dateText(selectedSubscription.starts_at) : '—'}</p></div>
            <div className="bg-blue-50 rounded-2xl p-4"><p className="text-xs text-blue-600 font-bold">نهاية الاشتراك الحالي</p><p className="font-black mt-1">{selectedSubscription ? dateText(selectedSubscription.ends_at) : '—'}</p></div>
            <div className="bg-blue-50 rounded-2xl p-4"><p className="text-xs text-blue-600 font-bold">آخر مبلغ اشتراك</p><p className="font-black mt-1">{selectedSubscription ? iqd(selectedSubscription.price_iqd || 0) : '—'}</p></div>
          </div>

          {credentialsOpen && <form onSubmit={saveCredentials} className="mx-4 sm:mx-6 mb-4 sm:mb-6 bg-violet-50/60 border border-violet-100 rounded-2xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="sm:col-span-2"><h3 className="font-black text-lg">تعديل بيانات الدخول</h3><p className="text-xs text-slate-500 mt-1">لأسباب أمنية لا يمكن عرض كلمة المرور الحالية؛ يمكنك استبدالها بكلمة جديدة.</p></div>
            <input required type="email" placeholder="إيميل تسجيل الدخول" value={credentialForm.email} onChange={e=>setCredentialForm(f=>({...f,email:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white" />
            <input type="text" minLength={6} placeholder="كلمة مرور جديدة (اختياري)" value={credentialForm.password} onChange={e=>setCredentialForm(f=>({...f,password:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white" />
            <div className="sm:col-span-2 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3"><button type="button" onClick={()=>setCredentialsOpen(false)} className="px-4 py-2.5 rounded-xl border font-black bg-white">إلغاء</button><button disabled={savingAccount} className="px-5 py-2.5 rounded-xl bg-violet-700 text-white font-black disabled:opacity-50 inline-flex items-center gap-2"><Save className="w-4 h-4"/>حفظ بيانات الدخول</button></div>
          </form>}

          {renewalOpen && <form onSubmit={renewSubscription} className="mx-4 sm:mx-6 mb-4 sm:mb-6 bg-slate-50 border rounded-2xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="sm:col-span-2"><h3 className="font-black text-lg">تجديد الاشتراك</h3><p className="text-xs text-slate-500 mt-1">إذا الاشتراك فعال، التجديد يبدأ من تاريخ انتهائه الحالي. اشتراك الفحص يقبل أيام/ساعات/دقائق.</p></div>
            <select required value={renewalForm.plan_id} onChange={e => { const id=e.target.value; const p=plans.find(x=>x.id===id); setRenewalForm(f=>({...f, plan_id:id, price_iqd:p?.price_iqd ? String(p.price_iqd) : f.price_iqd})) }} className="border rounded-xl px-3 py-3 bg-white"><option value="">اختر نوع الاشتراك</option>{plans.map(p => <option key={p.id} value={p.id}>{planLabel(p)}</option>)}</select>
            <input inputMode="numeric" placeholder="المبلغ المستحصل بالدينار" value={renewalForm.price_iqd} onChange={e=>setRenewalForm(f=>({...f,price_iqd:e.target.value.replace(/\D/g,'')}))} className="border rounded-xl px-3 py-3" />
            {plans.find(p=>p.id===renewalForm.plan_id)?.is_custom_duration && <div className="sm:col-span-2 grid grid-cols-1 min-[360px]:grid-cols-3 gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4"><label className="text-xs font-bold">الأيام<input inputMode="numeric" value={renewalForm.test_days} onChange={e=>setRenewalForm(f=>({...f,test_days:e.target.value.replace(/\D/g,'')}))} className="mt-1 w-full border rounded-xl px-3 py-2 bg-white"/></label><label className="text-xs font-bold">الساعات<input inputMode="numeric" value={renewalForm.test_hours} onChange={e=>setRenewalForm(f=>({...f,test_hours:e.target.value.replace(/\D/g,'')}))} className="mt-1 w-full border rounded-xl px-3 py-2 bg-white"/></label><label className="text-xs font-bold">الدقائق<input inputMode="numeric" value={renewalForm.test_minutes} onChange={e=>setRenewalForm(f=>({...f,test_minutes:e.target.value.replace(/\D/g,'')}))} className="mt-1 w-full border rounded-xl px-3 py-2 bg-white"/></label></div>}
            <input placeholder="طريقة الدفع" value={renewalForm.payment_method} onChange={e=>setRenewalForm(f=>({...f,payment_method:e.target.value}))} className="border rounded-xl px-3 py-3" />
            <input placeholder="ملاحظات اختيارية" value={renewalForm.notes} onChange={e=>setRenewalForm(f=>({...f,notes:e.target.value}))} className="border rounded-xl px-3 py-3" />
            <div className="sm:col-span-2 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3"><button type="button" onClick={() => setRenewalOpen(false)} className="px-4 py-2.5 rounded-xl border font-black">إلغاء</button><button disabled={renewing} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-black disabled:opacity-50">{renewing ? 'جاري التجديد...' : 'تأكيد التجديد'}</button></div>
          </form>}

          {editSubscriptionOpen && selectedSubscription && <form onSubmit={saveSubscriptionEdit} className="mx-4 sm:mx-6 mb-4 sm:mb-6 bg-blue-50/50 border border-blue-100 rounded-2xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="sm:col-span-2"><h3 className="font-black text-lg">تعديل الاشتراك الحالي</h3><p className="text-xs text-slate-500 mt-1">يمكنك تغيير نوع الاشتراك أو تاريخ البداية والنهاية في أي وقت.</p></div>
            <select value={editSubscriptionForm.plan_id} onChange={e=>setEditSubscriptionForm(f=>({...f,plan_id:e.target.value}))} className="border rounded-xl px-3 py-3 bg-white"><option value="">بدون باقة</option>{plans.map(p=><option key={p.id} value={p.id}>{planLabel(p)}</option>)}</select>
            <input inputMode="numeric" placeholder="مبلغ الاشتراك" value={editSubscriptionForm.price_iqd} onChange={e=>setEditSubscriptionForm(f=>({...f,price_iqd:e.target.value.replace(/\D/g,'')}))} className="border rounded-xl px-3 py-3 bg-white" />
            <label className="text-xs font-black text-slate-600">تاريخ ووقت البداية<input type="datetime-local" value={editSubscriptionForm.starts_at} onChange={e=>setEditSubscriptionForm(f=>({...f,starts_at:e.target.value}))} className="mt-1 w-full border rounded-xl px-3 py-3 bg-white"/></label>
            <label className="text-xs font-black text-slate-600">تاريخ ووقت النهاية<input type="datetime-local" value={editSubscriptionForm.ends_at} onChange={e=>setEditSubscriptionForm(f=>({...f,ends_at:e.target.value}))} className="mt-1 w-full border rounded-xl px-3 py-3 bg-white"/></label>
            <input className="sm:col-span-2 border rounded-xl px-3 py-3 bg-white" placeholder="ملاحظات التعديل (اختياري)" value={editSubscriptionForm.notes} onChange={e=>setEditSubscriptionForm(f=>({...f,notes:e.target.value}))}/>
            <div className="sm:col-span-2 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3"><button type="button" onClick={()=>setEditSubscriptionOpen(false)} className="px-4 py-2.5 rounded-xl border font-black bg-white">إلغاء</button><button disabled={savingAccount} className="px-5 py-2.5 rounded-xl bg-[#0B1F3B] text-white font-black disabled:opacity-50 inline-flex items-center gap-2"><Save className="w-4 h-4"/>حفظ تعديل الاشتراك</button></div>
          </form>}

          <div className="px-4 sm:px-6 py-4 border-t bg-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap w-full lg:w-auto">
              <button disabled={savingAccount} onClick={() => void setGeneratorStatus(selectedGenerator.status === 'suspended' ? 'active' : 'suspended')} className={`px-4 py-2.5 rounded-xl font-black inline-flex items-center gap-2 ${selectedGenerator.status === 'suspended' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}><PauseCircle className="w-4 h-4" />{selectedGenerator.status === 'suspended' ? 'رفع التقييد' : 'إيقاف مؤقت للحساب'}</button>
              <button disabled={savingAccount} onClick={() => void deleteGeneratorAccount()} className="px-4 py-2.5 rounded-xl font-black inline-flex items-center gap-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-50"><Trash2 className="w-4 h-4" />حذف الحساب</button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full lg:w-auto"><button onClick={openEditSubscription} className="px-4 py-2.5 rounded-xl bg-white border border-blue-200 text-blue-700 font-black inline-flex items-center gap-2"><Pencil className="w-4 h-4"/>تعديل الاشتراك</button><button onClick={() => setRenewalOpen(true)} className="px-5 py-2.5 rounded-xl bg-[#0B1F3B] text-white font-black inline-flex items-center gap-2"><CreditCard className="w-4 h-4" />تجديد الاشتراك</button></div>
          </div>
        </div>
      </div>}

      {excelImportOpen && <div className="moldatk-modal-viewport fixed inset-0 z-[118] bg-black/50 flex items-center justify-center p-2 sm:p-4 lg:p-6">
        <form onSubmit={importSubscribersFromExcel} className="moldatk-modal-surface w-full max-w-3xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] overflow-y-auto">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b flex items-start sm:items-center justify-between gap-3 bg-white">
            <div>
              <h2 className="text-xl font-black flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-emerald-600" />رفع بيانات المشتركين من Excel</h2>
              <p className="text-xs text-slate-500 mt-1">اختر ملف Excel ثم حساب صاحب المولدة حتى تُضاف البيانات داخل حسابه فقط.</p>
            </div>
            <button type="button" onClick={() => setExcelImportOpen(false)} className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-4 sm:p-6 grid grid-cols-1 gap-4">
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
          <div className="px-4 sm:px-6 py-4 border-t bg-slate-50 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
            <button type="button" onClick={() => setExcelImportOpen(false)} className="px-5 py-2.5 rounded-xl border font-black bg-white">{excelImportReport.status === 'success' ? 'إغلاق' : 'إلغاء'}</button>
            <button disabled={excelImporting} className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black disabled:opacity-50 inline-flex items-center gap-2">
              <UploadCloud className="w-4 h-4" />{excelImporting ? 'جاري الرفع...' : 'رفع البيانات'}
            </button>
          </div>
        </form>
      </div>}


      {generatorOpen && <div className="moldatk-modal-viewport fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-2 sm:p-4 lg:p-6">
        <form onSubmit={createGeneratorAccount} className="moldatk-modal-surface w-full max-w-3xl bg-white text-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[94vh] overflow-y-auto" style={{ colorScheme: 'light' }}>
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b flex items-center justify-between gap-3 sticky top-0 bg-white z-10"><div className="min-w-0"><h2 className="text-lg sm:text-xl font-black">إضافة صاحب مولدة</h2><p className="text-xs text-slate-500 mt-1">إنشاء المولدة، حساب الدخول والاشتراك دفعة واحدة</p></div><button type="button" onClick={() => { setGeneratorFormError(null); setGeneratorOpen(false); }} className="p-2 rounded-xl hover:bg-slate-100"><X className="w-5 h-5" /></button></div>
          {generatorFormError && <div role="alert" className="mx-6 mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{generatorFormError}</div>}
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <input required placeholder="اسم المولدة" value={generatorForm.name} onChange={e=>setGeneratorForm(f=>({...f,name:e.target.value}))} className="border border-slate-300 rounded-xl px-3 py-3 bg-white text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
            <input required placeholder="اسم صاحب المولدة" value={generatorForm.owner_name} onChange={e=>setGeneratorForm(f=>({...f,owner_name:e.target.value}))} className="border border-slate-300 rounded-xl px-3 py-3 bg-white text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
            <input placeholder="رقم الهاتف" value={generatorForm.phone} onChange={e=>setGeneratorForm(f=>({...f,phone:e.target.value}))} className="border border-slate-300 rounded-xl px-3 py-3 bg-white text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
            <input placeholder="رمز الحساب الحالي" value={generatorForm.area} onChange={e=>setGeneratorForm(f=>({...f,area:e.target.value}))} className="border border-slate-300 rounded-xl px-3 py-3 bg-white text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
            <input required type="email" placeholder="إيميل تسجيل الدخول" value={generatorForm.email} onChange={e=>setGeneratorForm(f=>({...f,email:e.target.value}))} className="border border-slate-300 rounded-xl px-3 py-3 bg-white text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
            <input required type="text" minLength={6} placeholder="كلمة المرور الأولية" value={generatorForm.password} onChange={e=>setGeneratorForm(f=>({...f,password:e.target.value}))} className="border border-slate-300 rounded-xl px-3 py-3 bg-white text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
            <select required value={generatorForm.plan_id} onChange={e=>{const id=e.target.value; const plan=plans.find(p=>p.id===id); setGeneratorForm(f=>({...f,plan_id:id,price_iqd:plan?.price_iqd ? String(plan.price_iqd) : f.price_iqd}))}} className="border border-slate-300 rounded-xl px-3 py-3 bg-white text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"><option value="">اختر نوع الاشتراك</option>{plans.map(p=><option key={p.id} value={p.id}>{planLabel(p)}</option>)}</select>
            <label className="text-xs font-black text-slate-600">تاريخ ووقت التفعيل<input type="datetime-local" value={generatorForm.starts_at} onChange={e=>setGeneratorForm(f=>({...f,starts_at:e.target.value}))} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-3 bg-white text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" /></label>
            {plans.find(p=>p.id===generatorForm.plan_id)?.is_custom_duration && <div className="sm:col-span-2 grid grid-cols-1 min-[360px]:grid-cols-3 gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4"><div className="min-[360px]:col-span-3 text-xs font-black text-amber-800 flex items-center gap-2"><Clock3 className="w-4 h-4"/>مدة اشتراك الفحص — حددها بدقة</div><label className="text-xs font-bold">الأيام<input inputMode="numeric" value={generatorForm.test_days} onChange={e=>setGeneratorForm(f=>({...f,test_days:e.target.value.replace(/\D/g,'')}))} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"/></label><label className="text-xs font-bold">الساعات<input inputMode="numeric" value={generatorForm.test_hours} onChange={e=>setGeneratorForm(f=>({...f,test_hours:e.target.value.replace(/\D/g,'')}))} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"/></label><label className="text-xs font-bold">الدقائق<input inputMode="numeric" value={generatorForm.test_minutes} onChange={e=>setGeneratorForm(f=>({...f,test_minutes:e.target.value.replace(/\D/g,'')}))} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"/></label></div>}
            <input inputMode="numeric" placeholder="المبلغ المستحصل بالدينار" value={generatorForm.price_iqd} onChange={e=>setGeneratorForm(f=>({...f,price_iqd:e.target.value.replace(/\D/g,'')}))} className="border border-slate-300 rounded-xl px-3 py-3 bg-white text-slate-900 placeholder:text-slate-400 caret-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
            <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs font-bold text-blue-800 flex items-center">الاشتراكات: فحص مخصص، أسبوعي 7 أيام، شهر، 3 شهور، 6 شهور، سنوي.</div>
          </div>
          <div className="px-4 sm:px-6 py-4 border-t bg-slate-50 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3"><button type="button" onClick={()=>setGeneratorOpen(false)} className="px-5 py-2.5 rounded-xl border font-black">إلغاء</button><button type="submit" disabled={creatingGenerator} className="px-6 py-2.5 rounded-xl bg-[#0B1F3B] text-white font-black disabled:opacity-50 disabled:cursor-not-allowed">{creatingGenerator ? 'جاري الإنشاء...' : 'إنشاء الحساب'}</button></div>
        </form>
      </div>}
    </div>
  );
};
