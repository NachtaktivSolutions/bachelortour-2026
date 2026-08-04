-- Firestarter V3: robuste Profilerstellung direkt durch Supabase Auth
-- Diese Migration kann gefahrlos nach schema.sql und migration_v2.sql ausgeführt werden.

-- 1. Funktion, die bei jeder Registrierung automatisch ein Profil erzeugt.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    name,
    phone,
    is_admin,
    share_location,
    created_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    false,
    false,
    now()
  )
  on conflict (id) do update
  set
    name = coalesce(nullif(excluded.name, ''), public.profiles.name),
    phone = coalesce(excluded.phone, public.profiles.phone);

  return new;
end;
$$;

-- 2. Trigger neu und eindeutig anlegen.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

-- 3. Bereits vorhandene Auth-Nutzer ohne Profil nachtragen.
insert into public.profiles (id, name, phone, is_admin, share_location, created_at)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'name', ''),
  nullif(u.raw_user_meta_data ->> 'phone', ''),
  false,
  false,
  coalesce(u.created_at, now())
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- 4. Klare Policies für Profile.
alter table public.profiles enable row level security;

drop policy if exists "profiles own insert" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "profiles authenticated read" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "profiles own update" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "admins update profiles" on public.profiles;

-- Alle angemeldeten Tourteilnehmer dürfen die Mitgliederliste sehen.
create policy "profiles authenticated read"
on public.profiles
for select
to authenticated
using (true);

-- Nutzer dürfen nur ihr eigenes Profil ändern.
create policy "profiles own update"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Admins dürfen Profile verwalten, z. B. Adminrechte vergeben.
create policy "admins update profiles"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Ein direkter Insert aus dem Browser ist absichtlich nicht nötig:
-- Das Profil wird serverseitig durch den Trigger erstellt.
