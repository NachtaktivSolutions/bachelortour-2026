"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [preview, setPreview] = useState<string>("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");

    const form = new FormData(e.currentTarget);
    const name = String(form.get("name")).trim();
    const phone = String(form.get("phone")).trim();
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));

    if (password !== String(form.get("password2"))) {
      setError("Die Passwörter stimmen nicht überein.");
      setBusy(false);
      return;
    }

    // Name und Telefonnummer werden als Auth-Metadaten mitgegeben.
    // Der Supabase-Trigger erstellt daraus automatisch den profiles-Datensatz.
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone }
      }
    });

    if (authError || !data.user) {
      setError(authError?.message ?? "Registrierung fehlgeschlagen.");
      setBusy(false);
      return;
    }

    // Bei deaktivierter E-Mail-Bestätigung sind wir sofort angemeldet.
    // Dann kann das optionale Profilbild direkt hochgeladen werden.
    if (data.session) {
      const file = form.get("avatar");
      if (file instanceof File && file.size > 0) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${data.user.id}/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, file, { upsert: true });

        if (uploadError) {
          setError(`Account wurde erstellt, aber das Profilbild konnte nicht gespeichert werden: ${uploadError.message}`);
          setBusy(false);
          return;
        }

        const avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;

        const { error: profileError } = await supabase
          .from("profiles")
          .update({ avatar_url: avatarUrl })
          .eq("id", data.user.id);

        if (profileError) {
          setError(`Account wurde erstellt, aber das Profilbild konnte nicht verknüpft werden: ${profileError.message}`);
          setBusy(false);
          return;
        }
      }

      router.replace("/");
      router.refresh();
      return;
    }

    // Falls E-Mail-Bestätigung in Supabase aktiviert ist.
    setInfo("Account erstellt. Bitte bestätige zunächst die E-Mail und melde dich danach an.");
    setBusy(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="eyebrow">BACHELORTOUR 2026</span>
        <h1>Account erstellen</h1>
        <p>Dein Profil für die Tour.</p>

        <form onSubmit={submit}>
          <label className="avatar-upload">
            {preview ? <img src={preview} alt="Profilbild-Vorschau" /> : <span>Foto wählen</span>}
            <input
              name="avatar"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPreview(URL.createObjectURL(file));
              }}
            />
          </label>

          <input name="name" placeholder="Vor- und Nachname" required />
          <input name="email" type="email" placeholder="E-Mail-Adresse" required />
          <input name="phone" type="tel" placeholder="Handynummer" required />
          <input name="password" type="password" placeholder="Passwort" required minLength={6} />
          <input name="password2" type="password" placeholder="Passwort wiederholen" required minLength={6} />

          {error && <div className="error">{error}</div>}
          {info && <div className="status">{info}</div>}

          <button className="primary-button" disabled={busy}>
            {busy ? "Account wird erstellt …" : "Registrieren"}
          </button>
        </form>

        <Link href="/login">Bereits registriert? <strong>Anmelden</strong></Link>
      </section>
    </main>
  );
}
