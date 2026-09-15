export type Row = Record<string, any>;

const text = (value: unknown) => String(value ?? '').trim();

export function isUniqueViolation(error: any): boolean {
  const code = text(error?.code);
  const message = text(error?.message || error);
  const status = Number(error?.status || error?.statusCode || 0);
  return code === '23505' || status === 409 || /duplicate key value|unique constraint/i.test(message);
}

export function canonicalizeSubscriberRows(rows: Row[], cloudRows: Row[]) {
  const codeToId = new Map<string, string>();
  for (const row of cloudRows) {
    const code = text(row.code);
    const id = text(row.id);
    if (code && id) codeToId.set(code, id);
  }

  const aliases = new Map<string, string>();
  const byId = new Map<string, Row>();
  for (const source of rows) {
    const row = { ...source };
    const localId = text(row.id);
    const code = text(row.code);
    let canonicalId = code ? codeToId.get(code) : undefined;
    if (!canonicalId) {
      canonicalId = localId;
      if (code && canonicalId) codeToId.set(code, canonicalId);
    }
    if (localId && canonicalId && localId !== canonicalId) aliases.set(localId, canonicalId);
    if (canonicalId) byId.set(canonicalId, { ...row, id: canonicalId });
  }
  return { rows: [...byId.values()], aliases };
}

export function remapInvoiceSubscriberIds(rows: Row[], aliases: Map<string, string>): Row[] {
  return rows.map(row => {
    const subscriberId = text(row.subscriber_id);
    const canonical = aliases.get(subscriberId);
    return canonical ? { ...row, subscriber_id: canonical } : { ...row };
  });
}

const invoiceScore = (row: Row) => {
  const statusRank: Record<string, number> = { paid: 4, partial: 3, unpaid: 2, free: 1 };
  return (statusRank[text(row.status)] || 0) * 1_000_000_000 + Math.max(0, Number(row.paid_amount || 0));
};

export function canonicalizeLiveInvoiceRows(rows: Row[], cloudLiveRows: Row[]): Row[] {
  const cloudByPeriod = new Map<string, string>();
  for (const row of cloudLiveRows) {
    if (text(row.status) === 'cancelled') continue;
    const subscriberId = text(row.subscriber_id);
    const monthId = text(row.month_id);
    const id = text(row.id);
    if (subscriberId && monthId && id) cloudByPeriod.set(`${subscriberId}|${monthId}`, id);
  }

  const localByPeriod = new Map<string, Row>();
  for (const source of rows) {
    if (text(source.status) === 'cancelled') continue;
    const key = `${text(source.subscriber_id)}|${text(source.month_id)}`;
    const current = localByPeriod.get(key);
    if (!current || invoiceScore(source) > invoiceScore(current) ||
      (invoiceScore(source) === invoiceScore(current) && text(source.id) > text(current.id))) {
      localByPeriod.set(key, { ...source });
    }
  }

  const byId = new Map<string, Row>();
  for (const [period, row] of localByPeriod) {
    const canonicalId = cloudByPeriod.get(period) || text(row.id);
    if (canonicalId) byId.set(canonicalId, { ...row, id: canonicalId });
  }
  return [...byId.values()];
}

export function canonicalizeTariffRows(rows: Row[], cloudRows: Row[]) {
  const periodToId = new Map<string, string>();
  for (const row of cloudRows) {
    const id = text(row.id);
    const year = Number(row.year);
    const month = Number(row.month);
    if (id && Number.isFinite(year) && Number.isFinite(month)) periodToId.set(`${year}-${month}`, id);
  }

  const aliases = new Map<string, string>();
  const byId = new Map<string, Row>();
  for (const source of rows) {
    const row = { ...source };
    const localId = text(row.id);
    const period = `${Number(row.year)}-${Number(row.month)}`;
    let canonicalId = periodToId.get(period);
    if (!canonicalId) {
      canonicalId = localId;
      if (canonicalId) periodToId.set(period, canonicalId);
    }
    if (localId && canonicalId && localId !== canonicalId) aliases.set(localId, canonicalId);
    if (canonicalId) byId.set(canonicalId, { ...row, id: canonicalId });
  }
  return { rows: [...byId.values()], aliases };
}
