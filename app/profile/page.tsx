"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Hotel, MapPin, PauseCircle, Route, Shirt, Siren } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { PushProfileSetting } from "@/components/push-settings";
import { ImageCropper } from "@/components/image-cropper";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";

const statusOptions=[
  {value:"bereit",label:"Bereit",icon:CheckCircle2},
  {value:"unterwegs",label:"Unterwegs",icon:Route},
  {value:"im Hotel",label:"Im Hotel",icon:Hotel},
  {value:"komme später",label:"Komme später",icon:Clock3},
  {value:"brauche Pause",label:"Brauche Pause",icon:PauseCircle},
  {value:"brauche Hilfe",label:"Brauche Hilfe",icon:Siren}
];

export default function ProfilePage() {
  const { profile, session, refreshProfile } = useApp();
  const fallbackNames=useMemo(()=>splitName(profile?.name||""),[profile?.name]);
  const [preview,setPreview]=useState(profile?.avatar_url||"");
  const [avatarFile,setAvatarFile]=useState<File|null>(null);
  const [cropFile,setCropFile]=useState<File|null>(null);
  const [clothingSize,setClothingSize]=useState("");
  const [homeAddress,setHomeAddress]=useState("");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const [helpBusy,setHelpBusy]=useState(false);
  const supabase=createClient();

  useEffect(()=>{
    if(!profile)return;
    supabase.from("member_private_details").select("clothing_size,home_address").eq("user_id",profile.id).maybeSingle().then(({data})=>{
      setClothingSize(data?.clothing_size||"");
      setHomeAddress(data?.home_address||"");
    });
  },[profile,supabase]);

  async function save(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(!profile)return; setBusy(true); setStatus("");
    const f=new FormData(e.currentTarget);const first_name=String(f.get("first_name")).trim();const last_name=String(f.get("last_name")).trim();const name=`${first_name} ${last_name}`.trim();let avatar_url=profile.avatar_url;
    if(avatarFile){const safe=avatarFile.name.replace(/[^a-zA-Z0-9._-]/g,"-");const path=`${profile.id}/${Date.now()}-${safe}`;const up=await supabase.storage.from("avatars").upload(path,avatarFile,{upsert:true});if(up.error){setStatus(up.error.message);setBusy(false);return}avatar_url=supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}
    const [{error},{error:privateError}]=await Promise.all([
      supabase.from("profiles").update({first_name,last_name,name,phone:String(f.get("phone")).trim(),avatar_url}).eq("id",profile.id),
      supabase.from("member_private_details").upsert({user_id:profile.id,clothing_size:String(f.get("clothing_size")).trim()||null,home_address:String(f.get("home_address")).trim()||null,updated_at:new Date().toISOString()},{onConflict:"user_id"})
    ]);
    const saveError=error||privateError;
    if(saveError)setStatus(saveError.message);else{setStatus("Profil gespeichert.");setAvatarFile(null);await refreshProfile()}setBusy(false);
  }

  async function setParticipantStatus(next:string){if(!profile)return;const {error}=await supabase.from("profiles").update({participant_status:next,status_updated_at:new Date().toISOString()}).eq("id",profile.id);setStatus(error?error.message:`Status auf „${next}“ gesetzt.`);if(!error)await refreshProfile()}

  async function sendHelp(){
    if(!session||helpBusy)return;
    if(!confirm("Wirklich einen Hilferuf an alle Teilnehmer senden? Dein aktueller Standort wird geteilt."))return;
    setHelpBusy(true);setStatus("Standort wird ermittelt …");
    navigator.geolocation.getCurrentPosition(async position=>{
      const res=await fetch("/api/help-alert",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy})});
      const json=await res.json();setStatus(res.ok?`Hilferuf gesendet. ${json.sent??0} Geräte wurden benachrichtigt.`:json.error||"Hilferuf fehlgeschlagen.");setHelpBusy(false);if(res.ok)await refreshProfile();
    },async()=>{
      const res=await fetch("/api/help-alert",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({})});
      const json=await res.json();setStatus(res.ok?"Hilferuf gesendet. Standort konnte nicht ermittelt werden.":json.error||"Hilferuf fehlgeschlagen.");setHelpBusy(false);if(res.ok)await refreshProfile();
    },{enableHighAccuracy:true,timeout:12000,maximumAge:0});
  }

  const first=(profile as any)?.first_name||fallbackNames.first;const last=(profile as any)?.last_name||fallbackNames.last;
  return <AuthGate><Shell>
    <div className="page-heading"><span className="eyebrow">DEIN PROFIL</span><h1>Meine Daten & Status</h1><p>Profil, Tourstatus, Push-Einstellungen und Hilfe an einem Ort.</p></div>
    <form className="profile-card" onSubmit={save}>
      <label className="profile-avatar-upload">{preview?<img src={preview} alt=""/>:<span>Foto</span>}<input type="file" accept="image/*" onChange={(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(file)setCropFile(file);e.target.value=""}}/></label>
      <small>Tippe auf das Foto, um ein neues Bild auszuwählen und zuzuschneiden.</small>
      <div className="two-cols"><input name="first_name" defaultValue={first} placeholder="Vorname" required/><input name="last_name" defaultValue={last} placeholder="Nachname" required/></div>
      <input name="phone" defaultValue={profile?.phone||""} placeholder="Handynummer" required/>
      <div className="private-profile-section"><div className="private-profile-heading"><Shirt/><div><span className="eyebrow">PRIVATE ZUSATZDATEN</span><h3>Kleidung & Anschrift</h3></div></div><p>Diese Angaben können ausschließlich du selbst und die Admins sehen.</p><select name="clothing_size" value={clothingSize} onChange={e=>setClothingSize(e.target.value)}><option value="">Kleidergröße auswählen</option><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option><option>3XL</option><option>4XL</option><option value="Sonstige">Sonstige</option></select><textarea name="home_address" value={homeAddress} onChange={e=>setHomeAddress(e.target.value)} placeholder="Wohnanschrift: Straße, Hausnummer, PLZ und Ort"/></div>
      <button className="primary-button" disabled={busy}>{busy?"Speichert …":"Profil speichern"}</button>
    </form>

    <section className="profile-status-card"><div className="profile-section-head"><MapPin/><div><span className="eyebrow">MEIN TOURSTATUS</span><h2>Wie ist dein Stand?</h2></div></div><div className="profile-status-grid">{statusOptions.map(({value,label,icon:Icon})=><button type="button" key={value} className={`profile-status-option status-${slug(value)} ${profile?.participant_status===value?"active":""}`} onClick={()=>setParticipantStatus(value)}><Icon/><span>{label}</span></button>)}</div></section>

    <section className="profile-help-card"><div><span className="eyebrow">NUR IM NOTFALL</span><h2>Hilfe benötigt?</h2><p>Alle Teilnehmer erhalten sofort eine Push-Nachricht. Dein aktueller Standort wird neu abgerufen und auf der Karte geteilt.</p></div><button type="button" className="help-alert-button" disabled={helpBusy} onClick={sendHelp}><AlertTriangle/>{helpBusy?"Hilferuf wird gesendet …":"Hilfe an alle senden"}</button></section>

    {status&&<div className="status">{status}</div>}
    <PushProfileSetting />
    {cropFile&&<ImageCropper file={cropFile} aspect={1} round title="Profilfoto zuschneiden" onCancel={()=>setCropFile(null)} onComplete={(file,url)=>{setAvatarFile(file);setPreview(url);setCropFile(null)}}/>}
  </Shell></AuthGate>;
}
function splitName(name:string){const parts=name.trim().split(/\s+/).filter(Boolean);return{first:parts.shift()||"",last:parts.join(" ")}}
function slug(value:string){return value.toLowerCase().replace(/\s+/g,"-").replace(/ä/g,"ae")}
