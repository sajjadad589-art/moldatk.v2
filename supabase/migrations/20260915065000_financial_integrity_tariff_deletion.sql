-- Financial integrity hardening for monthly ledgers.
-- Invariants:
-- 1) generator_invoices.remaining_amount is ONLY that invoice/month remaining amount.
-- 2) historical debt is represented by historical invoices, never copied into a newer invoice's remaining_amount.
-- 3) deleting a tariff extinguishes every unpaid liability created by that tariff.
--    Real money already received remains in audit/payment history and any paid invoice is retained as settled history.
-- 4) subscriber.amount_due is the sum of surviving non-cancelled monthly invoice balances.

create schema if not exists moldatk_private;
revoke all on schema moldatk_private from public;
grant usage on schema moldatk_private to authenticated;

create or replace function moldatk_private.refresh_generator_subscriber_balances(p_generator_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active_tariff text;
begin
  select id into v_active_tariff
  from public.generator_monthly_tariffs
  where generator_id = p_generator_id and is_current_active
  order by created_at desc
  limit 1;

  update public.generator_subscribers s
  set amount_due = case
        when s.tier='free' or s.is_exempted then 0
        else coalesce((
          select sum(greatest(coalesce(i.remaining_amount,0),0))::bigint
          from public.generator_invoices i
          where i.generator_id=s.generator_id and i.subscriber_id=s.id
            and i.status not in ('cancelled','free')
        ),0)
      end,
      amount_paid = case
        when s.tier='free' or s.is_exempted or v_active_tariff is null then 0
        else coalesce((
          select least(greatest(coalesce(i.paid_amount,0),0), greatest(coalesce(i.total_amount,0),0))
          from public.generator_invoices i
          where i.generator_id=s.generator_id and i.subscriber_id=s.id
            and i.month_id=v_active_tariff and i.status<>'cancelled'
          order by i.created_at desc limit 1
        ),0)
      end,
      payment_status = case
        when s.tier='free' or s.is_exempted then 'free'
        when coalesce((
          select sum(greatest(coalesce(i.remaining_amount,0),0))
          from public.generator_invoices i
          where i.generator_id=s.generator_id and i.subscriber_id=s.id
            and i.status not in ('cancelled','free')
        ),0) = 0 then case when v_active_tariff is null then 'unpaid' else 'paid' end
        when exists (
          select 1 from public.generator_invoices i
          where i.generator_id=s.generator_id and i.subscriber_id=s.id
            and i.status not in ('cancelled','free')
            and coalesce(i.paid_amount,0)>0 and coalesce(i.remaining_amount,0)>0
        ) then 'partial'
        else 'unpaid'
      end,
      updated_at=now()
  where s.generator_id=p_generator_id;
end;
$$;
revoke all on function moldatk_private.refresh_generator_subscriber_balances(uuid) from public,anon,authenticated;

create or replace function public.reconcile_generator_monthly_cycle(p_generator_id uuid, p_tariff_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tariff public.generator_monthly_tariffs%rowtype;
  v_count integer := 0;
  v_paid integer := 0;
  v_partial integer := 0;
  v_unpaid integer := 0;
  v_free integer := 0;
  v_total_due bigint := 0;
begin
  if auth.uid() is null or not public.is_generator_admin_for(p_generator_id) then
    raise exception 'not_authorized' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_generator_id::text, 89142));

  select * into v_tariff
  from public.generator_monthly_tariffs
  where generator_id=p_generator_id and id=p_tariff_id
  limit 1;
  if v_tariff.id is null then raise exception 'tariff_not_found'; end if;

  create temporary table if not exists _moldatk_cycle_integrity (
    subscriber_id text primary key,
    tier text,
    amperes integer,
    discount_amps numeric,
    billed_amps numeric,
    price_per_ampere bigint,
    fixed_fee bigint,
    gross_amount bigint,
    discount_amount bigint,
    month_charge bigint,
    carried_debt bigint,
    current_invoice_id text,
    current_paid bigint,
    current_payment_date date,
    preserved_notes text,
    is_free boolean,
    current_status text,
    current_remaining bigint,
    total_remaining bigint
  ) on commit drop;
  truncate _moldatk_cycle_integrity;

  insert into _moldatk_cycle_integrity
  select
    s.id,
    s.tier,
    s.amperes,
    case when s.tier='free' or s.is_exempted then 0 else least(greatest(coalesce(s.ampere_discount,0),0),greatest(s.amperes,0)) end,
    case when s.tier='free' or s.is_exempted then 0 else greatest(s.amperes-least(greatest(coalesce(s.ampere_discount,0),0),greatest(s.amperes,0)),0) end,
    case when s.tier='free' or s.is_exempted then 0 when coalesce(cur.is_lump,false) or coalesce(cur.is_no_charge,false) then coalesce(cur.price_per_ampere,0) else coalesce(price.ppa,0) end,
    case when s.tier='free' or s.is_exempted then 0 when coalesce(cur.is_lump,false) or coalesce(cur.is_no_charge,false) then coalesce(cur.fixed_fee,0) else coalesce(price.fee,0) end,
    case when s.tier='free' or s.is_exempted then 0 when coalesce(cur.is_lump,false) or coalesce(cur.is_no_charge,false) then coalesce(cur.total_amount,0) else greatest(s.amperes,0)*coalesce(price.ppa,0)+coalesce(price.fee,0) end,
    case when s.tier='free' or s.is_exempted or coalesce(cur.is_lump,false) or coalesce(cur.is_no_charge,false) then 0 else least(greatest(coalesce(s.ampere_discount,0),0),greatest(s.amperes,0))*coalesce(price.ppa,0) end,
    case
      when s.tier='free' or s.is_exempted or coalesce(cur.is_no_charge,false) then 0
      when coalesce(cur.is_lump,false) then greatest(coalesce(cur.total_amount,0),0)
      else greatest(s.amperes-least(greatest(coalesce(s.ampere_discount,0),0),greatest(s.amperes,0)),0)*coalesce(price.ppa,0)+coalesce(price.fee,0)
    end,
    coalesce(hist.carried,0),
    cur.id,
    case
      when s.tier='free' or s.is_exempted or coalesce(cur.is_no_charge,false) then 0
      else least(greatest(coalesce(cur.paid_amount,0),0),
        case when coalesce(cur.is_lump,false) then greatest(coalesce(cur.total_amount,0),0)
             else greatest(s.amperes-least(greatest(coalesce(s.ampere_discount,0),0),greatest(s.amperes,0)),0)*coalesce(price.ppa,0)+coalesce(price.fee,0) end)
    end,
    cur.payment_date,
    cur.notes,
    (s.tier='free' or s.is_exempted),
    case
      when s.tier='free' or s.is_exempted then 'free'
      when (case when coalesce(cur.is_no_charge,false) then 0 when coalesce(cur.is_lump,false) then greatest(coalesce(cur.total_amount,0),0) else greatest(s.amperes-least(greatest(coalesce(s.ampere_discount,0),0),greatest(s.amperes,0)),0)*coalesce(price.ppa,0)+coalesce(price.fee,0) end) <= 0 then 'paid'
      when greatest(coalesce(cur.paid_amount,0),0) <= 0 then 'unpaid'
      when greatest(coalesce(cur.paid_amount,0),0) >= (case when coalesce(cur.is_lump,false) then greatest(coalesce(cur.total_amount,0),0) else greatest(s.amperes-least(greatest(coalesce(s.ampere_discount,0),0),greatest(s.amperes,0)),0)*coalesce(price.ppa,0)+coalesce(price.fee,0) end) then 'paid'
      else 'partial'
    end,
    greatest(
      (case when s.tier='free' or s.is_exempted or coalesce(cur.is_no_charge,false) then 0 when coalesce(cur.is_lump,false) then greatest(coalesce(cur.total_amount,0),0) else greatest(s.amperes-least(greatest(coalesce(s.ampere_discount,0),0),greatest(s.amperes,0)),0)*coalesce(price.ppa,0)+coalesce(price.fee,0) end)
      - least(greatest(coalesce(cur.paid_amount,0),0),(case when coalesce(cur.is_lump,false) then greatest(coalesce(cur.total_amount,0),0) else greatest(s.amperes-least(greatest(coalesce(s.ampere_discount,0),0),greatest(s.amperes,0)),0)*coalesce(price.ppa,0)+coalesce(price.fee,0) end)),0),
    coalesce(hist.carried,0) + greatest(
      (case when s.tier='free' or s.is_exempted or coalesce(cur.is_no_charge,false) then 0 when coalesce(cur.is_lump,false) then greatest(coalesce(cur.total_amount,0),0) else greatest(s.amperes-least(greatest(coalesce(s.ampere_discount,0),0),greatest(s.amperes,0)),0)*coalesce(price.ppa,0)+coalesce(price.fee,0) end)
      - least(greatest(coalesce(cur.paid_amount,0),0),(case when coalesce(cur.is_lump,false) then greatest(coalesce(cur.total_amount,0),0) else greatest(s.amperes-least(greatest(coalesce(s.ampere_discount,0),0),greatest(s.amperes,0)),0)*coalesce(price.ppa,0)+coalesce(price.fee,0) end)),0)
  from public.generator_subscribers s
  left join lateral (
    select coalesce((j->>'pricePerAmpere')::bigint,0) ppa,coalesce((j->>'fixedFee')::bigint,0) fee
    from jsonb_array_elements(v_tariff.tiers) j
    where j->>'type'=s.tier or j->>'id'=s.tier
    limit 1
  ) price on true
  left join lateral (
    select i.id,i.paid_amount,i.payment_date,i.total_amount,i.price_per_ampere,i.fixed_fee,i.notes,
           position('MOLDATK_LUMP_SETTLEMENT' in coalesce(i.notes,''))>0 is_lump,
           position('MOLDATK_ONBOARDING_NO_CURRENT_CHARGE' in coalesce(i.notes,''))>0 is_no_charge
    from public.generator_invoices i
    where i.generator_id=s.generator_id and i.subscriber_id=s.id and i.month_id=v_tariff.id
      and i.status<>'cancelled' and i.created_at>=v_tariff.created_at
    order by i.created_at desc limit 1
  ) cur on true
  left join lateral (
    select coalesce(sum(greatest(coalesce(i.remaining_amount,0),0)),0)::bigint carried
    from public.generator_invoices i
    where i.generator_id=s.generator_id and i.subscriber_id=s.id and i.status not in ('cancelled','free')
      and i.month_id<>v_tariff.id
      and exists(select 1 from public.generator_monthly_tariffs ht where ht.generator_id=i.generator_id and ht.id=i.month_id and ht.created_at<v_tariff.created_at)
  ) hist on true
  where s.generator_id=p_generator_id;

  update public.generator_invoices
  set status='cancelled',
      cancellation_reason=coalesce(cancellation_reason,'مؤرشف تلقائياً عند بدء دورة تسعيرة جديدة لنفس الشهر'),
      cancelled_at=coalesce(cancelled_at,now()),
      cancelled_by=coalesce(cancelled_by,'monthly-cycle-reconcile'),updated_at=now()
  where generator_id=p_generator_id and month_id=v_tariff.id and status<>'cancelled' and created_at<v_tariff.created_at;

  insert into public.generator_invoices (
    id,generator_id,subscriber_id,month_id,month_name_ar,issue_date,payment_date,amperes,tier,
    price_per_ampere,fixed_fee,total_amount,paid_amount,remaining_amount,status,notes,receipt_number,
    previous_debt,current_month_charge,total_before_payment,allocated_previous_debt,allocated_current_month,
    remaining_after_payment,original_amperes,discounted_amperes,billed_amperes,gross_amount_before_discount,
    discount_amount,updated_at
  )
  select
    coalesce(c.current_invoice_id,'cycle-'||v_tariff.id||'-'||substr(md5(v_tariff.created_at::text),1,8)||'-'||s.id),
    p_generator_id,s.id,v_tariff.id,v_tariff.month_name_ar,v_tariff.created_at::date,c.current_payment_date,s.amperes,s.tier,
    c.price_per_ampere,c.fixed_fee,c.month_charge,c.current_paid,c.current_remaining,c.current_status,
    case when c.preserved_notes like '%MOLDATK_LUMP_SETTLEMENT%' or c.preserved_notes like '%MOLDATK_ONBOARDING_NO_CURRENT_CHARGE%' then c.preserved_notes when c.carried_debt>0 then 'دين سابق مرحل: '||c.carried_debt else null end,
    'ACC-'||v_tariff.id||'-'||coalesce(s.code,s.id),c.carried_debt,c.month_charge,c.carried_debt+c.month_charge,
    0,c.current_paid,c.total_remaining,s.amperes,c.discount_amps,c.billed_amps,c.gross_amount,c.discount_amount,now()
  from _moldatk_cycle_integrity c
  join public.generator_subscribers s on s.generator_id=p_generator_id and s.id=c.subscriber_id
  on conflict (generator_id,id) do update set
    month_name_ar=excluded.month_name_ar,amperes=excluded.amperes,tier=excluded.tier,
    price_per_ampere=excluded.price_per_ampere,fixed_fee=excluded.fixed_fee,total_amount=excluded.total_amount,
    paid_amount=excluded.paid_amount,remaining_amount=excluded.remaining_amount,status=excluded.status,notes=excluded.notes,
    previous_debt=excluded.previous_debt,current_month_charge=excluded.current_month_charge,total_before_payment=excluded.total_before_payment,
    allocated_current_month=excluded.allocated_current_month,remaining_after_payment=excluded.remaining_after_payment,
    original_amperes=excluded.original_amperes,discounted_amperes=excluded.discounted_amperes,billed_amperes=excluded.billed_amperes,
    gross_amount_before_discount=excluded.gross_amount_before_discount,discount_amount=excluded.discount_amount,updated_at=now();

  insert into public.generator_monthly_accounts (
    generator_id,id,subscriber_id,month_id,month,year,month_name_ar,tariff_id,subscriber_name,subscriber_code,
    subscriber_phone,line_name,tier,amperes,price_per_ampere,fixed_fee,month_charge,carried_debt,paid_amount,
    remaining_amount,status,is_exempted,exempt_reason,updated_at
  )
  select p_generator_id,'acct-'||v_tariff.id||'-'||s.id,s.id,v_tariff.id,v_tariff.month,v_tariff.year,v_tariff.month_name_ar,v_tariff.id,
    s.full_name,coalesce(s.code,s.id),s.phone,s.line_name,s.tier,s.amperes,c.price_per_ampere,c.fixed_fee,c.month_charge,c.carried_debt,
    c.current_paid,c.total_remaining,
    case when c.is_free then 'free' when c.total_remaining=0 then 'paid' when c.current_paid>0 then 'partial' else 'unpaid' end,
    (s.tier='free' or s.is_exempted),s.exempt_reason,now()
  from _moldatk_cycle_integrity c
  join public.generator_subscribers s on s.generator_id=p_generator_id and s.id=c.subscriber_id
  on conflict (generator_id,subscriber_id,month_id) do update set
    tariff_id=excluded.tariff_id,subscriber_name=excluded.subscriber_name,subscriber_code=excluded.subscriber_code,
    subscriber_phone=excluded.subscriber_phone,line_name=excluded.line_name,tier=excluded.tier,amperes=excluded.amperes,
    price_per_ampere=excluded.price_per_ampere,fixed_fee=excluded.fixed_fee,month_charge=excluded.month_charge,
    carried_debt=excluded.carried_debt,paid_amount=excluded.paid_amount,remaining_amount=excluded.remaining_amount,status=excluded.status,
    is_exempted=excluded.is_exempted,exempt_reason=excluded.exempt_reason,updated_at=now();

  perform moldatk_private.refresh_generator_subscriber_balances(p_generator_id);

  select count(*),count(*) filter(where current_status='paid'),count(*) filter(where current_status='partial'),
         count(*) filter(where current_status='unpaid'),count(*) filter(where current_status='free'),coalesce(sum(total_remaining),0)::bigint
  into v_count,v_paid,v_partial,v_unpaid,v_free,v_total_due
  from _moldatk_cycle_integrity;

  return jsonb_build_object('ok',true,'generator_id',p_generator_id,'tariff_id',v_tariff.id,'subscribers',v_count,
    'paid',v_paid,'partial',v_partial,'unpaid',v_unpaid,'free',v_free,'total_due',v_total_due);
