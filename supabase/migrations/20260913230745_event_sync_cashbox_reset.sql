-- A reset is an immutable server event, not a locally writable settings field.
create schema if not exists moldatk_private;
revoke all on schema moldatk_private from public;
grant usage on schema moldatk_private to authenticated;

create table public.generator_cashbox_entries (
  sequence bigint generated always as identity primary key,
  generator_id uuid not null references public.generators(id) on delete cascade,
  source_id text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  amount bigint not null,
  unique(generator_id, source_id)
);
create index on public.generator_cashbox_entries(generator_id, sequence);
create table public.generator_cashbox_resets (
  generator_id uuid not null references public.generators(id) on delete cascade,
  request_id uuid not null,
  reset_at timestamptz not null default clock_timestamp(),
  baseline_sequence bigint not null,
  reset_by uuid not null,
  primary key(generator_id, request_id)
);
create index on public.generator_cashbox_resets(generator_id, reset_at desc);
alter table public.generator_cashbox_entries enable row level security;
alter table public.generator_cashbox_resets enable row level security;
revoke all on public.generator_cashbox_entries, public.generator_cashbox_resets from anon, authenticated;
grant select on public.generator_cashbox_entries, public.generator_cashbox_resets to authenticated;
create policy cashbox_entries_read on public.generator_cashbox_entries for select to authenticated
  using (public.is_generator_admin_for(generator_id) or public.collector_has_permission(generator_id, 'canViewFinancialReports'));
create policy cashbox_resets_read on public.generator_cashbox_resets for select to authenticated
  using (public.is_generator_admin_for(generator_id) or public.is_active_collector_for(generator_id));

create function moldatk_private.capture_cashbox_entry() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_amount bigint;
begin
  if new.category not in ('payment','cancellation') then return new; end if;
  -- Serialize capture and resets for this generator. Events already in flight are
  -- committed before the reset establishes its baseline, or are recorded after it.
  perform pg_advisory_xact_lock(hashtextextended(new.generator_id::text, 71632));
  v_amount := greatest(coalesce(new.amount,0),0);
  if new.category = 'cancellation' then
    if v_amount = 0 then
      select greatest(coalesce(a.amount,0),0) into v_amount from public.generator_audit_logs a
      where a.generator_id=new.generator_id and a.entity_id=new.entity_id and a.category='payment'
        and a.timestamp<=new.timestamp and a.id<>new.id
      order by a.timestamp desc, a.id desc limit 1;
    end if;
    v_amount := -coalesce(v_amount,0);
  end if;
  insert into public.generator_cashbox_entries(generator_id,source_id,occurred_at,amount)
  values(new.generator_id,new.id,new.timestamp,coalesce(v_amount,0))
  on conflict(generator_id,source_id) do nothing;
  return new;
end;
$$;
revoke all on function moldatk_private.capture_cashbox_entry() from public,anon,authenticated;
create trigger capture_cashbox_entry after insert on public.generator_audit_logs
for each row execute function moldatk_private.capture_cashbox_entry();

create function public.get_generator_cashbox(p_generator_id uuid) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare v_reset public.generator_cashbox_resets%rowtype; v_balance bigint;
begin
  if auth.uid() is null or not (public.is_generator_admin_for(p_generator_id) or public.is_active_collector_for(p_generator_id)) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  select * into v_reset from public.generator_cashbox_resets
    where generator_id=p_generator_id order by reset_at desc, request_id desc limit 1;
  if not found then
    return jsonb_build_object('reset_id',null,'reset_at',null,'balance',null);
  end if;
  select greatest(coalesce(sum(amount),0),0) into v_balance from public.generator_cashbox_entries
    where generator_id=p_generator_id and sequence>v_reset.baseline_sequence and occurred_at>v_reset.reset_at;
  return jsonb_build_object('reset_id',v_reset.request_id,'reset_at',v_reset.reset_at,'balance',v_balance);
end;
$$;
revoke all on function public.get_generator_cashbox(uuid) from public,anon;
grant execute on function public.get_generator_cashbox(uuid) to authenticated;

create function moldatk_private.reset_generator_cashbox(p_generator_id uuid,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_baseline bigint;
begin
  if auth.uid() is null or not public.is_generator_admin_for(p_generator_id) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  if p_request_id is null then raise exception 'request_id_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_generator_id::text,71632));
  if not exists(select 1 from public.generator_cashbox_resets where generator_id=p_generator_id and request_id=p_request_id) then
    select coalesce(max(sequence),0) into v_baseline from public.generator_cashbox_entries where generator_id=p_generator_id;
    insert into public.generator_cashbox_resets(generator_id,request_id,baseline_sequence,reset_by)
      values(p_generator_id,p_request_id,v_baseline,auth.uid());
  end if;
  -- A duplicate request returns the latest state; it never advances the reset again.
  return public.get_generator_cashbox(p_generator_id);
end;
$$;
revoke all on function moldatk_private.reset_generator_cashbox(uuid,uuid) from public,anon;
grant execute on function moldatk_private.reset_generator_cashbox(uuid,uuid) to authenticated;
create function public.reset_generator_cashbox(p_generator_id uuid,p_request_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$
  select moldatk_private.reset_generator_cashbox(p_generator_id,p_request_id);
$$;
revoke all on function public.reset_generator_cashbox(uuid,uuid) from public,anon;
grant execute on function public.reset_generator_cashbox(uuid,uuid) to authenticated;

-- Existing valid server markers remain effective. No reset is invented for accounts
-- with null markers. No invoices, payments or audit history are deleted or updated.
insert into public.generator_cashbox_entries(generator_id,source_id,occurred_at,amount)
select a.generator_id,a.id,a.timestamp,
  case when a.category='cancellation' then -greatest(coalesce(a.amount,0),0) else greatest(coalesce(a.amount,0),0) end
from public.generator_audit_logs a join public.generator_settings s on s.generator_id=a.generator_id
where s.wallet_reset_timestamp is not null and a.category in ('payment','cancellation');
insert into public.generator_cashbox_resets(generator_id,request_id,reset_at,baseline_sequence,reset_by)
select generator_id,gen_random_uuid(),wallet_reset_timestamp,0,'00000000-0000-0000-0000-000000000000'::uuid
from public.generator_settings where wallet_reset_timestamp is not null;

-- Publish only immutable reset markers; normal collection notifications already come
-- from generator_audit_logs. Guard for installations without the publication.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.generator_cashbox_resets;
  end if;
end $$;

