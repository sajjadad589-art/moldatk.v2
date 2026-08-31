import { supabase } from './supabase';
import type { Subscriber } from '../types';

const toRow = (generatorId: string, s: Subscriber) => ({
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
  payment_status: s.paymentStatus || 'unpaid',
  last_payment_date: s.lastPaymentDate || null,
  amount_due: Number(s.amountDue || 0),
  amount_paid: Number(s.amountPaid || 0),
  notes: s.notes || null,
  is_exempted: Boolean(s.isExempted),
  exempt_reason: s.exemptReason || null,
  joining_date: s.joiningDate || null,
  updated_at: new Date().toISOString(),
});

export async function persistCollectorSubscriber(generatorId: string, subscriber: Subscriber) {
  const { data, error } = await supabase
    .from('generator_subscribers')
    .upsert(toRow(generatorId, subscriber), { onConflict: 'generator_id,id' })
    .select('id')
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error('subscriber_not_persisted');
  return data.id as string;
}
