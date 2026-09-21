import { supabase } from './supabase';
import type { ActiveUserSession, CollectorPermissions } from '../types';

export type LoginAccountRole = 'generator_admin' | 'collector' | 'super_admin' | 'super_admin_manager';

export interface AuthAccountPayload {
  userId: string;
  role: LoginAccountRole;
  generatorId: string;
  generatorName: string;
  ownerName: string;
  location?: string;
  collectorName?: string | null;
  collectorId?: string | null;
  collectorPermissions?: CollectorPermissions | null;
  assignedLineId?: string | null;
  assignedLineName?: string | null;
  assignedLineIds?: string[];
  assignedAllLines?: boolean;
}

export interface SavedLoginAccount extends AuthAccountPayload {
  id: string;
  identifier: string;
  passkeyEnabled: boolean;
  lastUsedAt: string;
}

const STORAGE_KEY = 'moldatk_saved_login_accounts_v2';

const base64UrlToBuffer = (value: string): ArrayBuffer => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob(base64);
  const bytes = Uint8Array.from(raw, ch => ch.charCodeAt(0));
  return bytes.buffer;
};

const bufferToBase64Url = (buffer: ArrayBuffer | ArrayBufferView | null): string => {
  if (!buffer) return '';
  const view = buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer)
    : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let raw = '';
  for (const byte of view) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const invokeAuth = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('moldatk-auth', { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data;
};

export const accountToSession = (account: AuthAccountPayload, identifier = ''): ActiveUserSession => ({
  role: account.role,
  authUserId: account.userId,
  generatorId: account.generatorId,
  generatorName: account.generatorName,
  ownerName: account.ownerName,
  generatorLocation: account.location || '',
  collectorId: account.collectorId || undefined,
  collectorName: account.collectorName || undefined,
  collectorPermissions: account.collectorPermissions || undefined,
  assignedLineId: account.assignedLineId || undefined,
  assignedLineName: account.assignedLineName || undefined,
  assignedLineIds: account.assignedLineIds || [],
  assignedAllLines: Boolean(account.assignedAllLines),
  username: identifier || undefined,
  email: identifier.includes('@') ? identifier : undefined,
  loginTime: new Date().toISOString(),
});

export function loadSavedLoginAccounts(): SavedLoginAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(item => item?.userId && item?.generatorId && ['generator_admin', 'collector'].includes(item?.role))
      .map(item => ({
        ...item,
        id: String(item.id || `${item.userId}:${item.generatorId}:${item.role}`),
        generatorName: String(item.generatorName || 'مولدتك'),
        ownerName: String(item.ownerName || 'صاحب المولدة'),
        location: String(item.location || ''),
        identifier: String(item.identifier || ''),
        passkeyEnabled: Boolean(item.passkeyEnabled),
        lastUsedAt: String(item.lastUsedAt || new Date(0).toISOString()),
      }))
      .sort((a, b) => Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt));
  } catch {
    return [];
  }
}

export function saveLoginAccount(
  account: AuthAccountPayload,
  identifier: string,
  overrides: Partial<Pick<SavedLoginAccount, 'passkeyEnabled' | 'lastUsedAt'>> = {},
): SavedLoginAccount {
  const existing = loadSavedLoginAccounts();
  const id = `${account.userId}:${account.generatorId}:${account.role}`;
  const previous = existing.find(item => item.id === id);
  const next: SavedLoginAccount = {
    ...account,
    id,
    identifier: identifier || previous?.identifier || '',
    passkeyEnabled: overrides.passkeyEnabled ?? previous?.passkeyEnabled ?? false,
    lastUsedAt: overrides.lastUsedAt || new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      next,
      ...existing.filter(item => item.id !== id),
    ].slice(0, 12)));
  } catch {}
  return next;
}

export function removeSavedLoginAccount(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loadSavedLoginAccounts().filter(item => item.id !== id)));
  } catch {}
}

export async function discoverLoginIdentifier(identifier: string): Promise<{ found: boolean; roleHint?: LoginAccountRole }> {
  const data = await invokeAuth({
    action: 'discover',
    identifier: identifier.trim(),
  });
  return {
    found: Boolean(data?.found),
    roleHint: data?.roleHint === 'collector' ? 'collector' : data?.roleHint === 'generator_admin' ? 'generator_admin' : undefined,
  };
}

