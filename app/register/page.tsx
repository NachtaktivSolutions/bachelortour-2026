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
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("password2"))) {
      setError("Die Passwörter stimmen nicht überein."); setBusy(false); return;
    }
    const email = String(form.get("email"));
    const { data, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError || !data.user) { setError(authError?.message ?? "Registrierung fehlgeschlagen."); setBusy(false); return; }

    let avatar_url: string | null = null;
    const file = form.get("avatar");
    if (file instanceof File && file.size) {
      const path = `${data.user.id}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
      const up = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (!up.error) avatar_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: data.user.id,
      name: String(form.get("name")),
      phone: String(form.get("phone")),
      avatar_url
    });
    if (profileError) { setError(profileError.message); setBusy(false); return; }
    router.replace("/");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="eyebrow">BACHELORTOUR 2026</span>
        <h1>Account erstellen</h1>
        <p>Dein Profil für die Tour.</p>
        <form onSubmit={submit}>
          <label className="avatar-upload">
            {preview ? <img src={preview} alt="Vorschau"/> : <span>Foto wählen</span>}
            <input name="avatar" type="file" accept="image/*" onChange={e => {
              const f=e.target.files?.[0]; if(f) setPreview(URL.createObjectURL(f));
            }}/>
          </label>
          <input name="name" placeholder="Vor- und Nachname" required />
          <input name="email" type="email" placeholder="E-Mail-Adresse" required />
          <input name="phone" type="tel" placeholder="Handynummer" required />
          <input name="password" type="password" placeholder="Passwort" required minLength={6}/>
          <input name="password2" type="password" placeholder="Passwort wiederholen" required minLength={6}/>
          {error && <div className="error">{error}</div>}
          <button className="primary-button" disabled={busy}>{busy ? "Account wird erstellt …" : "Registrieren"}</button>
        </form>
        <Link href="/login">Bereits registriert? <strong>Anmelden</strong></Link>
      </section>
    </main>
  );
}
