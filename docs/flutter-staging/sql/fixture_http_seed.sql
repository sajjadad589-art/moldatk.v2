-- Synthetic HTTP fixture, executed only after private SQL and role regressions.
do $$ begin
 if current_database()<>'moldatk_fixture' then raise exception 'fixture_only'; end if;
end $$;
create role fixture_http login noinherit password 'fixture_http_only';
grant anon,authenticated to fixture_http;
grant usage on schema public to anon,authenticated;
insert into generators values ('33333333-3333-4333-8333-333333333333'),('44444444-4444-4444-8444-444444444444');
insert into profiles values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','33333333-3333-4333-8333-333333333333','HTTP owner',true,'generator_admin'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','33333333-3333-4333-8333-333333333333','HTTP collector',true,'employee'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','44444444-4444-4444-8444-444444444444','Foreign owner',true,'generator_admin');
insert into generator_sync_state values ('33333333-3333-4333-8333-333333333333',0),('44444444-4444-4444-8444-444444444444',0);
insert into generator_lines(generator_id,id,name) values
 ('33333333-3333-4333-8333-333333333333','http-a','A'),
 ('33333333-3333-4333-8333-333333333333','http-b','B');
insert into generator_monthly_tariffs(generator_id,id,month_name_ar,is_current_active,tiers,created_at) values
 ('33333333-3333-4333-8333-333333333333','2026-10','October',false,
 '[{"id":"normal","type":"normal","pricePerAmpere":10000,"fixedFee":5000}]','2026-10-01T00:00:00Z'),
 ('33333333-3333-4333-8333-333333333333','2026-11','November',true,
 '[{"id":"normal","type":"normal","pricePerAmpere":15000,"fixedFee":0}]','2026-11-01T00:00:00Z');