end;
$$;
revoke all on function public.reconcile_generator_monthly_cycle(uuid,text) from public,anon;
grant execute on function public.reconcile_generator_monthly_cycle(uuid,text) to authenticated;

create or replace function public.delete_generator_tariff_month(p_generator_id uuid,p_tariff_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tariff public.generator_monthly_tariffs%rowtype;
  v_had_tariff boolean := false;
  v_unpaid_removed integer := 0;
  v_paid_preserved integer := 0;
  v_forgiven bigint := 0;
begin
  if auth.uid() is null or not public.is_generator_admin_for(p_generator_id) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  if coalesce(trim(p_tariff_id),'')='' then raise exception 'tariff_id_required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_generator_id::text,89142));
  select * into v_tariff from public.generator_monthly_tariffs
  where generator_id=p_generator_id and id=p_tariff_id limit 1;
  v_had_tariff := v_tariff.id is not null;

  select coalesce(sum(greatest(coalesce(remaining_amount,0),0)),0)::bigint into v_forgiven
  from public.generator_invoices
  where generator_id=p_generator_id and month_id=p_tariff_id and status not in ('cancelled','free');

  update public.generator_invoices
  set notes=concat_ws(' | ',nullif(notes,''),'MOLDATK_TARIFF_DELETED_SETTLED_HISTORY|forgiven='||greatest(coalesce(remaining_amount,0)),
      total_amount=greatest(coalesce(paid_amount,0),0),remaining_amount=0,status='paid',remaining_after_payment=0,updated_at=now()
  where generator_id=p_generator_id and month_id=p_tariff_id and status<>'cancelled' and coalesce(paid_amount,0)>0;
  get diagnostics v_paid_preserved = row_count;

  delete from public.generator_invoices
  where generator_id=p_generator_id and month_id=p_tariff_id and status<>'cancelled' and coalesce(paid_amount,0)=0;
  get diagnostics v_unpaid_removed = row_count;

  update public.generator_monthly_accounts
  set month_charge=greatest(coalesce(paid_amount,0),0),carried_debt=0,remaining_amount=0,
      status=case when is_exempted then 'free' else 'paid' end,updated_at=now()
  where generator_id=p_generator_id and month_id=p_tariff_id and coalesce(paid_amount,0)>0;

  delete from public.generator_monthly_accounts
  where generator_id=p_generator_id and month_id=p_tariff_id and coalesce(paid_amount,0)=0;

  delete from public.generator_monthly_tariffs where generator_id=p_generator_id and id=p_tariff_id;

  perform moldatk_private.refresh_generator_subscriber_balances(p_generator_id);

  return jsonb_build_object('ok',true,'generator_id',p_generator_id,'tariff_id',p_tariff_id,'had_tariff',v_had_tariff,
    'unpaid_rows_removed',v_unpaid_removed,'paid_history_preserved',v_paid_preserved,'forgiven_liability',v_forgiven);
end;
$$;
revoke all on function public.delete_generator_tariff_month(uuid,text) from public,anon;
grant execute on function public.delete_generator_tariff_month(uuid,text) to authenticated;

-- Repair legacy orphan liabilities left by tariffs deleted by older application versions.
-- Paid rows are kept as settled history; unpaid rows disappear with their deleted tariff.
update public.generator_invoices i
set notes=concat_ws(' | ',nullif(i.notes,''),'MOLDATK_TARIFF_DELETED_SETTLED_HISTORY|forgiven='||greatest(coalesce(i.remaining_amount,0)),
    total_amount=greatest(coalesce(i.paid_amount,0),0),remaining_amount=0,status='paid',remaining_after_payment=0,updated_at=now()
where i.status<>'cancelled' and coalesce(i.paid_amount,0)>0
  and not exists(select 1 from public.generator_monthly_tariffs t where t.generator_id=i.generator_id and t.id=i.month_id);

delete from public.generator_invoices i
where i.status<>'cancelled' and coalesce(i.paid_amount,0)=0
  and not exists(select 1 from public.generator_monthly_tariffs t where t.generator_id=i.generator_id and t.id=i.month_id);

update public.generator_monthly_accounts a
set month_charge=greatest(coalesce(a.paid_amount,0),0),carried_debt=0,remaining_amount=0,
    status=case when a.is_exempted then 'free' else 'paid' end,updated_at=now()
where coalesce(a.paid_amount,0)>0
  and not exists(select 1 from public.generator_monthly_tariffs t where t.generator_id=a.generator_id and t.id=a.month_id);

delete from public.generator_monthly_accounts a
where coalesce(a.paid_amount,0)=0
  and not exists(select 1 from public.generator_monthly_tariffs t where t.generator_id=a.generator_id and t.id=a.month_id);

-- Restore the per-invoice invariant for all surviving monthly invoices. Historical cash/audit rows are untouched.
update public.generator_invoices i
set remaining_amount=greatest(coalesce(i.total_amount,0)-least(coalesce(i.paid_amount,0),coalesce(i.total_amount,0)),0),updated_at=now()
where i.status not in ('cancelled','free')
  and exists(select 1 from public.generator_monthly_tariffs t where t.generator_id=i.generator_id and t.id=i.month_id)
  and i.remaining_amount<>greatest(coalesce(i.total_amount,0)-least(coalesce(i.paid_amount,0),coalesce(i.total_amount,0)),0);

-- Recalculate subscriber balances from surviving invoice ledgers for every generator.
do $$
declare r record;
begin
  for r in select id from public.generators loop
    perform moldatk_private.refresh_generator_subscriber_balances(r.id);
  end loop;
end $$;
