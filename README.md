# Bachelortour 2026 – installierbare PWA

Enthalten:
- Registrierung und Login
- Profile mit Bild und Telefonnummer
- Adminrolle mit serverseitigen Datenbankregeln
- Neuigkeiten
- Termine und Karten-Pins
- Gruppenchat in Echtzeit
- Fotogalerie
- Mitgliederliste mit Anruf-Button
- Live-Standort (freiwillig, überschreibt immer denselben Nutzer-Datensatz)
- Web-Push für installierte/unterstützte Browser
- Homescreen-Installation als PWA

## 1. Konten anlegen

### Supabase
1. Auf https://supabase.com registrieren.
2. Neues Projekt erstellen.
3. Im Supabase Dashboard: **SQL Editor → New query**.
4. Den gesamten Inhalt aus `supabase/schema.sql` einfügen und ausführen.
5. Unter **Project Settings → API** kopieren:
   - Project URL
   - anon/public key
   - service_role key (geheim halten)

### GitHub
1. Auf https://github.com registrieren.
2. Neues privates Repository erstellen.
3. Den Inhalt dieses Ordners hochladen.

### Vercel
1. Auf https://vercel.com mit GitHub anmelden.
2. **Add New → Project** und das GitHub-Repository auswählen.
3. Die Umgebungsvariablen aus `.env.example` eintragen.
4. Deploy klicken.

## 2. Push-Schlüssel erzeugen

Auf einem Rechner mit Node.js im Projektordner:

```bash
npx web-push generate-vapid-keys
```

Ausgabe eintragen:
- Public Key → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- Private Key → `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` z. B. `mailto:deine@email.de`

Danach in Vercel erneut deployen.

## 3. Ersten Admin setzen

1. Einmal normal in der App registrieren.
2. Supabase → **Table Editor → profiles**.
3. Beim eigenen Benutzer `is_admin` auf `true` setzen.
4. App neu laden. Oben erscheint das Schild für den Adminbereich.

## 4. Lokaler Test

```bash
npm install
cp .env.example .env.local
# Werte eintragen
npm run dev
```

Dann `http://localhost:3000` öffnen.

## 5. PWA auf iPhone installieren

- Seite in Safari öffnen.
- Teilen-Symbol.
- **Zum Home-Bildschirm**.
- Push-Benachrichtigungen auf iOS funktionieren für installierte Web-Apps und müssen vom Nutzer erlaubt werden.

## Wichtiger Hinweis zum gelieferten Bild

Das von dir bereitgestellte Bild enthält sichtbare Stockfoto-Wasserzeichen. Es ist technisch eingebunden, sollte aber vor einer öffentlichen Veröffentlichung durch ein eigenes oder lizenziertes Motiv ersetzt werden.


## Firestarter V2 einspielen

1. In Supabase den SQL Editor öffnen.
2. `supabase/migration_v2.sql` komplett ausführen.
3. Danach den gesamten Projektinhalt zu GitHub hochladen und committen.
4. Vercel baut automatisch neu.

V2 ergänzt:
- Premium Firestarter-Startseite
- dynamisch bearbeitbare Tourdaten
- News optional mit Push
- Termine optional mit Push
- freie Admin-Pushs
- Chat-Foto-Upload
- Galerie-Likes
- Admin-Verwaltung
- Push-Aktivierung für Teilnehmer
