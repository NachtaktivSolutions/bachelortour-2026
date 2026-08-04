"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Phone, Plus, Trash2, UserCheck, XCircle } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";
import { berlinLocalToIso, formatBerlinDateTime } from "@/lib/datetime";
import type { Profile } from "@/lib/types";

type EmergencySettings={is_visible:boolean;headline:string;instructions:string|null};
type EmergencyContact={id:string;title:string;category:string;phone:string|null;address:string|null;note:string|null;sort_order:number};
type CheckinEvent={id:string;title:string;description:string|null;starts_at:string|null;closes_at:string|null;is_open:boolean;completed_at:string|null};
type Checkin={event_id:string;user_id:string};

export default function AdminTourToolsPage(){
  const {session}=useApp();const supabase=createClient();
  const [settings,setSettings]=useState<EmergencySettings|null>(null);
  const [contacts,setContacts]=useState<EmergencyContact[]>([]);
  const [events,setEvents]=useState<CheckinEvent[]>([]);
  const [checkins,setCheckins]=useState<Checkin[]>([]);
  const [members,setMembers]=useState<Profile[]>([]);
  const [status,setStatus]=useState("");
  const [resultEvent,setResultEvent]=useState<CheckinEvent|null>(null);

  const load=useCallback(async()=>{
    const [s,c,e,ch,m]=await Promise.all([
      supabase.from("emergency_settings").select("*").eq("id",1).maybeSingle(),
      supabase.from("emergency_contacts").select("*").order("sort_order").order("title"),
      supabase.from("checkin_events").select("*").order("created_at",{ascending:false}),
      supabase.from("checkins").select("event_id,user_id"),
      supabase.from("profiles").select("*").order("name")
    ]);
    setSettings(s.data);setContacts(c.data??[]);setEvents(e.data??[]);setCheckins(ch.data??[]);setMembers((m.data as Profile[])??[]);
  },[supabase]);
  useEffect(()=>{load()},[load]);

  async function saveEmergency(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const {error}=await supabase.from("emergency_settings").upsert({id:1,is_visible:f.get("is_visible")==="on",headline:String(f.get("headline")),instructions:String(f.get("instructions"))||null,updated_by:session?.user.id,updated_at:new Date().toISOString()});setStatus(error?error.message:"Notfallbereich gespeichert.");await load()}
  async function addContact(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const {error}=await supabase.from("emergency_contacts").insert({title:String(f.get("title")),category:String(f.get("category"))||"Allgemein",phone:String(f.get("phone"))||null,address:String(f.get("address"))||null,note:String(f.get("note"))||null,sort_order:Number(f.get("sort_order"))||0,created_by:session?.user.id});setStatus(error?error.message:"Kontakt hinzugefügt.");if(!error)form.reset();await load()}
  async function addCheckin(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const open=f.get("is_open")==="on";if(open)await supabase.from("checkin_events").update({is_open:false}).eq("is_open",true);const {error}=await supabase.from("checkin_events").insert({title:String(f.get("title")),description:String(f.get("description"))||null,starts_at:f.get("starts_at")?berlinLocalToIso(String(f.get("starts_at"))):null,closes_at:f.get("closes_at")?berlinLocalToIso(String(f.get("closes_at"))):null,is_open:open,completed_at:null,created_by:session?.user.id});setStatus(error?error.message:"Check-in angelegt.");if(!error)form.reset();await load()}
  async function openCheckin(event:CheckinEvent){await supabase.from("checkin_events").update({is_open:false}).eq("is_open",true);const {error}=await supabase.from("checkin_events").update({is_open:true,completed_at:null}).eq("id",event.id);setStatus(error?error.message:"Check-in geöffnet.");await load()}
  async function finishCheckin(event:CheckinEvent){if(!confirm(`Check-in „${event.title}“ wirklich beenden?`))return;const {error}=await supabase.from("checkin_events").update({is_open:false,completed_at:new Date().toISOString()}).eq("id",event.id);setStatus(error?error.message:"Check-in beendet und im Verlauf gespeichert.");await load()}
  async function remove(table:string,id:string){if(!confirm("Wirklich löschen?"))return;const {error}=await supabase.from(table).delete().eq("id",id);setStatus(error?error.message:"Gelöscht.");await load()}

  const active=events.find(e=>e.is_open)??null;
  const prepared=events.filter(e=>!e.is_open&&!e.completed_at);
  const completed=events.filter(e=>Boolean(e.completed_at));
  const eventCount=(id:string)=>checkins.filter(c=>c.event_id===id).length;

  return <AuthGate admin><Shell>
    <div className="page-heading"><span className="eyebrow">TOUR-ORGANISATION</span><h1>Notfall & Check-ins</h1><p>Notfallinformationen und Anwesenheit getrennt und übersichtlich verwalten.</p></div>
    {status&&<div className="status">{status}</div>}
    <div className="admin-tool-grid">
      <form className="admin-card" onSubmit={saveEmergency}><AlertTriangle/><h2>Notfallbereich</h2><label className="check-row"><input name="is_visible" type="checkbox" defaultChecked={settings?.is_visible}/> Für Teilnehmer sichtbar</label><input name="headline" defaultValue={settings?.headline||"Notfall & Hilfe"} required/><textarea name="instructions" defaultValue={settings?.instructions||""} placeholder="Allgemeiner Hinweis"/><button className="primary-button">Speichern</button></form>
      <form className="admin-card" onSubmit={addContact}><Phone/><h2>Notfallkontakt</h2><input name="title" placeholder="Name / Stelle" required/><input name="category" placeholder="Kategorie, z. B. Taxi"/><input name="phone" placeholder="Telefon"/><input name="address" placeholder="Adresse"/><textarea name="note" placeholder="Hinweis"/><input name="sort_order" type="number" placeholder="Reihenfolge"/><button className="primary-button"><Plus/>Hinzufügen</button></form>
      <form className="admin-card" onSubmit={addCheckin}><UserCheck/><h2>Check-in erstellen</h2><input name="title" placeholder="Treffpunkt / Abfahrt" required/><textarea name="description" placeholder="Hinweis"/><label>Beginn<input name="starts_at" type="datetime-local"/></label><label>Ende<input name="closes_at" type="datetime-local"/></label><label className="check-row"><input name="is_open" type="checkbox"/> Sofort öffnen</label><button className="primary-button"><CheckCircle2/>Anlegen</button></form>
    </div>

    <section className="admin-list-section"><h2>Notfallkontakte</h2>{contacts.length?contacts.map(item=><div className="admin-compact-row" key={item.id}><div><strong>{item.title}</strong><small>{item.category}{item.phone?` · ${item.phone}`:""}</small></div><button onClick={()=>remove("emergency_contacts",item.id)}><Trash2/></button></div>):<div className="empty-card">Noch keine Kontakte.</div>}</section>
    <section className="admin-list-section"><h2>Aktiver Check-in</h2>{active?<div className="admin-compact-row"><div><strong>{active.title}</strong><small>{eventCount(active.id)}/{members.length} eingecheckt{active.starts_at?` · ${formatBerlinDateTime(active.starts_at)}`:""}</small></div><div className="row-actions"><button className="danger-button" onClick={()=>finishCheckin(active)}><XCircle/>Beenden</button></div></div>:<div className="empty-card">Kein Check-in aktiv.</div>}</section>
    <section className="admin-list-section"><h2>Vorbereitete Check-ins</h2>{prepared.length?prepared.map(event=><div className="admin-compact-row" key={event.id}><div><strong>{event.title}</strong><small>{event.starts_at?formatBerlinDateTime(event.starts_at):"Ohne Startzeit"}</small></div><div className="row-actions"><button onClick={()=>openCheckin(event)}>Öffnen</button><button onClick={()=>remove("checkin_events",event.id)}><Trash2/></button></div></div>):<div className="empty-card">Keine vorbereiteten Check-ins.</div>}</section>
    <section className="admin-list-section"><h2>Beendete Check-ins</h2>{completed.length?completed.map(event=><div className="admin-compact-row" key={event.id}><div><strong>{event.title}</strong><small>{eventCount(event.id)}/{members.length} eingecheckt · beendet {event.completed_at?formatBerlinDateTime(event.completed_at):""}</small></div><div className="row-actions"><button onClick={()=>setResultEvent(event)}>Ergebnis</button><button onClick={()=>remove("checkin_events",event.id)}><Trash2/></button></div></div>):<div className="empty-card">Noch kein Verlauf.</div>}</section>

    {resultEvent&&<div className="cropper-backdrop"><div className="cropper-modal"><button className="cropper-close" onClick={()=>setResultEvent(null)}>×</button><h2>{resultEvent.title}</h2><p>{eventCount(resultEvent.id)} von {members.length} waren eingecheckt.</p><div className="missing-box"><h3>Eingecheckt</h3>{members.filter(m=>checkins.some(c=>c.event_id===resultEvent.id&&c.user_id===m.id)).map(m=><div className="missing-person" key={m.id}><strong>{m.name}</strong><small>{m.participant_status||"kein Status"}</small></div>)}</div><div className="missing-box"><h3>Gefehlt</h3>{members.filter(m=>!checkins.some(c=>c.event_id===resultEvent.id&&c.user_id===m.id)).map(m=><div className="missing-person" key={m.id}><div><strong>{m.name}</strong><small>{m.participant_status||"kein Status"}</small></div>{m.phone&&<a href={`tel:${m.phone}`}><Phone/></a>}</div>)}</div></div></div>}
  </Shell></AuthGate>;
}
