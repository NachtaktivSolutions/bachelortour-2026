-- Firestarter V11: Admin-Löschrechte und automatische Zeitplanung
-- Diese Migration wurde bereits auf dem verbundenen Produktionsprojekt ausgeführt.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create table if not exists public.scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('news','program','push')),
  payload jsonb not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending','processing','published','failed','cancelled')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

create index if not exists scheduled_jobs_due_idx on public.scheduled_jobs (status, scheduled_for);
alter table public.scheduled_jobs enable row level security;

drop policy if exists "admins read scheduled jobs" on public.scheduled_jobs;
drop policy if exists "admins create scheduled jobs" on public.scheduled_jobs;
drop policy if exists "admins update scheduled jobs" on public.scheduled_jobs;
drop policy if exists "admins delete scheduled jobs" on public.scheduled_jobs;
create policy "admins read scheduled jobs" on public.scheduled_jobs for select to authenticated using (public.is_admin());
create policy "admins create scheduled jobs" on public.scheduled_jobs for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy "admins update scheduled jobs" on public.scheduled_jobs for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete scheduled jobs" on public.scheduled_jobs for delete to authenticated using (public.is_admin());

create table if not exists public.scheduler_config (
  id integer primary key check (id = 1),
  token text not null default encode(gen_random_bytes(32), 'hex'),
  updated_at timestamptz not null default now()
);
alter table public.scheduler_config enable row level security;
revoke all on public.scheduler_config from anon, authenticated;
insert into public.scheduler_config (id) values (1) on conflict (id) do nothing;

alter table public.news enable row level security;
alter table public.program_items enable row level security;
alter table public.photos enable row level security;
drop policy if exists "admins delete news" on public.news;
drop policy if exists "admins delete program" on public.program_items;
drop policy if exists "photos own delete or admin" on public.photos;
create policy "admins delete news" on public.news for delete to authenticated using (public.is_admin());
create policy "admins delete program" on public.program_items for delete to authenticated using (public.is_admin());
create policy "photos own delete or admin" on public.photos for delete to authenticated using (uploader_id = auth.uid() or public.is_admin());

select cron.unschedule(jobid) from cron.job where jobname = 'firestarter_publish_scheduled_jobs';
select cron.schedule(
  'firestarter_publish_scheduled_jobs',
  '* * * * *',
  $job$select net.http_post(
    url := 'https://bachelortour-2026.vercel.app/api/cron/scheduled',
    headers := jsonb_build_object('Content-Type','application/json','x-scheduler-token',(select token from public.scheduler_config where id = 1)),
    body := '{}'::jsonb
  );$job$
);
