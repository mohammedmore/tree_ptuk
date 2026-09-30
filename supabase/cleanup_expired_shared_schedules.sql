-- Run after creating public.shared_schedules; pg_cron must be available to the current role.
create extension if not exists pg_cron;

create index if not exists shared_schedules_expires_at_idx
  on public.shared_schedules (expires_at);

select cron.unschedule(jobid)
from cron.job
where jobname = 'delete-expired-shared-schedules'
  and username = current_user;

select cron.schedule(
  'delete-expired-shared-schedules',
  '15 3 * * *',
  $job$delete from public.shared_schedules where expires_at <= now();$job$
);
