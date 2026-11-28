-- PRIVATE REVIEW CANDIDATE. Do not deploy before staging validation.
begin;
create table moldatk_private.flutter_profile_requests (
  generator_id uuid not null references public.generators(id) on delete cascade,
  actor_id uuid not null,
  request_id uuid not null,
  epoch bigint not null,
  fingerprint text not null,
  subscriber_id text not null,
  primary key(generator_id,actor_id,request_id)
);
alter table moldatk_private.flutter_profile_requests enable row level security;
revoke all on moldatk_private.flutter_profile_requests from public,anon,authenticated;

create function moldatk_private.flutter_edit_subscriber_profile_v1(
  p_command jsonb,p_expected_epoch bigint
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  actor uuid := auth.uid();
  gid uuid;
  actor_name text;
  access_state jsonb;
  epoch_now bigint;
  rid uuid;
  fingerprint text;
  sid text;
  previous moldatk_private.flutter_profile_requests%rowtype;
  old_row public.generator_subscribers%rowtype;
  next_name text;
  next_phone text;
begin
  if actor is null then raise exception 'not_authorized' using errcode='42501'; end if;
  select p.generator_id,p.full_name into strict gid,actor_name from public.profiles p
    where p.id=actor and p.is_active and p.role='generator_admin' for share;
  if gid is null or public.is_generator_admin_for(gid) is distinct from true then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(gid::text,89144));
  select coalesce((select epoch from public.generator_sync_state where generator_id=gid),0) into epoch_now;
  if p_expected_epoch is distinct from epoch_now
    or coalesce(coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb
       ->>'x-moldatk-sync-epoch','0')<>epoch_now::text then
    raise exception 'MOLDATK_STALE_SYNC_EPOCH';
  end if;
  access_state:=public.get_my_subscription_access_state();
  if access_state->>'ok' is distinct from 'true' or access_state->>'accessActive' is distinct from 'true'
    or access_state#>>'{generator,id}' is distinct from gid::text then
    raise exception 'subscription_unavailable' using errcode='42501';
  end if;
  if jsonb_typeof(p_command) is distinct from 'object'
    or coalesce(p_command->>'requestId','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or jsonb_typeof(p_command->'subscriberId') is distinct from 'string'
    or jsonb_typeof(p_command->'fullName') is distinct from 'string'
    or jsonb_typeof(p_command->'phone') is distinct from 'string'
    or jsonb_typeof(p_command->'expectedUpdatedAt') is distinct from 'string'
    or exists(select 1 from jsonb_object_keys(p_command) k(key)
      where key not in ('requestId','subscriberId','fullName','phone','expectedUpdatedAt')) then
    raise exception 'invalid_profile_command';
  end if;
  rid:=(p_command->>'requestId')::uuid;
  sid:=p_command->>'subscriberId';
  next_name:=trim(p_command->>'fullName');
  next_phone:=trim(p_command->>'phone');
  if next_name='' or length(next_name)>200 or length(next_phone)>40 or sid='' then
    raise exception 'invalid_profile_fields';
  end if;
  fingerprint:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
  select * into previous from moldatk_private.flutter_profile_requests
    where generator_id=gid and actor_id=actor and request_id=rid;
  if found then
    if previous.epoch<>epoch_now or previous.fingerprint<>fingerprint
      or not exists(select 1 from public.generator_subscribers where generator_id=gid and id=previous.subscriber_id) then
      raise exception 'request_conflict_or_reset';
    end if;
    return jsonb_build_object('ok',true,'requestId',rid,'generatorId',gid,'subscriberId',sid,'replayed',true);
  end if;
  select * into strict old_row from public.generator_subscribers where generator_id=gid and id=sid for update;
  if old_row.updated_at is distinct from (p_command->>'expectedUpdatedAt')::timestamptz then
    raise exception 'subscriber_changed';
  end if;
  if old_row.full_name=next_name and old_row.phone=next_phone then
    raise exception 'no_profile_change';
  end if;
  update public.generator_subscribers set full_name=next_name,phone=next_phone,updated_at=clock_timestamp()
    where generator_id=gid and id=sid;
  insert into public.generator_audit_logs
    (id,generator_id,category,title,details,entity_id,entity_name,actor_name)
    values ('flutter-profile-'||rid::text,gid,'subscriber','تعديل بيانات المشترك',
      'تعديل الاسم أو الهاتف دون تعديل الفواتير',sid,next_name,actor_name);
  insert into moldatk_private.flutter_profile_requests
    (generator_id,actor_id,request_id,epoch,fingerprint,subscriber_id)
    values (gid,actor,rid,epoch_now,fingerprint,sid);
  return jsonb_build_object('ok',true,'requestId',rid,'generatorId',gid,'subscriberId',sid,'replayed',false);
end;
$$;
revoke all on function moldatk_private.flutter_edit_subscriber_profile_v1(jsonb,bigint)
  from public,anon,authenticated,service_role;
commit;
