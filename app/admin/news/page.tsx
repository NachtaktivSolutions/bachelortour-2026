"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, Eye, EyeOff, Newspaper, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/app-provider";

type NewsAdminItem = {
  id:string;
  title:string;
  body:string;
  image_url:string|null;
  author_id:string;
  created_at:string;
  updated_at:string;
  is_visible:boolean;
};

export default function AdminNewsPage(){
  const {session}=useApp();
  const supabase=useMemo(()=>createClient(),[]);
  const [items,setItems]=useState<NewsAdminItem[]>([]);
  const [editing,setEditing]=useState<NewsAdminItem|null>(null);
  const [creating,setCreating]=useState(false);
  const [status,setStatus]=useState("");
  const [saving,setSaving]=useState(false);
  const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    const {data,error}=await supabase.from("news").select("id,title,body,image_url,author_id,created_at,updated_at,is_visible").order("created_at",{ascending:false});
    if(error)setStatus(error.message);else setItems((data as NewsAdminItem[])??[]);
    setLoading(false);
  },[supabase]);

  useEffect(()=>{load()},[load]);

  async function sendNewsPush(item:Pick<NewsAdminItem,"id"|"title"|"body">){
    if(!session)return 0;
    const response=await fetch("/api/push/send",{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},
      body:JSON.stringify({title:`Neue Neuigkeit: ${item.title}`,body:item.body,url:`/#news-${item.id}`,tag:`news-${item.id}`})
    });
    const json=await response.json();
    if(!response.ok)throw new Error(json.error||"Push konnte nicht versendet werden.");
    return json.sent??0;
  }

  async function save(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!session)return;
    const form=new FormData(e.currentTarget);
    const isVisible=form.get("is_visible")==="on";
    const sendPush=form.get("send_push")==="on";
    const values={title:String(form.get("title")).trim(),body:String(form.get("body")).trim(),is_visible:isVisible,updated_at:new Date().toISOString()};
    if(!values.title||!values.body)return;
    setSaving(true);setStatus("");
    try{
      const result=editing
        ? await supabase.from("news").update(values).eq("id",editing.id).select().single()
        : await supabase.from("news").insert({...values,author_id:session.user.id}).select().single();
      if(result.error)throw result.error;
      let message=isVisible?"Neuigkeit gespeichert und sichtbar.":"Neuigkeit vorbereitet und bleibt für Teilnehmer unsichtbar.";
      if(isVisible&&sendPush){const sent=await sendNewsPush(result.data as NewsAdminItem);message+=` Push an ${sent} Geräte versendet.`}
      setStatus(message);setEditing(null);setCreating(false);await load();
    }catch(error){setStatus(error instanceof Error?error.message:"Neuigkeit konnte nicht gespeichert werden.")}
    finally{setSaving(false)}
  }

  async function toggleVisibility(item:NewsAdminItem){
    const next=!item.is_visible;
    const question=next?`„${item.title}“ jetzt für alle Teilnehmer sichtbar schalten?`:`„${item.title}“ wieder vor den Teilnehmern verbergen?`;
    if(!window.confirm(question))return;
    const {error}=await supabase.from("news").update({is_visible:next,updated_at:new Date().toISOString()}).eq("id",item.id);
    if(error){setStatus(error.message);return}
    let message=next?"Neuigkeit wurde veröffentlicht.":"Neuigkeit wurde wieder verborgen.";
    if(next&&window.confirm("Soll dazu jetzt auch eine Push-Nachricht an alle Teilnehmer gesendet werden?")){
      try{const sent=await sendNewsPush(item);message+=` Push an ${sent} Geräte versendet.`}
      catch(error){message+=` Sichtbar, aber Push fehlgeschlagen: ${error instanceof Error?error.message:"Unbekannter Fehler"}`}
    }
    setStatus(message);await load();
  }

  async function remove(item:NewsAdminItem){
    if(!window.confirm(`Neuigkeit „${item.title}“ wirklich löschen?`))return;
    const {error}=await supabase.from("news").delete().eq("id",item.id);
    setStatus(error?error.message:"Neuigkeit gelöscht.");
    if(!error){if(editing?.id===item.id)setEditing(null);await load()}
  }

  const formItem=editing;
  return <AuthGate admin><Shell>
    <div className="page-heading"><span className="eyebrow">ADMIN · NEUIGKEITEN</span><h1>Neuigkeiten verwalten</h1><p>Neuigkeiten geheim vorbereiten, bearbeiten und später gezielt mit optionaler Push-Mitteilung veröffentlichen.</p></div>
    {status&&<div className="status">{status}</div>}
    <div className="event-admin-toolbar"><button className="primary-button" onClick={()=>{setCreating(true);setEditing(null)}}><Plus/>Neue Neuigkeit vorbereiten</button></div>

    {(creating||editing)&&<form className="admin-card event-edit-form" onSubmit={save}>
      <div className="admin-card-heading"><div><Newspaper/><h2>{editing?"Neuigkeit bearbeiten":"Neue Neuigkeit"}</h2></div><button type="button" className="icon-button" onClick={()=>{setCreating(false);setEditing(null)}}><X/></button></div>
      <input name="title" defaultValue={formItem?.title??""} placeholder="Titel" required/>
      <textarea name="body" defaultValue={formItem?.body??""} placeholder="Nachricht" required/>
      <label className="event-visibility-choice"><input name="is_visible" type="checkbox" defaultChecked={formItem?.is_visible??false}/><span>{formItem?.is_visible?<Eye/>:<EyeOff/>}<strong>Für Teilnehmer sichtbar</strong><small>Ausgeschaltet bleibt die Neuigkeit vorbereitet und ist nur im Adminbereich sichtbar.</small></span></label>
      <label className="check-row"><input name="send_push" type="checkbox"/><BellRing/><span><strong>Push-Nachricht mitsenden</strong><small>Wird nur gesendet, wenn die Neuigkeit sichtbar gespeichert wird.</small></span></label>
      <button className="primary-button" disabled={saving}><Save/>{saving?"Wird gespeichert …":(formItem?.is_visible?"Speichern":"Vorbereiten")}</button>
    </form>}

    {loading?<div className="empty-card">Neuigkeiten werden geladen …</div>:<div className="event-admin-list">{items.map(item=><article className={`event-admin-card ${item.is_visible?"":"is-hidden"}`} key={item.id}>
      <div className="event-admin-date"><strong>{new Date(item.created_at).toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",timeZone:"Europe/Berlin"})}</strong><span>{new Date(item.created_at).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Berlin"})}</span></div>
      <div className="event-admin-copy"><div className="event-admin-title"><h3>{item.title}</h3><em className={item.is_visible?"visible-chip":"hidden-chip"}>{item.is_visible?"Sichtbar":"Vorbereitet"}</em></div><p>{item.body}</p></div>
      <div className="event-admin-actions"><button className={`icon-button ${item.is_visible?"":"member-info-button"}`} onClick={()=>toggleVisibility(item)} title={item.is_visible?"Verbergen":"Jetzt veröffentlichen"}>{item.is_visible?<EyeOff/>:<Eye/>}</button><button className="icon-button" onClick={()=>{setEditing(item);setCreating(false);window.scrollTo({top:0,behavior:"smooth"})}} title="Bearbeiten"><Pencil/></button><button className="icon-button danger-icon" onClick={()=>remove(item)} title="Löschen"><Trash2/></button></div>
    </article>)}{!items.length&&<div className="empty-card">Noch keine Neuigkeiten angelegt.</div>}</div>}
  </Shell></AuthGate>;
}
