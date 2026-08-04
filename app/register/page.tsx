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
    const formElement = e.currentTarget;
    setBusy(true); setError(""); setInfo("");
    const form = new FormData(formElement);
    const firstName = String(form.get("first_name")).trim();
    const lastName = String(form.get("last_name")).trim();
    const name = `${firstName} ${lastName}`.trim();
    const phone = String(form.get("phone")).trim();
    const clothingSize = String(form.get("clothing_size")).trim();
    const homeAddress = String(form.get("home_address")).trim();
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));

    if (password !== String(form.get("password2"))) {
      setError("Die Passwörter stimmen nicht überein."); setBusy(false); return;
    }

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName, name, phone } }
    });

    if (authError || !data.user) {
      setError(authError?.message ?? "Registrierung fehlgeschlagen."); setBusy(false); return;
    }

    if (data.session) {
      await supabase.from("profiles").update({ first_name: firstName, last_name: lastName, name, phone }).eq("id", data.user.id);
      const { error: privateError } = await supabase.from("member_private_details").upsert({
        user_id: data.user.id,
        clothing_size: clothingSize || null,
        home_address: homeAddress || null,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });
      if (privateError) { setError(`Account wurde erstellt, aber die Zusatzdaten konnten nicht gespeichert werden: ${privateError.message}`); setBusy(false); return; }

      const file = form.get("avatar");
      if (file instanceof File && file.size > 0) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${data.user.id}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
        if (uploadError) { setError(`Account wurde erstellt, aber das Profilbild konnte nicht gespeichert werden: ${uploadError.message}`); setBusy(false); return; }
        const avatarUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
        const { error: profileError } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", data.user.id);
        if (profileError) { setError(`Account wurde erstellt, aber das Profilbild konnte nicht verknüpft werden: ${profileError.message}`); setBusy(false); return; }
      }
      router.replace("/"); router.refresh(); return;
    }

    setInfo("Account erstellt. Bitte bestätige zunächst die E-Mail und melde dich danach an. Kleidergröße und Anschrift kannst du anschließend im Profil ergänzen.");
    setBusy(false);
  }

  return <main className="auth-page"><section className="auth-card">
    <span className="eyebrow">FIRESTARTER 2026</span><h1>Account erstellen</h1><p>Dein Profil für die Tour.</p>
    <form onSubmit={submit}>
      <label className="avatar-upload">{preview ? <img src={preview} alt="Profilbild-Vorschau" /> : <span>Foto wählen</span>}<input name="avatar" type="file" accept="image/*" onChange={e => { const file=e.target.files?.[0]; if(file)setPreview(URL.createObjectURL(file)); }}/></label>
      <div className="two-cols auth-name-fields"><input name="first_name" autoComplete="given-name" placeholder="Vorname" required/><input name="last_name" autoComplete="family-name" placeholder="Nachname" required/></div>
      <input name="email" type="email" autoComplete="email" placeholder="E-Mail-Adresse" required/>
      <input name="phone" type="tel" autoComplete="tel" placeholder="Handynummer" required/>
      <select name="clothing_size" required defaultValue=""><option value="" disabled>Kleidergröße auswählen</option><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option><option>3XL</option><option>4XL</option><option value="Sonstige">Sonstige</option></select>
      <textarea name="home_address" autoComplete="street-address" placeholder="Wohnanschrift: Straße, Hausnummer, PLZ und Ort" required/>
      <small className="private-data-note">Kleidergröße und Wohnanschrift sind ausschließlich für Admins sichtbar.</small>
      <input name="password" type="password" autoComplete="new-password" placeholder="Passwort" required minLength={6}/>
      <input name="password2" type="password" autoComplete="new-password" placeholder="Passwort wiederholen" required minLength={6}/>
      {error&&<div className="error">{error}</div>}{info&&<div className="status">{info}</div>}
      <button className="primary-button" disabled={busy}>{busy?"Account wird erstellt …":"Registrieren"}</button>
    </form>
    <Link href="/login">Bereits registriert? <strong>Anmelden</strong></Link>
  </section></main>;
}
