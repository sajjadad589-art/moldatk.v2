-- REVIEW / DISPOSABLE FIXTURE ONLY. Never install in production.
-- This file intentionally refuses any database other than moldatk_fixture.
-- A hosted staging installation needs a separately reviewed environment gate.
begin;
do $$ begin
 if current_database() <> 'moldatk_fixture' then
   raise exception 'fixture_only';
 end if;
end $$;
create function public.flutter_stage_create_subscriber_v1(p_command jsonb,p_expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if current_database()<>'moldatk_fixture' then raise exception 'fixture_only'; end if;
 if auth.uid() is null then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_expected_epoch is null or p_expected_epoch<0 or
   (coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-moldatk-sync-epoch') is distinct from p_expected_epoch::text then
   raise exception 'MOLDATK_STALE_SYNC_EPOCH';
 end if;
 return moldatk_private.flutter_create_subscriber_v1(p_command,p_expected_epoch);
exception when no_data_found then
 -- Do not reveal whether a foreign resource or unauthorized actor exists.
 raise exception 'operation_not_authorized_or_unavailable' using errcode='42501';
end;
$$;
revoke all on function public.flutter_stage_create_subscriber_v1(jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function public.flutter_stage_create_subscriber_v1(jsonb,bigint) to authenticated;
create function public.flutter_stage_edit_subscriber_profile_v1(p_command jsonb,p_expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if current_database()<>'moldatk_fixture' then raise exception 'fixture_only'; end if;
 if auth.uid() is null then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_expected_epoch is null or p_expected_epoch<0 or
   (coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-moldatk-sync-epoch') is distinct from p_expected_epoch::text then
   raise exception 'MOLDATK_STALE_SYNC_EPOCH';
 end if;
 return moldatk_private.flutter_edit_subscriber_profile_v1(p_command,p_expected_epoch);
exception when no_data_found then
 -- Do not reveal whether a foreign resource or unauthorized actor exists.
 raise exception 'operation_not_authorized_or_unavailable' using errcode='42501';
end;
$$;
revoke all on function public.flutter_stage_edit_subscriber_profile_v1(jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function public.flutter_stage_edit_subscriber_profile_v1(jsonb,bigint) to authenticated;
create function public.flutter_stage_move_subscriber_line_v1(p_command jsonb,p_expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if current_database()<>'moldatk_fixture' then raise exception 'fixture_only'; end if;
 if auth.uid() is null then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_expected_epoch is null or p_expected_epoch<0 or
   (coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-moldatk-sync-epoch') is distinct from p_expected_epoch::text then
   raise exception 'MOLDATK_STALE_SYNC_EPOCH';
 end if;
 return moldatk_private.flutter_move_subscriber_line_v1(p_command,p_expected_epoch);
exception when no_data_found then
 -- Do not reveal whether a foreign resource or unauthorized actor exists.
 raise exception 'operation_not_authorized_or_unavailable' using errcode='42501';
end;
$$;
revoke all on function public.flutter_stage_move_subscriber_line_v1(jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function public.flutter_stage_move_subscriber_line_v1(jsonb,bigint) to authenticated;
create function public.flutter_stage_collect_payment_v1(p_command jsonb,p_expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if current_database()<>'moldatk_fixture' then raise exception 'fixture_only'; end if;
 if auth.uid() is null then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_expected_epoch is null or p_expected_epoch<0 or
   (coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-moldatk-sync-epoch') is distinct from p_expected_epoch::text then
   raise exception 'MOLDATK_STALE_SYNC_EPOCH';
 end if;
 return moldatk_private.flutter_collect_payment_v1(p_command,p_expected_epoch);
exception when no_data_found then
 -- Do not reveal whether a foreign resource or unauthorized actor exists.
 raise exception 'operation_not_authorized_or_unavailable' using errcode='42501';
end;
$$;
revoke all on function public.flutter_stage_collect_payment_v1(jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function public.flutter_stage_collect_payment_v1(jsonb,bigint) to authenticated;
create function public.flutter_stage_reverse_payment_v1(p_command jsonb,p_expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if current_database()<>'moldatk_fixture' then raise exception 'fixture_only'; end if;
 if auth.uid() is null then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_expected_epoch is null or p_expected_epoch<0 or
   (coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-moldatk-sync-epoch') is distinct from p_expected_epoch::text then
   raise exception 'MOLDATK_STALE_SYNC_EPOCH';
 end if;
 return moldatk_private.flutter_reverse_payment_v1(p_command,p_expected_epoch);
exception when no_data_found then
 -- Do not reveal whether a foreign resource or unauthorized actor exists.
 raise exception 'operation_not_authorized_or_unavailable' using errcode='42501';
end;
$$;
revoke all on function public.flutter_stage_reverse_payment_v1(jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function public.flutter_stage_reverse_payment_v1(jsonb,bigint) to authenticated;
create function public.flutter_stage_payment_status_v1(p_command jsonb,p_expected_epoch bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if current_database()<>'moldatk_fixture' then raise exception 'fixture_only'; end if;
 if auth.uid() is null then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_expected_epoch is null or p_expected_epoch<0 or
   (coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-moldatk-sync-epoch') is distinct from p_expected_epoch::text then
   raise exception 'MOLDATK_STALE_SYNC_EPOCH';
 end if;
 return moldatk_private.flutter_payment_status_v1(p_command,p_expected_epoch);
exception when no_data_found then
 -- Do not reveal whether a foreign resource or unauthorized actor exists.
 raise exception 'operation_not_authorized_or_unavailable' using errcode='42501';
end;
$$;
revoke all on function public.flutter_stage_payment_status_v1(jsonb,bigint) from public,anon,authenticated,service_role;
grant execute on function public.flutter_stage_payment_status_v1(jsonb,bigint) to authenticated;
commit;
