import { supabase } from './supabase';

export type SiteSettings = {
  id: string;
  whatsapp_phone: string;
  whatsapp_message: string;
  hero_title: string;
  hero_subtitle: string;
  android_download_enabled: boolean;
  updated_at: string;
};

export type AppRelease = {
  id: string;
  version_name: string;
  version_code: number;
  release_notes: string;
  apk_path: string;
  apk_url: string;
  file_size?: number | null;
  is_mandatory: boolean;
  is_active: boolean;
  created_at: string;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  id: 'main',
  whatsapp_phone: '07766334555',
  whatsapp_message: 'السلام عليكم، أريد طلب تطبيق مولدتك',
  hero_title: 'إدارة المولدة والجباية من أي جهاز',
  hero_subtitle: 'مولدتك يجمع المشتركين، التسديدات، الفواتير، الجباة والإعدادات في نظام واحد.',
  android_download_enabled: false,
  updated_at: new Date(0).toISOString(),
};

export const normalizeIraqiPhoneForWhatsApp = (phone: string) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('964')) return digits;
  if (digits.startsWith('0')) return `964${digits.slice(1)}`;
  return digits;
};

export const whatsappUrl = (phone: string, message: string) =>
  `https://wa.me/${normalizeIraqiPhoneForWhatsApp(phone)}?text=${encodeURIComponent(message || '')}`;

export async function loadSiteSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 'main').maybeSingle();
  if (error) throw error;
  return (data as SiteSettings | null) || DEFAULT_SITE_SETTINGS;
}

export async function saveSiteSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const payload = { id: 'main', ...patch, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('site_settings').upsert(payload).select('*').single();
  if (error) throw error;
  return data as SiteSettings;
}

export async function loadReleases(includeInactive = false): Promise<AppRelease[]> {
  let query = supabase.from('app_releases').select('*').order('created_at', { ascending: false });
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AppRelease[];
}

export async function loadActiveRelease(): Promise<AppRelease | null> {
  const { data, error } = await supabase.from('app_releases').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as AppRelease | null;
}

export async function createRelease(input: { versionName: string; versionCode: number; releaseNotes: string; file: File; mandatory: boolean; }) {
  const safeVersion = input.versionName.replace(/[^0-9A-Za-z._-]/g, '-');
  const path = `android/${input.versionCode}-${safeVersion}-${Date.now()}.apk`;
  const { error: uploadError } = await supabase.storage.from('app-releases').upload(path, input.file, {
    cacheControl: '3600', upsert: false, contentType: input.file.type || 'application/vnd.android.package-archive'
  });
  if (uploadError) throw uploadError;
  const { data: publicData } = supabase.storage.from('app-releases').getPublicUrl(path);
  const { data, error } = await supabase.from('app_releases').insert({
    version_name: input.versionName,
    version_code: input.versionCode,
    release_notes: input.releaseNotes,
    apk_path: path,
    apk_url: publicData.publicUrl,
    file_size: input.file.size,
    is_mandatory: input.mandatory,
    is_active: false,
  }).select('*').single();
  if (error) {
    await supabase.storage.from('app-releases').remove([path]);
    throw error;
  }
  return data as AppRelease;
}

export async function activateRelease(id: string) {
  const { error } = await supabase.rpc('activate_app_release', { target_id: id });
  if (error) throw error;
}

export async function deleteRelease(release: AppRelease) {
  if (release.is_active) throw new Error('لا يمكن حذف الإصدار النشط. فعّل إصداراً آخر أولاً.');
  const { error } = await supabase.from('app_releases').delete().eq('id', release.id);
  if (error) throw error;
  if (release.apk_path) await supabase.storage.from('app-releases').remove([release.apk_path]);
}
