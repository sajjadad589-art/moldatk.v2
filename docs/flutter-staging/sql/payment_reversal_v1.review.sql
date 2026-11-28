-- PRIVATE REVIEW ONLY: reversal of a verified Flutter payment, latest only.
-- Preserve original payment and allocations. Portal must learn reversal status before launch.
begin;
create table moldatk_private.flutter_payment_reversals(
 generator_id uuid not null references public.generators(id) on delete cascade,
 payment_id text not null, actor_id uuid not null, request_id uuid not null,
 epoch bigint not null, fingerprint text not null, receipt jsonb not null,
 primary key(generator_id,payment_id), unique(generator_id,actor_id,request_id)
);
alter table moldatk_private.flutter_payment_reversals enable row level security;
revoke all on moldatk_private.flutter_payment_reversals from public,anon,authenticated,service_role;
create function moldatk_private.flutter_reverse_payment_v1(p_command jsonb,p_expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); gid uuid; actor_name text; access_state jsonb; epoch_now bigint;
 rid uuid; pid text; reason text; fingerprint text; sid text; month_now text;
 original moldatk_private.flutter_payment_requests%rowtype;
 prior moldatk_private.flutter_payment_reversals%rowtype;
 pay public.generator_payments%rowtype; sub public.generator_subscribers%rowtype;
 ledger jsonb; restored jsonb; result jsonb; received timestamptz;
 debt_after bigint; current_paid bigint; previous_paid_date date; any_paid boolean;
