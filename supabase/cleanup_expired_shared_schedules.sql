-- Optional: run separately after enabling the pg_cron extension in Supabase.
create extension if not exists pg_cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'delete-expired-shared-schedules';

select cron.schedule(
  'delete-expired-shared-schedules',
  '15 3 * * *',
  $job$delete from public.shared_schedules where expires_at <= now();$job$
);
