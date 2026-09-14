-- Removing every tariff suspends the current billable state without deleting
-- subscribers, invoices, audit logs, or payment history.
create or replace function public.reconcile_generator_no_tariff_state(p_generator_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  changed_count integer;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_generator_admin_for(p_generator_id) then
    raise exception 'FORBIDDEN';
  end if;

  if exists (select 1 from public.generator_monthly_tariffs where generator_id = p_generator_id) then
    raise exception 'TARIFFS_STILL_EXIST';
  end if;

  update public.generator_subscribers
  set amount_due = 0,
      amount_paid = 0,
      payment_status = case when tier = 'free' or is_exempted then 'free' else 'unpaid' end,
      updated_at = now()
  where generator_id = p_generator_id
    and (amount_due <> 0 or amount_paid <> 0
      or payment_status <> case when tier = 'free' or is_exempted then 'free' else 'unpaid' end);
  get diagnostics changed_count = row_count;

  return jsonb_build_object('ok', true, 'updated_subscribers', changed_count);
end;
$$;

revoke all on function public.reconcile_generator_no_tariff_state(uuid) from public;
grant execute on function public.reconcile_generator_no_tariff_state(uuid) to authenticated;
