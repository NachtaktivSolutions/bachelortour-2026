"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarClock, Navigation, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";
import type { ProgramItem } from "@/lib/types";

export default function AdminEventsPage() {
  const { session } = useApp();
  const supabase = createClient();
  const [items, setItems] = useState<ProgramItem[]>([]);
  const [editing, setEditing] = useState<ProgramItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("program_items").select("*").order("starts_at");
    if (error) setStatus(error.message);
    else setItems(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session) return;
    setStatus("");
    const form = new FormData(e.currentTarget);
    const values = {
      title: String(form.get("title")).trim(),
      description: String(form.get("description")).trim() || null,
      address: String(form.get("address")).trim() || null,
      starts_at: String(form.get("starts_at")),
      ends_at: String(form.get("ends_at")) || null,
      latitude: Number(form.get("latitude")) || null,
      longitude: Number(form.get("longitude")) || null
    };

    if (values.ends_at && new Date(values.ends_at) < new Date(values.starts_at)) {
      setStatus("Die Endzeit darf nicht vor der Startzeit liegen.");
      return;
    }

    const result = editing
      ? await supabase.from("program_items").update(values).eq("id", editing.id)
      : await supabase.from("program_items").insert({ ...values, created_by: session.user.id });

    if (result.error) setStatus(result.error.message);
    else {
      setStatus(editing ? "Event gespeichert." : "Event angelegt.");
      setEditing(null);
      setCreating(false);
      await load();
    }
  }

  async function remove(item: ProgramItem) {
    if (!window.confirm(`Event „${item.title}“ wirklich löschen?`)) return;
    const { error } = await supabase.from("program_items").delete().eq("id", item.id);
    if (error) setStatus(error.message);
    else {
      setStatus("Event gelöscht.");
      if (editing?.id === item.id) setEditing(null);
      await load();
    }
  }

  const formItem = editing;

  return <AuthGate admin><Shell>
    <div className="page-heading">
      <span className="eyebrow">ADMIN · PROGRAMM</span>
      <h1>Events verwalten</h1>
      <p>Beginn, Ende, Adresse und Kartenposition bearbeiten. Vergangene Events verschwinden nach der Endzeit automatisch von der Karte.</p>
    </div>

    {status && <div className="status">{status}</div>}

    <div className="event-admin-toolbar">
      <button className="primary-button" onClick={() => { setCreating(true); setEditing(null); }}><Plus />Neues Event</button>
    </div>

    {(creating || editing) && <form className="admin-card event-edit-form" onSubmit={save}>
      <div className="admin-card-heading">
        <div><CalendarClock /><h2>{editing ? "Event bearbeiten" : "Neues Event"}</h2></div>
        <button type="button" className="icon-button" onClick={() => { setEditing(null); setCreating(false); }}><X /></button>
      </div>
      <input name="title" defaultValue={formItem?.title ?? ""} placeholder="Titel" required />
      <textarea name="description" defaultValue={formItem?.description ?? ""} placeholder="Beschreibung" />
      <input name="address" defaultValue={formItem?.address ?? ""} placeholder="Adresse" />
      <div className="two-cols">
        <label>Beginn<input name="starts_at" type="datetime-local" defaultValue={toLocalInput(formItem?.starts_at)} required /></label>
        <label>Ende<input name="ends_at" type="datetime-local" defaultValue={toLocalInput(formItem?.ends_at)} required /></label>
      </div>
      <div className="two-cols">
        <input name="latitude" type="number" step="any" defaultValue={formItem?.latitude ?? ""} placeholder="Breitengrad" />
        <input name="longitude" type="number" step="any" defaultValue={formItem?.longitude ?? ""} placeholder="Längengrad" />
      </div>
      <button className="primary-button"><Save />Speichern</button>
    </form>}

    {loading ? <div className="empty-card">Events werden geladen …</div> : <div className="event-admin-list">
      {items.map(item => {
        const expired = Boolean(item.ends_at && new Date(item.ends_at) < new Date());
        return <article className={`event-admin-card ${expired ? "expired" : ""}`} key={item.id}>
          <div className="event-admin-date">
            <strong>{new Date(item.starts_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</strong>
            <span>{new Date(item.starts_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
          <div className="event-admin-copy">
            <div className="event-admin-title"><h3>{item.title}</h3>{expired && <em>Vergangen</em>}</div>
            <p>{item.description}</p>
            <small>{item.address || "Keine Adresse"}</small>
            {item.ends_at && <small>Ende: {new Date(item.ends_at).toLocaleString("de-DE")}</small>}
          </div>
          <div className="event-admin-actions">
            {item.address && <a className="icon-button" target="_blank" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address)}`}><Navigation /></a>}
            <button className="icon-button" onClick={() => { setEditing(item); setCreating(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil /></button>
            <button className="icon-button danger-icon" onClick={() => remove(item)}><Trash2 /></button>
          </div>
        </article>;
      })}
      {!items.length && <div className="empty-card">Noch keine Events angelegt.</div>}
    </div>}
  </Shell></AuthGate>;
}

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}
