"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Newspaper, MapPinned, BellRing, Settings2, Users, ShieldCheck, Plus, X, Pencil, ImagePlus, KeyRound } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/app-provider";
import type { Profile, EventSettings } from "@/lib/types";

export default function AdminPage(){
  const {session}=useApp();
  const supabase=createClient();
  const [status,setStatus]=useState("");
  const [members,setMembers]=useState<Profile[]>([]);
  const [event,setEvent]=useState<EventSettings|null>(null);
  const [showAdminPicker,setShowAdminPicker]=useState(false);
  const [editingMember,setEditingMember]=useState<Profile|null>(null);
  const [adminSearch,setAdminSearch]=useState("");
  const [heroPreview,setHeroPreview]=useState("");

  const load=async()=>{
    const [m,e]=await Promise.all([
      supabase.from("profiles").select("*").order("name"),
      supabase.from("event_settings").select("*").eq("id",1).maybeSingle()
    ]);
    setMembers(m.data??[]);
    setEvent(e.data);
    setHeroPreview(e.data?.hero_image_url||"");
  };
  useEffect(()=>{load()},[]);

  const admins=members.filter(m=>m.is_admin);
  const nonAdmins=useMemo(
    ()=>members.filter(m=>!m.is_admin&&m.name.toLowerCase().includes(adminSearch.toLowerCase())),
    [members,adminSearch]
  );

  async function sendPushPayload(title:string,body:string){
    const token=session?.access_token;
    const res=await fetch("/api/push/send",{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
      body:JSON.stringify({title,body,url:"/"})
    });
    return res.json();
  }

  async function adminPatch(payload:Record<string,unknown>){
    const res=await fetch("/api/admin/users",{
      method:"PATCH",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token}`},
      body:JSON.stringify(payload)
    });
    const json=await res.json();
    if(!res.ok) throw new Error(json.error||"Änderung fehlgeschlagen.");
    await load();
  }

  async function addNews(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); const f=new FormData(e.currentTarget); setStatus("");
    const title=String(f.get("title")), body=String(f.get("body"));
    const {error}=await supabase.from("news").insert({title,body,author_id:session!.user.id});
    if(error)setStatus(error.message); else {
      if(f.get("push")==="on") {
        const push=await sendPushPayload(title,body);
        if(push.error){setStatus(`Neuigkeit gespeichert, Push-Fehler: ${push.error}`);return}
      }
      setStatus("Neuigkeit veröffentlicht.");e.currentTarget.reset()
    }
  }

  async function addProgram(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); const f=new FormData(e.currentTarget); setStatus("");
    const title=String(f.get("title"));
    const {error}=await supabase.from("program_items").insert({
      title,
      description:String(f.get("description")),
      address:String(f.get("address")),
      starts_at:String(f.get("starts_at")),
      ends_at:String(f.get("ends_at"))||null,
      latitude:Number(f.get("latitude"))||null,
      longitude:Number(f.get("longitude"))||null,
      created_by:session!.user.id
    });
    if(error)setStatus(error.message); else {
      if(f.get("push")==="on"){
        const push=await sendPushPayload(`Programm: ${title}`,String(f.get("description"))||"Neuer Programmpunkt");
        if(push.error){setStatus(`Programmpunkt gespeichert, Push-Fehler: ${push.error}`);return}
      }
      setStatus("Programmpunkt gespeichert.");e.currentTarget.reset()
    }
  }

  async function saveEvent(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); const f=new FormData(e.currentTarget); setStatus("");
    let hero_image_url=event?.hero_image_url||null;
    const heroFile=f.get("hero_image");

    if(heroFile instanceof File && heroFile.size){
      const safe=heroFile.name.replace(/[^a-zA-Z0-9._-]/g,"-");
      const path=`event/${Date.now()}-${safe}`;
      const up=await supabase.storage.from("event-images").upload(path,heroFile,{upsert:true});
      if(up.error){setStatus(up.error.message);return}
      hero_image_url=supabase.storage.from("event-images").getPublicUrl(path).data.publicUrl;
    }

    const {error}=await supabase.from("event_settings").upsert({
      id:1,
      title:String(f.get("title")),
      subtitle:String(f.get("subtitle")),
      description:String(f.get("description")),
      starts_at:String(f.get("starts_at")),
      hero_image_url,
      spotify_url:String(f.get("spotify_url"))||null,
      weather_latitude:Number(f.get("weather_latitude"))||48.6778281,
      weather_longitude:Number(f.get("weather_longitude"))||9.21833,
      updated_by:session!.user.id
    });

    if(error)setStatus(error.message); else {setStatus("Tourdaten gespeichert.");await load()}
  }

  async function sendPush(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);setStatus("");
    const json=await sendPushPayload(String(f.get("title")),String(f.get("body")));
    setStatus(json.error||`Push versendet (${json.sent}).`);
  }

  async function addAdmin(member:Profile){
    try{await adminPatch({userId:member.id,isAdmin:true});setStatus(`${member.name} ist jetzt Admin.`);setShowAdminPicker(false)}
    catch(error){setStatus(error instanceof Error?error.message:"Fehler")}
  }

  async function removeAdmin(member:Profile){
    if(member.id===session?.user.id){setStatus("Du kannst deinen eigenen Adminstatus hier nicht entfernen.");return}
    try{await adminPatch({userId:member.id,isAdmin:false});setStatus(`${member.name} ist kein Admin mehr.`)}
    catch(error){setStatus(error instanceof Error?error.message:"Fehler")}
  }

  async function saveMember(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); if(!editingMember)return;
    const f=new FormData(e.currentTarget); setStatus("");
    let avatarUrl=editingMember.avatar_url;
    const avatar=f.get("avatar");
    if(avatar instanceof File&&avatar.size){
      const safe=avatar.name.replace(/[^a-zA-Z0-9._-]/g,"-");
      const path=`${editingMember.id}/admin-${Date.now()}-${safe}`;
      const up=await supabase.storage.from("avatars").upload(path,avatar,{upsert:true});
      if(up.error){setStatus(up.error.message);return}
      avatarUrl=supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }

    try{
      await adminPatch({
        userId:editingMember.id,
        name:String(f.get("name")),
        phone:String(f.get("phone")),
        avatarUrl,
        temporaryPassword:String(f.get("temporaryPassword"))||undefined
      });
      setStatus(`${editingMember.name} wurde aktualisiert.`);
      setEditingMember(null);
    }catch(error){setStatus(error instanceof Error?error.message:"Fehler")}
  }

  return <AuthGate admin><Shell>
    <div className="page-heading"><span className="eyebrow">KOMMANDOZENTRALE</span><h1>Admin-Bereich</h1><p>Inhalte, Teilnehmer und Benachrichtigungen verwalten.</p></div>
    {status&&<div className="status">{status}</div>}

    <div className="admin-grid">
      <form className="admin-card" onSubmit={addNews}>
        <Newspaper/><h2>Neuigkeit posten</h2>
        <input name="title" placeholder="Titel" required/>
        <textarea name="body" placeholder="Nachricht" required/>
        <label className="check-row"><input name="push" type="checkbox"/> Zusätzlich Push an alle senden</label>
        <button className="primary-button">Veröffentlichen</button>
      </form>

      <form className="admin-card" onSubmit={addProgram}>
        <MapPinned/><h2>Programmpunkt / Event</h2>
        <input name="title" placeholder="Titel" required/>
        <textarea name="description" placeholder="Beschreibung"/>
        <input name="address" placeholder="Adresse"/>
        <label>Beginn<input name="starts_at" type="datetime-local" required/></label>
        <label>Ende<input name="ends_at" type="datetime-local"/></label>
        <div className="two-cols">
          <input name="latitude" type="number" step="any" placeholder="Breitengrad optional"/>
          <input name="longitude" type="number" step="any" placeholder="Längengrad optional"/>
        </div>
        <label className="check-row"><input name="push" type="checkbox"/> Push senden</label>
        <button className="primary-button">Event speichern</button>
      </form>

      <form className="admin-card" onSubmit={sendPush}>
        <BellRing/><h2>Freie Push-Nachricht</h2>
        <input name="title" placeholder="Titel" required/>
        <textarea name="body" placeholder="Push-Nachricht" required/>
        <button className="primary-button">Push an alle senden</button>
      </form>

      <form className="admin-card" onSubmit={saveEvent}>
        <Settings2/><h2>Tourdaten</h2>
        {heroPreview&&<img className="admin-hero-preview" src={heroPreview} alt="Titelbild"/>}
        <label className="admin-image-upload"><ImagePlus/>Titelbild hochladen<input name="hero_image" type="file" accept="image/*" onChange={(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(file)setHeroPreview(URL.createObjectURL(file))}}/></label>
        <input name="title" defaultValue={event?.title||"Bachelortour 2026"} placeholder="Tourname" required/>
        <input name="subtitle" defaultValue={event?.subtitle||""} placeholder="Untertitel"/>
        <textarea name="description" defaultValue={event?.description||""} placeholder="Beschreibung"/>
        <input name="starts_at" type="datetime-local" defaultValue={event?.starts_at?.slice(0,16)||""} required/>
        <input name="spotify_url" defaultValue={event?.spotify_url||""} placeholder="Spotify-Playlist-Link"/>
        <div className="two-cols">
          <input name="weather_latitude" type="number" step="any" defaultValue={event?.weather_latitude||48.6778281}/>
          <input name="weather_longitude" type="number" step="any" defaultValue={event?.weather_longitude||9.21833}/>
        </div>
        <button className="primary-button">Tourdaten speichern</button>
      </form>

      <section className="admin-card admin-members">
        <div className="admin-card-heading"><div><Users/><h2>Admins verwalten</h2></div><button className="add-admin-button" onClick={()=>setShowAdminPicker(true)}><Plus/>Admin hinzufügen</button></div>
        {admins.map(member=><div className="admin-member-row" key={member.id}>
          <div className="avatar">{member.avatar_url?<img src={member.avatar_url} alt=""/>:<span>{member.name[0]}</span>}</div>
          <div><strong>{member.name}</strong><small>Administrator</small></div>
          <div className="admin-row-actions">
            <button className="secondary-button" onClick={()=>setEditingMember(member)}><Pencil/>Bearbeiten</button>
            <button className="danger-button" onClick={()=>removeAdmin(member)}>Admin entfernen</button>
          </div>
        </div>)}
      </section>

      <section className="admin-card admin-members">
        <div className="admin-card-heading"><div><Users/><h2>Alle Mitglieder</h2></div></div>
        {members.map(member=><div className="admin-member-row" key={member.id}>
          <div className="avatar">{member.avatar_url?<img src={member.avatar_url} alt=""/>:<span>{member.name[0]}</span>}</div>
          <div><strong>{member.name}</strong><small>{member.phone||"Keine Telefonnummer"}</small></div>
          <button className="secondary-button" onClick={()=>setEditingMember(member)}><Pencil/>Profil bearbeiten</button>
        </div>)}
      </section>
    </div>

    {showAdminPicker&&<div className="admin-modal" onClick={()=>setShowAdminPicker(false)}>
      <div className="admin-modal-card" onClick={e=>e.stopPropagation()}>
        <button className="modal-close" onClick={()=>setShowAdminPicker(false)}><X/></button>
        <h2>Admin hinzufügen</h2>
        <input placeholder="Mitglied suchen …" value={adminSearch} onChange={e=>setAdminSearch(e.target.value)}/>
        <div className="admin-picker-list">{nonAdmins.map(member=><button key={member.id} onClick={()=>addAdmin(member)}>
          <div className="avatar">{member.avatar_url?<img src={member.avatar_url} alt=""/>:<span>{member.name[0]}</span>}</div>
          <span>{member.name}</span><Plus/>
        </button>)}</div>
      </div>
    </div>}

    {editingMember&&<div className="admin-modal" onClick={()=>setEditingMember(null)}>
      <form className="admin-modal-card" onClick={e=>e.stopPropagation()} onSubmit={saveMember}>
        <button type="button" className="modal-close" onClick={()=>setEditingMember(null)}><X/></button>
        <h2>Profil bearbeiten</h2>
        <label className="admin-image-upload"><ImagePlus/>Neues Profilbild<input name="avatar" type="file" accept="image/*"/></label>
        <input name="name" defaultValue={editingMember.name} placeholder="Name" required/>
        <input name="phone" defaultValue={editingMember.phone||""} placeholder="Telefonnummer"/>
        <label className="password-label"><KeyRound/>Temporäres neues Passwort</label>
        <input name="temporaryPassword" type="password" minLength={6} placeholder="Leer lassen, wenn unverändert"/>
        <small>Das Passwort wird sofort geändert. Teile es dem Mitglied anschließend sicher mit.</small>
        <button className="primary-button">Änderungen speichern</button>
      </form>
    </div>}
  </Shell></AuthGate>;
}
