import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { Capacitor } from '@capacitor/core';
import type { ActiveUserSession, Subscriber, SubscriberInvoice, LineDistribution, MonthlyTariffRecord, GeneratorSpecs, InvoiceTemplateSettings, AuditLogEntry } from '../types';

const key = (base: string, generatorId: string) => `${base}_${generatorId}`;
const recentWriteKey = (generatorId: string) => key('moldatk_last_local_write', generatorId);

function readLocal<T>(storageKey: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(storageKey: string, value: unknown) {
  try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch {}
}

// LIVE_FINANCE_FREE_NORMALIZER_V1
const isPermanentFreeSubscriber = (s: Subscriber) => s.tier === 'free' || s.isExempted === true || s.paymentStatus === 'free';
const normalizeInvoiceForSubscriber = (s: Subscriber, inv: SubscriberInvoice): SubscriberInvoice =>
  isPermanentFreeSubscriber(s) && inv.status !== 'cancelled'
    ? { ...inv, tier: 'free', pricePerAmpere: 0, fixedFee: 0, totalAmount: 0, paidAmount: 0, remainingAmount: 0, status: 'free' }
    : inv;

function emitSyncProgress(detail: { active?: boolean; progress?: number; message?: string; pending?: boolean }) {
  try { window.dispatchEvent(new CustomEvent('moldatk-sync-progress', { detail })); } catch {}
}

const subscriberToRow = (generatorId: string, s: Subscriber) => ({
  id: s.id,
  generator_id: generatorId,
  code: s.code || s.subscriberCode || s.id,
  full_name: s.fullName || '',
  phone: s.phone || '',
  tier: s.tier,
  amperes: Number(s.amperes || 0),
  // AMPERE_DISCOUNT_CLOUD_SYNC_V1
  ampere_discount: Number(s.ampereDiscount || 0),
  ampere_discount_reason: s.ampereDiscountReason || null,
  line_id: s.lineId || null,
  line_name: s.lineName || s.line || null,
  address: s.address || null,
  box_number: s.boxNumber || null,
  payment_status: s.paymentStatus,
  last_payment_date: s.lastPaymentDate || null,
  amount_due: (s.invoicesHistory || []).filter(i => i.status !== 'cancelled').reduce((sum, i) => sum + Math.max(0, Number(i.remainingAmount || 0)), 0),
  amount_paid: Number(s.amountPaid || 0),
  notes: s.notes || null,
  is_exempted: Boolean(s.isExempted),
  exempt_reason: s.exemptReason || null,
  joining_date: s.joiningDate || null,
  updated_at: new Date().toISOString(),
});

const rowToSubscriber = (r: any): Subscriber => ({
  id: r.id,
  code: r.code,
  subscriberCode: r.code,
  fullName: r.full_name,
  phone: r.phone || '',
  tier: r.tier,
  amperes: Number(r.amperes || 0),
  ampereDiscount: Math.max(0, Number(r.ampere_discount || 0)),
  ampereDiscountReason: r.ampere_discount_reason || undefined,
  lineId: r.line_id || undefined,
  lineName: r.line_name || undefined,
  line: r.line_name || undefined,
  address: r.address || undefined,
  boxNumber: r.box_number || undefined,
  paymentStatus: r.payment_status,
  lastPaymentDate: r.last_payment_date || undefined,
  amountDue: Number(r.amount_due || 0),
  amountPaid: Number(r.amount_paid || 0),
  notes: r.notes || undefined,
  isExempted: Boolean(r.is_exempted),
  exemptReason: r.exempt_reason || undefined,
  joiningDate: r.joining_date || undefined,
  createdAt: r.created_at || undefined,
});

const invoiceToRow = (generatorId: string, i: SubscriberInvoice) => ({
  id: i.id,
  generator_id: generatorId,
  subscriber_id: i.subscriberId,
  month_id: i.monthId,
  month_name_ar: i.monthNameAr,
  issue_date: i.issueDate,
  payment_date: i.paymentDate || null,
  amperes: Number(i.amperes || 0),
  original_amperes: i.originalAmperes == null ? null : Number(i.originalAmperes),
  discounted_amperes: i.discountedAmperes == null ? null : Number(i.discountedAmperes),
  billed_amperes: i.billedAmperes == null ? null : Number(i.billedAmperes),
  gross_amount_before_discount: i.grossAmountBeforeDiscount == null ? null : Number(i.grossAmountBeforeDiscount),
  discount_amount: i.discountAmount == null ? null : Number(i.discountAmount),
  tier: i.tier,
  price_per_ampere: Number(i.pricePerAmpere || 0),
  fixed_fee: Number(i.fixedFee || 0),
  total_amount: Number(i.totalAmount || 0),
  paid_amount: Number(i.paidAmount || 0),
  remaining_amount: Number(i.remainingAmount || 0),
  status: i.status,
  cancellation_reason: i.cancellationReason || null,
  cancelled_at: i.cancelledAt || null,
  cancelled_by: i.cancelledBy || null,
  collector_name: i.collectorName || null,
  notes: i.notes || null,
  receipt_number: i.receiptNumber || null,
  updated_at: new Date().toISOString(),
});

const rowToInvoice = (r: any): SubscriberInvoice => ({
  id: r.id,
  subscriberId: r.subscriber_id,
  monthId: r.month_id,
  monthNameAr: r.month_name_ar,
  issueDate: r.issue_date,
  paymentDate: r.payment_date || undefined,
  amperes: Number(r.amperes || 0),
  originalAmperes: r.original_amperes == null ? undefined : Number(r.original_amperes),
  discountedAmperes: r.discounted_amperes == null ? undefined : Number(r.discounted_amperes),
  billedAmperes: r.billed_amperes == null ? undefined : Number(r.billed_amperes),
  grossAmountBeforeDiscount: r.gross_amount_before_discount == null ? undefined : Number(r.gross_amount_before_discount),
  discountAmount: r.discount_amount == null ? undefined : Number(r.discount_amount),
  tier: r.tier,
  pricePerAmpere: Number(r.price_per_ampere || 0),
  fixedFee: Number(r.fixed_fee || 0),
  totalAmount: Number(r.total_amount || 0),
  paidAmount: Number(r.paid_amount || 0),
  remainingAmount: Number(r.remaining_amount || 0),
  status: r.status,
  cancellationReason: r.cancellation_reason || undefined,
  cancelledAt: r.cancelled_at || undefined,
  cancelledBy: r.cancelled_by || undefined,
  collectorName: r.collector_name || undefined,
  notes: r.notes || undefined,
  receiptNumber: r.receipt_number || undefined,
});

const lineToRow = (generatorId: string, l: LineDistribution, sortOrder = 0) => ({
  id: l.id,
  generator_id: generatorId,
  name: l.name,
  zone: l.zone || '',
  phase_type: l.phaseType || null,
  phase_name_ar: l.phaseNameAr || null,
  max_capacity_amperes: Number(l.maxCapacityAmperes || 0),
  current_load_amperes: Number(l.currentLoadAmperes || 0),
  subscribers_count: Number(l.subscribersCount || 0),
  technician_name: l.technicianName || '',
  breaker_number: l.breakerNumber || null,
  sort_order: sortOrder,
  updated_at: new Date().toISOString(),
});

const rowToLine = (r: any): LineDistribution => ({
  id: r.id,
  name: r.name,
  zone: r.zone || '',
  phaseType: r.phase_type || undefined,
  phaseNameAr: r.phase_name_ar || undefined,
  maxCapacityAmperes: Number(r.max_capacity_amperes || 0),
  currentLoadAmperes: Number(r.current_load_amperes || 0),
  subscribersCount: Number(r.subscribers_count || 0),
  technicianName: r.technician_name || '',
  breakerNumber: r.breaker_number || undefined,
});

const tariffToRow = (generatorId: string, t: MonthlyTariffRecord) => ({
  generator_id: generatorId,
  id: t.id,
  month: t.month,
  year: t.year,
  month_name_ar: t.monthNameAr,
  tiers: t.tiers,
  fuel_price_per_liter: t.fuelPricePerLiter ?? null,
  operating_hours_total: t.operatingHoursTotal ?? null,
  is_current_active: Boolean(t.isCurrentActive),
  created_at: t.createdAt || new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const rowToTariff = (r: any): MonthlyTariffRecord => ({
  id: r.id,
  month: Number(r.month),
  year: Number(r.year),
  monthNameAr: r.month_name_ar,
  tiers: r.tiers || [],
  fuelPricePerLiter: r.fuel_price_per_liter == null ? undefined : Number(r.fuel_price_per_liter),
  operatingHoursTotal: r.operating_hours_total == null ? undefined : Number(r.operating_hours_total),
  createdAt: r.created_at,
  isCurrentActive: Boolean(r.is_current_active),
});

function dedupeInvoicesForCloud(invoices: SubscriberInvoice[]): SubscriberInvoice[] {
  const cancelled: SubscriberInvoice[] = [];
  const liveByPeriod = new Map<string, SubscriberInvoice>();
  const statusRank: Record<string, number> = { paid: 4, partial: 3, unpaid: 2, free: 1 };

  for (const invoice of invoices) {
    if (invoice.status === 'cancelled') {
      cancelled.push(invoice);
      continue;
    }
    const key = `${invoice.subscriberId}|${invoice.monthId}`;
    const current = liveByPeriod.get(key);
    if (!current) {
      liveByPeriod.set(key, invoice);
      continue;
    }
    const invoiceScore = (statusRank[invoice.status] || 0) * 1_000_000_000 + Number(invoice.paidAmount || 0);
    const currentScore = (statusRank[current.status] || 0) * 1_000_000_000 + Number(current.paidAmount || 0);
    if (invoiceScore > currentScore || (invoiceScore === currentScore && String(invoice.id) > String(current.id))) {
      liveByPeriod.set(key, invoice);
    }
  }
  return [...cancelled, ...liveByPeriod.values()];
}

async function replaceMissingRows(table: string, generatorId: string, ids: string[]) {
  let q = supabase.from(table).delete().eq('generator_id', generatorId);
  if (ids.length) q = q.not('id', 'in', `(${ids.map(x => `"${String(x).replace(/"/g, '')}"`).join(',')})`);
  const { error } = await q;
  if (error) throw error;
}

export function useGeneratorCloudSync(session: ActiveUserSession | null) {
  const ready = useRef(false);
  const pushing = useRef(false);
  const pendingPush = useRef(false);
  const refreshing = useRef(false);
  const lastSnapshot = useRef('');
  const retryAfter = useRef(0);
  const authBlocked = useRef(false);

  useEffect(() => {
    const generatorId = session?.generatorId || '';
    const isGeneratorUser = session?.role === 'generator_admin' || session?.role === 'collector';
    if (!generatorId || !isGeneratorUser) return;

    let disposed = false;
    authBlocked.current = false;
    ready.current = false;

    const localKeys = {
      subscribers: key('moldatk_subscribers', generatorId),
      lines: key('moldatk_lines', generatorId),
      deletedLines: key('moldatk_deleted_line_ids', generatorId),
      tariffs: key('moldatk_monthly_tariffs', generatorId),
      specs: key('moldatk_generator', generatorId),
      invoice: key('moldatk_invoice_template', generatorId),
      invoiceCustom: key('moldatk_invoice_custom_settings', generatorId),
      audit: key('moldatk_audit_logs', generatorId),
      walletReset: key('moldatk_wallet_reset_timestamp', generatorId),
      deletedSubscribers: key('moldatk_deleted_subscribers', generatorId),
      deletedTariffs: key('moldatk_deleted_tariffs', generatorId),
    };
    const pendingSyncKey = key('moldatk_pending_sync', generatorId);
    const hasPendingLocalChanges = () => localStorage.getItem(pendingSyncKey) === '1';
    const markPendingLocalChanges = () => { try { localStorage.setItem(pendingSyncKey, '1'); } catch {} };
    const clearPendingLocalChanges = () => { try { localStorage.removeItem(pendingSyncKey); } catch {} };

    const signalExpiredAuth = () => {
      if (authBlocked.current || disposed) return;
      authBlocked.current = true;
      ready.current = false;
      try {
        window.dispatchEvent(new CustomEvent('moldatk-auth-expired'));
        window.dispatchEvent(new CustomEvent('moldatk-sync-progress', {
          detail: { active: false, progress: 0, pending: false, message: 'انتهت جلسة الدخول — يرجى تسجيل الدخول مرة أخرى' }
        }));
      } catch {}
    };

    const ensureValidAuth = async () => {
      if (authBlocked.current || disposed) return false;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session?.access_token) {
          signalExpiredAuth();
          return false;
        }

        const expiresAtMs = Number(data.session.expires_at || 0) * 1000;
        if (expiresAtMs && expiresAtMs <= Date.now() + 30000) {
          const refreshed = await supabase.auth.refreshSession();
          if (refreshed.error || !refreshed.data.session?.access_token) {
            signalExpiredAuth();
            return false;
          }
        }
        return true;
      } catch {
        signalExpiredAuth();
        return false;
      }
    };

    const isUnauthorized = (error) => {
      const status = Number(error?.status || error?.statusCode || 0);
      const code = String(error?.code || '');
      const message = String(error?.message || '').toLowerCase();
      return status === 401 || code === 'PGRST301' || message.includes('jwt') || message.includes('unauthorized');
    };

    const snapshot = () => JSON.stringify({
      subscribers: readLocal<Subscriber[]>(localKeys.subscribers, []),
      lines: readLocal<LineDistribution[]>(localKeys.lines, []),
      deletedLineIds: readLocal<string[]>(localKeys.deletedLines, []),
      tariffs: readLocal<MonthlyTariffRecord[]>(localKeys.tariffs, []),
      specs: readLocal<GeneratorSpecs | null>(localKeys.specs, null),
      invoice: readLocal<InvoiceTemplateSettings | null>(localKeys.invoice, null),
      invoiceCustom: readLocal<any>(localKeys.invoiceCustom, null),
      audit: readLocal<AuditLogEntry[]>(localKeys.audit, []),
      deletedTariffs: readLocal<string[]>(localKeys.deletedTariffs, []),
      walletReset: localStorage.getItem(localKeys.walletReset) || '',
      deletedSubscribers: readLocal<string[]>(localKeys.deletedSubscribers, []),
    });

    const push = async () => {
      const resetInProgress = localStorage.getItem(key('moldatk_factory_reset_in_progress', generatorId)) === '1';
      if (resetInProgress) return;
      if (!ready.current || disposed) return;
      if (pushing.current) { pendingPush.current = true; return; }
      if (!(await ensureValidAuth())) return;
      if (!Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && typeof navigator !== 'undefined' && !navigator.onLine) {
        emitSyncProgress({ active: false, progress: 0, pending: true, message: 'بانتظار رجوع الإنترنت للمزامنة' });
        return;
      }
      pushing.current = true;
      pendingPush.current = false;
      const pushedSnapshot = snapshot();
      let pushSucceeded = false;
      emitSyncProgress({ active: true, progress: 5, message: 'جاري المزامنة' });
      try {
        const subscribers = readLocal<Subscriber[]>(localKeys.subscribers, []);
        // COLLECTOR_SYNC_FREE_GUARD_V2
        const collectorPush = session?.role === 'collector';
        const writableSubscribers = collectorPush
          ? subscribers.filter(s => s.paymentStatus !== 'free' && s.isExempted !== true && s.tier !== 'free')
          : subscribers;
        const deletedLineIds = new Set(readLocal<string[]>(localKeys.deletedLines, []));
        const lines = readLocal<LineDistribution[]>(localKeys.lines, []).filter(line => !deletedLineIds.has(line.id));
        const rawTariffs = readLocal<MonthlyTariffRecord[]>(localKeys.tariffs, []);
        const tariffMap = new Map<string, MonthlyTariffRecord>();
        for (const tariff of rawTariffs) tariffMap.set(tariff.id, tariff);
        const tariffs = Array.from(tariffMap.values());
        if (tariffs.length !== rawTariffs.length) {
          writeLocal(localKeys.tariffs, tariffs);
        }
        const deletedTariffIds = readLocal<string[]>(localKeys.deletedTariffs, []);
        const specs = readLocal<GeneratorSpecs | null>(localKeys.specs, null);
        const invoiceTemplate = readLocal<InvoiceTemplateSettings | null>(localKeys.invoice, null);
        const invoiceCustom = readLocal<any>(localKeys.invoiceCustom, null);
        const audit = readLocal<AuditLogEntry[]>(localKeys.audit, []);
        const walletResetTimestamp = localStorage.getItem(localKeys.walletReset) || '';
        const deletedSubscribers = readLocal<string[]>(localKeys.deletedSubscribers, []);
        const invoices = dedupeInvoicesForCloud(writableSubscribers.flatMap(sub => (sub.invoicesHistory || []).map(inv => normalizeInvoiceForSubscriber(sub, inv))));

        if (deletedSubscribers.length) {
          const { error: invoiceDeleteError } = await supabase.from('generator_invoices').delete().eq('generator_id', generatorId).in('subscriber_id', deletedSubscribers);
          if (invoiceDeleteError) throw invoiceDeleteError;
          const { error: subscriberDeleteError } = await supabase.from('generator_subscribers').delete().eq('generator_id', generatorId).in('id', deletedSubscribers);
          if (subscriberDeleteError) throw subscriberDeleteError;
          writeLocal(localKeys.deletedSubscribers, []);
        }

        if (writableSubscribers.length) {
          const { error } = await supabase.from('generator_subscribers').upsert(writableSubscribers.map(s => subscriberToRow(generatorId, s)), { onConflict: 'generator_id,id' });
          if (error) throw error;
        }
        emitSyncProgress({ active: true, progress: 30, message: 'مزامنة المشتركين' });

        if (invoices.length) {
          const { error } = await supabase.from('generator_invoices').upsert(invoices.map(i => invoiceToRow(generatorId, i)), { onConflict: 'generator_id,id' });
          if (error) throw error;
        }
        emitSyncProgress({ active: true, progress: 55, message: 'مزامنة التسديدات' });

        // الجابي يحتاج مزامنة المشتركين والفواتير فقط. إعدادات المولدة تبقى بيد الإدارة.
        if (session?.role === 'generator_admin') {
          // MOLDATK_LINE_TOMBSTONE_DELETE_V2: remove deleted cabinets from Supabase before any realtime refresh.
          if (deletedLineIds.size) {
            const { error: deleteLinesError } = await supabase
              .from('generator_lines')
              .delete()
              .eq('generator_id', generatorId)
              .in('id', Array.from(deletedLineIds));
            if (deleteLinesError) throw deleteLinesError;
          }
          if (lines.length) {
            const { error } = await supabase.from('generator_lines').upsert(lines.map((l, index) => lineToRow(generatorId, l, index)), { onConflict: 'generator_id,id' });
            if (error) throw error;
          }

          if (deletedTariffIds.length) {
            const { error } = await supabase.from('generator_monthly_tariffs').delete().eq('generator_id', generatorId).in('id', deletedTariffIds);
            if (error) throw error;
          }

          if (tariffs.length) {
            const uniqueTariffs = Array.from(new Map(tariffs.map(t => [t.id, t] as const)).values());
            const { error } = await supabase.from('generator_monthly_tariffs').upsert(uniqueTariffs.map(t => tariffToRow(generatorId, t)), { onConflict: 'generator_id,id' });
            if (error) throw error;
          }

          if (specs || invoiceTemplate || invoiceCustom || walletResetTimestamp) {
            const { error } = await supabase.from('generator_settings').upsert({
              generator_id: generatorId,
              specs: specs || {},
              invoice_settings: { template: invoiceTemplate || {}, custom: invoiceCustom || {} },
              wallet_reset_timestamp: walletResetTimestamp || null,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'generator_id' });
            if (error) throw error;
          }
        }

        emitSyncProgress({ active: true, progress: 80, message: 'مزامنة الإعدادات' });

        if (audit.length) {
          const rows = audit.map(a => ({
            id: a.id, generator_id: generatorId, timestamp: a.timestamp, category: a.category,
            title: a.title, details: a.details, entity_id: a.entityId || null, entity_name: a.entityName || null,
            actor_name: a.actorName, previous_value: a.previousValue || null, new_value: a.newValue || null,
            cancellation_reason: a.cancellationReason || null, amount: a.amount ?? null,
          }));
          const { error } = await supabase.from('generator_audit_logs').upsert(rows, { onConflict: 'generator_id,id', ignoreDuplicates: session?.role === 'collector' });
          if (error) throw error;
        }
        if (session?.role === 'generator_admin' && deletedTariffIds.length) {
          writeLocal(localKeys.deletedTariffs, []);
        }
        clearPendingLocalChanges();
        lastSnapshot.current = pushedSnapshot;
        pushSucceeded = true;
        retryAfter.current = 0;
        emitSyncProgress({ active: false, progress: 100, message: 'اكتملت المزامنة', pending: false });
      } catch (e) {
        if (isUnauthorized(e)) { signalExpiredAuth(); return; }
        console.error('Moldatk cloud sync push failed:', e);
        retryAfter.current = Date.now() + 15000;
        emitSyncProgress({ active: false, progress: 0, pending: !Capacitor.isNativePlatform(), message: 'تعذر مزامنة السحابة — ستتم إعادة المحاولة تلقائياً' });
      } finally {
        pushing.current = false;
        if (pushSucceeded && !disposed && ready.current && (pendingPush.current || snapshot() !== lastSnapshot.current)) {
          pendingPush.current = false;
          queueMicrotask(() => { void push(); });
        }
      }
    };

    const pull = async (bootstrap = false) => {
      if (refreshing.current || authBlocked.current) return;
      if (!(await ensureValidAuth())) return;
      if (!Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && !Capacitor.isNativePlatform() && typeof navigator !== 'undefined' && !navigator.onLine) {
        ready.current = true;
        emitSyncProgress({ active: false, progress: 0, pending: true, message: 'وضع بدون إنترنت — التغييرات محفوظة للمزامنة' });
        return;
      }
      refreshing.current = true;
      try {
        const [subs, invoices, lines, tariffs, settings, logs] = await Promise.all([
          supabase.from('generator_subscribers').select('*').eq('generator_id', generatorId).order('created_at'),
          supabase.from('generator_invoices').select('*').eq('generator_id', generatorId).order('issue_date', { ascending: false }),
          supabase.from('generator_lines').select('*').eq('generator_id', generatorId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
          supabase.from('generator_monthly_tariffs').select('*').eq('generator_id', generatorId).order('year', { ascending: false }).order('month', { ascending: false }),
          supabase.from('generator_settings').select('*').eq('generator_id', generatorId).maybeSingle(),
          supabase.from('generator_audit_logs').select('*').eq('generator_id', generatorId).order('timestamp', { ascending: false }).limit(1000),
        ]);
        const firstError = subs.error || invoices.error || lines.error || tariffs.error || settings.error || logs.error;
        if (firstError) throw firstError;

        const localSubs = readLocal<Subscriber[]>(localKeys.subscribers, []);
        const localLines = readLocal<LineDistribution[]>(localKeys.lines, []);
        const localTariffs = readLocal<MonthlyTariffRecord[]>(localKeys.tariffs, []);
        const localAudit = readLocal<AuditLogEntry[]>(localKeys.audit, []);

        // COLLECTOR_STALE_PENDING_RECONCILIATION_V1
        if (session?.role === 'collector' && hasPendingLocalChanges()) {
          const remoteSubscriberIds = new Set((subs.data || []).map((row: any) => String(row.id)));
          const remoteInvoiceIds = new Set((invoices.data || []).map((row: any) => String(row.id)));
          const remoteAuditIds = new Set((logs.data || []).map((row: any) => String(row.id)));
          const localInvoiceIds = localSubs.flatMap(sub => (sub.invoicesHistory || []).map(inv => String(inv.id)));
          const hasLocalOnlyIdentity =
            localSubs.some(sub => !remoteSubscriberIds.has(String(sub.id))) ||
            localInvoiceIds.some(id => !remoteInvoiceIds.has(id)) ||
            localAudit.some(log => !remoteAuditIds.has(String(log.id)));
          if (!hasLocalOnlyIdentity) clearPendingLocalChanges();
        }

        if (hasPendingLocalChanges()) {
          ready.current = true;
          await push();
          // push keeps the dirty flag on any failure. In that case leave local data untouched.
          if (hasPendingLocalChanges()) {
            emitSyncProgress({ active: false, progress: 0, pending: true, message: 'التعديلات محفوظة على الجهاز وبانتظار المزامنة' });
            return;
          }
        }
        const deletedSubscriberIds = new Set(readLocal<string[]>(localKeys.deletedSubscribers, []));
        const deletedSubscribers = new Set(readLocal<string[]>(localKeys.deletedSubscribers, []));

        const remoteIsEmpty = !(subs.data?.length || invoices.data?.length || lines.data?.length || tariffs.data?.length || settings.data || logs.data?.length);
        const localHasData = Boolean(localSubs.length || localLines.length || localTariffs.length || localAudit.length || localStorage.getItem(localKeys.specs));

        if (bootstrap && remoteIsEmpty && localHasData) {
          ready.current = true;
          await push();
          return;
        }

        const invoiceMap = new Map<string, SubscriberInvoice[]>();
        for (const row of invoices.data || []) {
          const item = rowToInvoice(row);
          const list = invoiceMap.get(item.subscriberId) || [];
          list.push(item);
          invoiceMap.set(item.subscriberId, list);
        }
        writeLocal(localKeys.subscribers, (subs.data || []).filter((row: any) => !deletedSubscriberIds.has(row.id)).map((row: any) => {
          const subscriber = rowToSubscriber(row);
          const history = (invoiceMap.get(subscriber.id) || []).map(inv => normalizeInvoiceForSubscriber(subscriber, inv));
          if (isPermanentFreeSubscriber(subscriber)) {
            return { ...subscriber, paymentStatus: 'free', amountDue: 0, amountPaid: 0, invoicesHistory: history };
          }
          return { ...subscriber, invoicesHistory: history };
        }));
        const lineTombstones = new Set(readLocal<string[]>(localKeys.deletedLines, []));
        writeLocal(localKeys.lines, (lines.data || []).filter((row: any) => !lineTombstones.has(String(row.id))).map(rowToLine));
        const deletedTariffSet = new Set(readLocal<string[]>(localKeys.deletedTariffs, []));
        const remoteTariffs = (tariffs.data || []).map(rowToTariff).filter(t => !deletedTariffSet.has(t.id));
        const remoteTariffIds = new Set(remoteTariffs.map(t => t.id));
        const pendingLocalTariffs = localTariffs.filter(t => !remoteTariffIds.has(t.id));
        const hasPendingLocalTariffs = pendingLocalTariffs.length > 0;
        const localPendingActive = pendingLocalTariffs.some(t => t.isCurrentActive);
        const mergedTariffMap = new Map<string, MonthlyTariffRecord>();
        for (const remote of remoteTariffs) mergedTariffMap.set(remote.id, localPendingActive ? { ...remote, isCurrentActive: false } : remote);
        // النسخة المحلية غير الموجودة في السحابة أولوية، ولا يجوز للـPull أن يمسحها.
        for (const local of pendingLocalTariffs) mergedTariffMap.set(local.id, local);
        const mergedTariffs = Array.from(mergedTariffMap.values())
          .sort((a, b) => (b.year - a.year) || (b.month - a.month));
        writeLocal(localKeys.tariffs, mergedTariffs);
        writeLocal(localKeys.audit, (logs.data || []).map((r: any) => ({
          id: r.id, timestamp: r.timestamp, category: r.category, title: r.title, details: r.details,
          entityId: r.entity_id || undefined, entityName: r.entity_name || undefined, actorName: r.actor_name,
          previousValue: r.previous_value || undefined, newValue: r.new_value || undefined,
          cancellationReason: r.cancellation_reason || undefined, amount: r.amount == null ? undefined : Number(r.amount),
        })));
        if (settings.data) {
          if (settings.data.specs) writeLocal(localKeys.specs, settings.data.specs);
          const inv = settings.data.invoice_settings || {};
          if (inv.template) writeLocal(localKeys.invoice, inv.template);
          else if (Object.keys(inv).length) writeLocal(localKeys.invoice, inv);
          if (inv.custom) writeLocal(localKeys.invoiceCustom, inv.custom);
          if (settings.data.wallet_reset_timestamp) {
            localStorage.setItem(localKeys.walletReset, String(settings.data.wallet_reset_timestamp));
          } else {
            localStorage.removeItem(localKeys.walletReset);
          }
        }
        window.dispatchEvent(new Event('moldatk-local-sync'));
        ready.current = true;
        if (hasPendingLocalTariffs && session?.role === 'generator_admin') {
          await push();
        }
        // AUTHORITATIVE_MONTH_CYCLE_RECONCILE_V1
        // Reconcile only for the owner/admin role; collector payments remain normal cloud writes.
        if (session?.role === 'generator_admin') {
          const reconciliationTariffs = readLocal<MonthlyTariffRecord[]>(localKeys.tariffs, []);
          const activeTariff = reconciliationTariffs.find(t => t.isCurrentActive) || reconciliationTariffs[0];
          if (activeTariff?.id) {
            const { error: reconcileError } = await supabase.rpc('reconcile_generator_monthly_cycle', {
              p_generator_id: generatorId,
              p_tariff_id: activeTariff.id,
            });
            if (reconcileError) throw reconcileError;

            // Pull the server-authoritative financial projection immediately so the dashboard
            // cannot keep stale paid/unpaid counters or zero balances after tariff activation.
            const [freshSubs, freshInvoices] = await Promise.all([
              supabase.from('generator_subscribers').select('*').eq('generator_id', generatorId).order('created_at'),
              supabase.from('generator_invoices').select('*').eq('generator_id', generatorId).order('issue_date', { ascending: false }),
            ]);
            if (freshSubs.error) throw freshSubs.error;
            if (freshInvoices.error) throw freshInvoices.error;

            const freshInvoiceMap = new Map<string, SubscriberInvoice[]>();
            for (const row of freshInvoices.data || []) {
              const item = rowToInvoice(row);
              const list = freshInvoiceMap.get(item.subscriberId) || [];
              list.push(item);
              freshInvoiceMap.set(item.subscriberId, list);
            }
            writeLocal(localKeys.subscribers, (freshSubs.data || []).map((row: any) => {
              const subscriber = rowToSubscriber(row);
              return { ...subscriber, invoicesHistory: freshInvoiceMap.get(subscriber.id) || [] };
            }));
          }
        }

        clearPendingLocalChanges();
        lastSnapshot.current = snapshot();
      } finally {
        refreshing.current = false;
      }
    };

    const onLocalChange = () => {
      if (!ready.current || refreshing.current) return;
      if (Date.now() < retryAfter.current) return;
      if (Date.now() < retryAfter.current) return;
      if (Date.now() < retryAfter.current) return;
      if (Date.now() < retryAfter.current) return;
      if (Date.now() < retryAfter.current) return;
      if (Date.now() < retryAfter.current) return;
      if (Date.now() < retryAfter.current) return;
      if (Date.now() < retryAfter.current) return;
      if (Date.now() < retryAfter.current) return;

      // MOLDATK_CAPTURE_DELETED_LINES_V1: compare the last acknowledged snapshot with local state.
      try {
        const previous = lastSnapshot.current ? JSON.parse(lastSnapshot.current) : {};
        const previousLines: LineDistribution[] = Array.isArray(previous?.lines) ? previous.lines : [];
        const currentLines = readLocal<LineDistribution[]>(localKeys.lines, []);
        const currentIds = new Set(currentLines.map(line => line.id));
        const removedIds = previousLines.map(line => line?.id).filter(Boolean).filter(id => !currentIds.has(id));
        if (removedIds.length) {
          const tombstones = new Set(readLocal<string[]>(localKeys.deletedLines, []));
          removedIds.forEach(id => tombstones.add(String(id)));
          writeLocal(localKeys.deletedLines, Array.from(tombstones));
        }
      } catch (error) {
        console.warn('Cabinet deletion tombstone capture failed:', error);
      }

      const next = snapshot();
      if (next !== lastSnapshot.current) void push();
    };

    if (hasPendingLocalChanges()) {
      ready.current = true;
      void push();
    }

    void pull(true).catch(e => {
      ready.current = true;
      console.error('Moldatk cloud sync bootstrap failed:', e);
      emitSyncProgress({ active: false, progress: 0, pending: true, message: 'البيانات محفوظة محلياً وستتزامن عند رجوع الإنترنت' });
    });

    const channel = supabase.channel(`generator-sync-${generatorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generator_subscribers', filter: `generator_id=eq.${generatorId}` }, () => void pull())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generator_invoices', filter: `generator_id=eq.${generatorId}` }, () => void pull())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generator_lines', filter: `generator_id=eq.${generatorId}` }, () => void pull())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generator_monthly_tariffs', filter: `generator_id=eq.${generatorId}` }, () => void pull())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generator_settings', filter: `generator_id=eq.${generatorId}` }, () => void pull())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generator_audit_logs', filter: `generator_id=eq.${generatorId}` }, () => void pull())
      .subscribe();

    const handleOnline = async () => {
      ready.current = true;
      emitSyncProgress({ active: true, progress: 1, message: 'عاد الإنترنت — جاري المزامنة' });
      await push();
      await pull();
      emitSyncProgress({ active: false, progress: 100, message: 'اكتملت المزامنة', pending: false });
    };
    const handleOffline = () => {
      if (Capacitor.isNativePlatform()) return;
      emitSyncProgress({ active: false, progress: 0, pending: true, message: 'بدون إنترنت — سيتم حفظ العمليات للمزامنة' });
    };

    window.addEventListener('moldatk-local-sync', onLocalChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    // Safety reconciliation only; realtime + moldatk-local-sync handle normal changes immediately.
    const timer = window.setInterval(onLocalChange, 60 * 1000);
    const visibility = () => { if (document.visibilityState === 'visible') void pull(); };
    document.addEventListener('visibilitychange', visibility);

    return () => {
      disposed = true;
      ready.current = false;
      window.removeEventListener('moldatk-local-sync', onLocalChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', visibility);
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [session?.role, session?.generatorId]);
}
