-- When the last tariff is removed, no collectible debt is allowed to survive.
-- Paid/cancelled/free history is preserved for reporting; unpaid liability rows are removed.
create or replace function moldatk_private.enforce_zero_financial_state_without_tariff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.generator_monthly_tariffs
    where generator_id = old.generator_id
  ) then
    return old;
  end if;

  update public.generator_invoices
  set
    notes = concat_ws(
      ' | ',
      nullif(notes, ''),
      'MOLDATK_ALL_TARIFFS_CLEARED_SETTLED_HISTORY'
    ),
    total_amount = greatest(coalesce(paid_amount, 0), 0),
    remaining_amount = 0,
    remaining_after_payment = 0,
    status = case when status = 'free' then 'free' else 'paid' end,
    updated_at = now()
  where generator_id = old.generator_id
    and status not in ('cancelled', 'free')
    and coalesce(paid_amount, 0) > 0;

  delete from public.generator_invoices
  where generator_id = old.generator_id
    and status not in ('cancelled', 'free')
    and coalesce(paid_amount, 0) <= 0;

  update public.generator_monthly_accounts
  set
    month_charge = greatest(coalesce(paid_amount, 0), 0),
    carried_debt = 0,
    remaining_amount = 0,
    status = case when is_exempted then 'free' else 'paid' end,
    updated_at = now()
  where generator_id = old.generator_id
    and coalesce(paid_amount, 0) > 0;

  delete from public.generator_monthly_accounts
  where generator_id = old.generator_id
    and coalesce(paid_amount, 0) <= 0;

  perform moldatk_private.refresh_generator_subscriber_balances(old.generator_id);
  return old;
end;
$$;

revoke all on function moldatk_private.enforce_zero_financial_state_without_tariff() from public, anon, authenticated;
grant execute on function moldatk_private.enforce_zero_financial_state_without_tariff() to service_role;

drop trigger if exists moldatk_zero_financial_state_after_last_tariff on public.generator_monthly_tariffs;

create trigger moldatk_zero_financial_state_after_last_tariff
after delete on public.generator_monthly_tariffs
for each row
execute function moldatk_private.enforce_zero_financial_state_without_tariff();
