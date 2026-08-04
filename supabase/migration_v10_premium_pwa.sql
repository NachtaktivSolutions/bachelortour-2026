-- Firestarter V10: Premium-PWA, Chat-Badge und Startseiten-Fotos
-- V10 benötigt keine neue fachliche Tabelle. Dieses Skript stellt sicher,
-- dass die Abhängigkeiten aus V9 vorhanden und für Realtime aktiviert sind.

alter table public.profiles
  add column if not exists chat_last_read_at timestamptz;

update public.profiles
set chat_last_read_at = now()
where chat_last_read_at is null;

alter table public.profiles enable row level security;
alter table public.chat_messages enable row level security;
alter table public.photos enable row level security;

-- Bestehende Policies aus älteren Versionen bleiben erhalten.
-- Realtime wiederholbar aktivieren.
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

select 'Firestarter V10 erfolgreich vorbereitet' as status;
