#!/usr/bin/env bash
set -euo pipefail
# Only the disposable CI database is supported.
[[ "${PGHOST:-}" == 127.0.0.1 && "${PGDATABASE:-}" == moldatk_fixture ]] || exit 2
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
psql -X -v ON_ERROR_STOP=1 <<'SQL'
insert into generators values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into profiles values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Fixture owner',true,'generator_admin'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','Fixture collector',true,'employee');
insert into generator_sync_state values ('11111111-1111-4111-8111-111111111111',0);
insert into generator_lines(generator_id,id,name) values
 ('11111111-1111-4111-8111-111111111111','line-a','A'),
 ('22222222-2222-4222-8222-222222222222','foreign','B');
insert into generator_monthly_tariffs values
 ('11111111-1111-4111-8111-111111111111','2026-10','October',false,
 '[{"id":"normal","type":"normal","pricePerAmpere":10000,"fixedFee":5000}]'),
 ('11111111-1111-4111-8111-111111111111','2026-11','November',true,
 '[{"id":"normal","type":"normal","pricePerAmpere":15000,"fixedFee":0},{"id":"free","type":"free","pricePerAmpere":0,"fixedFee":0}]');
SQL
cat > "$work/call.sql" <<'SQL'
begin;
select set_config('fixture.actor','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select set_config('fixture.access','active',true);
select set_config('request.headers','{"x-moldatk-sync-epoch":"0"}',true);
select moldatk_private.flutter_create_subscriber_v1(
  '{"requestId":"44444444-0000-4000-8000-444444444444","fullName":"Concurrent","code":"MW-TEST","phone":"","tierId":"normal","lineId":"line-a","amperes":5,"discountAmperes":0,"debtMode":"none","priorMonth":null,"expectedCurrentMonth":"2026-11","expectedDebtIqd":0}',0);
select pg_sleep(0.5);
commit;
SQL
psql -X -v ON_ERROR_STOP=1 -At -f "$work/call.sql" > "$work/a" &
a=$!
psql -X -v ON_ERROR_STOP=1 -At -f "$work/call.sql" > "$work/b" &
b=$!
wait "$a"
wait "$b"
cat "$work/a" "$work/b"
[[ $(grep -h -c '"replayed": false' "$work/a" "$work/b" | awk '{s+=$1} END {print s}') == 1 ]]
[[ $(grep -h -c '"replayed": true' "$work/a" "$work/b" | awk '{s+=$1} END {print s}') == 1 ]]
psql -X -v ON_ERROR_STOP=1 <<'SQL'
do $$
begin
  if (select count(*) from generator_subscribers)<>1
    or (select count(*) from generator_invoices)<>1
    or (select count(*) from generator_audit_logs)<>1
    or (select count(*) from moldatk_private.flutter_create_requests)<>1
    or not exists(select 1 from generator_lines where id='line-a' and subscribers_count=1 and current_load_amperes=5)
  then raise exception 'concurrent duplicate or recount mismatch'; end if;
end;
$$;
SQL
echo 'PASS: simultaneous requests produced a single subscriber, invoice, audit and receipt'
