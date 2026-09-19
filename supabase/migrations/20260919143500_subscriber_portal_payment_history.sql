-- Complete subscriber QR portal history without changing accounting semantics.
-- Exact future receipts are stored in generator_payments.receipt_snapshot.
-- Legacy history remains read-only and is reconstructed from invoices/audit logs.

alter table public.generator_payments
  add column if not exists receipt_snapshot jsonb;

create index if not exists generator_payments_subscriber_received_idx
  on public.generator_payments(generator_id, subscriber_id, received_at desc);

create or replace function public.get_public_subscriber_account(p_token uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_generator_id uuid;
  v_subscriber_id text;
  v_sub public.generator_subscribers%rowtype;
  v_specs jsonb := '{}'::jsonb;
  v_current jsonb := null;
  v_invoices jsonb := '[]'::jsonb;
  v_payments jsonb := '[]'::jsonb;
  v_total_paid bigint := 0;
  v_invoice_paid bigint := 0;
  v_last_payment timestamptz := null;
begin
  select t.generator_id, t.subscriber_id
    into v_generator_id, v_subscriber_id
  from public.subscriber_portal_tokens t
  where t.token = p_token
    and t.is_active = true
  limit 1;

  if v_generator_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select s.*
    into v_sub
  from public.generator_subscribers s
  where s.generator_id = v_generator_id
    and s.id = v_subscriber_id
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select coalesce(gs.specs, '{}'::jsonb)
    into v_specs
  from public.generator_settings gs
  where gs.generator_id = v_generator_id
  limit 1;

  -- Prefer the canonical invoice row. If older data only exists in monthly accounts,
  -- expose that row as a read-only fallback.
  select jsonb_build_object(
      'monthId', i.month_id,
      'monthNameAr', i.month_name_ar,
      'issueDate', i.issue_date,
      'paymentDate', i.payment_date,
      'amperes', i.amperes,
      'totalAmount', greatest(coalesce(i.total_amount, 0), 0),
      'paidAmount', greatest(coalesce(i.paid_amount, 0), 0),
      'remainingAmount', greatest(coalesce(i.remaining_amount, 0), 0),
      'status', i.status,
      'receiptNumber', coalesce(i.receipt_number, '')
    )
    into v_current
  from public.generator_invoices i
  where i.generator_id = v_generator_id
    and i.subscriber_id = v_subscriber_id
    and i.status <> 'cancelled'
  order by i.month_id desc, i.updated_at desc nulls last, i.created_at desc
  limit 1;

  if v_current is null then
    select jsonb_build_object(
        'monthId', a.month_id,
        'monthNameAr', a.month_name_ar,
        'issueDate', a.created_at,
        'paymentDate', case when coalesce(a.paid_amount, 0) > 0 then a.updated_at else null end,
        'amperes', a.amperes,
        'totalAmount', greatest(coalesce(a.month_charge, 0), 0),
        'paidAmount', greatest(coalesce(a.paid_amount, 0), 0),
        'remainingAmount', greatest(coalesce(a.remaining_amount, 0), 0),
        'status', a.status,
        'receiptNumber', ''
      )
      into v_current
    from public.generator_monthly_accounts a
    where a.generator_id = v_generator_id
      and a.subscriber_id = v_subscriber_id
    order by a.month_id desc, a.updated_at desc nulls last, a.created_at desc
    limit 1;
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x."monthId" desc, x."issueDate" desc), '[]'::jsonb)
    into v_invoices
  from (
    select *
    from (
      select
        i.month_id as "monthId",
        i.month_name_ar as "monthNameAr",
        i.issue_date as "issueDate",
        i.payment_date as "paymentDate",
        i.amperes,
        greatest(coalesce(i.total_amount, 0), 0) as "totalAmount",
        greatest(coalesce(i.paid_amount, 0), 0) as "paidAmount",
        greatest(coalesce(i.remaining_amount, 0), 0) as "remainingAmount",
        i.status,
        coalesce(i.receipt_number, '') as "receiptNumber"
      from public.generator_invoices i
      where i.generator_id = v_generator_id
        and i.subscriber_id = v_subscriber_id
        and i.status <> 'cancelled'

      union all

      select
        a.month_id as "monthId",
        a.month_name_ar as "monthNameAr",
        a.created_at as "issueDate",
        case when coalesce(a.paid_amount, 0) > 0 then a.updated_at else null end as "paymentDate",
        a.amperes,
        greatest(coalesce(a.month_charge, 0), 0) as "totalAmount",
        greatest(coalesce(a.paid_amount, 0), 0) as "paidAmount",
        greatest(coalesce(a.remaining_amount, 0), 0) as "remainingAmount",
        a.status,
        ''::text as "receiptNumber"
      from public.generator_monthly_accounts a
      where a.generator_id = v_generator_id
        and a.subscriber_id = v_subscriber_id
        and not exists (
          select 1
          from public.generator_invoices i2
          where i2.generator_id = a.generator_id
            and i2.subscriber_id = a.subscriber_id
            and i2.month_id = a.month_id
            and i2.status <> 'cancelled'
        )
    ) all_rows
    order by "monthId" desc, "issueDate" desc
    limit 18
  ) x;

  -- Exact receipt ledger + paid invoice fallback + old audit history.
  -- New audit rows matching a persisted receipt are suppressed to avoid duplicates.
  select coalesce(jsonb_agg(to_jsonb(x) order by x."receivedAt" desc), '[]'::jsonb)
    into v_payments
  from (
    select *
    from (
      select
        p.received_at as "receivedAt",
        greatest(coalesce(p.amount, 0), 0) as amount,
        coalesce(p.receipt_number, '') as "receiptNumber",
        coalesce(p.collector_name, '') as "collectorName",
        'receipt'::text as source,
        'وصل تسديد'::text as title,
        false as cancelled,
        p.receipt_snapshot as "receiptSnapshot"
      from public.generator_payments p
      where p.generator_id = v_generator_id
        and p.subscriber_id = v_subscriber_id

      union all

      select
        coalesce(i.payment_date, i.updated_at, i.created_at) as "receivedAt",
        greatest(coalesce(i.paid_amount, 0), 0) as amount,
        coalesce(i.receipt_number, '') as "receiptNumber",
        coalesce(i.collector_name, '') as "collectorName",
        'invoice'::text as source,
        'وصل مسدد محفوظ بالفاتورة'::text as title,
        false as cancelled,
        jsonb_build_object(
          'monthId', i.month_id,
          'monthNameAr', i.month_name_ar,
          'issueDate', i.issue_date,
          'paymentDate', i.payment_date,
          'amperes', i.amperes,
          'totalAmount', greatest(coalesce(i.total_amount, 0), 0),
          'paidAmount', greatest(coalesce(i.paid_amount, 0), 0),
          'remainingAmount', greatest(coalesce(i.remaining_amount, 0), 0),
          'status', i.status,
          'receiptNumber', coalesce(i.receipt_number, ''),
          'collectorName', coalesce(i.collector_name, '')
        ) as "receiptSnapshot"
      from public.generator_invoices i
      where i.generator_id = v_generator_id
        and i.subscriber_id = v_subscriber_id
        and i.status <> 'cancelled'
        and greatest(coalesce(i.paid_amount, 0), 0) > 0
        and coalesce(trim(i.receipt_number), '') <> ''
        and not exists (
          select 1
          from public.generator_payments p2
          where p2.generator_id = i.generator_id
            and p2.subscriber_id = i.subscriber_id
            and p2.receipt_number = i.receipt_number
        )

      union all

      select
        a.timestamp as "receivedAt",
        greatest(coalesce(a.amount, 0), 0) as amount,
        ''::text as "receiptNumber",
        coalesce(a.actor_name, '') as "collectorName",
        'audit'::text as source,
        coalesce(a.title, case when a.category = 'cancellation' then 'إلغاء تسديد' else 'تسديد سابق' end) as title,
        (a.category = 'cancellation') as cancelled,
        null::jsonb as "receiptSnapshot"
      from public.generator_audit_logs a
      where a.generator_id = v_generator_id
        and a.entity_id = v_subscriber_id
        and a.category in ('payment', 'cancellation')
        and (
          a.category = 'cancellation'
          or not exists (
            select 1
            from public.generator_payments p3
            where p3.generator_id = a.generator_id
              and p3.subscriber_id = a.entity_id
              and p3.amount = greatest(coalesce(a.amount, 0), 0)
              and abs(extract(epoch from (p3.received_at - a.timestamp))) <= 600
          )
        )
    ) all_payments
    order by "receivedAt" desc
    limit 30
  ) x;

  select coalesce(sum(greatest(coalesce(p.amount, 0), 0)), 0),
         max(p.received_at)
    into v_total_paid, v_last_payment
  from public.generator_payments p
  where p.generator_id = v_generator_id
    and p.subscriber_id = v_subscriber_id;

  select greatest(
      coalesce(v_invoice_paid, 0),
      coalesce(sum(greatest(coalesce(i.paid_amount, 0), 0)), 0)
    )
    into v_invoice_paid
  from public.generator_invoices i
  where i.generator_id = v_generator_id
    and i.subscriber_id = v_subscriber_id
    and i.status <> 'cancelled';

  if v_last_payment is null then
    select max(i.payment_date)
      into v_last_payment
    from public.generator_invoices i
    where i.generator_id = v_generator_id
      and i.subscriber_id = v_subscriber_id
      and i.status <> 'cancelled'
      and greatest(coalesce(i.paid_amount, 0), 0) > 0;
  end if;

  if v_last_payment is null then
    select max(a.timestamp)
      into v_last_payment
    from public.generator_audit_logs a
    where a.generator_id = v_generator_id
      and a.entity_id = v_subscriber_id
      and a.category = 'payment'
      and greatest(coalesce(a.amount, 0), 0) > 0;
  end if;

  return jsonb_build_object(
    'ok', true,
    'generator', jsonb_build_object(
      'name', coalesce(nullif(v_specs->>'generatorName', ''), 'المولدة'),
      'currency', coalesce(nullif(v_specs->>'currency', ''), 'د.ع')
    ),
    'subscriber', jsonb_build_object(
      'name', v_sub.full_name,
      'code', v_sub.code,
      'lineName', coalesce(v_sub.line_name, ''),
      'amperes', greatest(coalesce(v_sub.amperes, 0), 0),
      'ampereDiscount', greatest(coalesce(v_sub.ampere_discount, 0), 0),
      'paymentStatus', v_sub.payment_status,
      'lastPaymentDate', coalesce(v_sub.last_payment_date, v_last_payment)
    ),
    'summary', jsonb_build_object(
      'totalOutstanding', greatest(coalesce(v_sub.amount_due, 0), 0),
      'currentMonthPaid', greatest(
        coalesce(v_sub.amount_paid, 0),
        coalesce((v_current->>'paidAmount')::bigint, 0),
        0
      ),
      'totalPaidRecorded', greatest(v_total_paid, v_invoice_paid, 0)
    ),
    'currentMonth', v_current,
    'invoices', v_invoices,
    'payments', v_payments,
    'generatedAt', now()
  );
end;
$$;

revoke all on function public.get_public_subscriber_account(uuid) from public, anon, authenticated;
grant execute on function public.get_public_subscriber_account(uuid) to anon, authenticated, service_role;

comment on function public.get_public_subscriber_account(uuid) is
  'Read-only QR portal. Returns exact receipt ledger, invoice/monthly fallbacks, and legacy payment audit history.';
