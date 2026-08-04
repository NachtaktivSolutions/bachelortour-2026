-- Firestarter V6: Event-Endzeiten, Titelbild-Upload und Admin-Verwaltung

alter table public.program_items add column if not exists ends_at timestamptz;
alter table public.map_pins add column if not exists ends_at timestamptz;

-- Vorhandenes Start-Event mit einer sinnvollen Endzeit versehen.
update public.program_items
set ends_at = '2026-08-07T22:00:00+02:00'
where title = 'Anleuchten bei Oli'
  and starts_at = '2026-08-07T18:00:00+02:00'
  and ends_at is null;

-- Öffentlicher Storage-Bucket für Tour-Titelbilder.
insert into storage.buckets (id,name,public)
values ('event-images','event-images',true)
on conflict (id) do update set public = true;

drop policy if exists "event images public read" on storage.objects;
drop policy if exists "admins upload event images" on storage.objects;
drop policy if exists "admins update event images" on storage.objects;
drop policy if exists "admins delete event images" on storage.objects;

create policy "event images public read"
on storage.objects for select
using (bucket_id = 'event-images');

create policy "admins upload event images"
on storage.objects for insert to authenticated
with check (bucket_id = 'event-images' and public.is_admin());

create policy "admins update event images"
on storage.objects for update to authenticated
using (bucket_id = 'event-images' and public.is_admin())
with check (bucket_id = 'event-images' and public.is_admin());

create policy "admins delete event images"
on storage.objects for delete to authenticated
using (bucket_id = 'event-images' and public.is_admin());

-- Admins dürfen Avatare anderer Mitglieder im dafür vorgesehenen Benutzerordner hochladen.
drop policy if exists "admins upload avatars" on storage.objects;
create policy "admins upload avatars"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and public.is_admin());
