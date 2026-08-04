"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertTriangle, BellRing, CheckCircle2, Clock3, Eye, Phone, Plus, Send, StopCircle, Trash2, UserCheck } from "lucide-react";
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
type ScheduledJob={id:string;job_type:string;payload:Record<string,any>;scheduled_for:string;status:string};

export default function AdminTourToolsPage(){
  const {session}=useApp();const supabase=createClient();
  const [settings,setSettings]=useState<EmergencySettings|null>(null);
  const [contacts,setContacts]=useState<EmergencyContact[]>([]);
  const [events,setEvents]=useState<CheckinEvent[]>([]);
  const [checkins,setCheckins]=useState<Checkin[]>([]);
  const [members,setMembers]=useState<Profile[]>([]);
  const [jobs,setJobs]=useState<ScheduledJob[]>([]);
  const [status,setStatus]=useState("");
  const [historyEventId,setHistoryEventId]=useState<string|null>(null);

  const load=useCallback(async()=>{
    const [s,c,e,ch,m,j]=await Promise.all([
      supabase.from("emergency_settings").select("*").eq("id",1).maybeSingle(),
      supabase.from("emergency_contacts").select("*").order("sort_order").order("title"),
      supabase.from("checkin_events").select("*").order("created_at",{ascending:false}),
      supabase.from("checkins").select("event_id,user_id"),
      supabase.from("profiles").select("*").order("name"),
      supabase.from("scheduled_jobs").select("*").eq("job_type","push").order("scheduled_for",{ascending:false}).limit(30)
    ]);
    setSettings(s.data);setContacts(c.data??[]);setEvents(e.data??[]);setCheckins(ch.data??[]);setMembers((m.data as Profile[])??[]);setJobs(j.data??[]);
  },[supabase]);
  useEffect(()=>{load()},[load]);

  async function saveEmergency(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const {error}=await supabase.from("emergency_settings").upsert({id:1,is_visible:f.get("is_visible")==="on",headline:String(f.get("headline")),instructions:String(f.get("instructions"))||null,updated_by:session?.user.id,updated_at:new Date().toISOString()});setStatus(error?error.message:"Notfallbereich gespeichert.");await load()}
  async function addContact(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const {error}=await supabase.from("emergency_contacts").insert({title:String(f.get("title")),category:String(f.get("category"))||"Allgemein",phone:String(f.get("phone"))||null,address:String(f.get("address"))||null,note:String(f.get("note"))||null,sort_order:Number(f.get("sort_order"))||0,created_by:session?.user.id});setStatus(error?error.message:"Kontakt hinzugefügt.");if(!error)form.reset();await load()}
  async function addCheckin(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const open=f.get("is_open")==="on";if(open)await supabase.from("checkin_events").update({is_open:false}).eq("is_open",true);const {error}=await supabase.from("checkin_events").insert({title:String(f.get("title")),description:String(f.get("description"))||null,starts_at:f.get("starts_at")?berlinLocalToIso(String(f.get("starts_at"))):null,closes_at:f.get("closes_at")?berlinLocalToIso(String(f.get("closes_at"))):null,is_open:open,completed_at:null,created_by:session?.user.id});setStatus(error?error.message:"Check-in angelegt.");if(!error)form.reset();await load()}
  async function openCheckin(event:CheckinEvent){await supabase.from("checkin_events").update({is_open:false}).eq("is_open",true);const {error}=await supabase.from("checkin_events").update({is_open:true,completed_at:null}).eq("id",event.id);setStatus(error?error.message:"Check-in geöffnet.");await load()}
  async function finishCheckin(event:CheckinEvent){if(!confirm(`Check-in „${event.title}“ wirklich beenden? Danach können sich keine weiteren Teilnehmer einchecken.`))return;const {error}=await supabase.from("checkin_events").update({is_open:false,completed_at:new Date().toISOString()}).eq("id",event.id);setStatus(error?error.message:"Check-in beendet und im Verlauf gespeichert.");await load()}
  async function scheduleReminder(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const when=berlinLocalToIso(String(f.get("scheduled_for")));const payload={title:String(f.get("title")),body:String(f.get("body")),url:String(f.get("url"))||"/tour-tools"};const {error}=await supabase.from("scheduled_jobs").insert({job_type:"push",payload,scheduled_for:when,created_by:session?.user.id});setStatus(error?error.message:"Erinnerung wurde geplant.");if(!error)form.reset();await load()}
  async function remove(table:string,id:string){if(!confirm("Wirklich löschen?"))return;const {error}=await supabase.from(table).delete().eq("id",id);setStatus(error?error.message:"Gelöscht.");if(historyEventId===id)setHistoryEventId(null);await load()}

  const activeEvent=events.find(event=>event.is_open)??null;
  const preparedEvents=events.filter(event=>!event.is_open&&!event.completed_at);
  const completedEvents=events.filter(event=>Boolean(event.completed_at));

  function resultFor(eventId:string){
    const checkedIds=new Set(checkins.filter(item=>item.event_id===eventId).map(item=>item.user_id));
    return {checked:members.filter(member=>checkedIds.has(member.id)),missing:members.filter(member=>!checkedIds.has(member.id))};
  }

  return <AuthGate admin><Shell>
    <div className="page-heading"><span className="eyebrow">TOUR-ORGANISATION</span><h1>Hilfe, Check-ins & Erinnerungen</h1><p>Notfallinfos freischalten, Treffpunkte kontrollieren und Push-Erinnerungen zeitlich planen.</p></div>
    {status&&<div className="status">{status}</div>}
    <div className="admin-tool-grid">
      <form className="admin-card" onSubmit={saveEmergency}><AlertTriangle/><h2>Notfallbereich</h2><label className="check-row"><input name="is_visible" type="checkbox" defaultChecked={settings?.is_visible}/> Für Teilnehmer sichtbar</label><input name="headline" defaultValue={settings?.headline||"Notfall & Hilfe"} required/><textarea name="instructions" defaultValue={settings?.instructions||""} placeholder="Allgemeiner Hinweis"/><button className="primary-button">Speichern</button></form>
      <form className="admin-card" onSubmit={addContact}><Phone/><h2>Notfallkontakt</h2><input name="title" placeholder="Name / Stelle" required/><input name="category" placeholder="Kategorie, z. B. Taxi"/><input name="phone" placeholder="Telefon"/><input name="address" placeholder="Adresse"/><textarea name="note" placeholder="Hinweis"/><input name="sort_order" type="number" placeholder="Reihenfolge"/><button className="primary-button"><Plus/>Hinzufügen</button></form>
      <form className="admin-card" onSubmit={addCheckin}><UserCheck/><h2>Check-in erstellen</h2><input name="title" placeholder="Treffpunkt / Abfahrt" required/><textarea name="description" placeholder="Hinweis"/><label>Beginn<input name="starts_at" type="datetime-local"/></label><label>Ende<input name="closes_at" type="datetime-local"/></label><label className="check-row"><input name="is_open" type="checkbox"/> Sofort öffnen</label><button className="primary-button"><CheckCircle2/>Anlegen</button></form>
      <form className="admin-card" onSubmit={scheduleReminder}><BellRing/><h2>Automatische Erinnerung</h2><input name="title" placeholder="Titel" required/><textarea name="body" placeholder="Push-Nachricht" required/><label><Clock3/> Datum und Uhrzeit<input name="scheduled_for" type="datetime-local" required/></label><select name="url" defaultValue="/tour-tools"><option value="/tour-tools">Hilfe & Check-in</option><option value="/packing-list">Packliste</option><option value="/program">Programm</option><option value="/">Startseite</option></select><button className="primary-button"><Send/>Erinnerung planen</button></form>
    </div>

    <section className="admin-list-section"><h2>Notfallkontakte</h2>{contacts.map(item=><div className="admin-compact-row" key={item.id}><div><strong>{item.title}</strong><small>{item.category}{item.phone?` · ${item.phone}`:""}</small></div><button onClick={()=>remove("emergency_contacts",item.id)}><Trash2/></button></div>)}</section>

    <section className="admin-list-section"><h2>Aktiver Check-in</h2>{activeEvent?(()=>{const result=resultFor(activeEvent.id);return <div className="admin-compact-row active-checkin-row"><div><strong>{activeEvent.title}</strong><small>{result.checked.length}/{members.length} eingecheckt{activeEvent.starts_at?` · ${formatBerlinDateTime(activeEvent.starts_at)}`:""}</small></div><div className="row-actions"><button className="active" onClick={()=>setHistoryEventId(historyEventId===activeEvent.id?null:activeEvent.id)}><Eye/>Ergebnis</button><button className="danger-button" onClick={()=>finishCheckin(activeEvent)}><StopCircle/>Beenden</button></div></div>})():<div className="empty-card">Aktuell ist kein Check-in geöffnet.</div>}</section>

    {preparedEvents.length>0&&<section className="admin-list-section"><h2>Vorbereitete Check-ins</h2>{preparedEvents.map(event=>{const count=checkins.filter(c=>c.event_id===event.id).length;return <div className="admin-compact-row" key={event.id}><div><strong>{event.title}</strong><small>{count}/{members.length} eingecheckt{event.starts_at?` · ${formatBerlinDateTime(event.starts_at)}`:""}</small></div><div className="row-actions"><button onClick={()=>openCheckin(event)}>Öffnen</button><button onClick={()=>remove("checkin_events",event.id)}><Trash2/></button></div></div>})}</section>}

    <section className="admin-list-section"><h2>Beendete Check-ins</h2>{completedEvents.length?completedEvents.map(event=>{const result=resultFor(event.id);const expanded=historyEventId===event.id;return <div key={event.id}><div className="admin-compact-row"><div><strong>{event.title}</strong><small>{result.checked.length}/{members.length} eingecheckt · beendet {event.completed_at?formatBerlinDateTime(event.completed_at):""}</small></div><div className="row-actions"><button onClick={()=>setHistoryEventId(expanded?null:event.id)}><Eye/>{expanded?"Schließen":"Ergebnis"}</button><button onClick={()=>remove("checkin_events",event.id)}><Trash2/></button></div></div>{expanded&&<div className="missing-box checkin-history-result"><h3>Eingecheckt ({result.checked.length})</h3>{result.checked.length?result.checked.map(member=><div className="missing-person" key={`checked-${member.id}`}><span className="avatar">{member.avatar_url?<img src={member.avatar_url} alt=""/>:member.name.slice(0,1)}</span><div><strong>{member.name}</strong><small>{member.participant_status||"kein Status"}</small></div></div>):<p>Niemand war eingecheckt.</p>}<h3>Hat gefehlt ({result.missing.length})</h3>{result.missing.length?result.missing.map(member=><div className="missing-person" key={`missing-${member.id}`}><span className="avatar">{member.avatar_url?<img src={member.avatar_url} alt=""/>:member.name.slice(0,1)}</span><div><strong>{member.name}</strong><small>{member.participant_status||"kein Status"}</small></div>{member.phone&&<a href={`tel:${member.phone}`} aria-label={`${member.name} anrufen`}><Phone/></a>}</div>):<p>Alle waren da 🎉</p>}</div>}</div>}):<div className="empty-card">Noch kein Check-in abgeschlossen.</div>}</section>

    <section className="admin-list-section"><h2>Geplante Erinnerungen</h2>{jobs.filter(j=>j.status==="pending").map(job=><div className="admin-compact-row" key={job.id}><div><strong>{job.payload.title}</strong><small>{formatBerlinDateTime(job.scheduled_for)}</small></div><button onClick={()=>remove("scheduled_jobs",job.id)}><Trash2/></button></div>)}</section>
  </Shell></AuthGate>;
}
