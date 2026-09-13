create or replace function public.super_admin_storage_snapshot()
returns table (
  database_bytes bigint,
  object_storage_bytes bigint,
  object_count bigint,
  sampled_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, public, storage
as $$
  select
    pg_database_size(current_database())::bigint as database_bytes,
    coalesce((
      select sum(
        case
          when o.metadata->>'size' ~ '^[0-9]+$' then (o.metadata->>'size')::bigint
          else 0
        end
      )
      from storage.objects o
    ), 0)::bigint as object_storage_bytes,
    coalesce((select count(*) from storage.objects), 0)::bigint as object_count,
    now() as sampled_at;
$$;

revoke all on function public.super_admin_storage_snapshot() from public, anon, authenticated;
grant execute on function public.super_admin_storage_snapshot() to service_role;
