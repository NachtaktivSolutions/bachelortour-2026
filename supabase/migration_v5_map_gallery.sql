-- Firestarter V5: Karte, Galerie und Profilzugriff stabilisieren

-- Programmpunkt sicher mit Koordinaten versehen.
update public.program_items
set latitude = 48.6778281,
    longitude = 9.21833,
    address = 'Bahnhofstraße 88, 70794 Filderstadt-Sielmingen'
where title = 'Anleuchten bei Oli'
  and starts_at = '2026-08-07T18:00:00+02:00';

-- Storage-Regeln eindeutig und wiederholbar anlegen.
drop policy if exists "photo authenticated upload own folder" on storage.objects;
drop policy if exists "photo owner delete own files" on storage.objects;
drop policy if exists "avatar authenticated upload own folder" on storage.objects;

create policy "photo authenticated upload own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "photo owner delete own files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatar authenticated upload own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Tabellen sicher lesbar / beschreibbar.
alter table public.photos enable row level security;
alter table public.photo_likes enable row level security;
alter table public.photo_comments enable row level security;
alter table public.program_items enable row level security;

-- Realtime hinzufügen; Fehler ignorieren, falls bereits enthalten.
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

do $$
begin
  alter publication supabase_realtime add table public.program_items;
exception when duplicate_object then null;
end $$;
