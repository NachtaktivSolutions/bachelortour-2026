"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Newspaper, MapPinned, BellRing, Settings2, Users, Plus, X, Pencil, ImagePlus, KeyRound, Trash2, Clock3, Send, CalendarDays } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { ImageCropper } from "@/components/image-cropper";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/app-provider";
import type { Profile, EventSettings, NewsItem, ProgramItem, Photo } from "@/lib/types";

type ScheduledJob = { id:string; job_type:"news"|"program"|"push"; payload:Record<string,any>; scheduled_for:string; status:string; error:string|null };

type CropTarget = { file:File; kind:"hero"|"avatar" } | null;

export default function AdminPage(){
  const {session}=useApp();
  const supabase=createClient();
  const [status,setStatus]=useState("");
  const [members,setMembers]=useState<Profile[]>([]);
  const [news,setNews]=useState<NewsItem[]>([]);
  const [program,setProgram]=useState<ProgramItem[]>([]);
  const [photos,setPhotos]=useState<Photo[]>([]);
  const [jobs,setJobs]=useState<ScheduledJob[]>([]);
  const [event,setEvent]=useState<EventSettings|null>(null);
  const [showAdminPicker,setShowAdminPicker]=useState(false);
  const [editingMember,setEditingMember]=useState<Profile|null>(null);
  const [adminSearch,setAdminSearch]=useState("");
  const [heroPreview,setHeroPreview]=useState("");
  const [heroFile,setHeroFile]=useState<File|null>(null);
  const [avatarFile,setAvatarFile]=useState<File|null>(null);
  const [cropTarget,setCropTarget]=useState<CropTarget>(null);

  const load=useCallback(async()=>{
    const [m,e,n,p,ph,j]=await Promise.all([
      supabase.from("profiles").select("*").order("name"),
      supabase.from("event_settings").select("*").eq("id",1).maybeSingle(),
      supabase.from("news").select("*").order("created_at",{ascending:false}),
      supabase.from("program_items").select("*").order("starts_at"),
      supabase.from("photos").select("*").order("created_at",{ascending:false}).limit(30),
      supabase.from("scheduled_jobs").select("*").order("scheduled_for",{ascending:false})
    ]);
    setMembers(m.data??[]); setEvent(e.data); setHeroPreview(e.data?.hero_image_url||"");
    setNews((n.data as NewsItem[])??[]); setProgram((p.data as ProgramItem[])??[]); setPhotos((ph.data as Photo[])??[]); setJobs((j.data as ScheduledJob[])??[]);
  },[supabase]);
  useEffect(()=>{load()},[load]);

  const admins=members.filter(m=>m.is_admin);
  const nonAdmins=useMemo(()=>members.filter(m=>!m.is_admin&&m.name.toLowerCase().includes(adminSearch.toLowerCase())),[members,adminSearch]);

  async function sendPushPayload(title:string,body:string){
    const res=await fetch("/api/push/send",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token}`},body:JSON.stringify({title,body,url:"/"})});
    return res.json();
  }

  async function schedule(job_type:ScheduledJob["job_type"],payload:Record<string,any>,scheduled_for:string){
    const {error}=await supabase.from("scheduled_jobs").insert({job_type,payload,scheduled_for:new Date(scheduled_for).toISOString(),created_by:session!.user.id});
    if(error)throw error;
  }

  async function adminPatch(payload:Record<string,unknown>){
    const res=await fetch("/api/admin/users",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token}`},body:JSON.stringify(payload)});
    const json=await res.json(); if(!res.ok)throw new Error(json.error||"Änderung fehlgeschlagen."); await load();
  }

  async function addNews(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);setStatus("");
    const title=String(f.get("title")),body=String(f.get("body")),when=String(f.get("scheduled_for"));
    try{
      if(when){await schedule("news",{title,body,author_id:session!.user.id,send_push:f.get("push")==="on"},when);setStatus("Neuigkeit wurde vorbereitet.")}
      else{const {error}=await supabase.from("news").insert({title,body,author_id:session!.user.id});if(error)throw error;if(f.get("push")==="on"){const push=await sendPushPayload(title,body);if(push.error)throw new Error(push.error)}setStatus("Neuigkeit veröffentlicht.")}
      e.currentTarget.reset();await load();
    }catch(error){setStatus(error instanceof Error?error.message:"Fehler")}
  }

  async function addProgram(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);setStatus("");
    const payload={title:String(f.get("title")),description:String(f.get("description"))||null,address:String(f.get("address"))||null,starts_at:String(f.get("starts_at")),ends_at:String(f.get("ends_at"))||null,latitude:Number(f.get("latitude"))||null,longitude:Number(f.get("longitude"))||null,created_by:session!.user.id,send_push:f.get("push")==="on"};
    const when=String(f.get("publish_at"));
    try{
      if(when){await schedule("program",payload,when);setStatus("Programmpunkt wurde vorbereitet.")}
      else{const direct={...payload};delete (direct as any).send_push;const {error}=await supabase.from("program_items").insert(direct);if(error)throw error;if(payload.send_push){const push=await sendPushPayload(`Programm: ${payload.title}`,payload.description||"Neuer Programmpunkt");if(push.error)throw new Error(push.error)}setStatus("Programmpunkt gespeichert.")}
      e.currentTarget.reset();await load();
    }catch(error){setStatus(error instanceof Error?error.message:"Fehler")}
  }

  async function sendPush(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);setStatus("");const title=String(f.get("title")),body=String(f.get("body")),when=String(f.get("scheduled_for"));
    try{if(when){await schedule("push",{title,body,url:"/"},when);setStatus("Push wurde vorbereitet.")}else{const json=await sendPushPayload(title,body);if(json.error)throw new Error(json.error);setStatus(`Push versendet (${json.sent}).`)}e.currentTarget.reset();await load()}catch(error){setStatus(error instanceof Error?error.message:"Fehler")}
  }

  async function saveEvent(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);setStatus("");let hero_image_url=event?.hero_image_url||null;
    if(heroFile){const path=`event/${Date.now()}-${heroFile.name.replace(/[^a-zA-Z0-9._-]/g,"-")}`;const up=await supabase.storage.from("event-images").upload(path,heroFile,{upsert:true});if(up.error){setStatus(up.error.message);return}hero_image_url=supabase.storage.from("event-images").getPublicUrl(path).data.publicUrl}
    const {error}=await supabase.from("event_settings").upsert({id:1,title:String(f.get("title")),subtitle:String(f.get("subtitle")),description:String(f.get("description")),starts_at:String(f.get("starts_at")),hero_image_url,spotify_url:String(f.get("spotify_url"))||null,weather_latitude:Number(f.get("weather_latitude"))||48.6778281,weather_longitude:Number(f.get("weather_longitude"))||9.21833,updated_by:session!.user.id});
    if(error)setStatus(error.message);else{setStatus("Tourdaten gespeichert.");setHeroFile(null);await load()}
  }

  async function remove(table:string,id:string,label:string){
    if(!confirm(`${label} wirklich löschen?`))return;const {error}=await supabase.from(table).delete().eq("id",id);setStatus(error?error.message:`${label} gelöscht.`);await load();
  }

  async function removeUser(member:Profile){
    if(!confirm(`${member.name} samt Zugang und Daten wirklich löschen?`))return;
    const res=await fetch("/api/admin/users",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token}`},body:JSON.stringify({userId:member.id})});const json=await res.json();setStatus(res.ok?`${member.name} wurde gelöscht.`:json.error);await load();
  }

  async function addAdmin(member:Profile){try{await adminPatch({userId:member.id,isAdmin:true});setStatus(`${member.name} ist jetzt Admin.`);setShowAdminPicker(false)}catch(error){setStatus(error instanceof Error?error.message:"Fehler")}}
  async function removeAdmin(member:Profile){if(member.id===session?.user.id){setStatus("Du kannst deinen eigenen Adminstatus nicht entfernen.");return}try{await adminPatch({userId:member.id,isAdmin:false});setStatus(`${member.name} ist kein Admin mehr.`)}catch(error){setStatus(error instanceof Error?error.message:"Fehler")}}

  async function saveMember(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!editingMember)return;const f=new FormData(e.currentTarget);setStatus("");let avatarUrl=editingMember.avatar_url;
    if(avatarFile){const path=`${editingMember.id}/admin-${Date.now()}-${avatarFile.name.replace(/[^a-zA-Z0-9._-]/g,"-")}`;const up=await supabase.storage.from("avatars").upload(path,avatarFile,{upsert:true});if(up.error){setStatus(up.error.message);return}avatarUrl=supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}
    try{await adminPatch({userId:editingMember.id,name:String(f.get("name")),phone:String(f.get("phone")),avatarUrl,temporaryPassword:String(f.get("temporaryPassword"))||undefined});setStatus(`${editingMember.name} wurde aktualisiert.`);setEditingMember(null);setAvatarFile(null)}catch(error){setStatus(error instanceof Error?error.message:"Fehler")}
  }

  return <AuthGate admin><Shell>
    <div className="page-heading"><span className="eyebrow">KOMMANDOZENTRALE</span><h1>Admin-Bereich</h1><p>Direkt veröffentlichen, zeitlich planen, bearbeiten und löschen.</p></div>
    {status&&<div className="status">{status}</div>}
    <div className="admin-grid">
      <form className="admin-card" onSubmit={addNews}><Newspaper/><h2>Neuigkeit</h2><input name="title" placeholder="Titel" required/><textarea name="body" placeholder="Nachricht" required/><label className="check-row"><input name="push" type="checkbox"/> Push mitsenden</label><label><Clock3/> Optional vorbereiten für<input name="scheduled_for" type="datetime-local"/></label><button className="primary-button"><Send/>Direkt posten oder planen</button></form>
      <form className="admin-card" onSubmit={addProgram}><MapPinned/><h2>Programmpunkt / Event</h2><input name="title" placeholder="Titel" required/><textarea name="description" placeholder="Beschreibung"/><input name="address" placeholder="Adresse"/><label>Beginn<input name="starts_at" type="datetime-local" required/></label><label>Ende<input name="ends_at" type="datetime-local" required/></label><div className="two-cols"><input name="latitude" type="number" step="any" placeholder="Breitengrad"/><input name="longitude" type="number" step="any" placeholder="Längengrad"/></div><label className="check-row"><input name="push" type="checkbox"/> Push mitsenden</label><label><Clock3/> Optional erst veröffentlichen am<input name="publish_at" type="datetime-local"/></label><button className="primary-button"><CalendarDays/>Direkt speichern oder planen</button></form>
      <form className="admin-card" onSubmit={sendPush}><BellRing/><h2>Push-Nachricht</h2><input name="title" placeholder="Titel" required/><textarea name="body" placeholder="Push-Nachricht" required/><label><Clock3/> Optional senden am<input name="scheduled_for" type="datetime-local"/></label><button className="primary-button"><Send/>Direkt senden oder planen</button></form>
      <form className="admin-card" onSubmit={saveEvent}><Settings2/><h2>Tourdaten</h2>{heroPreview&&<img className="admin-hero-preview" src={heroPreview} alt="Titelbild"/>}<label className="admin-image-upload"><ImagePlus/>Titelbild auswählen und zuschneiden<input type="file" accept="image/*" onChange={(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(file)setCropTarget({file,kind:"hero"});e.target.value=""}}/></label><input name="title" defaultValue={event?.title||"Bachelortour 2026"} required/><input name="subtitle" defaultValue={event?.subtitle||""} placeholder="Untertitel"/><textarea name="description" defaultValue={event?.description||""}/><input name="starts_at" type="datetime-local" defaultValue={event?.starts_at?.slice(0,16)||""} required/><input name="spotify_url" defaultValue={event?.spotify_url||""} placeholder="Spotify-Link"/><div className="two-cols"><input name="weather_latitude" type="number" step="any" defaultValue={event?.weather_latitude||48.6778281}/><input name="weather_longitude" type="number" step="any" defaultValue={event?.weather_longitude||9.21833}/></div><button className="primary-button">Tourdaten speichern</button></form>

      <section className="admin-card admin-wide"><div className="admin-card-heading"><div><Clock3/><h2>Vorbereitete Inhalte</h2></div></div>{jobs.filter(j=>j.status==="pending").map(j=><div className="admin-content-row" key={j.id}><div><strong>{j.payload.title||j.job_type}</strong><small>{j.job_type} · {new Date(j.scheduled_for).toLocaleString("de-DE")}</small></div><button className="danger-button" onClick={()=>remove("scheduled_jobs",j.id,"Planung")}><Trash2/>Löschen</button></div>)}{!jobs.some(j=>j.status==="pending")&&<p>Keine vorbereiteten Inhalte.</p>}</section>
      <section className="admin-card admin-wide"><h2>Neuigkeiten verwalten</h2>{news.map(item=><div className="admin-content-row" key={item.id}><div><strong>{item.title}</strong><small>{new Date(item.created_at).toLocaleString("de-DE")}</small></div><button className="danger-button" onClick={()=>remove("news",item.id,"Neuigkeit")}><Trash2/>Löschen</button></div>)}</section>
      <section className="admin-card admin-wide"><h2>Programmpunkte verwalten</h2>{program.map(item=><div className="admin-content-row" key={item.id}><div><strong>{item.title}</strong><small>{new Date(item.starts_at).toLocaleString("de-DE")}</small></div><button className="danger-button" onClick={()=>remove("program_items",item.id,"Programmpunkt")}><Trash2/>Löschen</button></div>)}</section>
      <section className="admin-card admin-wide"><h2>Fotos verwalten</h2><div className="admin-photo-grid">{photos.map(photo=><div key={photo.id}><img src={photo.image_url} alt=""/><button className="danger-icon" onClick={()=>remove("photos",photo.id,"Foto")}><Trash2/></button></div>)}</div></section>

      <section className="admin-card admin-members admin-wide"><div className="admin-card-heading"><div><Users/><h2>Admins verwalten</h2></div><button className="add-admin-button" onClick={()=>setShowAdminPicker(true)}><Plus/>Admin hinzufügen</button></div>{admins.map(member=><div className="admin-member-row" key={member.id}><div className="avatar">{member.avatar_url?<img src={member.avatar_url} alt=""/>:<span>{member.name[0]}</span>}</div><div><strong>{member.name}</strong><small>Administrator</small></div><div className="admin-row-actions"><button className="secondary-button" onClick={()=>setEditingMember(member)}><Pencil/>Bearbeiten</button><button className="danger-button" onClick={()=>removeAdmin(member)}>Admin entfernen</button>{member.id!==session?.user.id&&<button className="danger-button" onClick={()=>removeUser(member)}><Trash2/>Benutzer löschen</button>}</div></div>)}</section>
      <section className="admin-card admin-members admin-wide"><h2>Alle Mitglieder</h2>{members.map(member=><div className="admin-member-row" key={member.id}><div className="avatar">{member.avatar_url?<img src={member.avatar_url} alt=""/>:<span>{member.name[0]}</span>}</div><div><strong>{member.name}</strong><small>{member.phone||"Keine Telefonnummer"}</small></div><div className="admin-row-actions"><button className="secondary-button" onClick={()=>setEditingMember(member)}><Pencil/>Profil bearbeiten</button>{member.id!==session?.user.id&&<button className="danger-button" onClick={()=>removeUser(member)}><Trash2/>Löschen</button>}</div></div>)}</section>
    </div>

    {showAdminPicker&&<div className="admin-modal" onClick={()=>setShowAdminPicker(false)}><div className="admin-modal-card" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setShowAdminPicker(false)}><X/></button><h2>Admin hinzufügen</h2><input placeholder="Mitglied suchen …" value={adminSearch} onChange={e=>setAdminSearch(e.target.value)}/><div className="admin-picker-list">{nonAdmins.map(member=><button key={member.id} onClick={()=>addAdmin(member)}><div className="avatar">{member.avatar_url?<img src={member.avatar_url} alt=""/>:<span>{member.name[0]}</span>}</div><span>{member.name}</span><Plus/></button>)}</div></div></div>}
    {editingMember&&<div className="admin-modal" onClick={()=>setEditingMember(null)}><form className="admin-modal-card" onClick={e=>e.stopPropagation()} onSubmit={saveMember}><button type="button" className="modal-close" onClick={()=>setEditingMember(null)}><X/></button><h2>Profil bearbeiten</h2>{avatarFile&&<img className="profile-crop-preview" src={URL.createObjectURL(avatarFile)} alt=""/>}<label className="admin-image-upload"><ImagePlus/>Profilbild auswählen und zuschneiden<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)setCropTarget({file,kind:"avatar"});e.target.value=""}}/></label><input name="name" defaultValue={editingMember.name} required/><input name="phone" defaultValue={editingMember.phone||""}/><label className="password-label"><KeyRound/>Temporäres Passwort</label><input name="temporaryPassword" type="password" minLength={6}/><button className="primary-button">Änderungen speichern</button></form></div>}
    {cropTarget&&<ImageCropper file={cropTarget.file} aspect={cropTarget.kind==="hero"?1.6:1} round={cropTarget.kind==="avatar"} title={cropTarget.kind==="hero"?"Tourfoto positionieren":"Profilfoto positionieren"} onCancel={()=>setCropTarget(null)} onComplete={(file,preview)=>{if(cropTarget.kind==="hero"){setHeroFile(file);setHeroPreview(preview)}else setAvatarFile(file);setCropTarget(null)}}/>}
  </Shell></AuthGate>;
}
