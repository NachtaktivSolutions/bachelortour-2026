"use client";

import { FormEvent, useEffect, useState } from "react";
import { Newspaper, MapPinned, BellRing, Settings2, Users, ShieldCheck } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/app-provider";
import type { Profile, EventSettings } from "@/lib/types";

export default function AdminPage(){
  const {session}=useApp(); const supabase=createClient(); const [status,setStatus]=useState("");
  const [members,setMembers]=useState<Profile[]>([]); const [event,setEvent]=useState<EventSettings|null>(null);

  const load=async()=>{
    const [m,e]=await Promise.all([
      supabase.from("profiles").select("*").order("name"),
      supabase.from("event_settings").select("*").eq("id",1).maybeSingle()
    ]);
    setMembers(m.data??[]); setEvent(e.data);
  };
  useEffect(()=>{load()},[]);

  async function sendPushPayload(title:string,body:string){
    const token=session?.access_token;
    const res=await fetch("/api/push/send",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({title,body,url:"/"})});
    return res.json();
  }

  async function addNews(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); const f=new FormData(e.currentTarget); setStatus("");
    const title=String(f.get("title")), body=String(f.get("body"));
    const {error}=await supabase.from("news").insert({title,body,author_id:session!.user.id});
    if(error)setStatus(error.message); else {
      if(f.get("push")==="on") await sendPushPayload(title,body);
      setStatus("Neuigkeit veröffentlicht.");e.currentTarget.reset()
    }
  }
  async function addPin(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);setStatus("");
    const title=String(f.get("title"));
    const {error}=await supabase.from("map_pins").insert({
      title,description:String(f.get("description")),
      latitude:Number(f.get("latitude")),longitude:Number(f.get("longitude")),
      starts_at:String(f.get("starts_at"))||null,created_by:session!.user.id
    });
    if(error)setStatus(error.message); else {
      if(f.get("push")==="on") await sendPushPayload(`Neuer Termin: ${title}`,String(f.get("description"))||"Es gibt einen neuen Programmpunkt.");
      setStatus("Termin gespeichert.");e.currentTarget.reset()
    }
  }
  async function saveEvent(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);setStatus("");
    const {error}=await supabase.from("event_settings").upsert({
      id:1,title:String(f.get("title")),subtitle:String(f.get("subtitle")),
      description:String(f.get("description")),starts_at:String(f.get("starts_at")),
      hero_image_url:String(f.get("hero_image_url"))||null,spotify_url:String(f.get("spotify_url"))||null,weather_latitude:Number(f.get("weather_latitude"))||48.6778281,weather_longitude:Number(f.get("weather_longitude"))||9.21833,updated_by:session!.user.id
    });
    if(error)setStatus(error.message); else {setStatus("Tourdaten gespeichert.");await load()}
  }
  async function sendPush(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);setStatus("");
    const json=await sendPushPayload(String(f.get("title")),String(f.get("body")));
    setStatus(json.error||`Push versendet (${json.sent}).`);
  }
  async function toggleAdmin(member:Profile){
    if(member.id===session?.user.id){setStatus("Deinen eigenen Adminstatus solltest du nicht entfernen.");return}
    const {error}=await supabase.from("profiles").update({is_admin:!member.is_admin}).eq("id",member.id);
    if(error)setStatus(error.message); else {setStatus(`${member.name}: Admin ${!member.is_admin?"aktiviert":"entfernt"}.`);await load()}
  }

  return <AuthGate admin><Shell><div className="page-heading"><span className="eyebrow">KOMMANDOZENTRALE</span><h1>Admin-Bereich</h1><p>Hier bestimmst du, was die Jungs sehen und wann ihre Handys klingeln.</p></div>
    {status&&<div className="status">{status}</div>}
    <div className="admin-grid">
      <form className="admin-card" onSubmit={addNews}><Newspaper/><h2>Neuigkeit posten</h2><input name="title" placeholder="Titel" required/><textarea name="body" placeholder="Nachricht" required/><label className="check-row"><input name="push" type="checkbox"/> Zusätzlich Push an alle senden</label><button className="primary-button">Veröffentlichen</button></form>
      <form className="admin-card" onSubmit={addPin}><MapPinned/><h2>Termin / Treffpunkt</h2><input name="title" placeholder="Titel" required/><textarea name="description" placeholder="Beschreibung"/><input name="starts_at" type="datetime-local"/><div className="two-cols"><input name="latitude" type="number" step="any" placeholder="Breitengrad" required/><input name="longitude" type="number" step="any" placeholder="Längengrad" required/></div><label className="check-row"><input name="push" type="checkbox"/> Push über den neuen Termin senden</label><button className="primary-button">Speichern</button></form>
      <form className="admin-card" onSubmit={sendPush}><BellRing/><h2>Freie Push-Nachricht</h2><input name="title" placeholder="Titel" required/><textarea name="body" placeholder="Push-Nachricht" required/><button className="primary-button">Push an alle senden</button></form>
      <form key={event?.updated_at || "new-event"} className="admin-card" onSubmit={saveEvent}><Settings2/><h2>Tourdaten</h2><input name="title" defaultValue={event?.title||"Bachelortour 2026"} placeholder="Tourname" required/><input name="subtitle" defaultValue={event?.subtitle||""} placeholder="Untertitel"/><textarea name="description" defaultValue={event?.description||""} placeholder="Beschreibung"/><input name="starts_at" type="datetime-local" defaultValue={event?.starts_at?.slice(0,16)||""} required/><input name="hero_image_url" defaultValue={event?.hero_image_url||""} placeholder="URL zum Titelbild"/><input name="spotify_url" defaultValue={event?.spotify_url||""} placeholder="Spotify-Playlist-Link"/><div className="two-cols"><input name="weather_latitude" type="number" step="any" defaultValue={event?.weather_latitude||48.6778281} placeholder="Wetter Breitengrad"/><input name="weather_longitude" type="number" step="any" defaultValue={event?.weather_longitude||9.21833} placeholder="Wetter Längengrad"/></div><button className="primary-button">Tourdaten speichern</button></form>
      <form className="admin-card" onSubmit={async(e)=>{e.preventDefault();const f=new FormData(e.currentTarget);const title=String(f.get("title"));const {error}=await supabase.from("program_items").insert({title,description:String(f.get("description")),address:String(f.get("address")),starts_at:String(f.get("starts_at")),latitude:Number(f.get("latitude"))||null,longitude:Number(f.get("longitude"))||null,created_by:session!.user.id});if(error)setStatus(error.message);else{if(f.get("push")==="on")await sendPushPayload(`Programm: ${title}`,String(f.get("description"))||"Neuer Programmpunkt");setStatus("Programmpunkt gespeichert.");e.currentTarget.reset()}}}><MapPinned/><h2>Programmpunkt anlegen</h2><input name="title" placeholder="Titel" required/><textarea name="description" placeholder="Beschreibung"/><input name="address" placeholder="Adresse"/><input name="starts_at" type="datetime-local" required/><div className="two-cols"><input name="latitude" type="number" step="any" placeholder="Breitengrad optional"/><input name="longitude" type="number" step="any" placeholder="Längengrad optional"/></div><label className="check-row"><input name="push" type="checkbox"/> Push senden</label><button className="primary-button">Programmpunkt speichern</button></form><section className="admin-card admin-members"><Users/><h2>Admins verwalten</h2>{members.map(m=><div className="admin-member-row" key={m.id}><div className="avatar">{m.avatar_url?<img src={m.avatar_url} alt=""/>:<span>{m.name[0]}</span>}</div><div><strong>{m.name}</strong><small>{m.is_admin?"Administrator":"Mitglied"}</small></div><button type="button" className={m.is_admin?"danger-button":"secondary-button"} onClick={()=>toggleAdmin(m)}><ShieldCheck size={17}/>{m.is_admin?"Admin entfernen":"Zum Admin machen"}</button></div>)}</section>
    </div>
  </Shell></AuthGate>;
}
