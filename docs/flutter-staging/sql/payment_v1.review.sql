-- PRIVATE REVIEW ONLY. Not a migration or callable API.
-- Initial narrow scope: existing reconciled invoice ledger, no monthly-account rows.
begin;
create table moldatk_private.flutter_payment_requests(
 generator_id uuid not null references public.generators(id) on delete cascade,
 actor_id uuid not null, request_id uuid not null, epoch bigint not null,
 fingerprint text not null, subscriber_id text not null, payment_id text not null,
 receipt jsonb not null, primary key(generator_id,actor_id,request_id)
);
alter table moldatk_private.flutter_payment_requests enable row level security;
revoke all on moldatk_private.flutter_payment_requests from public,anon,authenticated,service_role;

create function moldatk_private.flutter_collect_payment_v1(p_command jsonb,p_expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); gid uuid; actor_name text; access_state jsonb;
 rid uuid; fingerprint text; epoch_now bigint;
 old_request moldatk_private.flutter_payment_requests%rowtype;
 sub public.generator_subscribers%rowtype; inv public.generator_invoices%rowtype;
 month_now text; sid text; pid text; receipt_no text; amount_value bigint; due bigint;
 cash_left bigint; applied bigint; current_paid bigint; prior_debt bigint;
 current_charge bigint; applied_prior bigint:=0; applied_current bigint:=0;
 n integer:=0; allocation_list jsonb:='[]'::jsonb; ledger jsonb; receipt jsonb;
 received timestamptz; received_day date;
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
   coalesce(coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-moldatk-sync-epoch','0')<>epoch_now::text then
   raise exception 'MOLDATK_STALE_SYNC_EPOCH';
 end if;
 access_state:=public.get_my_subscription_access_state();
 if access_state->>'ok' is distinct from 'true' or access_state->>'accessActive' is distinct from 'true'
   or access_state#>>'{generator,id}' is distinct from gid::text then
   raise exception 'subscription_unavailable' using errcode='42501';
 end if;
 if jsonb_typeof(p_command) is distinct from 'object'
   or coalesce(p_command->>'requestId','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   or jsonb_typeof(p_command->'subscriberId') is distinct from 'string'
   or jsonb_typeof(p_command->'expectedUpdatedAt') is distinct from 'string'
   or jsonb_typeof(p_command->'expectedMonth') is distinct from 'string'
   or jsonb_typeof(p_command->'expectedLedger') is distinct from 'array'
   or jsonb_typeof(p_command->'amountIqd') is distinct from 'number'
   or coalesce(p_command->>'amountIqd','') !~ '^[0-9]+$'
   or exists(select 1 from jsonb_object_keys(p_command) k(key)
     where key not in ('requestId','subscriberId','expectedUpdatedAt','expectedMonth','expectedLedger','amountIqd')) then
   raise exception 'invalid_payment_command';
 end if;
 rid:=(p_command->>'requestId')::uuid;
 sid:=p_command->>'subscriberId';
 amount_value:=(p_command->>'amountIqd')::bigint;
 if amount_value<=0 or trim(sid)='' then raise exception 'invalid_payment_amount'; end if;
 fingerprint:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
 select * into old_request from moldatk_private.flutter_payment_requests
   where generator_id=gid and actor_id=actor and request_id=rid;
 if found then
   if old_request.epoch<>epoch_now or old_request.fingerprint<>fingerprint
     or not exists(select 1 from public.generator_payments where generator_id=gid and id=old_request.payment_id)
     or not exists(select 1 from public.generator_subscribers where generator_id=gid and id=sid) then
     raise exception 'request_conflict_or_reset';
   end if;
   return old_request.receipt||jsonb_build_object('replayed',true);
 end if;
 select id into strict month_now from public.generator_monthly_tariffs
   where generator_id=gid and is_current_active and jsonb_typeof(tiers)='array' and jsonb_array_length(tiers)>0 for share;
 if month_now is distinct from p_command->>'expectedMonth' then raise exception 'stale_tariff'; end if;
 select * into strict sub from public.generator_subscribers where generator_id=gid and id=sid for update;
 if sub.updated_at is distinct from (p_command->>'expectedUpdatedAt')::timestamptz then raise exception 'subscriber_changed'; end if;
 -- Monthly-account synchronization semantics are not yet verified: refuse rather than leave a split ledger.
 if exists(select 1 from public.generator_monthly_accounts where generator_id=gid and subscriber_id=sid) then
   raise exception 'monthly_account_reconciliation_required';
 end if;
 perform 1 from public.generator_invoices where generator_id=gid and subscriber_id=sid order by id for update;
 if exists(select 1 from public.generator_invoices where generator_id=gid and subscriber_id=sid
   and (month_id !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or month_id>month_now
     or status not in ('paid','partial','unpaid','free','cancelled')
     or total_amount<0 or paid_amount<0 or remaining_amount<0
     or (status<>'cancelled' and (paid_amount+remaining_amount<>total_amount
       or (status='paid' and remaining_amount<>0) or (status='free' and total_amount<>0)
       or (status='unpaid' and paid_amount<>0) or (status='partial' and (paid_amount<=0 or remaining_amount<=0)))))) then
   raise exception 'inconsistent_invoice_ledger';
 end if;
 if exists(select 1 from public.generator_invoices where generator_id=gid and subscriber_id=sid and status<>'cancelled'
   group by month_id having count(*)>1) then raise exception 'duplicate_month_invoice'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'month',month_id,'status',status,'total',total_amount,'paid',paid_amount,'remaining',remaining_amount) order by month_id,id),'[]'::jsonb)
   into ledger from public.generator_invoices where generator_id=gid and subscriber_id=sid;
 if ledger is distinct from p_command->'expectedLedger' then raise exception 'invoice_ledger_changed'; end if;
 select coalesce(sum(remaining_amount),0),coalesce(sum(remaining_amount) filter(where month_id<month_now),0)
   into due,prior_debt from public.generator_invoices where generator_id=gid and subscriber_id=sid and status<>'cancelled';
 select paid_amount,total_amount into strict current_paid,current_charge from public.generator_invoices
   where generator_id=gid and subscriber_id=sid and month_id=month_now and status<>'cancelled';
 if due is distinct from sub.amount_due or amount_value>due or due<=0 then raise exception 'payment_amount_or_ledger_mismatch'; end if;
 pid:='flutter-pay-'||rid::text;
 receipt_no:='REC-'||rid::text;
 received:=clock_timestamp(); received_day:=(received at time zone 'Asia/Baghdad')::date;
 insert into public.generator_payments(generator_id,id,subscriber_id,received_at,amount,collector_name,receipt_number)
   values(gid,pid,sid,received,amount_value,actor_name,receipt_no);
 cash_left:=amount_value;
 for inv in select * from public.generator_invoices where generator_id=gid and subscriber_id=sid
   and status in ('unpaid','partial') and remaining_amount>0 order by month_id,id loop
   exit when cash_left=0;
   applied:=least(cash_left,inv.remaining_amount); n:=n+1;
   update public.generator_invoices set paid_amount=inv.paid_amount+applied,
     remaining_amount=inv.remaining_amount-applied,
     status=case when inv.remaining_amount=applied then 'paid' else 'partial' end,
     payment_date=received_day,updated_at=received
     where generator_id=gid and id=inv.id;
   insert into public.generator_payment_allocations(generator_id,id,payment_id,subscriber_id,month_id,amount,allocation_order)
     values(gid,pid||'-'||n,pid,sid,inv.month_id,applied,n);
   allocation_list:=allocation_list||jsonb_build_array(jsonb_build_object('invoiceId',inv.id,'month',inv.month_id,'amount',applied));
   if inv.month_id=month_now then applied_current:=applied_current+applied;
   else applied_prior:=applied_prior+applied; end if;
   cash_left:=cash_left-applied;
 end loop;
 if cash_left<>0 or applied_current+applied_prior<>amount_value then raise exception 'allocation_mismatch'; end if;
 update public.generator_subscribers set amount_due=due-amount_value,amount_paid=current_paid+applied_current,
   payment_status=case when due=amount_value then 'paid' else 'partial' end,
   last_payment_date=received_day,updated_at=received where generator_id=gid and id=sid;
 receipt:=jsonb_build_object('ok',true,'requestId',rid,'generatorId',gid,'subscriberId',sid,
   'paymentId',pid,'receiptNumber',receipt_no,'receivedAt',received,'amountIqd',amount_value,
   'debtBefore',due,'debtAfter',due-amount_value,'previousDebtBefore',prior_debt,'currentCharge',current_charge,
   'appliedToPrevious',applied_prior,'appliedToCurrent',applied_current,'allocations',allocation_list,'replayed',false);
 update public.generator_payments set receipt_snapshot=receipt where generator_id=gid and id=pid;
 -- Existing AFTER INSERT audit trigger projects the cashbox entry. Never insert it twice.
 insert into public.generator_audit_logs(id,generator_id,category,title,details,entity_id,entity_name,actor_name,amount,timestamp)
   values(pid,gid,'payment','تسديد المشترك','توزيع الدفعة على الديون الأقدم أولاً',sid,sub.full_name,actor_name,amount_value,received);
 if not exists(select 1 from public.generator_cashbox_entries where generator_id=gid and source_id=pid and amount=amount_value)
   then raise exception 'cashbox_projection_missing'; end if;
 insert into moldatk_private.flutter_payment_requests(generator_id,actor_id,request_id,epoch,fingerprint,subscriber_id,payment_id,receipt)
   values(gid,actor,rid,epoch_now,fingerprint,sid,pid,receipt);
 return receipt;
end;
$$;
revoke all on function moldatk_private.flutter_collect_payment_v1(jsonb,bigint) from public,anon,authenticated,service_role;
commit;
