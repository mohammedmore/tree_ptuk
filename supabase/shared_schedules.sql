-- Apply before deploying the client version that fetches shares through the RPC.
create table if not exists public.shared_schedules (
  id varchar(8) primary key
    check (id ~ '^[A-HJ-KM-NP-Z2-9]{8}$'),
  schedule_data jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '120 days'),
  views_count integer not null default 0 check (views_count >= 0)
);

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
  returning views_count into updated_count;

  return updated_count;
end;
$$;

revoke all on function public.increment_shared_schedule_views(text) from public;
grant execute on function public.increment_shared_schedule_views(text)
  to anon, authenticated;

select pg_notify('pgrst', 'reload schema');
