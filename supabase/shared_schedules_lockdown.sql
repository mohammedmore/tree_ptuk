-- Apply to existing projects before deploying the client version that uses this RPC.
begin;

alter table public.shared_schedules enable row level security;

drop policy if exists "Anyone can read active shared schedules"
  on public.shared_schedules;
drop policy if exists "Anyone can insert shared schedules"
  on public.shared_schedules;
create policy "Anyone can insert shared schedules"
  on public.shared_schedules
  for insert
  to anon, authenticated
  with check (
    jsonb_typeof(schedule_data) = 'object'
    and octet_length(schedule_data::text) <= 262144
    and schedule_data ->> 'version' in ('1', '2')
    and expires_at > now()
    and expires_at <= now() + interval '120 days'
  );

revoke all on public.shared_schedules from public, anon, authenticated;
revoke select (id, schedule_data, created_at, expires_at, views_count),
  insert (id, schedule_data, created_at, expires_at, views_count),
  update (id, schedule_data, created_at, expires_at, views_count),
  references (id, schedule_data, created_at, expires_at, views_count)
  on public.shared_schedules
  from public, anon, authenticated;
grant insert (id, schedule_data) on public.shared_schedules to anon, authenticated;

create or replace function public.fetch_shared_schedule(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select schedule_data
  from public.shared_schedules
  where id::text = upper(regexp_replace(trim(p_code), '[[:space:]-]', '', 'g'))
    and expires_at > now()
  limit 1;
$$;

revoke all on function public.fetch_shared_schedule(text) from public;
grant execute on function public.fetch_shared_schedule(text) to anon, authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
