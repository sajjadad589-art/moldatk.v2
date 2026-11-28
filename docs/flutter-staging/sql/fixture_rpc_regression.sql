-- Run after the candidate against the disposable schema as its privileged test harness.
begin;
insert into generators values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into profiles values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Fixture owner',true,'generator_admin'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','Fixture collector',true,'employee');
insert into generator_sync_state values ('11111111-1111-4111-8111-111111111111',0);
insert into generator_lines(generator_id,id,name) values
 ('11111111-1111-4111-8111-111111111111','line-a','A'),
 ('22222222-2222-4222-8222-222222222222','foreign','B');
insert into generator_monthly_tariffs(generator_id,id,month_name_ar,is_current_active,tiers) values
 ('11111111-1111-4111-8111-111111111111','2026-10','October',false,
 '[{"id":"normal","type":"normal","pricePerAmpere":10000,"fixedFee":5000}]'),
 ('11111111-1111-4111-8111-111111111111','2026-11','November',true,
 '[{"id":"normal","type":"normal","pricePerAmpere":15000,"fixedFee":0},{"id":"free","type":"free","pricePerAmpere":0,"fixedFee":0}]');
select set_config('fixture.actor','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('fixture.access','active',true);
select set_config('request.headers','{"x-moldatk-sync-epoch":"0"}',true);

-- Permission checks are made from the fixture's privileged harness.
do $$ declare f text; begin
 foreach f in array array['public.flutter_stage_create_subscriber_v1(jsonb,bigint)','public.flutter_stage_edit_subscriber_profile_v1(jsonb,bigint)','public.flutter_stage_move_subscriber_line_v1(jsonb,bigint)','public.flutter_stage_collect_payment_v1(jsonb,bigint)','public.flutter_stage_reverse_payment_v1(jsonb,bigint)','public.flutter_stage_payment_status_v1(jsonb,bigint)'] loop
   if not has_function_privilege('authenticated',f,'EXECUTE')
     or has_function_privilege('anon',f,'EXECUTE')
     or has_function_privilege('service_role',f,'EXECUTE') then
     raise exception 'unexpected wrapper permission: %',f;
   end if;
 end loop;
end $$;
set local role authenticated;
do $$
declare
 base jsonb := '{"requestId":"11111111-0000-4000-8000-111111111111","fullName":"Fixture","code":null,"phone":"","tierId":"normal","lineId":"line-a","amperes":10,"discountAmperes":2,"debtMode":"prior","priorMonth":"2026-10","expectedCurrentMonth":"2026-11","expectedDebtIqd":85000}';
 response jsonb; rejected boolean;
begin
 rejected:=false;
 begin
   perform public.flutter_stage_create_subscriber_v1(base,1);
 exception when others then
   if sqlerrm<>'MOLDATK_STALE_SYNC_EPOCH' then raise; end if;
   rejected:=true;
 end;
 if not rejected then raise exception 'stale header accepted'; end if;
 response:=public.flutter_stage_create_subscriber_v1(base,0);
 if response->>'amountDueIqd' is distinct from '85000'
    or response->>'replayed' is distinct from 'false' then raise exception 'wrapper result mismatch'; end if;
 response:=public.flutter_stage_create_subscriber_v1(base,0);
 if response->>'replayed' is distinct from 'true' then raise exception 'wrapper replay failed'; end if;
 perform set_config('fixture.actor','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
 rejected:=false;
 begin
   perform public.flutter_stage_create_subscriber_v1(base,0);
 exception when others then
   if sqlstate not in ('42501','P0002') then raise; end if;
   rejected:=true;
 end;
 if not rejected then raise exception 'collector accepted'; end if;
 perform set_config('fixture.actor','',true);
 rejected:=false;
 begin
   perform public.flutter_stage_create_subscriber_v1(base,0);
 exception when insufficient_privilege then rejected:=true;
 end;
 if not rejected then raise exception 'missing actor accepted'; end if;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.generator_subscribers)<>1 then
   raise exception 'wrapper duplicated subscriber';
 end if;
end $$;
rollback;
