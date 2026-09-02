import { supabase } from './supabase';
import type { ActiveUserSession, Collector, CollectorPermissions } from '../types';

const normalizePhone = (value: string) => String(value || '').replace(/\D/g, '');
const collectorEmail = (phone: string) => `c_${normalizePhone(phone)}@collector.molidatk.app`;
const authPassword = (pin: string) => `Md!${String(pin || '').trim()}`;

const DEFAULT_COLLECTOR_PERMISSIONS: CollectorPermissions = {
  canCollectPayments: true,
  canCancelPayments: false,
  canAddSubscribers: false,
  canEditSubscribers: false,
  canDeleteSubscribers: false,
  canApplyFreeExemption: false,
  canPrintReceipts: true,
  canViewFinancialReports: false,
  canAccessSystemSettings: false,
};

const normalizePermissions = (value: any): CollectorPermissions => ({
  ...DEFAULT_COLLECTOR_PERMISSIONS,
  ...(value && typeof value === 'object' ? value : {}),
});

const fromRow = (row: any): Collector => ({
  id: row.id,
  generatorId: row.generator_id,
  name: row.name,
  phone: normalizePhone(row.phone),
  passcode: '',
  permissions: normalizePermissions(row.permissions),
  assignedLineId: row.assigned_line_id || undefined,
  assignedLineName: row.assigned_line_name || undefined,
  nationalId: row.national_id || '',
  notes: row.notes || '',
  isActive: row.is_active !== false,
});

const mergeKnownLocalPins = (generatorId: string, incoming: Collector[], preferred: Collector[] = []) => {
  const pinsById = new Map<string, string>();
  const pinsByPhone = new Map<string, string>();

  const remember = (items: Collector[]) => {
    for (const item of items || []) {
      const pin = String(item?.passcode || '').trim();
      if (!/^\d{4,8}$/.test(pin)) continue;
      if (item?.id) pinsById.set(String(item.id), pin);
      const phone = normalizePhone(item?.phone || '');
      if (phone) pinsByPhone.set(phone, pin);
    }
  };

  remember(preferred);
  try {
    const raw = localStorage.getItem(`moldatk_collectors_${generatorId}`);
    const cached = raw ? JSON.parse(raw) : [];
    if (Array.isArray(cached)) remember(cached);
  } catch (e) {}

  return incoming.map(item => ({
    ...item,
    passcode: pinsById.get(String(item.id)) || pinsByPhone.get(normalizePhone(item.phone)) || '',
  }));
};

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
    .select('id,name,phone,is_active,permissions,assigned_line_id,assigned_line_name')
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
    collectorPermissions: normalizePermissions(collector.permissions),
    assignedLineId: collector.assigned_line_id || undefined,
    assignedLineName: collector.assigned_line_name || undefined,
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
  return mergeKnownLocalPins(generatorId, (data || []).map(fromRow));
}

export async function syncCloudCollectorRoster(collectors: Collector[]): Promise<Collector[]> {
  const normalized = collectors.map(item => ({
    ...item,
    phone: normalizePhone(item.phone),
    passcode: String(item.passcode || '').trim(),
  }));

  const { data, error } = await supabase.functions.invoke('manage-collector-account', {
    body: { action: 'sync', collectors: normalized },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  const saved = Array.isArray(data?.collectors) ? data.collectors.map((row: any) => ({
    ...row,
    phone: normalizePhone(row.phone),
    permissions: normalizePermissions(row.permissions),
  })) as Collector[] : [];
  const generatorId = String(saved[0]?.generatorId || normalized[0]?.generatorId || '');
  return generatorId ? mergeKnownLocalPins(generatorId, saved, normalized) : saved;
}
