-- Firestarter V4: Programm, Spotify, Wetter, Kommentare

alter table public.event_settings
  add column if not exists spotify_url text,
  add column if not exists weather_latitude double precision default 48.6778281,
  add column if not exists weather_longitude double precision default 9.21833;

alter table public.map_pins add column if not exists address text;

create table if not exists public.program_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  address text,
  latitude double precision,
  longitude double precision,
  starts_at timestamptz not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.program_items enable row level security;
alter table public.photo_comments enable row level security;

create policy "program read" on public.program_items for select to authenticated using (true);
create policy "admins create program" on public.program_items for insert to authenticated with check (public.is_admin());
create policy "admins update program" on public.program_items for update to authenticated using (public.is_admin());
create policy "admins delete program" on public.program_items for delete to authenticated using (public.is_admin());

create policy "comments read" on public.photo_comments for select to authenticated using (true);
create policy "comments own insert" on public.photo_comments for insert to authenticated with check (user_id = auth.uid());
create policy "comments own delete or admin" on public.photo_comments for delete to authenticated using (user_id = auth.uid() or public.is_admin());

insert into public.program_items (title, description, address, latitude, longitude, starts_at, created_by)
select
  'Anleuchten bei Oli',
  'Startschuss für die Bachelortour 2026.',
  'Bahnhofstraße 88, 70794 Filderstadt-Sielmingen',
  48.6778281,
  9.21833,
  '2026-08-07T18:00:00+02:00',
  (select id from public.profiles where is_admin = true order by created_at limit 1)
where not exists (
  select 1 from public.program_items
  where title = 'Anleuchten bei Oli'
    and starts_at = '2026-08-07T18:00:00+02:00'
);

update public.event_settings
set starts_at = '2026-08-07T18:00:00+02:00',
    weather_latitude = 48.6778281,
    weather_longitude = 9.21833
where id = 1;
