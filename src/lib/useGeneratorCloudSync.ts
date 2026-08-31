import { useEffect, useRef } from 'react';
import { supabase } from './supabase';
import type { ActiveUserSession, Subscriber, SubscriberInvoice, LineDistribution, MonthlyTariffRecord, GeneratorSpecs, InvoiceTemplateSettings, AuditLogEntry } from '../types';

const key = (base: string, generatorId: string) => `${base}_${generatorId}`;

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

const subscriberToRow = (generatorId: string, s: Subscriber) => ({
  id: s.id,
  generator_id: generatorId,
  code: s.code || s.subscriberCode || s.id,
  full_name: s.fullName || '',
  phone: s.phone || '',
  tier: s.tier,
  amperes: Number(s.amperes || 0),
  line_id: s.lineId || null,
  line_name: s.lineName || s.line || null,
  address: s.address || null,
  box_number: s.boxNumber || null,
  payment_status: s.paymentStatus,
  last_payment_date: s.lastPaymentDate || null,
  amount_due: Number(s.amountDue || 0),
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

const lineToRow = (generatorId: string, l: LineDistribution) => ({
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

async function replaceMissingRows(table: string, generatorId: string, ids: string[]) {
  let q = supabase.from(table).delete().eq('generator_id', generatorId);
  if (ids.length) q = q.not('id', 'in', `(${ids.map(x => `"${String(x).replace(/"/g, '')}"`).join(',')})`);
  const { error } = await q;
  if (error) throw error;
}

export function useGeneratorCloudSync(session: ActiveUserSession | null) {
  const ready = useRef(false);
  const pushing = useRef(false);
  const refreshing = useRef(false);
  const lastSnapshot = useRef('');

  useEffect(() => {
    const generatorId = session?.generatorId || '';
    const isGeneratorUser = session?.role === 'generator_admin' || session?.role === 'collector';
    if (!generatorId || !isGeneratorUser) return;

    let disposed = false;
    ready.current = false;

    const localKeys = {
      subscribers: key('moldatk_subscribers', generatorId),
      lines: key('moldatk_lines', generatorId),
      tariffs: key('moldatk_monthly_tariffs', generatorId),
      specs: key('moldatk_generator', generatorId),
      invoice: key('moldatk_invoice_template', generatorId),
      invoiceCustom: key('moldatk_invoice_custom_settings', generatorId),
      audit: key('moldatk_audit_logs', generatorId),
    };

    const snapshot = () => JSON.stringify({
      subscribers: readLocal<Subscriber[]>(localKeys.subscribers, []),
      lines: readLocal<LineDistribution[]>(localKeys.lines, []),
      tariffs: readLocal<MonthlyTariffRecord[]>(localKeys.tariffs, []),
      specs: readLocal<GeneratorSpecs | null>(localKeys.specs, null),
      invoice: readLocal<InvoiceTemplateSettings | null>(localKeys.invoice, null),
      invoiceCustom: readLocal<any>(localKeys.invoiceCustom, null),
      audit: readLocal<AuditLogEntry[]>(localKeys.audit, []),
    });

    const push = async () => {
      if (!ready.current || pushing.current || disposed) return;
      pushing.current = true;
      try {
        const subscribers = readLocal<Subscriber[]>(localKeys.subscribers, []);
        const lines = readLocal<LineDistribution[]>(localKeys.lines, []);
        const tariffs = readLocal<MonthlyTariffRecord[]>(localKeys.tariffs, []);
        const specs = readLocal<GeneratorSpecs | null>(localKeys.specs, null);
        const invoiceTemplate = readLocal<InvoiceTemplateSettings | null>(localKeys.invoice, null);
        const invoiceCustom = readLocal<any>(localKeys.invoiceCustom, null);
        const audit = readLocal<AuditLogEntry[]>(localKeys.audit, []);
        const invoices = subscribers.flatMap(s => s.invoicesHistory || []);

        if (subscribers.length) {
          const { error } = await supabase.from('generator_subscribers').upsert(subscribers.map(s => subscriberToRow(generatorId, s)), { onConflict: 'generator_id,id' });
          if (error) throw error;
        }
        await replaceMissingRows('generator_subscribers', generatorId, subscribers.map(s => s.id));

        if (invoices.length) {
          const { error } = await supabase.from('generator_invoices').upsert(invoices.map(i => invoiceToRow(generatorId, i)), { onConflict: 'generator_id,id' });
          if (error) throw error;
        }
        await replaceMissingRows('generator_invoices', generatorId, invoices.map(i => i.id));

        // الجابي يحتاج مزامنة المشتركين والفواتير فقط. إعدادات المولدة تبقى بيد الإدارة.
        if (session?.role === 'generator_admin') {
          if (lines.length) {
            const { error } = await supabase.from('generator_lines').upsert(lines.map(l => lineToRow(generatorId, l)), { onConflict: 'generator_id,id' });
            if (error) throw error;
          }
          await replaceMissingRows('generator_lines', generatorId, lines.map(l => l.id));

          if (tariffs.length) {
            const { error } = await supabase.from('generator_monthly_tariffs').upsert(tariffs.map(t => tariffToRow(generatorId, t)), { onConflict: 'generator_id,id' });
            if (error) throw error;
          }
          await replaceMissingRows('generator_monthly_tariffs', generatorId, tariffs.map(t => t.id));

          if (specs || invoiceTemplate || invoiceCustom) {
            const { error } = await supabase.from('generator_settings').upsert({
              generator_id: generatorId,
              specs: specs || {},
              invoice_settings: { template: invoiceTemplate || {}, custom: invoiceCustom || {} },
              updated_at: new Date().toISOString(),
            }, { onConflict: 'generator_id' });
            if (error) throw error;
          }
        }

        if (audit.length) {
          const rows = audit.map(a => ({
            id: a.id, generator_id: generatorId, timestamp: a.timestamp, category: a.category,
            title: a.title, details: a.details, entity_id: a.entityId || null, entity_name: a.entityName || null,
            actor_name: a.actorName, previous_value: a.previousValue || null, new_value: a.newValue || null,
            cancellation_reason: a.cancellationReason || null, amount: a.amount ?? null,
          }));
          const { error } = await supabase.from('generator_audit_logs').upsert(rows, { onConflict: 'generator_id,id' });
          if (error) throw error;
        }
        lastSnapshot.current = snapshot();
      } catch (e) {
        console.error('Moldatk cloud sync push failed:', e);
      } finally {
        pushing.current = false;
      }
    };

    const pull = async (bootstrap = false) => {
      if (refreshing.current) return;
      refreshing.current = true;
      try {
        const [subs, invoices, lines, tariffs, settings, logs] = await Promise.all([
          supabase.from('generator_subscribers').select('*').eq('generator_id', generatorId).order('created_at'),
          supabase.from('generator_invoices').select('*').eq('generator_id', generatorId).order('issue_date', { ascending: false }),
          supabase.from('generator_lines').select('*').eq('generator_id', generatorId).order('created_at'),
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
        writeLocal(localKeys.subscribers, (subs.data || []).map((row: any) => {
          const subscriber = rowToSubscriber(row);
          return { ...subscriber, invoicesHistory: invoiceMap.get(subscriber.id) || [] };
        }));
        writeLocal(localKeys.lines, (lines.data || []).map(rowToLine));
        writeLocal(localKeys.tariffs, (tariffs.data || []).map(rowToTariff));
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
        }
        window.dispatchEvent(new Event('moldatk-local-sync'));
        lastSnapshot.current = snapshot();
        ready.current = true;
      } finally {
        refreshing.current = false;
      }
    };

    const onLocalChange = () => {
      if (!ready.current || refreshing.current) return;
      const next = snapshot();
      if (next !== lastSnapshot.current) void push();
    };

    void pull(true).catch(e => console.error('Moldatk cloud sync bootstrap failed:', e));

    const channel = supabase.channel(`generator-sync-${generatorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generator_subscribers', filter: `generator_id=eq.${generatorId}` }, () => void pull())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generator_invoices', filter: `generator_id=eq.${generatorId}` }, () => void pull())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generator_lines', filter: `generator_id=eq.${generatorId}` }, () => void pull())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generator_monthly_tariffs', filter: `generator_id=eq.${generatorId}` }, () => void pull())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generator_settings', filter: `generator_id=eq.${generatorId}` }, () => void pull())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'generator_audit_logs', filter: `generator_id=eq.${generatorId}` }, () => void pull())
      .subscribe();

    window.addEventListener('moldatk-local-sync', onLocalChange);
    const timer = window.setInterval(onLocalChange, 2500);
    const visibility = () => { if (document.visibilityState === 'visible') void pull(); };
    document.addEventListener('visibilitychange', visibility);

    return () => {
      disposed = true;
      ready.current = false;
      window.removeEventListener('moldatk-local-sync', onLocalChange);
      document.removeEventListener('visibilitychange', visibility);
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [session?.role, session?.generatorId]);
}
