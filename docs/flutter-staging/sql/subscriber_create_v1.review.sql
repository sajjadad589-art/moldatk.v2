-- STAGING REVIEW CANDIDATE ONLY. Not a migration; do not apply to production.
-- Requires the verified legacy schema, reset epoch guards and an isolated test DB.
begin;

create schema if not exists moldatk_private;
create table moldatk_private.flutter_create_requests (
  generator_id uuid not null references public.generators(id) on delete cascade,
  actor_id uuid not null,
  request_id uuid not null,
  epoch bigint not null check (epoch >= 0),
  payload_hash text not null,
  subscriber_id text not null,
  amount_due bigint not null check (amount_due >= 0),
  primary key (generator_id, actor_id, request_id)
);
alter table moldatk_private.flutter_create_requests enable row level security;
revoke all on moldatk_private.flutter_create_requests from public, anon, authenticated;

create function moldatk_private.flutter_create_subscriber_v1(
  p_command jsonb, p_expected_epoch bigint
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  gid uuid;
  actor_name text;
  access_state jsonb;
  rid uuid;
  fingerprint text;
  epoch_now bigint;
  old_request moldatk_private.flutter_create_requests%rowtype;
  active_tariff public.generator_monthly_tariffs%rowtype;
  prior_tariff public.generator_monthly_tariffs%rowtype;
  tier jsonb;
  historical_tier jsonb;
  tier_type text;
  line_name_value text;
  amps integer;
  discount integer;
  rate bigint := 0;
  fee bigint := 0;
  gross bigint := 0;
  discount_value bigint := 0;
  debt bigint := 0;
  sid text;
  subscriber_code text;
  debt_mode text;
  prior_month text;
  status_value text;
  issued date := (clock_timestamp() at time zone 'Asia/Baghdad')::date;
begin
  if actor is null then raise exception 'not_authorized' using errcode='42501'; end if;
  select p.generator_id, p.full_name into strict gid, actor_name
    from public.profiles p
    where p.id=actor and p.is_active and p.role='generator_admin'
    for share;
  if gid is null or public.is_generator_admin_for(gid) is distinct from true then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(gid::text,89144));
  -- Match the existing reset trigger and require a fresh epoch from the caller.
  select coalesce((select epoch from public.generator_sync_state
    where generator_id=gid),0) into epoch_now;
  if p_expected_epoch is distinct from epoch_now then
    raise exception 'MOLDATK_STALE_SYNC_EPOCH';
  end if;
  access_state := public.get_my_subscription_access_state();
  if access_state->>'ok' is distinct from 'true'
    or access_state->>'accessActive' is distinct from 'true'
    or access_state#>>'{generator,id}' is distinct from gid::text then
    raise exception 'subscription_unavailable' using errcode='42501';
  end if;
  if jsonb_typeof(p_command) is distinct from 'object'
    or coalesce(p_command->>'requestId','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'invalid_command';
  end if;
  rid := (p_command->>'requestId')::uuid;
  fingerprint := encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
  select * into old_request from moldatk_private.flutter_create_requests
    where generator_id=gid and actor_id=actor and request_id=rid;
  if found then
    if old_request.epoch<>epoch_now or old_request.payload_hash<>fingerprint
      or not exists(select 1 from public.generator_subscribers
        where generator_id=gid and id=old_request.subscriber_id) then
      raise exception 'request_conflict_or_reset';
    end if;
    return jsonb_build_object('ok',true,'requestId',rid,'generatorId',gid,
      'subscriberId',old_request.subscriber_id,'amountDueIqd',old_request.amount_due,'replayed',true);
  end if;
  if coalesce(trim(p_command->>'fullName'),'')='' or
    coalesce(p_command->>'amperes','') !~ '^[0-9]+$' or
    coalesce(p_command->>'discountAmperes','') !~ '^[0-9]+$' or
    coalesce(p_command->>'expectedDebtIqd','') !~ '^[0-9]+$' then
    raise exception 'invalid_fields';
  end if;
  amps := (p_command->>'amperes')::integer;
  discount := (p_command->>'discountAmperes')::integer;
  if amps<=0 or discount>amps then raise exception 'invalid_amperes'; end if;
  select * into strict active_tariff from public.generator_monthly_tariffs
    where generator_id=gid and is_current_active for share;
  if active_tariff.id is distinct from p_command->>'expectedCurrentMonth' then
    raise exception 'stale_tariff';
  end if;
  select value into strict tier from jsonb_array_elements(active_tariff.tiers)
    where value->>'id'=p_command->>'tierId';
  tier_type := tier->>'type';
  if tier_type is null or tier_type not in ('normal','commercial','golden','free','custom') then
    raise exception 'invalid_tier';
  end if;
  select l.name into strict line_name_value from public.generator_lines l
    where l.generator_id=gid and l.id=p_command->>'lineId' for share;
  debt_mode := p_command->>'debtMode';
  prior_month := p_command->>'priorMonth';
  if debt_mode is null or debt_mode not in ('none','prior','free')
    or ((tier_type='free') is distinct from (debt_mode='free'))
    or (debt_mode<>'prior' and prior_month is not null) then
    raise exception 'invalid_debt_mode';
  end if;
  if debt_mode='free' then discount:=0; end if;
  if debt_mode='prior' then
    if prior_month is null or prior_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
      or prior_month>active_tariff.id then raise exception 'invalid_prior_month'; end if;
    select * into strict prior_tariff from public.generator_monthly_tariffs
      where generator_id=gid and id=prior_month for share;
    select value into strict historical_tier from jsonb_array_elements(prior_tariff.tiers)
      where value->>'id'=p_command->>'tierId' and value->>'type'=tier_type;
    if coalesce(historical_tier->>'pricePerAmpere','') !~ '^[0-9]+$'
      or coalesce(historical_tier->>'fixedFee','') !~ '^[0-9]+$' then
      raise exception 'invalid_historical_price';
    end if;
    rate := (historical_tier->>'pricePerAmpere')::bigint;
    fee := (historical_tier->>'fixedFee')::bigint;
    gross := amps::bigint*rate+fee;
    discount_value := discount::bigint*rate;
    debt := gross-discount_value;
    if debt<=0 then raise exception 'invalid_debt'; end if;
  end if;
  if debt is distinct from (p_command->>'expectedDebtIqd')::bigint then
    raise exception 'stale_debt_confirmation';
  end if;
  -- Existing reset trigger expects this exact request header. Never override it.
  if coalesce(coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb
      ->>'x-moldatk-sync-epoch','0') <> epoch_now::text then
    raise exception 'MOLDATK_STALE_SYNC_EPOCH';
  end if;
  sid := 'sub-'||rid::text;
  subscriber_code := coalesce(nullif(trim(p_command->>'code'),''),'MW-'||rid::text);
  status_value := case debt_mode when 'free' then 'free' when 'prior' then 'unpaid' else 'paid' end;
  insert into public.generator_subscribers
    (id,generator_id,code,full_name,phone,tier,amperes,ampere_discount,
     line_id,line_name,payment_status,amount_due,amount_paid,joining_date)
  values
    (sid,gid,subscriber_code,trim(p_command->>'fullName'),coalesce(trim(p_command->>'phone'),''),
     tier_type,amps,discount,p_command->>'lineId',line_name_value,status_value,debt,0,issued);
  if debt_mode='prior' then
    insert into public.generator_invoices
      (id,generator_id,subscriber_id,month_id,month_name_ar,issue_date,amperes,tier,
       price_per_ampere,fixed_fee,total_amount,paid_amount,remaining_amount,status,notes,
       original_amperes,discounted_amperes,billed_amperes,gross_amount_before_discount,discount_amount)
    values ('inv-'||prior_month||'-'||sid,gid,sid,prior_month,prior_tariff.month_name_ar,issued,
      amps,tier_type,rate,fee,debt,0,debt,'unpaid','MOLDATK_PRIOR_DEBT_ONBOARDING|month='||prior_month,
      amps,discount,amps-discount,gross,discount_value);
  end if;
  if debt_mode<>'prior' or prior_month<>active_tariff.id then
    insert into public.generator_invoices
      (id,generator_id,subscriber_id,month_id,month_name_ar,issue_date,amperes,tier,
       price_per_ampere,fixed_fee,total_amount,paid_amount,remaining_amount,status,notes)
    values
      ((case when debt_mode='free' then 'inv-' else 'onboarding-zero-' end)||active_tariff.id||'-'||sid,
       gid,sid,active_tariff.id,active_tariff.month_name_ar,issued,amps,tier_type,0,0,0,0,0,
       case when debt_mode='free' then 'free' else 'paid' end,
       case debt_mode when 'free' then 'MOLDATK_ONBOARDING_FREE'
         when 'none' then 'MOLDATK_ONBOARDING_NO_CURRENT_CHARGE|reason=no_prior_debt'
         else 'MOLDATK_ONBOARDING_NO_CURRENT_CHARGE|reason=prior_debt_other_month' end);
  end if;
  perform public.moldatk_recount_generator_line(gid,p_command->>'lineId');
  insert into public.generator_audit_logs
    (id,generator_id,category,title,details,entity_id,entity_name,actor_name)
    values ('flutter-create-'||rid::text,gid,'subscriber','إضافة مشترك',
      'إضافة مشترك دون قبض نقدي',sid,trim(p_command->>'fullName'),actor_name);
  insert into moldatk_private.flutter_create_requests
    (generator_id,actor_id,request_id,epoch,payload_hash,subscriber_id,amount_due)
    values (gid,actor,rid,epoch_now,fingerprint,sid,debt);
  return jsonb_build_object('ok',true,'requestId',rid,'generatorId',gid,
    'subscriberId',sid,'amountDueIqd',debt,'replayed',false);
end;
$$;
-- Keep the candidate inaccessible until staging integration/security review.
revoke all on function moldatk_private.flutter_create_subscriber_v1(jsonb,bigint)
  from public, anon, authenticated, service_role;
commit;
