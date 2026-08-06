"use client";

import { ChangeEvent, FormEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, GripVertical, Headphones, Pencil, Save, Trash2, Upload, X } from "lucide-react";
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
  const [editing,setEditing]=useState<TourSound|null>(null);
  const [draggedId,setDraggedId]=useState<string|null>(null);
  const soundsRef=useRef<TourSound[]>([]);
  const draggedIdRef=useRef<string|null>(null);
  const formRef=useRef<HTMLFormElement|null>(null);
  const supabase=useMemo(()=>createClient(),[]);

  useEffect(()=>{soundsRef.current=sounds},[sounds]);

  const load=useCallback(async()=>{const {data,error}=await supabase.from("tour_sounds").select("*").order("sort_order").order("created_at");if(error)setStatus(error.message);else setSounds((data as TourSound[])??[])},[supabase]);
  useEffect(()=>{load()},[load]);

  function chooseFile(event:ChangeEvent<HTMLInputElement>){const selected=event.target.files?.[0]??null;setFile(selected);setDuration(null);if(!selected)return;const audio=document.createElement("audio");const objectUrl=URL.createObjectURL(selected);audio.preload="metadata";audio.onloadedmetadata=()=>{setDuration(Math.round(audio.duration));URL.revokeObjectURL(objectUrl)};audio.onerror=()=>URL.revokeObjectURL(objectUrl);audio.src=objectUrl}

  async function createSound(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!profile?.is_admin||!file||busy)return;
    const formElement=formRef.current;
    const form=new FormData(event.currentTarget);
    const selectedFile=file;
    setBusy(true);setStatus("");
    try{
      const extension=selectedFile.name.split(".").pop()?.toLowerCase()||"mp3";
      const safe=`${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const path=`sounds/${safe}`;
      const upload=await supabase.storage.from("tour-sounds").upload(path,selectedFile,{contentType:selectedFile.type||"audio/mpeg",cacheControl:"3600"});
      if(upload.error)throw upload.error;
      const nextOrder=soundsRef.current.length?Math.max(...soundsRef.current.map(sound=>sound.sort_order))+1:0;
      const values={title:String(form.get("title")).trim(),category:String(form.get("category")).trim()||"Firestarter 2026",description:String(form.get("description")).trim()||null,storage_path:path,duration_seconds:duration,is_visible:Boolean(form.get("is_visible")),sort_order:nextOrder,created_by:profile.id};
      const insert=await supabase.from("tour_sounds").insert(values).select("id,title,category,description,storage_path,duration_seconds,is_visible,sort_order").single();
      if(insert.error){await supabase.storage.from("tour-sounds").remove([path]);throw insert.error}
      const created=insert.data as TourSound;
      setSounds(current=>{const next=[...current,created].sort((a,b)=>a.sort_order-b.sort_order);soundsRef.current=next;return next});
      formElement?.reset();
      setFile(null);setDuration(null);
      setStatus("Sound gespeichert und sofort zur Liste hinzugefügt.");
    }catch(error){setStatus(error instanceof Error?error.message:"Sound konnte nicht gespeichert werden.")}finally{setBusy(false)}
  }

  async function saveEdit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!editing)return;setBusy(true);const form=new FormData(event.currentTarget);const values={title:String(form.get("title")).trim(),category:String(form.get("category")).trim()||"Allgemein",description:String(form.get("description")).trim()||null,is_visible:Boolean(form.get("is_visible")),updated_at:new Date().toISOString()};const {error}=await supabase.from("tour_sounds").update(values).eq("id",editing.id);setStatus(error?error.message:"Sound aktualisiert.");if(!error){setEditing(null);await load()}setBusy(false)}

  async function toggle(sound:TourSound){const {error}=await supabase.from("tour_sounds").update({is_visible:!sound.is_visible,updated_at:new Date().toISOString()}).eq("id",sound.id);setStatus(error?error.message:!sound.is_visible?"Sound freigeschaltet.":"Sound verborgen.");if(!error)await load()}
  async function remove(sound:TourSound){if(!confirm(`Sound „${sound.title}“ wirklich löschen?`))return;const db=await supabase.from("tour_sounds").delete().eq("id",sound.id);if(db.error){setStatus(db.error.message);return}await supabase.storage.from("tour-sounds").remove([sound.storage_path]);setStatus("Sound gelöscht.");await load()}

  function moveSound(targetId:string){const sourceId=draggedIdRef.current;if(!sourceId||sourceId===targetId)return;setSounds(current=>{const from=current.findIndex(sound=>sound.id===sourceId);const to=current.findIndex(sound=>sound.id===targetId);if(from<0||to<0)return current;const next=[...current];const [moved]=next.splice(from,1);next.splice(to,0,moved);const ordered=next.map((sound,index)=>({...sound,sort_order:index}));soundsRef.current=ordered;return ordered})}
  async function saveSoundOrder(){const ordered=soundsRef.current;const updates=await Promise.all(ordered.map(sound=>supabase.from("tour_sounds").update({sort_order:sound.sort_order,updated_at:new Date().toISOString()}).eq("id",sound.id)));const error=updates.find(result=>result.error)?.error;setStatus(error?error.message:"Reihenfolge gespeichert.");if(error)await load()}
  function startSoundDrag(event:ReactPointerEvent<HTMLButtonElement>,id:string){event.preventDefault();draggedIdRef.current=id;setDraggedId(id);event.currentTarget.setPointerCapture(event.pointerId)}
  function moveSoundDrag(event:ReactPointerEvent<HTMLButtonElement>){if(!draggedIdRef.current)return;event.preventDefault();const target=(document.elementFromPoint(event.clientX,event.clientY) as HTMLElement|null)?.closest<HTMLElement>("[data-sound-id]");const targetId=target?.dataset.soundId;if(targetId)moveSound(targetId)}
  async function endSoundDrag(event:ReactPointerEvent<HTMLButtonElement>){if(!draggedIdRef.current)return;event.preventDefault();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);draggedIdRef.current=null;setDraggedId(null);await saveSoundOrder()}

  return <AuthGate admin><Shell><div className="page-heading"><span className="eyebrow">ADMIN · SOUNDBOARD</span><h1>Tour-Sounds verwalten</h1><p>Sounds hochladen, nachträglich bearbeiten und per Ziehen sortieren.</p></div>{status&&<div className="status">{status}</div>}<form ref={formRef} className="admin-card sound-admin-form" onSubmit={createSound}><div className="admin-card-heading"><div><Headphones/><h2>Neuer Sound</h2></div></div><input name="title" placeholder="Titel des Sounds" required/><input name="category" placeholder="Rubrik, z. B. Firestarter 2026" defaultValue="Firestarter 2026" required/><textarea name="description" placeholder="Kurze Beschreibung (optional)"/><label className="sound-file-picker"><Upload/>Audiodatei auswählen<input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,.mp3,.m4a,.wav,.ogg" onChange={chooseFile} required/></label>{file&&<div className="sound-file-info"><strong>{file.name}</strong><small>{duration?`Dauer: ${Math.floor(duration/60)}:${String(duration%60).padStart(2,"0")}`:"Dauer wird gelesen …"}</small></div>}<label className="check-row"><input name="is_visible" type="checkbox"/>Sofort für alle sichtbar</label><button className="primary-button" disabled={busy||!file}><Save/>{busy?"Wird hochgeladen …":"Sound speichern"}</button></form><section className="sound-admin-list"><div className="sound-sort-hint"><GripVertical/><span>Zum Sortieren den Griff gedrückt halten und den Sound nach oben oder unten ziehen.</span></div>{sounds.map(sound=>editing?.id===sound.id?<form className="sound-admin-row sound-edit-row" key={sound.id} onSubmit={saveEdit}><div className="sound-edit-fields"><input name="title" defaultValue={sound.title} required/><input name="category" defaultValue={sound.category} required/><textarea name="description" defaultValue={sound.description??""} placeholder="Beschreibung (optional)"/><label className="check-row"><input name="is_visible" type="checkbox" defaultChecked={sound.is_visible}/>Für alle sichtbar</label></div><div className="sound-admin-actions"><button className="icon-button" type="submit" title="Änderungen speichern" disabled={busy}><Save/></button><button className="icon-button" type="button" onClick={()=>setEditing(null)} title="Abbrechen"><X/></button></div></form>:<article className={`sound-admin-row ${draggedId===sound.id?"dragging":""}`} data-sound-id={sound.id} key={sound.id}><button type="button" className="sound-drag-handle" aria-label={`${sound.title} verschieben`} title="Gedrückt halten und ziehen" onPointerDown={event=>startSoundDrag(event,sound.id)} onPointerMove={moveSoundDrag} onPointerUp={endSoundDrag} onPointerCancel={endSoundDrag}><GripVertical/></button><div><span className="eyebrow">{sound.category}</span><h3>{sound.title}</h3>{sound.description&&<p>{sound.description}</p>}<small>{sound.duration_seconds?`${Math.floor(sound.duration_seconds/60)}:${String(sound.duration_seconds%60).padStart(2,"0")}`:"Dauer unbekannt"} · {sound.is_visible?"Sichtbar":"Geheim"}</small></div><div className="sound-admin-actions"><button className="icon-button" onClick={()=>setEditing(sound)} title="Bearbeiten"><Pencil/></button><button className="icon-button" onClick={()=>toggle(sound)} title={sound.is_visible?"Verbergen":"Freischalten"}>{sound.is_visible?<EyeOff/>:<Eye/>}</button><button className="icon-button danger-icon" onClick={()=>remove(sound)} title="Löschen"><Trash2/></button></div></article>)}{!sounds.length&&<div className="empty-card">Noch keine Sounds hochgeladen.</div>}</section></Shell></AuthGate>
}
