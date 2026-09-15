-- One-time repair for hidden liabilities left by tariffs deleted by older builds.
-- Paid history is preserved; only deleted-month liability is extinguished.
alter table public.generator_invoices disable trigger user;
alter table public.generator_subscribers disable trigger user;

update public.generator_invoices i
set notes=concat_ws(' | ',nullif(i.notes,''),'MOLDATK_TARIFF_DELETED_SETTLED_HISTORY|forgiven='||greatest(coalesce(i.remaining_amount,0))),
    total_amount=greatest(coalesce(i.paid_amount,0),0),remaining_amount=0,status='paid',remaining_after_payment=0,updated_at=now()
where i.status<>'cancelled' and coalesce(i.paid_amount,0)>0
  and not exists(select 1 from public.generator_monthly_tariffs t where t.generator_id=i.generator_id and t.id=i.month_id);

delete from public.generator_invoices i
where i.status<>'cancelled' and coalesce(i.paid_amount,0)=0
  and not exists(select 1 from public.generator_monthly_tariffs t where t.generator_id=i.generator_id and t.id=i.month_id);

update public.generator_monthly_accounts a
set month_charge=greatest(coalesce(a.paid_amount,0),0),carried_debt=0,remaining_amount=0,
    status=case when a.is_exempted then 'free' else 'paid' end,updated_at=now()
where coalesce(a.paid_amount,0)>0
  and not exists(select 1 from public.generator_monthly_tariffs t where t.generator_id=a.generator_id and t.id=a.month_id);

delete from public.generator_monthly_accounts a
where coalesce(a.paid_amount,0)=0
  and not exists(select 1 from public.generator_monthly_tariffs t where t.generator_id=a.generator_id and t.id=a.month_id);

-- Remove the old server bug that copied previous debt into the current invoice balance.
update public.generator_invoices i
set remaining_amount=greatest(coalesce(i.total_amount,0)-least(coalesce(i.paid_amount,0),coalesce(i.total_amount,0)),0),updated_at=now()
where i.status not in ('cancelled','free')
  and exists(select 1 from public.generator_monthly_tariffs t where t.generator_id=i.generator_id and t.id=i.month_id)
  and i.remaining_amount<>greatest(coalesce(i.total_amount,0)-least(coalesce(i.paid_amount,0),coalesce(i.total_amount,0)),0);

with account_calc as (
  select a.generator_id,a.id,
    coalesce((select sum(greatest(coalesce(i.remaining_amount,0),0))::bigint
      from public.generator_invoices i
      join public.generator_monthly_tariffs oldt on oldt.generator_id=i.generator_id and oldt.id=i.month_id
      join public.generator_monthly_tariffs curt on curt.generator_id=a.generator_id and curt.id=a.month_id
      where i.generator_id=a.generator_id and i.subscriber_id=a.subscriber_id and i.month_id<>a.month_id
        and i.status not in ('cancelled','free') and oldt.created_at<curt.created_at),0) carried,
    coalesce((select greatest(coalesce(i.remaining_amount,0),0) from public.generator_invoices i
      where i.generator_id=a.generator_id and i.subscriber_id=a.subscriber_id and i.month_id=a.month_id and i.status<>'cancelled'
      order by i.created_at desc limit 1),0) current_remaining,
    coalesce((select least(greatest(coalesce(i.paid_amount,0),0),greatest(coalesce(i.total_amount,0),0)) from public.generator_invoices i
      where i.generator_id=a.generator_id and i.subscriber_id=a.subscriber_id and i.month_id=a.month_id and i.status<>'cancelled'
      order by i.created_at desc limit 1),0) current_paid
  from public.generator_monthly_accounts a
  where exists(select 1 from public.generator_monthly_tariffs t where t.generator_id=a.generator_id and t.id=a.month_id)
)
update public.generator_monthly_accounts a
set carried_debt=c.carried,paid_amount=c.current_paid,remaining_amount=c.carried+c.current_remaining,
    status=case when a.is_exempted then 'free' when c.carried+c.current_remaining=0 then 'paid'
      when c.current_paid>0 then 'partial' else 'unpaid' end,updated_at=now()
from account_calc c where a.generator_id=c.generator_id and a.id=c.id;

do $$ declare r record; begin
  for r in select id from public.generators loop
    perform moldatk_private.refresh_generator_subscriber_balances(r.id);
  end loop;
end $$;

alter table public.generator_subscribers enable trigger user;
alter table public.generator_invoices enable trigger user;
