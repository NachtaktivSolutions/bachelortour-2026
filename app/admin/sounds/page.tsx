"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, Headphones, Save, Trash2, Upload } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";

type TourSound={id:string;title:string;category:string;description:string|null;storage_path:string;duration_seconds:number|null;is_visible:boolean;sort_order:number};

export default function AdminSoundsPage(){
  const {profile}=useApp();
  const [sounds,setSounds]=useState<TourSound[]>([]);
  const [file,setFile]=useState<File|null>(null);
  const [duration,setDuration]=useState<number|null>(null);
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const supabase=createClient();

  const load=useCallback(async()=>{const {data,error}=await supabase.from("tour_sounds").select("*").order("category").order("sort_order").order("created_at");if(error)setStatus(error.message);else setSounds((data as TourSound[])??[])},[supabase]);
  useEffect(()=>{load()},[load]);

  function chooseFile(event:ChangeEvent<HTMLInputElement>){const selected=event.target.files?.[0]??null;setFile(selected);setDuration(null);if(!selected)return;const audio=document.createElement("audio");audio.preload="metadata";audio.onloadedmetadata=()=>{setDuration(Math.round(audio.duration));URL.revokeObjectURL(audio.src)};audio.src=URL.createObjectURL(selected)}

  async function createSound(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!profile?.is_admin||!file)return;setBusy(true);setStatus("");const form=new FormData(event.currentTarget);try{const extension=file.name.split(".").pop()?.toLowerCase()||"mp3";const safe=`${Date.now()}-${crypto.randomUUID()}.${extension}`;const path=`sounds/${safe}`;const upload=await supabase.storage.from("tour-sounds").upload(path,file,{contentType:file.type||"audio/mpeg",cacheControl:"3600"});if(upload.error)throw upload.error;const insert=await supabase.from("tour_sounds").insert({title:String(form.get("title")).trim(),category:String(form.get("category")).trim()||"Firestarter 2026",description:String(form.get("description")).trim()||null,storage_path:path,duration_seconds:duration,is_visible:Boolean(form.get("is_visible")),sort_order:Number(form.get("sort_order"))||0,created_by:profile.id});if(insert.error){await supabase.storage.from("tour-sounds").remove([path]);throw insert.error}event.currentTarget.reset();setFile(null);setDuration(null);setStatus("Sound gespeichert.");await load()}catch(error){setStatus(error instanceof Error?error.message:"Sound konnte nicht gespeichert werden.")}finally{setBusy(false)}}

  async function toggle(sound:TourSound){const {error}=await supabase.from("tour_sounds").update({is_visible:!sound.is_visible,updated_at:new Date().toISOString()}).eq("id",sound.id);setStatus(error?error.message:!sound.is_visible?"Sound freigeschaltet.":"Sound verborgen.");if(!error)await load()}
  async function remove(sound:TourSound){if(!confirm(`Sound „${sound.title}“ wirklich löschen?`))return;const db=await supabase.from("tour_sounds").delete().eq("id",sound.id);if(db.error){setStatus(db.error.message);return}await supabase.storage.from("tour-sounds").remove([sound.storage_path]);setStatus("Sound gelöscht.");await load()}

  return <AuthGate admin><Shell><div className="page-heading"><span className="eyebrow">ADMIN · SOUNDBOARD</span><h1>Tour-Sounds verwalten</h1><p>Audiodateien hochladen, sortieren und für Teilnehmer freischalten.</p></div>{status&&<div className="status">{status}</div>}<form className="admin-card sound-admin-form" onSubmit={createSound}><div className="admin-card-heading"><div><Headphones/><h2>Neuer Sound</h2></div></div><input name="title" placeholder="Titel des Sounds" required/><input name="category" placeholder="Rubrik, z. B. Firestarter 2026" defaultValue="Firestarter 2026" required/><textarea name="description" placeholder="Kurze Beschreibung (optional)"/><div className="two-cols"><label>Reihenfolge<input name="sort_order" type="number" defaultValue="0"/></label><label className="sound-file-picker"><Upload/>Audiodatei auswählen<input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,.mp3,.m4a,.wav,.ogg" onChange={chooseFile} required/></label></div>{file&&<div className="sound-file-info"><strong>{file.name}</strong><small>{duration?`Dauer: ${Math.floor(duration/60)}:${String(duration%60).padStart(2,"0")}`:"Dauer wird gelesen …"}</small></div>}<label className="check-row"><input name="is_visible" type="checkbox"/>Sofort für alle sichtbar</label><button className="primary-button" disabled={busy||!file}><Save/>{busy?"Wird hochgeladen …":"Sound speichern"}</button></form><section className="sound-admin-list">{sounds.map(sound=><article className="sound-admin-row" key={sound.id}><div><span className="eyebrow">{sound.category}</span><h3>{sound.title}</h3><p>{sound.description}</p><small>{sound.duration_seconds?`${Math.floor(sound.duration_seconds/60)}:${String(sound.duration_seconds%60).padStart(2,"0")}`:"Dauer unbekannt"} · {sound.is_visible?"Sichtbar":"Geheim"}</small></div><div className="sound-admin-actions"><button className="icon-button" onClick={()=>toggle(sound)} title={sound.is_visible?"Verbergen":"Freischalten"}>{sound.is_visible?<EyeOff/>:<Eye/>}</button><button className="icon-button danger-icon" onClick={()=>remove(sound)} title="Löschen"><Trash2/></button></div></article>)}{!sounds.length&&<div className="empty-card">Noch keine Sounds hochgeladen.</div>}</section></Shell></AuthGate>
}
