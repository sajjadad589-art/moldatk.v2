-- Durable reset generation, outside the operational data purged by factory reset.
create table public.generator_sync_state (
  generator_id uuid primary key references public.generators(id) on delete cascade,
  epoch bigint not null default 0 check (epoch >= 0),
  reset_at timestamptz
);
alter table public.generator_sync_state enable row level security;
revoke all on public.generator_sync_state from public, anon, authenticated;
grant select on public.generator_sync_state to authenticated;
grant all on public.generator_sync_state to service_role;
create policy generator_sync_state_read on public.generator_sync_state
  for select to authenticated using (
    public.is_generator_admin_for(generator_id) or public.is_active_collector_for(generator_id)
  );
insert into public.generator_sync_state(generator_id) select id from public.generators;

create or replace function public.get_generator_sync_state(p_generator_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or not (
    public.is_generator_admin_for(p_generator_id) or public.is_active_collector_for(p_generator_id)
  ) then
    return jsonb_build_object('authorized', false);
  end if;
  return jsonb_build_object('authorized', true, 'epoch', coalesce(
    (select epoch from public.generator_sync_state where generator_id = p_generator_id), 0));
end;
$$;
revoke all on function public.get_generator_sync_state(uuid) from public, anon;
grant execute on function public.get_generator_sync_state(uuid) to authenticated;

-- Same lock as factory reset: an old write either commits before reset and is
-- removed, or executes afterwards and is rejected. RLS still authorizes writes.
create or replace function moldatk_private.guard_generator_sync_epoch()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_epoch bigint;
  v_header text;
begin
  if auth.role() = 'service_role' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if auth.uid() is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if tg_op = 'DELETE' then v_id := old.generator_id; else v_id := new.generator_id; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_id::text, 89144));
  select epoch into v_epoch from public.generator_sync_state where generator_id = v_id;
  v_header := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb ->> 'x-moldatk-sync-epoch';
  if coalesce(v_header, '0') <> coalesce(v_epoch, 0)::text then
    raise exception 'MOLDATK_STALE_SYNC_EPOCH' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function moldatk_private.guard_generator_sync_epoch() from public, anon, authenticated;

do $$
declare v_table text;
begin
  foreach v_table in array array['generator_subscribers','generator_invoices',
    'generator_monthly_accounts','generator_payments','generator_payment_allocations',
    'generator_monthly_tariffs','generator_lines','generator_settings','generator_audit_logs'] loop
    execute format('create trigger aa_guard_sync_epoch before insert or update or delete on public.%I for each row execute function moldatk_private.guard_generator_sync_epoch()', v_table);
  end loop;
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.generator_sync_state;
  end if;
end;
$$;

-- Wrap the existing, permission-checked purge rather than duplicating its accounting.
alter function public.reset_generator_account_operational_data(uuid)
  rename to reset_generator_account_operational_data_before_epoch;
revoke all on function public.reset_generator_account_operational_data_before_epoch(uuid) from public, anon, authenticated, service_role;
create function public.reset_generator_account_operational_data(p_generator_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb; v_epoch bigint;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'service_role_required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_generator_id::text, 89144));
  v_result := public.reset_generator_account_operational_data_before_epoch(p_generator_id);
  insert into public.generator_sync_state(generator_id, epoch, reset_at)
    values (p_generator_id, 1, clock_timestamp())
    on conflict(generator_id) do update set epoch = public.generator_sync_state.epoch + 1, reset_at = excluded.reset_at
    returning epoch into v_epoch;
  return v_result || jsonb_build_object('epoch', v_epoch);
end;
$$;
revoke all on function public.reset_generator_account_operational_data(uuid) from public, anon, authenticated;
grant execute on function public.reset_generator_account_operational_data(uuid) to service_role;
