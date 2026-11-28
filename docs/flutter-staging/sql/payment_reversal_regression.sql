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
update generator_monthly_tariffs set created_at=(id||'-01T00:00:00Z')::timestamptz;
select set_config('fixture.actor','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('fixture.access','active',true);
select set_config('request.headers','{"x-moldatk-sync-epoch":"0"}',true);

do $$
declare sid text; command jsonb; response jsonb; ledger jsonb; caught boolean; reversal jsonb; pid text; recovery jsonb;
begin
 response:=moldatk_private.flutter_create_subscriber_v1(
 '{"requestId":"11111111-0000-4000-8000-111111111111","fullName":"Fixture","code":null,"phone":"","tierId":"normal","lineId":"line-a","amperes":10,"discountAmperes":2,"debtMode":"prior","priorMonth":"2026-10","expectedCurrentMonth":"2026-11","expectedDebtIqd":85000}',0);
 sid:=response->>'subscriberId';
 select jsonb_agg(jsonb_build_object('id',id,'month',month_id,'status',status,'total',total_amount,'paid',paid_amount,'remaining',remaining_amount) order by month_id,id)
 into ledger from generator_invoices where subscriber_id=sid;
 command:=jsonb_build_object('requestId','99999999-0000-4000-8000-999999999999','subscriberId',sid,
 'expectedUpdatedAt',(select updated_at from generator_subscribers where id=sid),'expectedMonth','2026-11','expectedLedger',ledger,'amountIqd',45000);
 recovery:=moldatk_private.flutter_payment_status_v1(command,0);
 if recovery->>'state' is distinct from 'unconfirmed' then raise exception 'unknown request reported committed'; end if;
 perform set_config('request.headers','{}',true);
 caught:=false;
 begin
  perform moldatk_private.flutter_collect_payment_v1(command,0);
 exception when others then
  if sqlerrm<>'MOLDATK_STALE_SYNC_EPOCH' then raise; end if;
  caught:=true;
 end;
 if not caught then raise exception 'missing epoch header accepted'; end if;
 perform set_config('request.headers','{"x-moldatk-sync-epoch":"0"}',true);
 update generator_monthly_tariffs set created_at='2026-11-02T00:00:00Z' where id='2026-10';
 caught:=false;
 begin
  perform moldatk_private.flutter_collect_payment_v1(command,0);
 exception when others then
  if sqlerrm<>'tariff_chronology_mismatch' then raise; end if;
  caught:=true;
 end;
 if not caught then raise exception 'ambiguous chronology accepted'; end if;
 update generator_monthly_tariffs set created_at='2026-10-01T00:00:00Z' where id='2026-10';
 caught:=false;
 begin
  perform moldatk_private.flutter_collect_payment_v1(command||'{"amountIqd":85001}',0);
 exception when others then
  if sqlerrm<>'payment_amount_or_ledger_mismatch' then raise; end if;
  caught:=true;
 end;
 if not caught then raise exception 'overpayment accepted'; end if;
 insert into generator_monthly_accounts(generator_id,subscriber_id,month_id) values ('11111111-1111-4111-8111-111111111111',sid,'2026-11');
 caught:=false;
 begin
  perform moldatk_private.flutter_collect_payment_v1(command,0);
 exception when others then
  if sqlerrm<>'monthly_account_reconciliation_required' then raise; end if;
  caught:=true;
 end;
 if not caught then raise exception 'unverified monthly account mutation'; end if;
 delete from generator_monthly_accounts where subscriber_id=sid;
 insert into generator_monthly_accounts(generator_id,subscriber_id,month_id,month_charge,carried_debt,paid_amount,remaining_amount,status)
 values ('11111111-1111-4111-8111-111111111111',sid,'2026-10',85000,0,0,85000,'unpaid'),
        ('11111111-1111-4111-8111-111111111111',sid,'2026-11',0,85000,0,85000,'unpaid');
 perform set_config('fixture.fail_invoice','yes',true);
 caught:=false;
 begin
  perform moldatk_private.flutter_collect_payment_v1(command,0);
 exception when others then
  if sqlerrm<>'fixture_invoice_failure' then raise; end if;
  caught:=true;
 end;
 if not caught or exists(select 1 from generator_payments) or exists(select 1 from generator_cashbox_entries)
   or exists(select 1 from generator_payment_allocations) then raise exception 'rollback failed'; end if;
 perform set_config('fixture.fail_invoice','no',true);
 response:=moldatk_private.flutter_collect_payment_v1(command,0);
 if response->>'debtAfter' is distinct from '40000' or response->>'appliedToPrevious' is distinct from '45000'
   or response->>'appliedToCurrent' is distinct from '0'
   or not exists(select 1 from generator_subscribers where id=sid and amount_due=40000 and amount_paid=0)
   or not exists(select 1 from generator_invoices where subscriber_id=sid and month_id='2026-10' and paid_amount=45000 and remaining_amount=40000)
   then raise exception 'payment mismatch'; end if;
 if not exists(select 1 from generator_monthly_accounts where subscriber_id=sid and month_id='2026-10'
   and month_charge=85000 and paid_amount=45000 and remaining_amount=40000 and status='partial')
   or not exists(select 1 from generator_monthly_accounts where subscriber_id=sid and month_id='2026-11'
     and month_charge=0 and carried_debt=40000 and remaining_amount=40000 and paid_amount=0)
   then raise exception 'monthly projection mismatch'; end if;
 if not exists(select 1 from generator_payments where subscriber_id=sid
   and receipt_snapshot->>'paidAmount'='45000'
   and receipt_snapshot->>'totalOutstandingAfter'='40000'
   and receipt_snapshot->>'previousDebtBefore'='85000'
   and receipt_snapshot->'paymentAllocations'->0->>'monthId'='2026-10'
   and receipt_snapshot->'paymentAllocations'->0->>'amount'='45000'
   and receipt_snapshot->>'receiptNumber'=receipt_number)
 then raise exception 'legacy receipt snapshot mismatch'; end if;
 response:=moldatk_private.flutter_collect_payment_v1(command,0);
 if response->>'replayed' is distinct from 'true' or (select count(*) from generator_payments)<>1
   or (select count(*) from generator_payment_allocations)<>1
   or (select count(*) from generator_cashbox_entries)<>1
   or (select sum(amount) from generator_cashbox_entries)<>45000 then raise exception 'duplicate collection'; end if;
 if has_function_privilege('authenticated','moldatk_private.flutter_collect_payment_v1(jsonb,bigint)','EXECUTE') then
  raise exception 'unexpected direct access'; end if;
 recovery:=moldatk_private.flutter_payment_status_v1(command,0);
 if recovery->>'state' is distinct from 'committed'
   or recovery->'receipt'->>'paymentId' is distinct from response->>'paymentId'
   or recovery->'receipt'->>'replayed' is distinct from 'true'
   or (select count(*) from generator_payments)<>1 then raise exception 'recovery mismatch'; end if;
 caught:=false;
 begin
   perform moldatk_private.flutter_payment_status_v1(command||'{"amountIqd":1}',0);
 exception when others then
   if sqlerrm<>'request_conflict_or_reset' then raise; end if;
   caught:=true;
 end;
 if not caught then raise exception 'changed recovery payload accepted'; end if;
 pid:=response->>'paymentId';
 reversal:=jsonb_build_object('requestId','abababab-0000-4000-8000-abababababab',
   'paymentId',pid,'reason','Fixture refund','expectedUpdatedAt',(select updated_at from generator_subscribers where id=sid));
 perform set_config('fixture.fail_invoice','yes',true);
 caught:=false;
 begin
   perform moldatk_private.flutter_reverse_payment_v1(reversal,0);
 exception when others then
   if sqlerrm<>'fixture_invoice_failure' then raise; end if;
   caught:=true;
 end;
 if not caught or (select sum(amount) from generator_cashbox_entries)<>45000
   or (select amount_due from generator_subscribers where id=sid)<>40000 then raise exception 'reversal rollback failed'; end if;
 perform set_config('fixture.fail_invoice','no',true);
 response:=moldatk_private.flutter_reverse_payment_v1(reversal,0);
 if response->>'reversedAmount' is distinct from '45000' or response->>'debtAfter' is distinct from '85000'
   or (select sum(amount) from generator_cashbox_entries)<>0
   or (select count(*) from generator_payments)<>1 or (select count(*) from generator_payment_allocations)<>1
   or not exists(select 1 from generator_monthly_accounts where subscriber_id=sid and month_id='2026-11' and remaining_amount=85000)
 then raise exception 'reversal mismatch'; end if;
 response:=moldatk_private.flutter_reverse_payment_v1(reversal,0);
 if response->>'replayed' is distinct from 'true' or (select count(*) from generator_cashbox_entries)<>2
 then raise exception 'duplicate refund'; end if;
 caught:=false;
 begin
   perform moldatk_private.flutter_collect_payment_v1(command,0);
 exception when others then
   if sqlerrm<>'payment_already_reversed' then raise; end if;
   caught:=true;
 end;
 if not caught then raise exception 'reversed receipt returned as active'; end if;
 if has_function_privilege('authenticated','moldatk_private.flutter_reverse_payment_v1(jsonb,bigint)','EXECUTE') then
   raise exception 'unexpected direct access'; end if;
 recovery:=moldatk_private.flutter_payment_status_v1(command,0);
 if recovery->>'state' is distinct from 'reversed' or recovery ? 'receipt'
   then raise exception 'reversed payment reported active'; end if;
 if has_function_privilege('authenticated','moldatk_private.flutter_payment_status_v1(jsonb,bigint)','EXECUTE')
   then raise exception 'unexpected recovery direct access'; end if;
 raise notice 'PASS: recovery unknown, committed, mismatched command, reversed';
 raise notice 'PASS: reversal restores debt, keeps receipt, offsets cashbox, rejects replay as active, rollback';
end;
$$;
rollback;
