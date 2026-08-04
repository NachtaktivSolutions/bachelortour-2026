"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { PushProfileSetting } from "@/components/push-settings";
import { ImageCropper } from "@/components/image-cropper";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const { profile, refreshProfile } = useApp();
  const [preview,setPreview]=useState(profile?.avatar_url||"");
  const [avatarFile,setAvatarFile]=useState<File|null>(null);
  const [cropFile,setCropFile]=useState<File|null>(null);
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const supabase=createClient();

  async function save(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(!profile)return; setBusy(true); setStatus("");
    const f=new FormData(e.currentTarget);
    let avatar_url=profile.avatar_url;
    if(avatarFile){
      const safe=avatarFile.name.replace(/[^a-zA-Z0-9._-]/g,"-");
      const path=`${profile.id}/${Date.now()}-${safe}`;
      const up=await supabase.storage.from("avatars").upload(path,avatarFile,{upsert:true});
      if(up.error){setStatus(up.error.message);setBusy(false);return}
      avatar_url=supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }
    const {error}=await supabase.from("profiles").update({name:String(f.get("name")).trim(),phone:String(f.get("phone")).trim(),avatar_url}).eq("id",profile.id);
    if(error)setStatus(error.message);else{setStatus("Profil gespeichert.");setAvatarFile(null);await refreshProfile()}
    setBusy(false);
  }

  return <AuthGate><Shell>
    <div className="page-heading"><span className="eyebrow">DEIN PROFIL</span><h1>Meine Daten</h1><p>Profilfoto auswählen, zuschneiden und genau positionieren.</p></div>
    <form className="profile-card" onSubmit={save}>
      <label className="profile-avatar-upload">{preview?<img src={preview} alt=""/>:<span>Foto</span>}<input type="file" accept="image/*" onChange={(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(file)setCropFile(file);e.target.value=""}}/></label>
      <small>Tippe auf das Foto, um ein neues Bild auszuwählen und zuzuschneiden.</small>
      <input name="name" defaultValue={profile?.name||""} placeholder="Name" required/>
      <input name="phone" defaultValue={profile?.phone||""} placeholder="Handynummer" required/>
      {status&&<div className="status">{status}</div>}
      <button className="primary-button" disabled={busy}>{busy?"Speichert …":"Profil speichern"}</button>
    </form>
    <PushProfileSetting />
    {cropFile&&<ImageCropper file={cropFile} aspect={1} round title="Profilfoto zuschneiden" onCancel={()=>setCropFile(null)} onComplete={(file,url)=>{setAvatarFile(file);setPreview(url);setCropFile(null)}}/>}
  </Shell></AuthGate>;
}
