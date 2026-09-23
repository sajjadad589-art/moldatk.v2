-- Moldatk security hardening: restrict internal RPCs and add server-side auth throttling.

create schema if not exists moldatk_private;

create table if not exists moldatk_private.auth_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default clock_timestamp(),
  attempts integer not null default 0 check (attempts >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);

create index if not exists auth_rate_limits_blocked_until_idx
  on moldatk_private.auth_rate_limits (blocked_until)
  where blocked_until is not null;

create or replace function public.consume_moldatk_auth_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer,
  p_increment boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_attempts integer;
  v_blocked_until timestamptz;
  v_next_attempts integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if coalesce(length(p_key_hash), 0) < 16
     or p_limit < 1
     or p_window_seconds < 1
     or p_block_seconds < 1 then
    raise exception 'invalid_rate_limit_parameters';
  end if;

  insert into moldatk_private.auth_rate_limits (
    key_hash, window_started_at, attempts, blocked_until, updated_at
  )
  values (
    p_key_hash, v_now, 0, null, v_now
  )
  on conflict (key_hash) do nothing;

  select window_started_at, attempts, blocked_until
    into v_window_started_at, v_attempts, v_blocked_until
  from moldatk_private.auth_rate_limits
  where key_hash = p_key_hash
  for update;

  if v_blocked_until is not null and v_blocked_until > v_now then
    return false;
  end if;

  if v_now >= v_window_started_at + make_interval(secs => p_window_seconds) then
    update moldatk_private.auth_rate_limits
       set window_started_at = v_now,
           attempts = case when p_increment then 1 else 0 end,
           blocked_until = null,
           updated_at = v_now
     where key_hash = p_key_hash;
    return true;
  end if;

  if not p_increment then
    return v_attempts < p_limit;
  end if;

  v_next_attempts := v_attempts + 1;

  if v_next_attempts > p_limit then
    update moldatk_private.auth_rate_limits
       set attempts = v_next_attempts,
           blocked_until = v_now + make_interval(secs => p_block_seconds),
           updated_at = v_now
     where key_hash = p_key_hash;
    return false;
  end if;

  update moldatk_private.auth_rate_limits
     set attempts = v_next_attempts,
         updated_at = v_now
   where key_hash = p_key_hash;

  return true;
end;
$$;

revoke all on function public.consume_moldatk_auth_rate_limit(text, integer, integer, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.consume_moldatk_auth_rate_limit(text, integer, integer, integer, boolean)
  to service_role;

revoke execute on function public.cleanup_collector_line_assignment_on_delete()
  from public, anon, authenticated;
revoke execute on function public.enforce_collector_invoice_change()
  from public, anon, authenticated;
revoke execute on function public.enforce_collector_subscriber_change()
  from public, anon, authenticated;
revoke execute on function public.moldatk_enforce_line_count()
  from public, anon, authenticated;
revoke execute on function public.moldatk_sync_line_counts_from_subscriber()
  from public, anon, authenticated;
revoke execute on function public.sync_app_notification_dates()
  from public, anon, authenticated;
revoke execute on function public.touch_app_ad_slides_updated_at()
  from public, anon, authenticated;
revoke execute on function public.touch_customer_order_updated_at()
  from public, anon, authenticated;

grant execute on function public.cleanup_collector_line_assignment_on_delete() to service_role;
grant execute on function public.enforce_collector_invoice_change() to service_role;
grant execute on function public.enforce_collector_subscriber_change() to service_role;
grant execute on function public.moldatk_enforce_line_count() to service_role;
grant execute on function public.moldatk_sync_line_counts_from_subscriber() to service_role;
grant execute on function public.sync_app_notification_dates() to service_role;
grant execute on function public.touch_app_ad_slides_updated_at() to service_role;
grant execute on function public.touch_customer_order_updated_at() to service_role;

revoke execute on function public.moldatk_recount_generator_line(uuid, text)
  from public, anon, authenticated;
grant execute on function public.moldatk_recount_generator_line(uuid, text)
  to service_role;

revoke execute on function public.activate_app_release(uuid) from public, anon;
grant execute on function public.activate_app_release(uuid) to authenticated, service_role;

revoke execute on function public.collector_can_access_line(uuid, text) from public, anon;
grant execute on function public.collector_can_access_line(uuid, text) to authenticated, service_role;

revoke execute on function public.collector_can_access_subscriber(uuid, text) from public, anon;
grant execute on function public.collector_can_access_subscriber(uuid, text) to authenticated, service_role;

revoke execute on function public.collector_has_permission(uuid, text) from public, anon;
grant execute on function public.collector_has_permission(uuid, text) to authenticated, service_role;

revoke execute on function public.is_active_collector_for(uuid) from public, anon;
grant execute on function public.is_active_collector_for(uuid) to authenticated, service_role;

revoke execute on function public.is_generator_admin_for(uuid) from public, anon;
grant execute on function public.is_generator_admin_for(uuid) to authenticated, service_role;

alter function public.touch_customer_order_updated_at() set search_path = 'public';
