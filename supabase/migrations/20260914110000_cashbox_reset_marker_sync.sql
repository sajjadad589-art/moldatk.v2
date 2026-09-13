create or replace function moldatk_private.reset_generator_cashbox(p_generator_id uuid,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_baseline bigint; v_reset_at timestamptz;
begin
  if auth.uid() is null or not public.is_generator_admin_for(p_generator_id) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  if p_request_id is null then raise exception 'request_id_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_generator_id::text,71632));
  select reset_at into v_reset_at
    from public.generator_cashbox_resets
    where generator_id=p_generator_id and request_id=p_request_id;
  if v_reset_at is null then
    select coalesce(max(sequence),0) into v_baseline
      from public.generator_cashbox_entries where generator_id=p_generator_id;
    v_reset_at := clock_timestamp();
    insert into public.generator_cashbox_resets(generator_id,request_id,reset_at,baseline_sequence,reset_by)
      values(p_generator_id,p_request_id,v_reset_at,v_baseline,auth.uid());
    update public.generator_settings
      set wallet_reset_timestamp=v_reset_at
      where generator_id=p_generator_id;
  end if;
  return public.get_generator_cashbox(p_generator_id);
end;
$$;