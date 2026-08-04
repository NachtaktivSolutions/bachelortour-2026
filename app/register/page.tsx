"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const sizes=["XS","S","M","L","XL","XXL","3XL","4XL"];

export default function RegisterPage(){
  const router=useRouter();const supabase=createClient();
  const [preview,setPreview]=useState("");const [error,setError]=useState("");const [info,setInfo]=useState("");const [busy,setBusy]=useState(false);const [size,setSize]=useState("");
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError("");setInfo("");const form=new FormData(e.currentTarget);
    const firstName=String(form.get("first_name")).trim(),lastName=String(form.get("last_name")).trim(),name=`${firstName} ${lastName}`.trim(),phone=String(form.get("phone")).trim(),email=String(form.get("email")).trim(),password=String(form.get("password"));
    const street=String(form.get("street")).trim(),postalCode=String(form.get("postal_code")).trim(),city=String(form.get("city")).trim();
    if(!size){setError("Bitte wähle deine Kleidergröße aus.");setBusy(false);return}
    if(password!==String(form.get("password2"))){setError("Die Passwörter stimmen nicht überein.");setBusy(false);return}
    const {data,error:authError}=await supabase.auth.signUp({email,password,options:{data:{first_name:firstName,last_name:lastName,name,phone}}});
    if(authError||!data.user){setError(authError?.message??"Registrierung fehlgeschlagen.");setBusy(false);return}
    if(data.session){
      await supabase.from("profiles").update({first_name:firstName,last_name:lastName,name,phone}).eq("id",data.user.id);
      const homeAddress=`${street}\n${postalCode} ${city}`;
      const {error:privateError}=await supabase.from("member_private_details").upsert({user_id:data.user.id,clothing_size:size,street,postal_code:postalCode,city,home_address:homeAddress,updated_at:new Date().toISOString()},{onConflict:"user_id"});
      if(privateError){setError(`Account wurde erstellt, aber die Zusatzdaten konnten nicht gespeichert werden: ${privateError.message}`);setBusy(false);return}
      const file=form.get("avatar");if(file instanceof File&&file.size>0){const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"-");const path=`${data.user.id}/${Date.now()}-${safe}`;const up=await supabase.storage.from("avatars").upload(path,file,{upsert:true});if(up.error){setError(up.error.message);setBusy(false);return}const avatarUrl=supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;await supabase.from("profiles").update({avatar_url:avatarUrl}).eq("id",data.user.id)}
      router.replace("/");router.refresh();return;
    }
    setInfo("Account erstellt. Bitte bestätige zunächst die E-Mail und melde dich danach an.");setBusy(false);
  }
  return <main className="auth-page"><section className="auth-card"><span className="eyebrow">FIRESTARTER 2026</span><h1>Account erstellen</h1><p>Dein Profil für die Tour.</p><form onSubmit={submit}>
    <label className="avatar-upload">{preview?<img src={preview} alt="Profilbild-Vorschau"/>:<span>Foto wählen</span>}<input name="avatar" type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)setPreview(URL.createObjectURL(f))}}/></label>
    <div className="two-cols"><input name="first_name" placeholder="Vorname" required/><input name="last_name" placeholder="Nachname" required/></div><input name="email" type="email" placeholder="E-Mail-Adresse" required/><input name="phone" type="tel" placeholder="Handynummer" required/>
    <div className="size-picker"><span>Kleidergröße</span><div>{sizes.map(s=><button type="button" key={s} className={size===s?"active":""} onClick={()=>setSize(s)}>{s}</button>)}</div></div>
    <input name="street" autoComplete="street-address" placeholder="Straße und Hausnummer" required/><div className="address-row"><input name="postal_code" inputMode="numeric" pattern="[0-9]{5}" placeholder="PLZ" required/><input name="city" placeholder="Ort" required/></div><small className="private-data-note">Diese Angaben können nur du selbst und die Admins sehen.</small>
    <input name="password" type="password" placeholder="Passwort" required minLength={6}/><input name="password2" type="password" placeholder="Passwort wiederholen" required minLength={6}/>{error&&<div className="error">{error}</div>}{info&&<div className="status">{info}</div>}<button className="primary-button" disabled={busy}>{busy?"Account wird erstellt …":"Registrieren"}</button>
  </form><Link href="/login">Bereits registriert? <strong>Anmelden</strong></Link></section></main>
}
