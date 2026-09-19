-- Authoritative owner/collector subscription access using the server clock.
-- This prevents collector devices from being falsely locked when the generator subscription is active.

create or replace function public.get_my_subscription_access_state()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_generator_id uuid;
  v_generator public.generators%rowtype;
  v_current public.subscriptions%rowtype;
  v_latest public.subscriptions%rowtype;
  v_now timestamptz := now();
  v_has_current boolean := false;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select p.generator_id
    into v_generator_id
  from public.profiles p
  where p.id = v_uid
    and p.is_active = true
  limit 1;

  if v_generator_id is null then
    return jsonb_build_object('ok', false, 'reason', 'generator_not_linked', 'serverNow', v_now);
  end if;

  select g.*
    into v_generator
  from public.generators g
  where g.id = v_generator_id
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'generator_not_found', 'serverNow', v_now);
  end if;

  select s.*
    into v_current
  from public.subscriptions s
  where s.generator_id = v_generator_id
    and s.status = 'active'
    and s.starts_at <= v_now
    and s.ends_at > v_now
  order by s.ends_at desc, s.created_at desc
  limit 1;

  v_has_current := found;

  if not v_has_current then
    select s.*
      into v_latest
    from public.subscriptions s
    where s.generator_id = v_generator_id
    order by s.ends_at desc, s.created_at desc
    limit 1;
  else
    v_latest := v_current;
  end if;

  return jsonb_build_object(
    'ok', true,
    'serverNow', v_now,
    'accessActive', (v_generator.status = 'active' and v_has_current),
    'generator', jsonb_build_object(
      'id', v_generator.id,
      'name', coalesce(v_generator.name, 'مولدتك'),
      'ownerName', coalesce(v_generator.owner_name, 'صاحب المولدة'),
      'phone', v_generator.phone,
      'area', v_generator.area,
      'status', v_generator.status,
      'suspensionReason', v_generator.suspension_reason
    ),
    'subscription',
      case when v_latest.id is null then null
      else jsonb_build_object(
        'startsAt', v_latest.starts_at,
        'endsAt', v_latest.ends_at,
        'status', v_latest.status
      )
      end
  );
end;
$$;

revoke all on function public.get_my_subscription_access_state() from public, anon;
grant execute on function public.get_my_subscription_access_state() to authenticated, service_role;

comment on function public.get_my_subscription_access_state() is
  'Returns authoritative subscription access for the authenticated profile generator. Uses server time and works identically for owner and collector accounts.';
