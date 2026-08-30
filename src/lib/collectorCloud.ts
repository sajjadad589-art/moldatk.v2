import { supabase } from './supabase';
import type { ActiveUserSession, Collector } from '../types';

const normalizePhone = (value: string) => String(value || '').replace(/\D/g, '');
const collectorEmail = (phone: string) => `c_${normalizePhone(phone)}@collector.molidatk.app`;
const authPassword = (pin: string) => `Md!${String(pin || '').trim()}`;

const fromRow = (row: any): Collector => ({
  id: row.id,
  generatorId: row.generator_id,
  name: row.name,
  phone: row.phone,
  // PIN is never downloaded from the server. Empty means "keep current PIN" when saving.
  passcode: '',
  permissions: row.permissions || {},
  assignedLineId: row.assigned_line_id || undefined,
  assignedLineName: row.assigned_line_name || undefined,
  nationalId: row.national_id || '',
  notes: row.notes || '',
  isActive: row.is_active !== false,
});

export async function loginCollectorWithCloud(phoneInput: string, pinInput: string): Promise<ActiveUserSession> {
  const phone = normalizePhone(phoneInput);
  const pin = String(pinInput || '').trim();
  if (phone.length < 10 || !/^\d{4,8}$/.test(pin)) throw new Error('invalid_credentials');

  const { data, error } = await supabase.auth.signInWithPassword({
    email: collectorEmail(phone),
    password: authPassword(pin),
  });
  if (error || !data.user) throw new Error('invalid_credentials');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role,generator_id,is_active,full_name,phone')
    .eq('id', data.user.id)
    .single();
  if (profileError || !profile || profile.role !== 'employee' || !profile.generator_id || !profile.is_active) {
    await supabase.auth.signOut();
    throw new Error('collector_not_active');
  }

  const { data: collector, error: collectorError } = await supabase
    .from('generator_collectors')
    .select('id,name,phone,is_active')
    .eq('id', data.user.id)
    .single();
  if (collectorError || !collector || collector.is_active === false) {
    await supabase.auth.signOut();
    throw new Error('collector_not_active');
  }

  return {
    role: 'collector',
    collectorId: collector.id,
    collectorName: collector.name || profile.full_name || 'جابي ميداني',
    generatorId: profile.generator_id,
    loginTime: new Date().toISOString(),
  };
}

export async function loadCloudCollectors(generatorId: string): Promise<Collector[]> {
  const { data, error } = await supabase
    .from('generator_collectors')
    .select('*')
    .eq('generator_id', generatorId)
    .order('created_at');
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function syncCloudCollectorRoster(collectors: Collector[]): Promise<Collector[]> {
  const { data, error } = await supabase.functions.invoke('manage-collector-account', {
    body: { action: 'sync', collectors },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return Array.isArray(data?.collectors) ? data.collectors : [];
}