export async function loginWithIdentifier(identifier: string, secret: string) {
  const data = await invokeAuth({
    action: 'password-login',
    identifier: identifier.trim(),
    secret,
  });
  if (!data?.accessToken || !data?.refreshToken || !data?.account) throw new Error('invalid_credentials');

  const { error } = await supabase.auth.setSession({
    access_token: String(data.accessToken),
    refresh_token: String(data.refreshToken),
  });
  if (error) throw error;

  const account = data.account as AuthAccountPayload;
  const isSuperAdmin = account.role === 'super_admin' || account.role === 'super_admin_manager';
  const saved = saveLoginAccount(
    account,
    identifier,
    isSuperAdmin
      ? { passkeyEnabled: true, lastUsedAt: new Date().toISOString() }
      : { lastUsedAt: new Date().toISOString() },
  );
  return { account, saved, session: accountToSession(account, identifier) };
}

export async function isPlatformPasskeyAvailable(): Promise<boolean> {
  try {
    if (!window.isSecureContext || !('PublicKeyCredential' in window) || !navigator.credentials) return false;
    const api = window.PublicKeyCredential as typeof PublicKeyCredential & {
      isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
    };
    if (!api.isUserVerifyingPlatformAuthenticatorAvailable) return true;
    return await api.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

const prepareRegistrationOptions = (raw: any): PublicKeyCredentialCreationOptions => ({
  ...raw,
  challenge: base64UrlToBuffer(String(raw.challenge)),
  user: {
    ...raw.user,
    id: base64UrlToBuffer(String(raw.user.id)),
  },
  excludeCredentials: Array.isArray(raw.excludeCredentials)
    ? raw.excludeCredentials.map((item: any) => ({ ...item, id: base64UrlToBuffer(String(item.id)) }))
    : [],
});

const prepareAuthenticationOptions = (raw: any): PublicKeyCredentialRequestOptions => ({
  ...raw,
  challenge: base64UrlToBuffer(String(raw.challenge)),
  allowCredentials: Array.isArray(raw.allowCredentials)
    ? raw.allowCredentials.map((item: any) => ({ ...item, id: base64UrlToBuffer(String(item.id)) }))
    : [],
});

const serializeRegistrationCredential = (credential: PublicKeyCredential) => {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: bufferToBase64Url(response.attestationObject),
      transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: (credential as any).authenticatorAttachment ?? null,
  };
};

const serializeAuthenticationCredential = (credential: PublicKeyCredential) => {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: (credential as any).authenticatorAttachment ?? null,
  };
};

export async function registerPasskeyForCurrentAccount(saved: SavedLoginAccount): Promise<SavedLoginAccount> {
  if (!(await isPlatformPasskeyAvailable())) throw new Error('passkey_not_supported');

  const origin = window.location.origin;
  const start = await invokeAuth({
    action: 'passkey-register-options',
    origin,
  });

  const credential = await navigator.credentials.create({
    publicKey: prepareRegistrationOptions(start.options),
  }) as PublicKeyCredential | null;
  if (!credential) throw new Error('passkey_cancelled');

  await invokeAuth({
    action: 'passkey-register-verify',
    origin,
    challengeId: start.challengeId,
    response: serializeRegistrationCredential(credential),
    deviceLabel: navigator.userAgent.includes('iPhone') ? 'iPhone' : navigator.userAgent.includes('Android') ? 'Android' : 'جهاز موثوق',
  });

  return saveLoginAccount(saved, saved.identifier, { passkeyEnabled: true, lastUsedAt: new Date().toISOString() });
}

export async function loginWithPasskey(saved: SavedLoginAccount) {
  if (!(await isPlatformPasskeyAvailable())) throw new Error('passkey_not_supported');

  const origin = window.location.origin;
  const start = await invokeAuth({
    action: 'passkey-auth-options',
    userId: saved.userId,
    origin,
  });

  const credential = await navigator.credentials.get({
    publicKey: prepareAuthenticationOptions(start.options),
  }) as PublicKeyCredential | null;
  if (!credential) throw new Error('passkey_cancelled');

  const finish = await invokeAuth({
    action: 'passkey-auth-verify',
    userId: saved.userId,
    origin,
    challengeId: start.challengeId,
    response: serializeAuthenticationCredential(credential),
  });
  if (!finish?.tokenHash || !finish?.account) throw new Error('passkey_verification_failed');

  const { error } = await supabase.auth.verifyOtp({
    token_hash: String(finish.tokenHash),
    type: 'email',
  });
  if (error) throw error;

  const account = finish.account as AuthAccountPayload;
  const updated = saveLoginAccount(account, saved.identifier, {
    passkeyEnabled: true,
    lastUsedAt: new Date().toISOString(),
  });
  return { account, saved: updated, session: accountToSession(account, saved.identifier) };
}
