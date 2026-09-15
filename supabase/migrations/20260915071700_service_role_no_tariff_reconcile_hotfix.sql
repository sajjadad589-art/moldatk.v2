-- Full account reset removes tariffs under the service-role Edge Function. The existing
-- after-delete trigger invokes this reconciler, so service_role must be accepted just like
-- the already-authorized owner path.
create or replace function public.reconcile_generator_no_tariff_state(p_generator_id uuid)
returns jsonb
language plpgsql
set search_path to 'public','auth'
as $$
declare changed_count integer;
begin
  if auth.role()<>'service_role' then
    if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
    if not public.is_generator_admin_for(p_generator_id) then raise exception 'FORBIDDEN'; end if;
  end if;
  if exists (select 1 from public.generator_monthly_tariffs where generator_id=p_generator_id) then raise exception 'TARIFFS_STILL_EXIST'; end if;
  update public.generator_subscribers
  set amount_due=0,amount_paid=0,
      payment_status=case when tier='free' or is_exempted then 'free' else 'unpaid' end,
      updated_at=now()
  where generator_id=p_generator_id
    and (amount_due<>0 or amount_paid<>0 or payment_status<>case when tier='free' or is_exempted then 'free' else 'unpaid' end);
  get diagnostics changed_count=row_count;
  return jsonb_build_object('ok',true,'updated_subscribers',changed_count);
end;
$$;
