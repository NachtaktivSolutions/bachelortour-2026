"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarClock, Navigation, Pencil, Plus, Save, Trash2, X, MapPin, Flame, Star, Eye, EyeOff } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";
import { berlinLocalToIso, isoToBerlinLocalInput } from "@/lib/datetime";
import type { ProgramItem } from "@/lib/types";

export default function AdminEventsPage() {
  const { session } = useApp();
  const supabase = createClient();
  const [items, setItems] = useState<ProgramItem[]>([]);
  const [editing, setEditing] = useState<ProgramItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("program_items").select("*").order("starts_at");
    if (error) setStatus(error.message); else setItems((data as ProgramItem[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session) return;
    setSaving(true); setStatus("");
    try {
      const form = new FormData(e.currentTarget);
      const address = String(form.get("address")).trim();
      let latitude = Number(form.get("latitude")) || null;
      let longitude = Number(form.get("longitude")) || null;

      if (address) {
        const geoResponse = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
        const geo = await geoResponse.json();
        if (!geoResponse.ok) throw new Error(geo.error || "Adresse konnte nicht gefunden werden.");
        latitude = geo.latitude;
        longitude = geo.longitude;
      }

      const startsAt = berlinLocalToIso(String(form.get("starts_at")));
      const endsAt = berlinLocalToIso(String(form.get("ends_at")));
      if (endsAt && startsAt && new Date(endsAt) < new Date(startsAt)) throw new Error("Die Endzeit darf nicht vor der Startzeit liegen.");

      const markerType = String(form.get("marker_type")) === "meeting" ? "meeting" : "program";
      const isVisible = form.get("is_visible") === "on";
      const values = {
        title: String(form.get("title")).trim(),
        description: String(form.get("description")).trim() || null,
        address: address || null,
        starts_at: startsAt,
        ends_at: endsAt || null,
        latitude,
        longitude,
        marker_type: markerType,
        is_visible: isVisible
      };

      const result = editing
        ? await supabase.from("program_items").update(values).eq("id", editing.id).select().single()
        : await supabase.from("program_items").insert({ ...values, created_by: session.user.id }).select().single();
      if (result.error) throw result.error;

      setStatus(isVisible ? "Event gespeichert und für alle sichtbar." : "Event geheim gespeichert. Nur Admins können es sehen.");
      setEditing(null); setCreating(false); await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Event konnte nicht gespeichert werden.");
    } finally { setSaving(false); }
  }

  async function toggleVisibility(item: ProgramItem) {
    const next = !item.is_visible;
    const question = next
      ? `„${item.title}“ jetzt für alle Teilnehmer bekanntgeben?`
      : `„${item.title}“ wieder vor den Teilnehmern verbergen?`;
    if (!window.confirm(question)) return;
    const { error } = await supabase.from("program_items").update({ is_visible: next }).eq("id", item.id);
    setStatus(error ? error.message : next ? "Programmpunkt wurde bekanntgegeben." : "Programmpunkt wurde verborgen.");
    if (!error) await load();
  }

  async function remove(item: ProgramItem) {
    if (!window.confirm(`Event „${item.title}“ wirklich löschen?`)) return;
    const { error } = await supabase.from("program_items").delete().eq("id", item.id);
    setStatus(error ? error.message : "Event gelöscht.");
    if (!error) { if (editing?.id === item.id) setEditing(null); await load(); }
  }

  const formItem = editing;
  return <AuthGate admin><Shell>
    <div className="page-heading"><span className="eyebrow">ADMIN · PROGRAMM</span><h1>Events verwalten</h1><p>Programmpunkte geheim vorbereiten und erst bei der Bekanntgabe für alle freischalten.</p></div>
    {status && <div className="status">{status}</div>}
    <div className="event-admin-toolbar"><button className="primary-button" onClick={() => { setCreating(true); setEditing(null); }}><Plus />Neues Event</button></div>

    {(creating || editing) && <form className="admin-card event-edit-form" onSubmit={save}>
      <div className="admin-card-heading"><div><CalendarClock /><h2>{editing ? "Event bearbeiten" : "Neues Event"}</h2></div><button type="button" className="icon-button" onClick={() => { setEditing(null); setCreating(false); }}><X /></button></div>
      <input name="title" defaultValue={formItem?.title ?? ""} placeholder="Titel" required />
      <textarea name="description" defaultValue={formItem?.description ?? ""} placeholder="Beschreibung" />
      <label>Adresse – wird automatisch auf der Karte gesetzt<input name="address" defaultValue={formItem?.address ?? ""} placeholder="Straße, Hausnummer, PLZ, Ort" required /></label>
      <div className="event-pin-choice"><span className="form-label">Darstellung auf der Karte</span><div className="event-pin-options">
        <label className="event-pin-option"><input type="radio" name="marker_type" value="program" defaultChecked={(formItem?.marker_type ?? "program") === "program"}/><span className="event-pin-preview program"><Star/></span><span><strong>Programmpunkt</strong><small>Roter Stern mit Beschriftung</small></span></label>
        <label className="event-pin-option"><input type="radio" name="marker_type" value="meeting" defaultChecked={formItem?.marker_type === "meeting"}/><span className="event-pin-preview meeting"><Flame/></span><span><strong>Treffpunkt</strong><small>Große Flamme mit Beschriftung</small></span></label>
      </div></div>
      <div className="two-cols"><label>Beginn<input name="starts_at" type="datetime-local" defaultValue={isoToBerlinLocalInput(formItem?.starts_at)} required /></label><label>Ende<input name="ends_at" type="datetime-local" defaultValue={isoToBerlinLocalInput(formItem?.ends_at)} required /></label></div>
      <label className="event-visibility-choice"><input name="is_visible" type="checkbox" defaultChecked={formItem?.is_visible ?? false}/><span>{(formItem?.is_visible ?? false) ? <Eye/> : <EyeOff/>}<strong>Für Teilnehmer sichtbar</strong><small>Ausgeschaltet bleibt der Programmpunkt geheim und ist nur für Admins sichtbar.</small></span></label>
      <input name="latitude" type="hidden" defaultValue={formItem?.latitude ?? ""}/><input name="longitude" type="hidden" defaultValue={formItem?.longitude ?? ""}/>
      {formItem?.latitude != null && formItem?.longitude != null && <small className="coordinate-hint"><MapPin/>Bisherige Position: {formItem.latitude.toFixed(5)}, {formItem.longitude.toFixed(5)}</small>}
      <button className="primary-button" disabled={saving}><Save />{saving ? "Adresse wird gesucht …" : (formItem?.is_visible ? "Speichern" : "Geheim speichern")}</button>
    </form>}

    {loading ? <div className="empty-card">Events werden geladen …</div> : <div className="event-admin-list">{items.map(item => {
      const expired = Boolean(item.ends_at && new Date(item.ends_at) < new Date());
      const markerType = item.marker_type ?? "program";
      return <article className={`event-admin-card ${expired ? "expired" : ""} ${item.is_visible ? "" : "is-hidden"}`} key={item.id}><div className="event-admin-date"><strong>{new Date(item.starts_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone:"Europe/Berlin" })}</strong><span>{new Date(item.starts_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone:"Europe/Berlin" })}</span></div><div className="event-admin-copy"><div className="event-admin-title"><h3>{item.title}</h3>{expired && <em>Vergangen</em>}<em className={item.is_visible ? "visible-chip" : "hidden-chip"}>{item.is_visible ? "Sichtbar" : "Geheim"}</em></div><p>{item.description}</p><small>{item.address || "Keine Adresse"}</small><span className={`event-type-chip ${markerType}`}>{markerType === "meeting" ? <><Flame/>Treffpunkt</> : <><Star/>Programmpunkt</>}</span></div><div className="event-admin-actions"><button className={`icon-button ${item.is_visible ? "" : "member-info-button"}`} onClick={() => toggleVisibility(item)} title={item.is_visible ? "Vor Teilnehmern verbergen" : "Jetzt bekanntgeben"}>{item.is_visible ? <EyeOff/> : <Eye/>}</button>{item.address && <a className="icon-button" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address)}`}><Navigation /></a>}<button className="icon-button" onClick={() => { setEditing(item); setCreating(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil /></button><button className="icon-button danger-icon" onClick={() => remove(item)}><Trash2 /></button></div></article>;
    })}{!items.length && <div className="empty-card">Noch keine Events angelegt.</div>}</div>}
  </Shell></AuthGate>;
}
