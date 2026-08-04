-- Firestarter V8: Karte, Eventverwaltung und Galerie stabilisieren
-- Im Supabase SQL Editor vollständig ausführen.

-- 1. Events benötigen eine Endzeit, damit sie automatisch von der Karte verschwinden.
alter table public.program_items
  add column if not exists ends_at timestamptz;

alter table public.map_pins
  add column if not exists ends_at timestamptz;

-- Bestehendes Startevent erhält eine Endzeit.
update public.program_items
set ends_at = '2026-08-07T22:00:00+02:00'
where title = 'Anleuchten bei Oli'
  and starts_at = '2026-08-07T18:00:00+02:00'
  and ends_at is null;

-- 2. RLS für Events: alle angemeldeten Bachelor lesen, nur Admins ändern.
alter table public.program_items enable row level security;

drop policy if exists "program read" on public.program_items;
drop policy if exists "admins create program" on public.program_items;
drop policy if exists "admins update program" on public.program_items;
drop policy if exists "admins delete program" on public.program_items;

create policy "program read"
on public.program_items
for select
to authenticated
using (true);

create policy "admins create program"
on public.program_items
for insert
to authenticated
with check (public.is_admin());

create policy "admins update program"
on public.program_items
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins delete program"
on public.program_items
for delete
to authenticated
using (public.is_admin());

-- 3. Galerie absichern.
alter table public.photos enable row level security;
alter table public.photo_likes enable row level security;
alter table public.photo_comments enable row level security;

drop policy if exists "photos authenticated read" on public.photos;
drop policy if exists "photos own insert" on public.photos;
drop policy if exists "photos own delete or admin" on public.photos;

create policy "photos authenticated read"
on public.photos
for select
to authenticated
using (true);

create policy "photos own insert"
on public.photos
for insert
to authenticated
with check (uploader_id = auth.uid());

create policy "photos own delete or admin"
on public.photos
for delete
to authenticated
using (uploader_id = auth.uid() or public.is_admin());

drop policy if exists "likes authenticated read" on public.photo_likes;
drop policy if exists "likes own insert" on public.photo_likes;
drop policy if exists "likes own delete" on public.photo_likes;

create policy "likes authenticated read"
on public.photo_likes
for select
to authenticated
using (true);

create policy "likes own insert"
on public.photo_likes
for insert
to authenticated
with check (user_id = auth.uid());

create policy "likes own delete"
on public.photo_likes
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "comments read" on public.photo_comments;
drop policy if exists "comments own insert" on public.photo_comments;
drop policy if exists "comments own delete or admin" on public.photo_comments;

create policy "comments read"
on public.photo_comments
for select
to authenticated
using (true);

create policy "comments own insert"
on public.photo_comments
for insert
to authenticated
with check (user_id = auth.uid());

create policy "comments own delete or admin"
on public.photo_comments
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- 4. Storage-Bucket für mehrere Foto-Uploads.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

drop policy if exists "photos storage public read" on storage.objects;
drop policy if exists "photo authenticated upload own folder" on storage.objects;
drop policy if exists "photo owner delete own files" on storage.objects;

create policy "photos storage public read"
on storage.objects
for select
using (bucket_id = 'photos');

create policy "photo authenticated upload own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "photo owner delete own files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'photos'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

-- 5. Realtime aktivieren. Bereits vorhandene Einträge werden ignoriert.
do $$
begin
  alter publication supabase_realtime add table public.program_items;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.photos;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.photo_likes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.photo_comments;
exception when duplicate_object then null;
end $$;

select 'Firestarter V8 erfolgreich eingerichtet' as status;
