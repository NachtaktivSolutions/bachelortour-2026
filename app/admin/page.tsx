"use client";

import { FormEvent, useState } from "react";
import { Newspaper, MapPinned, BellRing, Settings2 } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/app-provider";

export default function AdminPage(){
  const {session}=useApp(); const supabase=createClient(); const [status,setStatus]=useState("");

  async function addNews(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); const f=new FormData(e.currentTarget); setStatus("");
    const {error}=await supabase.from("news").insert({title:String(f.get("title")),body:String(f.get("body")),author_id:session!.user.id});
    if(error)setStatus(error.message); else {setStatus("Neuigkeit gespeichert.");e.currentTarget.reset()}
  }
  async function addPin(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);setStatus("");
    const {error}=await supabase.from("map_pins").insert({
      title:String(f.get("title")),description:String(f.get("description")),
      latitude:Number(f.get("latitude")),longitude:Number(f.get("longitude")),
      starts_at:String(f.get("starts_at"))||null,created_by:session!.user.id
    });
    if(error)setStatus(error.message); else {setStatus("Termin gespeichert.");e.currentTarget.reset()}
  }
  async function sendPush(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);setStatus("");
    const token=session?.access_token;
    const res=await fetch("/api/push/send",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({title:String(f.get("title")),body:String(f.get("body")),url:"/"})});
    const json=await res.json();setStatus(res.ok?`Push versendet (${json.sent}).`:json.error||"Fehler");
  }
  async function enablePush(){
    if(!("serviceWorker"in navigator)||!("PushManager"in window)){setStatus("Push wird von diesem Browser nicht unterstützt.");return}
    const permission=await Notification.requestPermission();if(permission!=="granted"){setStatus("Push-Berechtigung wurde nicht erteilt.");return}
    const reg=await navigator.serviceWorker.ready;
    const key=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if(!key){setStatus("VAPID Public Key fehlt.");return}
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(key)});
    await supabase.from("push_subscriptions").upsert({user_id:session!.user.id,subscription:sub.toJSON()},{onConflict:"user_id"});
    setStatus("Push auf diesem Gerät aktiviert.");
  }
  return <AuthGate admin><Shell><div className="page-heading"><h1>Admin-Bereich</h1><p>Inhalte und Benachrichtigungen verwalten.</p></div>
    {status&&<div className="status">{status}</div>}
    <div className="admin-grid">
      <form className="admin-card" onSubmit={addNews}><Newspaper/><h2>Neuigkeit posten</h2><input name="title" placeholder="Titel" required/><textarea name="body" placeholder="Nachricht" required/><button className="primary-button">Veröffentlichen</button></form>
      <form className="admin-card" onSubmit={addPin}><MapPinned/><h2>Termin / Treffpunkt</h2><input name="title" placeholder="Titel" required/><textarea name="description" placeholder="Beschreibung"/><input name="starts_at" type="datetime-local"/><div className="two-cols"><input name="latitude" type="number" step="any" placeholder="Breitengrad" required/><input name="longitude" type="number" step="any" placeholder="Längengrad" required/></div><button className="primary-button">Speichern</button></form>
      <form className="admin-card" onSubmit={sendPush}><BellRing/><h2>Push an alle</h2><input name="title" placeholder="Titel" required/><textarea name="body" placeholder="Push-Nachricht" required/><button className="primary-button">Push senden</button><button type="button" className="secondary-button" onClick={enablePush}>Push auf diesem Gerät aktivieren</button></form>
      <div className="admin-card"><Settings2/><h2>Tourdaten</h2><p>Eventname und Startzeit werden über die Vercel-Umgebungsvariablen gepflegt.</p></div>
    </div>
  </Shell></AuthGate>;
}

function urlBase64ToUint8Array(base64String:string){
  const padding="=".repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(base64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
