-- Disposable PostgreSQL fixture ONLY. No production credentials or data.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('fixture.actor',true),'')::uuid
$$;
create table public.generators(id uuid primary key);
create table public.profiles(
  id uuid primary key, generator_id uuid references generators(id),
  full_name text not null, is_active boolean not null, role text not null
);
create table public.generator_sync_state(
  generator_id uuid primary key references generators(id), epoch bigint not null
);
create table public.generator_lines(
  generator_id uuid references generators(id), id text, name text not null,
  subscribers_count integer default 0, current_load_amperes integer default 0,
  primary key(generator_id,id)
);
create table public.generator_monthly_tariffs(
  generator_id uuid references generators(id), id text, month_name_ar text not null,
  is_current_active boolean not null, tiers jsonb not null,
  primary key(generator_id,id)
);
create table public.generator_subscribers(
  generator_id uuid references generators(id), id text, code text not null,
  full_name text not null, phone text not null, tier text not null,
  amperes integer not null, ampere_discount numeric not null,
  line_id text, line_name text, payment_status text not null,
  amount_due bigint not null check(amount_due>=0), amount_paid bigint not null,
  joining_date date, updated_at timestamptz not null default clock_timestamp(),
  primary key(generator_id,id), unique(generator_id,code)
);
create table public.generator_invoices(
  generator_id uuid, id text, subscriber_id text, month_id text not null,
  month_name_ar text not null, issue_date date not null, amperes integer not null,
  tier text not null, price_per_ampere bigint not null, fixed_fee bigint not null,
  total_amount bigint not null, paid_amount bigint not null, remaining_amount bigint not null,
  status text not null, notes text, original_amperes numeric, discounted_amperes numeric,
  billed_amperes numeric, gross_amount_before_discount bigint, discount_amount bigint,
  primary key(generator_id,id),
  foreign key(generator_id,subscriber_id) references generator_subscribers(generator_id,id) on delete cascade
);
create table public.generator_audit_logs(
  generator_id uuid references generators(id), id text, category text not null,
  title text not null, details text not null, entity_id text, entity_name text,
  actor_name text not null, primary key(generator_id,id)
);
create function public.is_generator_admin_for(target_generator uuid) returns boolean
language sql stable as $$
  select exists(select 1 from public.profiles
    where id=auth.uid() and generator_id=target_generator and is_active and role='generator_admin')
$$;
create function public.get_my_subscription_access_state() returns jsonb
language sql stable as $$
  select jsonb_build_object('ok',true,
    'accessActive',coalesce(current_setting('fixture.access',true),'')='active',
    'generator',jsonb_build_object('id',generator_id))
  from public.profiles where id=auth.uid()
$$;
create function public.moldatk_recount_generator_line(p_generator_id uuid,p_line_id text)
returns void language sql as $$
  update public.generator_lines l set
    subscribers_count=(select count(*) from public.generator_subscribers s
      where s.generator_id=p_generator_id and s.line_id=p_line_id),
    current_load_amperes=(select coalesce(sum(amperes),0) from public.generator_subscribers s
      where s.generator_id=p_generator_id and s.line_id=p_line_id)
  where l.generator_id=p_generator_id and l.id=p_line_id
$$;
-- Model the legacy header requirement and inject one invoice failure.
create function public.fixture_write_guard() returns trigger language plpgsql as $$
declare expected bigint;
begin
  select epoch into expected from public.generator_sync_state where generator_id=new.generator_id;
  if coalesce(coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb
      ->>'x-moldatk-sync-epoch','0')<>coalesce(expected,0)::text then
    raise exception 'fixture_stale_header';
  end if;
  if tg_table_name='generator_invoices' and current_setting('fixture.fail_invoice',true)='yes' then
    raise exception 'fixture_invoice_failure';
  end if;
  return new;
end;
$$;
create trigger fixture_guard before insert or update on public.generator_subscribers
  for each row execute function public.fixture_write_guard();
create trigger fixture_guard before insert on public.generator_invoices
  for each row execute function public.fixture_write_guard();
