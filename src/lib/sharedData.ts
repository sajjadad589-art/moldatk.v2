import { supabase } from './supabase';
import type {
  AuditLogEntry,
  GeneratorSpecs,
  InvoiceTemplateSettings,
  LineDistribution,
  MonthlyTariffRecord,
  Subscriber,
  SubscriberInvoice,
} from '../types';

const ensure = (error: any) => {
  if (error) throw error;
};

export async function getCurrentGeneratorId(): Promise<string> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  ensure(userError);
  if (!user) throw new Error('No authenticated user');

  const { data, error } = await supabase
    .from('profiles')
    .select('generator_id')
    .eq('id', user.id)
    .single();
  ensure(error);
  if (!data?.generator_id) throw new Error('User is not linked to a generator');
  return data.generator_id as string;
}

export async function loadSubscribers(generatorId: string): Promise<Subscriber[]> {
  const { data, error } = await supabase
    .from('generator_subscribers')
    .select('*')
    .eq('generator_id', generatorId)
    .order('created_at', { ascending: false });
  ensure(error);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    code: row.code,
    subscriberCode: row.code,
    fullName: row.full_name,
    phone: row.phone ?? '',
    tier: row.tier,
    amperes: row.amperes,
    lineId: row.line_id ?? undefined,
    lineName: row.line_name ?? undefined,
    line: row.line_name ?? undefined,
    address: row.address ?? undefined,
    boxNumber: row.box_number ?? undefined,
    paymentStatus: row.payment_status,
    lastPaymentDate: row.last_payment_date ?? undefined,
    amountDue: Number(row.amount_due ?? 0),
    amountPaid: Number(row.amount_paid ?? 0),
    notes: row.notes ?? undefined,
    isExempted: Boolean(row.is_exempted),
    exemptReason: row.exempt_reason ?? undefined,
    joiningDate: row.joining_date ?? undefined,
    createdAt: row.created_at,
  }));
}

export async function upsertSubscriber(generatorId: string, subscriber: Subscriber) {
  const { error } = await supabase.from('generator_subscribers').upsert({
    generator_id: generatorId,
    id: subscriber.id,
    code: subscriber.code || subscriber.subscriberCode,
    full_name: subscriber.fullName,
    phone: subscriber.phone || '',
    tier: subscriber.tier,
    amperes: subscriber.amperes,
    line_id: subscriber.lineId ?? null,
    line_name: subscriber.lineName ?? subscriber.line ?? null,
    address: subscriber.address ?? null,
    box_number: subscriber.boxNumber ?? null,
    payment_status: subscriber.paymentStatus,
    last_payment_date: subscriber.lastPaymentDate ?? null,
    amount_due: subscriber.amountDue ?? 0,
    amount_paid: subscriber.amountPaid ?? 0,
    notes: subscriber.notes ?? null,
    is_exempted: Boolean(subscriber.isExempted),
    exempt_reason: subscriber.exemptReason ?? null,
    joining_date: subscriber.joiningDate ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'generator_id,id' });
  ensure(error);
}

export async function deleteSubscriber(generatorId: string, subscriberId: string) {
  const { error } = await supabase
    .from('generator_subscribers')
    .delete()
    .eq('generator_id', generatorId)
    .eq('id', subscriberId);
  ensure(error);
}

export async function loadInvoices(generatorId: string): Promise<SubscriberInvoice[]> {
  const { data, error } = await supabase
    .from('generator_invoices')
    .select('*')
    .eq('generator_id', generatorId)
    .order('issue_date', { ascending: false });
  ensure(error);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    subscriberId: row.subscriber_id,
    monthId: row.month_id,
    monthNameAr: row.month_name_ar,
    issueDate: row.issue_date,
    paymentDate: row.payment_date ?? undefined,
    amperes: row.amperes,
    tier: row.tier,
    pricePerAmpere: Number(row.price_per_ampere ?? 0),
    fixedFee: Number(row.fixed_fee ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    paidAmount: Number(row.paid_amount ?? 0),
    remainingAmount: Number(row.remaining_amount ?? 0),
    status: row.status,
    cancellationReason: row.cancellation_reason ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    cancelledBy: row.cancelled_by ?? undefined,
    collectorName: row.collector_name ?? undefined,
    notes: row.notes ?? undefined,
    receiptNumber: row.receipt_number ?? undefined,
  }));
}

export async function upsertInvoice(generatorId: string, invoice: SubscriberInvoice) {
  const { error } = await supabase.from('generator_invoices').upsert({
    generator_id: generatorId,
    id: invoice.id,
    subscriber_id: invoice.subscriberId,
    month_id: invoice.monthId,
    month_name_ar: invoice.monthNameAr,
    issue_date: invoice.issueDate,
    payment_date: invoice.paymentDate ?? null,
    amperes: invoice.amperes,
    tier: invoice.tier,
    price_per_ampere: invoice.pricePerAmpere,
    fixed_fee: invoice.fixedFee,
    total_amount: invoice.totalAmount,
    paid_amount: invoice.paidAmount ?? 0,
    remaining_amount: invoice.remainingAmount ?? 0,
    status: invoice.status,
    cancellation_reason: invoice.cancellationReason ?? null,
    cancelled_at: invoice.cancelledAt ?? null,
    cancelled_by: invoice.cancelledBy ?? null,
    collector_name: invoice.collectorName ?? null,
    notes: invoice.notes ?? null,
    receipt_number: invoice.receiptNumber ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'generator_id,id' });
  ensure(error);
}

