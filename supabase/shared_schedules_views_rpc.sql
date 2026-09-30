begin;

drop function if exists public.increment_shared_schedule_views(varchar);
drop function if exists public.increment_shared_schedule_views(text);

create function public.increment_shared_schedule_views(p_code text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  update public.shared_schedules
  set views_count = views_count + 1
  where id::text = upper(regexp_replace(trim(p_code), '[[:space:]-]', '', 'g'))
    and expires_at > now()
    and views_count < 2147483647
  returning views_count into updated_count;

  return updated_count;
end;
$$;

revoke all on function public.increment_shared_schedule_views(text) from public;
grant execute on function public.increment_shared_schedule_views(text)
  to anon, authenticated;

select pg_notify('pgrst', 'reload schema');

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'increment_shared_schedule_views';

commit;
