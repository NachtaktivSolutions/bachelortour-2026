-- Bachelortour 2026 – Datenbank und Sicherheitsregeln
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text,
  avatar_url text,
  is_admin boolean not null default false,
  share_location boolean not null default false,
  latitude double precision,
  longitude double precision,
  location_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  image_url text,
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  image_url text,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.map_pins (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  latitude double precision not null,
  longitude double precision not null,
  starts_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.news enable row level security;
alter table public.chat_messages enable row level security;
alter table public.photos enable row level security;
alter table public.map_pins enable row level security;
alter table public.push_subscriptions enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create policy "profiles authenticated read" on public.profiles for select to authenticated using (true);
create policy "profiles own update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles own insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "admins update profiles" on public.profiles for update to authenticated using (public.is_admin());

create policy "news read" on public.news for select to authenticated using (true);
create policy "admins create news" on public.news for insert to authenticated with check (public.is_admin() and author_id = auth.uid());
create policy "admins update news" on public.news for update to authenticated using (public.is_admin());
create policy "admins delete news" on public.news for delete to authenticated using (public.is_admin());

create policy "chat read" on public.chat_messages for select to authenticated using (true);
create policy "chat write own" on public.chat_messages for insert to authenticated with check (sender_id = auth.uid());
create policy "chat delete own or admin" on public.chat_messages for delete to authenticated using (sender_id = auth.uid() or public.is_admin());

create policy "photos read" on public.photos for select to authenticated using (true);
create policy "photos upload own" on public.photos for insert to authenticated with check (uploader_id = auth.uid());
create policy "photos delete own or admin" on public.photos for delete to authenticated using (uploader_id = auth.uid() or public.is_admin());

create policy "pins read" on public.map_pins for select to authenticated using (true);
create policy "admins create pins" on public.map_pins for insert to authenticated with check (public.is_admin());
create policy "admins update pins" on public.map_pins for update to authenticated using (public.is_admin());
create policy "admins delete pins" on public.map_pins for delete to authenticated using (public.is_admin());

create policy "subscription own read" on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy "subscription own insert" on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy "subscription own update" on public.push_subscriptions for update to authenticated using (user_id = auth.uid());

insert into storage.buckets (id,name,public) values ('avatars','avatars',true) on conflict do nothing;
insert into storage.buckets (id,name,public) values ('photos','photos',true) on conflict do nothing;

create policy "avatar public read" on storage.objects for select using (bucket_id='avatars');
create policy "avatar authenticated upload" on storage.objects for insert to authenticated with check (bucket_id='avatars');
create policy "photo public read" on storage.objects for select using (bucket_id='photos');
create policy "photo authenticated upload" on storage.objects for insert to authenticated with check (bucket_id='photos');

alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.profiles;
