-- Production hardening for destructive financial operations.
-- Service-role Edge Functions must be able to perform owner-authorized deletes without
-- being misclassified by collector permission triggers.

create or replace function public.enforce_collector_invoice_change()
returns trigger
language plpgsql
security definer
set search_path to 'public','auth'
as $$
declare
  gid uuid := coalesce(new.generator_id, old.generator_id);
  target_status text := coalesce(new.status, old.status);
begin
  if auth.role() = 'service_role' or public.is_generator_admin_for(gid) then
    return case when tg_op='DELETE' then old else new end;
  end if;
  if not public.is_active_collector_for(gid) then raise exception 'collector_not_authorized' using errcode='42501'; end if;
  if tg_op='DELETE' then raise exception 'collector_cannot_delete_invoices' using errcode='42501'; end if;
  if target_status='free' then
    if not public.collector_has_permission(gid,'canApplyFreeExemption') then raise exception 'collector_cannot_apply_free_exemption' using errcode='42501'; end if;
  elsif target_status in ('cancelled','unpaid') then
    if not public.collector_has_permission(gid,'canCancelPayments') then raise exception 'collector_cannot_cancel_payments' using errcode='42501'; end if;
  elsif target_status in ('paid','partial') then
    if not public.collector_has_permission(gid,'canCollectPayments') then raise exception 'collector_cannot_collect_payments' using errcode='42501'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_collector_subscriber_change()
returns trigger
language plpgsql
security definer
set search_path to 'public','auth'
as $$
declare gid uuid := coalesce(new.generator_id, old.generator_id);
begin
  if auth.role() = 'service_role' or public.is_generator_admin_for(gid) then
    return case when tg_op='DELETE' then old else new end;
  end if;
  if not public.is_active_collector_for(gid) then raise exception 'collector_not_authorized' using errcode='42501'; end if;
  if tg_op='INSERT' then
    if not public.collector_has_permission(gid,'canAddSubscribers') then raise exception 'collector_cannot_add_subscribers' using errcode='42501'; end if;
    return new;
  elsif tg_op='DELETE' then
    if not public.collector_has_permission(gid,'canDeleteSubscribers') then raise exception 'collector_cannot_delete_subscribers' using errcode='42501'; end if;
    return old;
  end if;
  if (new.code,new.full_name,new.phone,new.tier,new.amperes,new.line_id,new.line_name,new.address,new.box_number,new.notes,new.joining_date)
     is distinct from (old.code,old.full_name,old.phone,old.tier,old.amperes,old.line_id,old.line_name,old.address,old.box_number,old.notes,old.joining_date)
     and not public.collector_has_permission(gid,'canEditSubscribers') then raise exception 'collector_cannot_edit_subscribers' using errcode='42501';
  end if;
  if (new.payment_status,new.last_payment_date,new.amount_due,new.amount_paid,new.is_exempted,new.exempt_reason)
     is distinct from (old.payment_status,old.last_payment_date,old.amount_due,old.amount_paid,old.is_exempted,old.exempt_reason) then
    if (new.payment_status='free' or new.is_exempted=true) and not public.collector_has_permission(gid,'canApplyFreeExemption') then raise exception 'collector_cannot_apply_free_exemption' using errcode='42501';
    elsif new.payment_status='unpaid' and old.payment_status<>'unpaid' and not public.collector_has_permission(gid,'canCancelPayments') then raise exception 'collector_cannot_cancel_payments' using errcode='42501';
    elsif new.payment_status in ('paid','partial') and not public.collector_has_permission(gid,'canCollectPayments') then raise exception 'collector_cannot_collect_payments' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.delete_generator_subscriber_permanent(p_generator_id uuid,p_subscriber_id text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_exists boolean; v_line_id text;
begin
  if auth.role()<>'service_role' and (auth.uid() is null or not public.is_generator_admin_for(p_generator_id)) then raise exception 'not_authorized' using errcode='42501'; end if;
  if coalesce(trim(p_subscriber_id),'')='' then raise exception 'subscriber_id_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_generator_id::text,89143));
  select true,line_id into v_exists,v_line_id from public.generator_subscribers where generator_id=p_generator_id and id=p_subscriber_id limit 1;
  if not coalesce(v_exists,false) then return jsonb_build_object('ok',true,'already_deleted',true,'subscriber_id',p_subscriber_id); end if;
  delete from public.generator_audit_logs where generator_id=p_generator_id and entity_id=p_subscriber_id;
  delete from public.owner_ai_issues where generator_id=p_generator_id and subscriber_id=p_subscriber_id;
  delete from public.generator_subscribers where generator_id=p_generator_id and id=p_subscriber_id;
  if v_line_id is not null then perform public.moldatk_recount_generator_line(p_generator_id,v_line_id); end if;
  return jsonb_build_object('ok',true,'subscriber_id',p_subscriber_id,'purged',true);
end;
$$;
revoke all on function public.delete_generator_subscriber_permanent(uuid,text) from public,anon,authenticated;
grant execute on function public.delete_generator_subscriber_permanent(uuid,text) to service_role;

create or replace function public.reset_generator_account_operational_data(p_generator_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_subscribers bigint:=0; v_invoices bigint:=0; v_tariffs bigint:=0;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_generator_id::text,89144));
  select count(*) into v_subscribers from public.generator_subscribers where generator_id=p_generator_id;
  select count(*) into v_invoices from public.generator_invoices where generator_id=p_generator_id;
  select count(*) into v_tariffs from public.generator_monthly_tariffs where generator_id=p_generator_id;
  delete from public.generator_payment_allocations where generator_id=p_generator_id;
  delete from public.generator_payments where generator_id=p_generator_id;
  delete from public.generator_invoices where generator_id=p_generator_id;
  delete from public.generator_monthly_accounts where generator_id=p_generator_id;
  delete from public.generator_subscribers where generator_id=p_generator_id;
  delete from public.generator_audit_logs where generator_id=p_generator_id;
  delete from public.generator_cashbox_entries where generator_id=p_generator_id;
  delete from public.generator_cashbox_resets where generator_id=p_generator_id;
  delete from public.generator_collectors where generator_id=p_generator_id;
  delete from public.generator_lines where generator_id=p_generator_id;
  delete from public.generator_monthly_tariffs where generator_id=p_generator_id;
  delete from public.generator_settings where generator_id=p_generator_id;
  delete from public.owner_ai_actions where generator_id=p_generator_id;
  delete from public.owner_ai_pending_actions where generator_id=p_generator_id;
  delete from public.owner_ai_issues where generator_id=p_generator_id;
  delete from public.owner_ai_sessions where generator_id=p_generator_id;
  delete from public.app_popup_notifications where generator_id=p_generator_id;
  delete from public.app_notifications where generator_id=p_generator_id;
  delete from public.device_push_tokens where generator_id=p_generator_id;
  delete from public.web_push_subscriptions where generator_id=p_generator_id;
  return jsonb_build_object('ok',true,'generator_id',p_generator_id,'subscribers_deleted',v_subscribers,'invoices_deleted',v_invoices,'tariffs_deleted',v_tariffs,'purged',true);
end;
$$;
revoke all on function public.reset_generator_account_operational_data(uuid) from public,anon,authenticated;
grant execute on function public.reset_generator_account_operational_data(uuid) to service_role;
