create or replace function public.increment_shared_schedule_views(p_code text)
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

revoke all on function public.increment_shared_schedule_views(text) from public;
grant execute on function public.increment_shared_schedule_views(text)
  to anon, authenticated;

notify pgrst, 'reload schema';
