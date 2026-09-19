-- Public subscriber account portal reached from the QR code printed on receipts.
-- The QR token is a 128-bit bearer secret. Direct table access remains blocked; the
-- only anonymous surface is get_public_subscriber_account(), which returns a strict
-- read-only allowlist and never exposes phone, address, notes, auth ids, or generator ids.

create table if not exists public.subscriber_portal_tokens (
  generator_id uuid not null,
  subscriber_id text not null,
  token uuid not null default gen_random_uuid(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (generator_id, subscriber_id),
  unique (token),
  constraint subscriber_portal_tokens_subscriber_fk
    foreign key (generator_id, subscriber_id)
    references public.generator_subscribers(generator_id, id)
    on delete cascade
);

alter table public.subscriber_portal_tokens enable row level security;
revoke all on table public.subscriber_portal_tokens from public, anon, authenticated;

create or replace function public.ensure_subscriber_portal_token(
  p_generator_id uuid,
  p_subscriber_id text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid;
  v_exists boolean;
begin
  if p_generator_id is null or coalesce(trim(p_subscriber_id), '') = '' then
    raise exception 'subscriber_required';
  end if;

  if auth.role() <> 'service_role'
     and not public.is_generator_admin_for(p_generator_id)
     and not (
       public.collector_has_permission(p_generator_id, 'canPrintReceipts')
       and public.collector_can_access_subscriber(p_generator_id, p_subscriber_id)
     )
  then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.generator_subscribers s
    where s.generator_id = p_generator_id
      and s.id = p_subscriber_id
  ) into v_exists;

  if not v_exists then
    raise exception 'subscriber_not_found';
  end if;

  insert into public.subscriber_portal_tokens(generator_id, subscriber_id, is_active, updated_at)
  values (p_generator_id, p_subscriber_id, true, now())
  on conflict (generator_id, subscriber_id)
  do update set is_active = true, updated_at = now()
  returning token into v_token;

  return v_token::text;
end;
$$;

revoke all on function public.ensure_subscriber_portal_token(uuid, text) from public, anon, authenticated;
grant execute on function public.ensure_subscriber_portal_token(uuid, text) to authenticated, service_role;

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

  select coalesce(jsonb_agg(to_jsonb(x) order by x.month_id desc, x.issue_date desc), '[]'::jsonb)
    into v_invoices
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
    order by i.month_id desc, i.updated_at desc nulls last, i.created_at desc
    limit 18
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.received_at desc), '[]'::jsonb),
         coalesce(sum(x.amount), 0)
    into v_payments, v_total_paid
  from (
    select
      p.received_at as "receivedAt",
      greatest(coalesce(p.amount, 0), 0) as amount,
      coalesce(p.receipt_number, '') as "receiptNumber"
    from public.generator_payments p
    where p.generator_id = v_generator_id
      and p.subscriber_id = v_subscriber_id
    order by p.received_at desc, p.created_at desc
    limit 20
  ) x;

  select coalesce(sum(greatest(coalesce(i.paid_amount, 0), 0)), 0)
    into v_invoice_paid
  from public.generator_invoices i
  where i.generator_id = v_generator_id
    and i.subscriber_id = v_subscriber_id
    and i.status <> 'cancelled';

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
      'lastPaymentDate', v_sub.last_payment_date
    ),
    'summary', jsonb_build_object(
      'totalOutstanding', greatest(coalesce(v_sub.amount_due, 0), 0),
      'currentMonthPaid', greatest(coalesce(v_sub.amount_paid, 0), 0),
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
  'Intentional anonymous bearer-token endpoint for QR receipts. Returns only a strict subscriber billing allowlist.';
