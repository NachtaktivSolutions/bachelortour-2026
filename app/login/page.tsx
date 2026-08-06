"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(e.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password"))
    });
    if (error) { setError("E-Mail-Adresse oder Passwort ist falsch."); setBusy(false); return; }
    router.replace("/");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <img className="auth-logo" src="/api/branding/icon" alt="Firestarter 26" />
        <span className="eyebrow">FIRESTARTER 26</span>
        <h1>Willkommen zurück</h1>
        <p>Melde dich für die Bachelortour 2026 an.</p>
        <form onSubmit={submit}>
          <input name="email" type="email" placeholder="E-Mail-Adresse" required />
          <input name="password" type="password" placeholder="Passwort" required minLength={6}/>
          {error && <div className="error">{error}</div>}
          <button className="primary-button" disabled={busy}>{busy ? "Anmeldung läuft …" : "Anmelden"}</button>
        </form>
        <Link href="/register">Noch keinen Account? <strong>Registrieren</strong></Link>
      </section>
    </main>
  );
}
