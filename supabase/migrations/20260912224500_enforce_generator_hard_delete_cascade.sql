-- Ensure generator hard-delete never leaves generator-scoped rows orphaned.
alter table public.admin_transactions
  drop constraint if exists admin_transactions_generator_id_fkey;
alter table public.admin_transactions
  add constraint admin_transactions_generator_id_fkey
  foreign key (generator_id) references public.generators(id) on delete cascade;

alter table public.customer_orders
  drop constraint if exists customer_orders_generator_id_fkey;
alter table public.customer_orders
  add constraint customer_orders_generator_id_fkey
  foreign key (generator_id) references public.generators(id) on delete cascade;

alter table public.app_popup_notifications
  drop constraint if exists app_popup_notifications_generator_id_fkey;
alter table public.app_popup_notifications
  add constraint app_popup_notifications_generator_id_fkey
  foreign key (generator_id) references public.generators(id) on delete cascade;
