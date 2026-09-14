-- Current billing is disabled without tariffs; historical ledger rows stay intact.
create or replace function moldatk_private.guard_no_tariff_payment()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.generator_monthly_tariffs t where t.generator_id = new.generator_id) then
    return new;
  end if;
  if tg_table_name = 'generator_subscribers' then
    -- A client may edit a name while carrying a stale projection. Never accept
    -- an actual new payment, but allow projection cleanup to zero.
    if coalesce(new.amount_paid, 0) > 0 and
       (tg_op = 'INSERT' or new.amount_paid is distinct from old.amount_paid
        or new.last_payment_date is distinct from old.last_payment_date) then
      raise exception 'NO_MONTHLY_TARIFF' using errcode = '23514';
    end if;
    new.amount_due := 0;
    new.amount_paid := 0;
    new.payment_status := case when new.tier = 'free' or new.is_exempted then 'free' else 'unpaid' end;
  elsif tg_table_name = 'generator_invoices' then
    if tg_op = 'UPDATE' then
      if (new.paid_amount, new.status) is distinct from (old.paid_amount, old.status)
         and (coalesce(new.paid_amount, 0) > 0 or coalesce(old.paid_amount, 0) > 0) then
        raise exception 'NO_MONTHLY_TARIFF' using errcode = '23514';
      end if;
    elsif coalesce(new.paid_amount, 0) > 0 and not exists (
      select 1 from public.generator_invoices i
      where i.generator_id = new.generator_id and i.id = new.id
        and (i.paid_amount, i.status) is not distinct from (new.paid_amount, new.status)
    ) then
      -- A retry of an existing receipt is harmless; a new receipt is not.
      raise exception 'NO_MONTHLY_TARIFF' using errcode = '23514';
    end if;
  elsif tg_table_name = 'generator_audit_logs' then
    if new.category in ('payment', 'cancellation') and coalesce(new.amount, 0) <> 0
       and not exists (select 1 from public.generator_audit_logs a
         where a.generator_id = new.generator_id and a.id = new.id
           and (a.category, a.amount) is not distinct from (new.category, new.amount)) then
      raise exception 'NO_MONTHLY_TARIFF' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function moldatk_private.guard_no_tariff_payment() from public, anon, authenticated;

create trigger guard_no_tariff_payment before insert or update on public.generator_subscribers
for each row execute function moldatk_private.guard_no_tariff_payment();
create trigger guard_no_tariff_payment before insert or update on public.generator_invoices
for each row execute function moldatk_private.guard_no_tariff_payment();
-- AFTER INSERT makes ON CONFLICT DO NOTHING receipt retries a true no-op.
-- Raising here rolls back the insertion and any cashbox entry in the transaction.
create trigger guard_no_tariff_payment before update on public.generator_audit_logs
for each row execute function moldatk_private.guard_no_tariff_payment();
create or replace function moldatk_private.guard_no_tariff_audit_insert()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.category in ('payment', 'cancellation') and coalesce(new.amount, 0) <> 0
    and not exists (select 1 from public.generator_monthly_tariffs t where t.generator_id = new.generator_id) then
    raise exception 'NO_MONTHLY_TARIFF' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function moldatk_private.guard_no_tariff_audit_insert() from public, anon, authenticated;
create trigger guard_no_tariff_audit_insert after insert on public.generator_audit_logs
for each row execute function moldatk_private.guard_no_tariff_audit_insert();

create or replace function moldatk_private.clear_billing_after_tariff_delete()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare gid uuid;
begin
  for gid in select distinct generator_id from deleted_tariffs loop
    if exists (select 1 from public.generators g where g.id = gid)
       and not exists (select 1 from public.generator_monthly_tariffs t where t.generator_id = gid) then
      perform public.reconcile_generator_no_tariff_state(gid);
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function moldatk_private.clear_billing_after_tariff_delete() from public, anon, authenticated;
create trigger clear_billing_after_tariff_delete after delete on public.generator_monthly_tariffs
referencing old table as deleted_tariffs for each statement
execute function moldatk_private.clear_billing_after_tariff_delete();
