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

do $$
declare
  command jsonb;
  response jsonb;
  caught boolean:=false;
  sid text;
  original_invoice jsonb;
begin
  response:=moldatk_private.flutter_create_subscriber_v1(
    '{"requestId":"11111111-0000-4000-8000-111111111111","fullName":"Fixture","code":null,"phone":"","tierId":"normal","lineId":"line-a","amperes":10,"discountAmperes":2,"debtMode":"prior","priorMonth":"2026-10","expectedCurrentMonth":"2026-11","expectedDebtIqd":85000}',0);
  sid:=response->>'subscriberId';
  select jsonb_agg(to_jsonb(i) order by id) into original_invoice from generator_invoices i;
  command:=jsonb_build_object('requestId','77777777-0000-4000-8000-777777777777',
    'subscriberId',sid,'fullName','Updated','phone','07700000000',
    'expectedUpdatedAt',(select updated_at from generator_subscribers where id=sid));
  response:=moldatk_private.flutter_edit_subscriber_profile_v1(command,0);
  if response->>'ok' is distinct from 'true' or response->>'replayed' is distinct from 'false'
    or not exists(select 1 from generator_subscribers where id=sid and full_name='Updated'
      and phone='07700000000' and amount_due=85000 and amperes=10 and ampere_discount=2)
    then raise exception 'profile update mismatch'; end if;
  if original_invoice is distinct from (select jsonb_agg(to_jsonb(i) order by id) from generator_invoices i)
    then raise exception 'invoice changed'; end if;
  response:=moldatk_private.flutter_edit_subscriber_profile_v1(command,0);
  if response->>'replayed' is distinct from 'true' or (select count(*) from generator_audit_logs)<>2
    then raise exception 'profile retry duplicated'; end if;
  begin
    perform moldatk_private.flutter_edit_subscriber_profile_v1(command||'{"requestId":"88888888-0000-4000-8000-888888888888","fullName":"Stale"}',0);
  exception when others then
    if sqlerrm<>'subscriber_changed' then raise; end if;
    caught:=true;
  end;
  if not caught then raise exception 'stale profile overwrite'; end if;
  caught:=false;
  begin
    perform moldatk_private.flutter_edit_subscriber_profile_v1(command||'{"amountDue":0}',0);
  exception when others then
    if sqlerrm<>'invalid_profile_command' then raise; end if;
    caught:=true;
  end;
  if not caught then raise exception 'financial field accepted'; end if;
  if has_function_privilege('authenticated','moldatk_private.flutter_edit_subscriber_profile_v1(jsonb,bigint)','EXECUTE')
    then raise exception 'unexpected direct access'; end if;
  raise notice 'PASS: profile edit, untouched invoice history, duplicate retry, stale version, financial-field rejection';
end;
$$;
rollback;
