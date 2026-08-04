# Firestarter V7 – Push einrichten

## Supabase

`supabase/migration_v7_push_preferences.sql` kann ausgeführt werden, ändert aber keine Tabellen. Die bestehende Tabelle `push_subscriptions` wird weiterverwendet.

## Vercel Environment Variables

Folgende Werte müssen vorhanden sein:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (z. B. `mailto:info@nachtaktiv-solutions.de`)

## Verhalten

- Nach dem ersten Login erscheint einmalig die Push-Abfrage.
- Bei Zustimmung wird das Gerät in `push_subscriptions` gespeichert.
- Die Einstellung kann später im Profil deaktiviert oder wieder aktiviert werden.
- Der bisherige Push-Button auf der Startseite entfällt.
- Die Bezeichnung `Jungs` wurde auf `Bachelor` geändert.
