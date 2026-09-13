import type { Subscriber, SubscriberInvoice, LineDistribution, MonthlyTariffRecord } from '../types';
export const subscriberToRow = (generatorId: string, s: Subscriber) => ({
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

export const rowToSubscriber = (r: any): Subscriber => ({
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

export const invoiceToRow = (generatorId: string, i: SubscriberInvoice) => ({
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

export const rowToInvoice = (r: any): SubscriberInvoice => ({
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

export const lineToRow = (generatorId: string, l: LineDistribution, sortOrder = 0) => ({
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

export const rowToLine = (r: any): LineDistribution => ({
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

export const tariffToRow = (generatorId: string, t: MonthlyTariffRecord) => ({
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

export const rowToTariff = (r: any): MonthlyTariffRecord => ({
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

export function dedupeInvoicesForCloud(invoices: SubscriberInvoice[]): SubscriberInvoice[] {
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


