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
do $$
declare
  base jsonb := '{"requestId":"11111111-0000-4000-8000-111111111111","fullName":"Fixture","code":null,"phone":"","tierId":"normal","lineId":"line-a","amperes":10,"discountAmperes":2,"debtMode":"prior","priorMonth":"2026-10","expectedCurrentMonth":"2026-11","expectedDebtIqd":85000}';
  other jsonb;
  result jsonb;
  sid text;
  n integer;
  caught boolean;
begin
  if has_function_privilege('authenticated','moldatk_private.flutter_create_subscriber_v1(jsonb,bigint)','EXECUTE') then
    raise exception 'candidate is unexpectedly exposed';
  end if;
  result := moldatk_private.flutter_create_subscriber_v1(base,0);
  if result->>'ok' is distinct from 'true' or result->>'amountDueIqd' is distinct from '85000'
    or result->>'replayed' is distinct from 'false' then raise exception 'invalid initial receipt: %',result; end if;
  sid := result->>'subscriberId';
  select count(*) into n from generator_invoices where subscriber_id=sid;
  if n<>2 then raise exception 'expected debt and zero marker'; end if;
  if not exists(select 1 from generator_invoices where subscriber_id=sid and month_id='2026-10'
    and total_amount=85000 and gross_amount_before_discount=105000 and discount_amount=20000
    and paid_amount=0 and status='unpaid') then raise exception 'historical invoice mismatch'; end if;
  if not exists(select 1 from generator_invoices where subscriber_id=sid and month_id='2026-11'
    and total_amount=0 and notes like 'MOLDATK_ONBOARDING_NO_CURRENT_CHARGE%') then
    raise exception 'missing no-double-billing marker'; end if;
  result := moldatk_private.flutter_create_subscriber_v1(base,0);
  if result->>'replayed' is distinct from 'true' or result->>'subscriberId' is distinct from sid then
    raise exception 'bad replay'; end if;
  if (select count(*) from generator_subscribers)<>1 or (select count(*) from generator_audit_logs)<>1
    then raise exception 'duplicate effects'; end if;
  caught := false;
  begin
    perform moldatk_private.flutter_create_subscriber_v1(base||'{"fullName":"Changed"}',0);
  exception when others then
    if sqlerrm<>'request_conflict_or_reset' then raise; end if;
    caught := true;
  end;
  if not caught then raise exception 'conflicting replay accepted'; end if;
  other := base||'{"requestId":"22222222-0000-4000-8000-222222222222","debtMode":"none","priorMonth":null,"expectedDebtIqd":0}';
  perform set_config('fixture.fail_invoice','yes',true);
  caught := false;
  begin
    perform moldatk_private.flutter_create_subscriber_v1(other,0);
  exception when others then
    if sqlerrm<>'fixture_invoice_failure' then raise; end if;
    caught := true;
  end;
  if not caught or (select count(*) from generator_subscribers)<>1
    or (select count(*) from moldatk_private.flutter_create_requests)<>1 then
    raise exception 'rollback failed'; end if;
  perform set_config('fixture.fail_invoice','no',true);
  result := moldatk_private.flutter_create_subscriber_v1(other,0);
  if result->>'amountDueIqd' is distinct from '0' then raise exception 'no debt mismatch'; end if;
  other := base||'{"requestId":"33333333-0000-4000-8000-333333333333","tierId":"free","debtMode":"free","priorMonth":null,"expectedDebtIqd":0}';
  result := moldatk_private.flutter_create_subscriber_v1(other,0);
  if not exists(select 1 from generator_subscribers where id=result->>'subscriberId'
    and payment_status='free' and ampere_discount=0) then raise exception 'free subscriber mismatch'; end if;
  if not exists(select 1 from generator_lines where id='line-a' and subscribers_count=3
    and current_load_amperes=30) then raise exception 'line recount mismatch'; end if;
  other := base||'{"requestId":"55555555-0000-4000-8000-555555555555","lineId":"foreign"}';
  caught := false;
  begin
    perform moldatk_private.flutter_create_subscriber_v1(other,0);
  exception when no_data_found then caught := true;
  end;
  if not caught then raise exception 'cross tenant line accepted'; end if;
  other := base||'{"requestId":"66666666-0000-4000-8000-666666666666","expectedDebtIqd":1}';
  caught := false;
  begin
    perform moldatk_private.flutter_create_subscriber_v1(other,0);
  exception when others then
    if sqlerrm<>'stale_debt_confirmation' then raise; end if;
    caught := true;
  end;
  if not caught then raise exception 'stale debt accepted'; end if;
  perform set_config('fixture.actor','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
  caught := false;
  begin
    perform moldatk_private.flutter_create_subscriber_v1(base,0);
  exception when no_data_found or insufficient_privilege then caught := true;
  end;
  if not caught then raise exception 'collector write accepted'; end if;
  perform set_config('fixture.actor','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
  delete from generator_subscribers where id=sid;
  caught := false;
  begin
    perform moldatk_private.flutter_create_subscriber_v1(base,0);
  exception when others then
    if sqlerrm<>'request_conflict_or_reset' then raise; end if;
    caught := true;
  end;
  if not caught then raise exception 'deleted subscriber resurrected'; end if;
  perform set_config('fixture.access','expired',true);
  caught := false;
  begin
    perform moldatk_private.flutter_create_subscriber_v1(base,0);
  exception when insufficient_privilege then caught := true;
  end;
  if not caught then raise exception 'expired replay accepted'; end if;
  perform set_config('fixture.access','active',true);
  update generator_sync_state set epoch=1;
  caught := false;
  begin
    perform moldatk_private.flutter_create_subscriber_v1(base,0);
  exception when others then
    if sqlerrm<>'MOLDATK_STALE_SYNC_EPOCH' then raise; end if;
    caught := true;
  end;
  if not caught then raise exception 'old epoch accepted'; end if;
  raise notice 'PASS: debt, zero marker, free, receipt replay, conflict, rollback, recount, expiration and reset';
end;
$$;
rollback;