export async function loadLines(generatorId: string): Promise<LineDistribution[]> {
  const { data, error } = await supabase
    .from('generator_lines')
    .select('*')
    .eq('generator_id', generatorId)
    .order('name');
  ensure(error);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    zone: row.zone,
    phaseType: row.phase_type ?? undefined,
    phaseNameAr: row.phase_name_ar ?? undefined,
    maxCapacityAmperes: row.max_capacity_amperes,
    currentLoadAmperes: row.current_load_amperes,
    subscribersCount: row.subscribers_count,
    technicianName: row.technician_name,
    breakerNumber: row.breaker_number ?? undefined,
  }));
}

export async function replaceLines(generatorId: string, lines: LineDistribution[]) {
  const { error: deleteError } = await supabase.from('generator_lines').delete().eq('generator_id', generatorId);
  ensure(deleteError);
  if (!lines.length) return;
  const { error } = await supabase.from('generator_lines').insert(lines.map(line => ({
    generator_id: generatorId,
    id: line.id,
    name: line.name,
    zone: line.zone,
    phase_type: line.phaseType ?? null,
    phase_name_ar: line.phaseNameAr ?? null,
    max_capacity_amperes: line.maxCapacityAmperes,
    current_load_amperes: line.currentLoadAmperes,
    subscribers_count: line.subscribersCount,
    technician_name: line.technicianName,
    breaker_number: line.breakerNumber ?? null,
  })));
  ensure(error);
}

export async function loadMonthlyTariffs(generatorId: string): Promise<MonthlyTariffRecord[]> {
  const { data, error } = await supabase
    .from('generator_monthly_tariffs')
    .select('*')
    .eq('generator_id', generatorId)
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  ensure(error);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    month: row.month,
    year: row.year,
    monthNameAr: row.month_name_ar,
    tiers: row.tiers ?? [],
    fuelPricePerLiter: row.fuel_price_per_liter == null ? undefined : Number(row.fuel_price_per_liter),
    operatingHoursTotal: row.operating_hours_total == null ? undefined : Number(row.operating_hours_total),
    createdAt: row.created_at,
    isCurrentActive: row.is_current_active,
  }));
}

export async function upsertMonthlyTariff(generatorId: string, record: MonthlyTariffRecord) {
  const { error } = await supabase.from('generator_monthly_tariffs').upsert({
    generator_id: generatorId,
    id: record.id,
    month: record.month,
    year: record.year,
    month_name_ar: record.monthNameAr,
    tiers: record.tiers,
    fuel_price_per_liter: record.fuelPricePerLiter ?? null,
    operating_hours_total: record.operatingHoursTotal ?? null,
    is_current_active: Boolean(record.isCurrentActive),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'generator_id,id' });
  ensure(error);
}

export async function loadGeneratorSettings(generatorId: string): Promise<{ specs: Partial<GeneratorSpecs>; invoiceSettings: Partial<InvoiceTemplateSettings> }> {
  const { data, error } = await supabase
    .from('generator_settings')
    .select('specs,invoice_settings')
    .eq('generator_id', generatorId)
    .maybeSingle();
  ensure(error);
  return { specs: data?.specs ?? {}, invoiceSettings: data?.invoice_settings ?? {} };
}

export async function saveGeneratorSettings(generatorId: string, specs: Partial<GeneratorSpecs>, invoiceSettings?: Partial<InvoiceTemplateSettings>) {
  const payload: any = { generator_id: generatorId, specs, updated_at: new Date().toISOString() };
  if (invoiceSettings) payload.invoice_settings = invoiceSettings;
  const { error } = await supabase.from('generator_settings').upsert(payload, { onConflict: 'generator_id' });
  ensure(error);
}

export async function appendAuditLog(generatorId: string, entry: AuditLogEntry) {
  const { error } = await supabase.from('generator_audit_logs').upsert({
    generator_id: generatorId,
    id: entry.id,
    timestamp: entry.timestamp,
    category: entry.category,
    title: entry.title,
    details: entry.details,
    entity_id: entry.entityId ?? null,
    entity_name: entry.entityName ?? null,
    actor_name: entry.actorName,
    previous_value: entry.previousValue ?? null,
    new_value: entry.newValue ?? null,
    cancellation_reason: entry.cancellationReason ?? null,
    amount: entry.amount ?? null,
  }, { onConflict: 'generator_id,id' });
  ensure(error);
}

export function subscribeToGeneratorChanges(generatorId: string, onChange: () => void) {
  const channel = supabase
    .channel(`generator-sync-${generatorId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'generator_subscribers', filter: `generator_id=eq.${generatorId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'generator_invoices', filter: `generator_id=eq.${generatorId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'generator_lines', filter: `generator_id=eq.${generatorId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'generator_monthly_tariffs', filter: `generator_id=eq.${generatorId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'generator_settings', filter: `generator_id=eq.${generatorId}` }, onChange)
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}
