"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { PushProfileSetting } from "@/components/push-settings";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  const { profile, refreshProfile } = useApp();
  const [preview,setPreview]=useState(profile?.avatar_url||"");
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const supabase=createClient();

  async function save(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(!profile)return; setBusy(true); setStatus("");
    const f=new FormData(e.currentTarget);
    let avatar_url=profile.avatar_url;
    const file=f.get("avatar");
    if(file instanceof File && file.size){
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"-");
      const path=`${profile.id}/${Date.now()}-${safe}`;
      const up=await supabase.storage.from("avatars").upload(path,file,{upsert:true});
      if(up.error){setStatus(up.error.message);setBusy(false);return}
      avatar_url=supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    }
    const {error}=await supabase.from("profiles").update({
      name:String(f.get("name")).trim(),
      phone:String(f.get("phone")).trim(),
      avatar_url
    }).eq("id",profile.id);
    if(error)setStatus(error.message);else{setStatus("Profil gespeichert.");await refreshProfile()}
    setBusy(false);
  }

  return <AuthGate><Shell>
    <div className="page-heading"><span className="eyebrow">DEIN PROFIL</span><h1>Meine Daten</h1><p>Damit dich die Bachelor im Notfall finden und anrufen können.</p></div>
    <form className="profile-card" onSubmit={save}>
      <label className="profile-avatar-upload">{preview?<img src={preview} alt=""/>:<span>Foto</span>}<input name="avatar" type="file" accept="image/*" onChange={(e:ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];if(f)setPreview(URL.createObjectURL(f))}}/></label>
      <input name="name" defaultValue={profile?.name||""} placeholder="Name" required/>
      <input name="phone" defaultValue={profile?.phone||""} placeholder="Handynummer" required/>
      {status&&<div className="status">{status}</div>}
      <button className="primary-button" disabled={busy}>{busy?"Speichert …":"Profil speichern"}</button>
    </form>
    <PushProfileSetting />
  </Shell></AuthGate>;
}