begin
 if actor is null then raise exception 'not_authorized' using errcode='42501'; end if;
 select p.generator_id,p.full_name into strict gid,actor_name from public.profiles p
   where p.id=actor and p.is_active and p.role='generator_admin' for share;
 if gid is null or public.is_generator_admin_for(gid) is distinct from true then
   raise exception 'not_authorized' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(gid::text,89144));
 select coalesce((select epoch from public.generator_sync_state where generator_id=gid),0) into epoch_now;
 if p_expected_epoch is distinct from epoch_now or
   (coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-moldatk-sync-epoch') is distinct from epoch_now::text then
   raise exception 'MOLDATK_STALE_SYNC_EPOCH'; end if;
 access_state:=public.get_my_subscription_access_state();
 if access_state->>'ok' is distinct from 'true' or access_state->>'accessActive' is distinct from 'true'
   or access_state#>>'{generator,id}' is distinct from gid::text then
   raise exception 'subscription_unavailable' using errcode='42501'; end if;
 if jsonb_typeof(p_command) is distinct from 'object'
   or coalesce(p_command->>'requestId','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   or jsonb_typeof(p_command->'paymentId') is distinct from 'string'
   or jsonb_typeof(p_command->'reason') is distinct from 'string'
   or jsonb_typeof(p_command->'expectedUpdatedAt') is distinct from 'string'
   or exists(select 1 from jsonb_object_keys(p_command) k(key)
     where key not in ('requestId','paymentId','reason','expectedUpdatedAt')) then
   raise exception 'invalid_reversal_command'; end if;
 rid:=(p_command->>'requestId')::uuid; pid:=p_command->>'paymentId'; reason:=trim(p_command->>'reason');
 if reason='' or length(reason)>500 or trim(pid)='' then raise exception 'invalid_reversal_reason'; end if;
 fingerprint:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
 select * into prior from moldatk_private.flutter_payment_reversals where generator_id=gid and payment_id=pid;
 if found then
   if prior.actor_id<>actor or prior.request_id<>rid or prior.epoch<>epoch_now or prior.fingerprint<>fingerprint then
     raise exception 'payment_already_reversed'; end if;
   return prior.receipt||jsonb_build_object('replayed',true);
 end if;
 select * into strict original from moldatk_private.flutter_payment_requests where generator_id=gid and payment_id=pid;
 if original.epoch<>epoch_now then raise exception 'MOLDATK_STALE_SYNC_EPOCH'; end if;
 select * into strict pay from public.generator_payments where generator_id=gid and id=pid for update;
 sid:=original.subscriber_id;
 if pay.subscriber_id<>sid or pay.amount is distinct from (original.receipt->>'amountIqd')::bigint
    or not exists(select 1 from public.generator_cashbox_entries where generator_id=gid and source_id=pid and amount=pay.amount)
    then raise exception 'original_payment_mismatch'; end if;
 select * into strict sub from public.generator_subscribers where generator_id=gid and id=sid for update;
 if sub.updated_at is distinct from (p_command->>'expectedUpdatedAt')::timestamptz then raise exception 'subscriber_changed'; end if;
 -- Never reverse a receipt after a later collection or independent ledger change.
 if exists(select 1 from public.generator_payments where generator_id=gid and subscriber_id=sid and id<>pid and received_at>=pay.received_at)
    then raise exception 'not_latest_payment'; end if;
 select id into strict month_now from public.generator_monthly_tariffs
   where generator_id=gid and is_current_active and jsonb_typeof(tiers)='array' and jsonb_array_length(tiers)>0 for share;
 if month_now is distinct from pay.receipt_snapshot->>'monthId' then raise exception 'payment_cycle_changed'; end if;
 perform 1 from public.generator_monthly_accounts where generator_id=gid and subscriber_id=sid order by month_id for update;
 perform 1 from public.generator_invoices where generator_id=gid and subscriber_id=sid order by id for update;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'month',month_id,'status',status,'total',total_amount,'paid',paid_amount,'remaining',remaining_amount) order by month_id,id),'[]'::jsonb)
   into ledger from public.generator_invoices where generator_id=gid and subscriber_id=sid;
 if ledger is distinct from original.after_ledger
    or sub.amount_due is distinct from (original.receipt->>'debtAfter')::bigint then raise exception 'invoice_ledger_changed'; end if;
 -- Keep audit/cashbox history, never delete a receipt. Current-month account
 -- projections must still agree before touching them.
 if exists(select 1 from public.generator_monthly_accounts a
   left join public.generator_monthly_tariffs t on t.generator_id=a.generator_id and t.id=a.month_id
   left join public.generator_invoices i on i.generator_id=a.generator_id and i.subscriber_id=a.subscriber_id and i.month_id=a.month_id and i.status<>'cancelled'
   where a.generator_id=gid and a.subscriber_id=sid and
     (t.id is null or i.id is null or a.month_charge is distinct from i.total_amount
     or a.paid_amount is distinct from i.paid_amount
     or a.carried_debt is distinct from coalesce((select sum(j.remaining_amount) from public.generator_invoices j
        where j.generator_id=gid and j.subscriber_id=sid and j.month_id<a.month_id and j.status not in ('cancelled','free')),0)
     or a.remaining_amount is distinct from a.carried_debt+i.remaining_amount))
 then raise exception 'monthly_account_reconciliation_required'; end if;
 if exists(select 1 from public.generator_invoices i where i.generator_id=gid and i.subscriber_id=sid and i.status<>'cancelled'
   and not exists(select 1 from public.generator_monthly_tariffs t where t.generator_id=gid and t.id=i.month_id))
 then raise exception 'missing_debt_tariff'; end if;
 if exists(select 1 from public.generator_monthly_tariffs t1 join public.generator_monthly_tariffs t2
   on t2.generator_id=t1.generator_id and t1.id<t2.id where t1.generator_id=gid and t1.created_at>=t2.created_at
   and exists(select 1 from public.generator_invoices i where i.generator_id=gid and i.subscriber_id=sid and i.month_id=t1.id and i.status<>'cancelled')
   and exists(select 1 from public.generator_invoices i where i.generator_id=gid and i.subscriber_id=sid and i.month_id=t2.id and i.status<>'cancelled'))
 then raise exception 'tariff_chronology_mismatch'; end if;
 -- Date provenance for earlier collections is not captured in v1. Refuse
 -- reversing a payment into an invoice that already had collected cash.
 if exists(select 1 from jsonb_array_elements(original.before_ledger) b
   join jsonb_array_elements(original.after_ledger) a on a->>'id'=b->>'id'
   where (b->>'paid')::bigint>0 and b->>'paid' is distinct from a->>'paid')
 then raise exception 'prior_payment_date_review_required'; end if;
 received:=clock_timestamp();
 update public.generator_invoices i set paid_amount=(b->>'paid')::bigint,
   remaining_amount=(b->>'remaining')::bigint,status=b->>'status',
   payment_date=null,updated_at=received
 from jsonb_array_elements(original.before_ledger) b
 where i.generator_id=gid and i.subscriber_id=sid and i.id=b->>'id'
   and i.paid_amount is distinct from (b->>'paid')::bigint;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'month',month_id,'status',status,'total',total_amount,'paid',paid_amount,'remaining',remaining_amount) order by month_id,id),'[]'::jsonb)
   into restored from public.generator_invoices where generator_id=gid and subscriber_id=sid;
 if restored is distinct from original.before_ledger then raise exception 'reversal_ledger_mismatch'; end if;
 select coalesce(sum(remaining_amount),0),coalesce(bool_or(paid_amount>0),false)
   into debt_after,any_paid from public.generator_invoices where generator_id=gid and subscriber_id=sid and status<>'cancelled';
 select paid_amount into strict current_paid from public.generator_invoices where generator_id=gid and subscriber_id=sid and month_id=month_now and status<>'cancelled';
 select max(payment_date) into previous_paid_date from public.generator_invoices where generator_id=gid and subscriber_id=sid and status<>'cancelled' and paid_amount>0;
 if debt_after is distinct from (original.receipt->>'debtBefore')::bigint then raise exception 'reversal_balance_mismatch'; end if;
 update public.generator_subscribers set amount_due=debt_after,amount_paid=current_paid,
   payment_status=case when debt_after=0 then 'paid' when any_paid then 'partial' else 'unpaid' end,
   last_payment_date=previous_paid_date,updated_at=received where generator_id=gid and id=sid;
 with account_calc as (
   select a.month_id,i.paid_amount as paid,i.remaining_amount as current_remaining,
    coalesce((select sum(j.remaining_amount) from public.generator_invoices j where j.generator_id=gid and j.subscriber_id=sid
       and j.month_id<a.month_id and j.status not in ('cancelled','free')),0)::bigint as carried
   from public.generator_monthly_accounts a join public.generator_invoices i
     on i.generator_id=a.generator_id and i.subscriber_id=a.subscriber_id and i.month_id=a.month_id and i.status<>'cancelled'
   where a.generator_id=gid and a.subscriber_id=sid
 ) update public.generator_monthly_accounts a set carried_debt=c.carried,paid_amount=c.paid,
   remaining_amount=c.carried+c.current_remaining,
   status=case when a.is_exempted then 'free' when c.carried+c.current_remaining=0 then 'paid' when c.paid>0 then 'partial' else 'unpaid' end,
   updated_at=received from account_calc c where a.generator_id=gid and a.subscriber_id=sid and a.month_id=c.month_id;
 insert into public.generator_audit_logs(id,generator_id,category,title,details,entity_id,entity_name,actor_name,amount,timestamp)
   values('flutter-void-'||pid,gid,'cancellation','إلغاء تسديد',reason,sid,sub.full_name,actor_name,pay.amount,received);
 if not exists(select 1 from public.generator_cashbox_entries where generator_id=gid and source_id='flutter-void-'||pid and amount=-pay.amount)
 then raise exception 'cashbox_reversal_missing'; end if;
 result:=jsonb_build_object('ok',true,'requestId',rid,'generatorId',gid,'subscriberId',sid,'paymentId',pid,
   'reversedAmount',pay.amount,'debtAfter',debt_after,'replayed',false);
 insert into moldatk_private.flutter_payment_reversals(generator_id,payment_id,actor_id,request_id,epoch,fingerprint,receipt)
   values(gid,pid,actor,rid,epoch_now,fingerprint,result);
 return result;
end;
$$;
revoke all on function moldatk_private.flutter_reverse_payment_v1(jsonb,bigint) from public,anon,authenticated,service_role;
commit;
