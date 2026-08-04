-- Firestarter V2 Erweiterungen
create table if not exists public.event_settings (
  id integer primary key default 1 check (id = 1),
  title text not null default 'Bachelortour 2026',
  subtitle text,
  description text,
  hero_image_url text,
  starts_at timestamptz not null default '2026-08-14T09:00:00+02:00',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.event_settings (id, title, subtitle, starts_at)
values (1, 'Bachelortour 2026', 'Das wird legendär.', '2026-08-14T09:00:00+02:00')
on conflict (id) do nothing;

create table if not exists public.photo_likes (
  photo_id uuid not null references public.photos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

alter table public.event_settings enable row level security;
alter table public.photo_likes enable row level security;

create policy "event settings read" on public.event_settings for select to authenticated using (true);
create policy "admins update event settings" on public.event_settings for insert to authenticated with check (public.is_admin());
create policy "admins edit event settings" on public.event_settings for update to authenticated using (public.is_admin());

create policy "likes read" on public.photo_likes for select to authenticated using (true);
create policy "likes own insert" on public.photo_likes for insert to authenticated with check (user_id = auth.uid());
create policy "likes own delete" on public.photo_likes for delete to authenticated using (user_id = auth.uid());
