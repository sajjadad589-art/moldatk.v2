-- Read-only recovery of an existing payment; never submits a new collection.
begin;
create function moldatk_private.flutter_payment_status_v1(p_command jsonb,p_expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); gid uuid; actor_name text; access_state jsonb;
 epoch_now bigint; rid uuid; fingerprint text;
 original moldatk_private.flutter_payment_requests%rowtype;
 pay public.generator_payments%rowtype;
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
   raise exception 'MOLDATK_STALE_SYNC_EPOCH';
 end if;
 access_state:=public.get_my_subscription_access_state();
 if access_state->>'ok' is distinct from 'true' or access_state->>'accessActive' is distinct from 'true'
   or access_state#>>'{generator,id}' is distinct from gid::text then
   raise exception 'subscription_unavailable' using errcode='42501';
 end if;

 if jsonb_typeof(p_command) is distinct from 'object'
   or coalesce(p_command->>'requestId','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   or jsonb_typeof(p_command->'subscriberId') is distinct from 'string' then
   raise exception 'invalid_recovery_command';
 end if;
 rid:=(p_command->>'requestId')::uuid;
 fingerprint:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
 select * into original from moldatk_private.flutter_payment_requests
   where generator_id=gid and actor_id=actor and request_id=rid;
 if not found then
   -- Absence at this instant is NOT proof that a dispatched request failed.
   return jsonb_build_object('state','unconfirmed','requestId',rid);
 end if;
 if original.epoch<>epoch_now or original.fingerprint<>fingerprint
   or original.subscriber_id is distinct from p_command->>'subscriberId' then
   raise exception 'request_conflict_or_reset';
 end if;
 if exists(select 1 from moldatk_private.flutter_payment_reversals
       where generator_id=gid and payment_id=original.payment_id)
   or exists(select 1 from public.generator_audit_logs
       where generator_id=gid and id='flutter-void-'||original.payment_id) then
   return jsonb_build_object('state','reversed','requestId',rid);
 end if;
 select * into strict pay from public.generator_payments
   where generator_id=gid and id=original.payment_id;
 if pay.subscriber_id is distinct from original.subscriber_id
   or pay.amount is distinct from (original.receipt->>'amountIqd')::bigint
   or pay.receipt_number is distinct from original.receipt->>'receiptNumber'
   or not exists(select 1 from public.generator_cashbox_entries
       where generator_id=gid and source_id=original.payment_id and amount=pay.amount)
   or not exists(select 1 from public.generator_subscribers
       where generator_id=gid and id=original.subscriber_id)
   then raise exception 'payment_reconciliation_required'; end if;
 return jsonb_build_object('state','committed','requestId',rid,
   'receipt',original.receipt||jsonb_build_object('replayed',true));
end;
$$;
revoke all on function moldatk_private.flutter_payment_status_v1(jsonb,bigint) from public,anon,authenticated,service_role;
commit;
