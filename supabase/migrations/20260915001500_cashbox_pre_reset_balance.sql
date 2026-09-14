-- Cashbox must report collections even if the owner has never pressed reset.
-- Existing reset semantics remain unchanged: after a reset, only entries newer than
-- the reset baseline and timestamp are counted.
create or replace function public.get_generator_cashbox(p_generator_id uuid) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_reset public.generator_cashbox_resets%rowtype;
  v_balance bigint;
begin
  if auth.uid() is null or not (public.is_generator_admin_for(p_generator_id) or public.is_active_collector_for(p_generator_id)) then
    raise exception 'not_authorized' using errcode='42501';
  end if;

  select * into v_reset
  from public.generator_cashbox_resets
  where generator_id=p_generator_id
  order by reset_at desc, request_id desc
  limit 1;

  if not found then
    select greatest(coalesce(sum(amount),0),0)
      into v_balance
    from public.generator_cashbox_entries
    where generator_id=p_generator_id;

    return jsonb_build_object(
      'reset_id', null,
      'reset_at', null,
      'balance', v_balance
    );
  end if;

  select greatest(coalesce(sum(amount),0),0)
    into v_balance
  from public.generator_cashbox_entries
  where generator_id=p_generator_id
    and sequence>v_reset.baseline_sequence
    and occurred_at>v_reset.reset_at;

  return jsonb_build_object(
    'reset_id', v_reset.request_id,
    'reset_at', v_reset.reset_at,
    'balance', v_balance
  );
end;
$$;

revoke all on function public.get_generator_cashbox(uuid) from public, anon;
grant execute on function public.get_generator_cashbox(uuid) to authenticated;

-- Idempotent repair for any historical payment/cancellation audit rows that existed
-- before the capture trigger was installed or were missed during an older deployment.
insert into public.generator_cashbox_entries(generator_id, source_id, occurred_at, amount)
select
  a.generator_id,
  a.id,
  a.timestamp,
  case
    when a.category='cancellation' then -greatest(coalesce(a.amount,0),0)
    else greatest(coalesce(a.amount,0),0)
  end
from public.generator_audit_logs a
where a.category in ('payment','cancellation')
on conflict(generator_id, source_id) do nothing;
