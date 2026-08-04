-- Firestarter V9: ungelesene Chat-Nachrichten und Live-Fotos

alter table public.profiles
  add column if not exists chat_last_read_at timestamptz;

-- Bestehende Benutzer starten ohne alte Nachrichten-Bubble.
update public.profiles
set chat_last_read_at = now()
where chat_last_read_at is null;

-- Sicherstellen, dass Nutzer ihr eigenes Profil (inkl. Lesestatus) aktualisieren dürfen.
alter table public.profiles enable row level security;

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Chat muss für angemeldete Teilnehmer lesbar sein.
alter table public.chat_messages enable row level security;

drop policy if exists "chat authenticated read" on public.chat_messages;
create policy "chat authenticated read"
on public.chat_messages
for select
to authenticated
using (true);

-- Realtime für Chat und Startseiten-Fotos aktivieren.
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.photos;
exception when duplicate_object then null;
end $$;

select 'Firestarter V9 erfolgreich eingerichtet' as status;
