-- owner_ai_issues does not have a subscriber_id column. AI JSON/reference cleanup is
-- handled by generator-data-cleanup; the atomic core delete relies on financial FKs.
create or replace function public.delete_generator_subscriber_permanent(p_generator_id uuid,p_subscriber_id text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_exists boolean; v_line_id text;
begin
  if auth.role()<>'service_role' and (auth.uid() is null or not public.is_generator_admin_for(p_generator_id)) then raise exception 'not_authorized' using errcode='42501'; end if;
  if coalesce(trim(p_subscriber_id),'')='' then raise exception 'subscriber_id_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_generator_id::text,89143));
  select true,line_id into v_exists,v_line_id from public.generator_subscribers where generator_id=p_generator_id and id=p_subscriber_id limit 1;
  if not coalesce(v_exists,false) then return jsonb_build_object('ok',true,'already_deleted',true,'subscriber_id',p_subscriber_id); end if;
  delete from public.generator_audit_logs where generator_id=p_generator_id and entity_id=p_subscriber_id;
  delete from public.generator_subscribers where generator_id=p_generator_id and id=p_subscriber_id;
  if v_line_id is not null then perform public.moldatk_recount_generator_line(p_generator_id,v_line_id); end if;
  return jsonb_build_object('ok',true,'subscriber_id',p_subscriber_id,'purged',true);
end;
$$;
revoke all on function public.delete_generator_subscriber_permanent(uuid,text) from public,anon,authenticated;
grant execute on function public.delete_generator_subscriber_permanent(uuid,text) to service_role;
