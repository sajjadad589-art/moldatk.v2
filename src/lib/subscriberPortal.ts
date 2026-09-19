import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

const FALLBACK_PUBLIC_ORIGIN = 'https://moldatk-v2-beta.vercel.app';

function publicOrigin() {
  const configured = String(import.meta.env.VITE_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;

  if (typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol) && window.location.hostname !== 'localhost') {
    return window.location.origin.replace(/\/+$/, '');
  }

  if (Capacitor.isNativePlatform()) return FALLBACK_PUBLIC_ORIGIN;
  return FALLBACK_PUBLIC_ORIGIN;
}

const cacheKey = (generatorId: string, subscriberId: string) =>
  `moldatk_subscriber_portal_${generatorId}_${subscriberId}`;

export interface SubscriberPortalLink {
  token: string;
  url: string;
  qrDataUrl: string;
  cached: boolean;
}

function readCached(generatorId: string, subscriberId: string) {
  try {
    const raw = localStorage.getItem(cacheKey(generatorId, subscriberId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { token?: string; url?: string };
    if (!parsed?.token || !parsed?.url) return null;
    return { token: parsed.token, url: parsed.url };
  } catch {
    return null;
  }
}

function writeCached(generatorId: string, subscriberId: string, token: string, url: string) {
  try {
    localStorage.setItem(cacheKey(generatorId, subscriberId), JSON.stringify({ token, url }));
  } catch {}
}

export async function makeSubscriberPortalQr(url: string): Promise<string> {
  const { default: QRCode } = await import('qrcode');
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
}

export async function ensureSubscriberPortalLink(
  generatorId: string,
  subscriberId: string,
): Promise<SubscriberPortalLink> {
  const cached = readCached(generatorId, subscriberId);

  if (!navigator.onLine && cached) {
    return {
      ...cached,
      qrDataUrl: await makeSubscriberPortalQr(cached.url),
      cached: true,
    };
  }

  const { data, error } = await supabase.rpc('ensure_subscriber_portal_token', {
    p_generator_id: generatorId,
    p_subscriber_id: subscriberId,
  });

  if (error) {
    if (cached) {
      return {
        ...cached,
        qrDataUrl: await makeSubscriberPortalQr(cached.url),
        cached: true,
      };
    }
    throw error;
  }

  const token = String(data || '').trim();
  if (!token) throw new Error('Subscriber portal token was not returned.');

  const url = `${publicOrigin()}/s/${encodeURIComponent(token)}`;
  writeCached(generatorId, subscriberId, token, url);

  return {
    token,
    url,
    qrDataUrl: await makeSubscriberPortalQr(url),
    cached: false,
  };
}


export interface SubscriberReceiptSnapshot {
  monthId?: string;
  monthNameAr?: string;
  issueDate?: string;
  paymentDate?: string;
  amperes?: number;
  totalAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  status?: string;
  receiptNumber?: string;
  collectorName?: string;
  previousDebtBefore?: number;
  currentCharge?: number;
  totalBeforePayment?: number;
  appliedToPreviousDebt?: number;
  appliedToCurrentMonth?: number;
  totalOutstandingAfter?: number;
  paymentAllocations?: Array<{ monthId?: string; monthNameAr?: string; amount?: number }>;
  notes?: string;
}

export async function recordSubscriberReceiptPayment(args: {
  generatorId: string;
  subscriberId: string;
  receiptNumber: string;
  amount: number;
  receivedAt: string;
  collectorName?: string;
  snapshot: SubscriberReceiptSnapshot;
}) {
  const receiptNumber = String(args.receiptNumber || '').trim();
  if (!args.generatorId || !args.subscriberId || !receiptNumber) return;

  const row = {
    generator_id: args.generatorId,
    id: `receipt-${receiptNumber}`,
    subscriber_id: args.subscriberId,
    received_at: args.receivedAt || new Date().toISOString(),
    amount: Math.max(0, Math.round(Number(args.amount) || 0)),
    collector_name: String(args.collectorName || args.snapshot.collectorName || 'الإدارة العامة'),
    receipt_number: receiptNumber,
    notes: args.snapshot.notes || null,
    receipt_snapshot: args.snapshot,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('generator_payments')
    .upsert(row, { onConflict: 'generator_id,receipt_number' });

  if (error) throw error;
}
