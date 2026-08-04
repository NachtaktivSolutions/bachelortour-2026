"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, MapPin, Navigation, Phone, ShieldCheck, UserCheck, Users } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

type EmergencySettings={is_visible:boolean;headline:string;instructions:string|null};
type EmergencyContact={id:string;title:string;category:string;phone:string|null;address:string|null;note:string|null;sort_order:number};
type CheckinEvent={id:string;title:string;description:string|null;starts_at:string|null;closes_at:string|null;is_open:boolean};
type Checkin={event_id:string;user_id:string;checked_in_at:string};

const statuses=["bereit","unterwegs","im Hotel","komme später","brauche Pause","brauche Hilfe"];

export default function TourToolsPage(){
  const {profile,session,refreshProfile}=useApp();
  const supabase=createClient();
  const [settings,setSettings]=useState<EmergencySettings|null>(null);
  const [contacts,setContacts]=useState<EmergencyContact[]>([]);
  const [events,setEvents]=useState<CheckinEvent[]>([]);
  const [checkins,setCheckins]=useState<Checkin[]>([]);
  const [members,setMembers]=useState<Profile[]>([]);
  const [status,setStatus]=useState("");
  const [helpBusy,setHelpBusy]=useState(false);

  const load=useCallback(async()=>{
    const [s,c,e,ch,m]=await Promise.all([
      supabase.from("emergency_settings").select("is_visible,headline,instructions").eq("id",1).maybeSingle(),
      supabase.from("emergency_contacts").select("*").order("sort_order").order("title"),
      supabase.from("checkin_events").select("*").order("created_at",{ascending:false}),
      supabase.from("checkins").select("*"),
      supabase.from("profiles").select("*").order("name")
    ]);
    setSettings(s.data);setContacts(c.data??[]);setEvents(e.data??[]);setCheckins(ch.data??[]);setMembers((m.data as Profile[])??[]);
  },[supabase]);

  useEffect(()=>{
    load();
    const channel=supabase.channel("tour-tools-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"emergency_settings"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"emergency_contacts"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"checkin_events"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"checkins"},load)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles"},load).subscribe();
    return()=>{supabase.removeChannel(channel)};
  },[load,supabase]);

  const activeEvent=events.find(e=>e.is_open)??null;
  const checkedIds=useMemo(()=>new Set(checkins.filter(c=>c.event_id===activeEvent?.id).map(c=>c.user_id)),[checkins,activeEvent?.id]);
  const ownChecked=Boolean(profile&&checkedIds.has(profile.id));
  const missing=members.filter(m=>!checkedIds.has(m.id));

  async function toggleCheckin(){
    if(!profile||!activeEvent)return;
    const result=ownChecked
      ? await supabase.from("checkins").delete().eq("event_id",activeEvent.id).eq("user_id",profile.id)
      : await supabase.from("checkins").insert({event_id:activeEvent.id,user_id:profile.id});
    setStatus(result.error?result.error.message:ownChecked?"Check-in zurückgenommen.":"Du bist eingecheckt.");
    await load();
  }

  async function setParticipantStatus(next:string){
    if(!profile)return;
    const {error}=await supabase.from("profiles").update({participant_status:next,status_updated_at:new Date().toISOString()}).eq("id",profile.id);
    setStatus(error?error.message:`Status: ${next}`);if(!error){await refreshProfile();await load()}
  }

  async function sendHelp(){
    if(!profile||!session||helpBusy)return;
    if(!confirm("Wirklich einen Hilferuf an alle senden? Dein aktueller Standort wird sofort geteilt."))return;
    setHelpBusy(true);setStatus("Standort wird ermittelt …");
    try{
      if(!navigator.geolocation)throw new Error("Dieses Gerät unterstützt keine Standortermittlung.");
      const position=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
      const now=new Date().toISOString();
      const {error:updateError}=await supabase.from("profiles").update({latitude:position.coords.latitude,longitude:position.coords.longitude,location_updated_at:now,share_location:true,participant_status:"brauche Hilfe",status_updated_at:now}).eq("id",profile.id);
      if(updateError)throw updateError;
      const response=await fetch("/api/help-alert",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({latitude:position.coords.latitude,longitude:position.coords.longitude})});
      const json=await response.json();if(!response.ok)throw new Error(json.error||"Hilferuf konnte nicht gesendet werden.");
      setStatus("Hilferuf wurde an alle gesendet. Dein Standort ist jetzt sichtbar.");await refreshProfile();await load();
    }catch(err){setStatus(err instanceof Error?err.message:"Standort konnte nicht ermittelt werden.")}finally{setHelpBusy(false)}
  }

  return <AuthGate><Shell>
    <div className="page-heading"><span className="eyebrow">TOUR-ASSISTENT</span><h1>Hilfe, Check-in & Status</h1><p>Alles Wichtige für Treffpunkte und Notfälle an einem Ort.</p></div>
    {status&&<div className="status">{status}</div>}

    <section className="tour-tool-card help-center-card"><div className="tool-card-head"><AlertTriangle/><div><span className="eyebrow">HILFE-BEREICH</span><h2>Schnelle Hilfe</h2></div></div><button className="help-center-alert" onClick={sendHelp} disabled={helpBusy}><span><AlertTriangle/></span><div><strong>{helpBusy?"Hilferuf wird gesendet …":"Hilfe an alle senden"}</strong><small>Standort neu abrufen und alle Teilnehmer per Push benachrichtigen.</small></div><b>›</b></button><div className="help-center-location"><MapPin/><div><strong>Standortfreigabe</strong><small>Dein Standort ist {profile?.share_location?"für andere sichtbar":"aktuell verborgen"}.</small></div><span className={profile?.share_location?"active":""}>{profile?.share_location?"Aktiv":"Aus"}</span></div></section>

    <section className="tour-tool-card status-card"><div className="tool-card-head"><Users/><div><span className="eyebrow">MEIN STATUS</span><h2>Wie ist dein Stand?</h2></div></div><div className="status-choice-grid">{statuses.map(item=><button key={item} className={profile?.participant_status===item?"active":""} onClick={()=>setParticipantStatus(item)}>{item}</button>)}</div>{profile?.status_updated_at&&<small>Zuletzt geändert: {new Date(profile.status_updated_at).toLocaleString("de-DE")}</small>}</section>

    {activeEvent?<section className="tour-tool-card checkin-card"><div className="tool-card-head"><UserCheck/><div><span className="eyebrow">LIVE-CHECK-IN</span><h2>{activeEvent.title}</h2></div></div>{activeEvent.description&&<p>{activeEvent.description}</p>}<div className="checkin-progress"><strong>{checkedIds.size} / {members.length}</strong><span>sind da</span></div><button className={`primary-button big-checkin ${ownChecked?"checked":""}`} onClick={toggleCheckin}>{ownChecked?<><CheckCircle2/>Ich bin eingecheckt</>:<><MapPin/>Ich bin da</>}</button>{profile?.is_admin&&<div className="missing-box"><h3>Wer fehlt noch?</h3>{missing.length?missing.map(member=><div className="missing-person" key={member.id}><span className="avatar">{member.avatar_url?<img src={member.avatar_url} alt=""/>:member.name.slice(0,1)}</span><div><strong>{member.name}</strong><small>{member.participant_status||"kein Status"}</small></div>{member.phone&&<a href={`tel:${member.phone}`} aria-label={`${member.name} anrufen`}><Phone/></a>}</div>):<p>Alle sind da 🎉</p>}</div>}</section>:<section className="tour-tool-card empty-tool"><Clock3/><h2>Kein Check-in aktiv</h2><p>Sobald ein Admin einen Treffpunkt öffnet, kannst du dich hier einchecken.</p></section>}

    {settings?.is_visible&&<section className="tour-tool-card emergency-card"><div className="tool-card-head"><AlertTriangle/><div><span className="eyebrow">NOTFALLKONTAKTE</span><h2>{settings.headline}</h2></div></div>{settings.instructions&&<p className="emergency-instructions">{settings.instructions}</p>}<div className="emergency-list">{contacts.map(item=><article key={item.id}><div><span className="eyebrow">{item.category}</span><h3>{item.title}</h3>{item.note&&<p>{item.note}</p>}{item.address&&<small>{item.address}</small>}</div><div className="emergency-actions">{item.phone&&<a href={`tel:${item.phone}`} aria-label="Anrufen"><Phone/></a>}{item.address&&<a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address)}`} aria-label="Navigieren"><Navigation/></a>}</div></article>)}</div></section>}

    <section className="offline-info"><ShieldCheck/><div><strong>Offline verfügbar</strong><p>Programm, Hotel, Packliste und dieser Bereich werden nach dem ersten Öffnen zwischengespeichert. Live-Daten wie Standort und Check-in brauchen weiterhin Internet.</p></div></section>
  </Shell></AuthGate>;
}
