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
create policy "Anyone can read active shared schedules"
  on public.shared_schedules
  for select
  to anon, authenticated
  using (expires_at > now());

drop policy if exists "Anyone can insert shared schedules"
  on public.shared_schedules;
create policy "Anyone can insert shared schedules"
  on public.shared_schedules
  for insert
  to anon, authenticated
  with check (
    expires_at > now()
    and expires_at <= now() + interval '120 days'
  );

grant select, insert on public.shared_schedules to anon, authenticated;
revoke update, delete on public.shared_schedules from anon, authenticated;

create or replace function public.increment_shared_schedule_views(p_code varchar)
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
  where id = upper(regexp_replace(trim(p_code), '[[:space:]-]', '', 'g'))
    and expires_at > now()
  returning views_count into updated_count;

  return updated_count;
end;
$$;

revoke all on function public.increment_shared_schedule_views(varchar) from public;
grant execute on function public.increment_shared_schedule_views(varchar)
  to anon, authenticated;

notify pgrst, 'reload schema';
