"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BellRing, Eye, EyeOff, ListPlus, PackagePlus, Trash2 } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";

type Settings={is_visible:boolean;title:string;intro:string|null};
type Category={id:string;name:string;description:string|null;sort_order:number};
type Item={id:string;category_id:string;title:string;description:string|null;is_required:boolean;sort_order:number};

export default function PackingAdminPage(){
  const {session}=useApp();
  const supabase=createClient();
  const [settings,setSettings]=useState<Settings>({is_visible:false,title:"Packliste",intro:""});
  const [categories,setCategories]=useState<Category[]>([]);
  const [items,setItems]=useState<Item[]>([]);
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);

  const load=useCallback(async()=>{const [s,c,i]=await Promise.all([supabase.from("packing_settings").select("is_visible,title,intro").eq("id",1).maybeSingle(),supabase.from("packing_categories").select("*").order("sort_order").order("created_at"),supabase.from("packing_items").select("*").order("sort_order").order("created_at")]);if(s.data)setSettings(s.data);setCategories(c.data??[]);setItems(i.data??[])},[supabase]);
  useEffect(()=>{load()},[load]);

  async function push(title:string,body:string){const response=await fetch("/api/push/send",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token}`},body:JSON.stringify({title,body,url:"/packing-list"})});if(!response.ok){const json=await response.json();throw new Error(json.error||"Push konnte nicht gesendet werden.")}}

  async function saveSettings(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setStatus("");const form=new FormData(e.currentTarget);const next={title:String(form.get("title")).trim()||"Packliste",intro:String(form.get("intro")).trim()||null,is_visible:form.get("is_visible")==="on",updated_at:new Date().toISOString(),updated_by:session!.user.id};const becameVisible=!settings.is_visible&&next.is_visible;const {error}=await supabase.from("packing_settings").update(next).eq("id",1);if(error)setStatus(error.message);else{setSettings({...next,intro:next.intro});if(becameVisible&&form.get("send_push")==="on"){try{await push("Packliste ist online 🎒","Die Packliste ist freigeschaltet. Schau rein und hake ab, was du schon eingepackt hast.");setStatus("Packliste veröffentlicht und Push versendet.")}catch(error){setStatus(error instanceof Error?error.message:"Push-Fehler")}}else setStatus("Packliste gespeichert.")}setBusy(false)}

  async function addCategory(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const {error}=await supabase.from("packing_categories").insert({name:String(f.get("name")).trim(),description:String(f.get("description")).trim()||null,sort_order:Number(f.get("sort_order"))||0,created_by:session!.user.id});setStatus(error?error.message:"Rubrik angelegt.");if(!error){form.reset();await load()}}
  async function addItem(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const {error}=await supabase.from("packing_items").insert({category_id:String(f.get("category_id")),title:String(f.get("title")).trim(),description:String(f.get("description")).trim()||null,is_required:f.get("is_required")==="on",sort_order:Number(f.get("sort_order"))||0,created_by:session!.user.id});setStatus(error?error.message:"Gegenstand hinzugefügt.");if(!error){form.reset();await load()}}
  async function remove(table:"packing_categories"|"packing_items",id:string,label:string){if(!confirm(`${label} wirklich löschen?`))return;const {error}=await supabase.from(table).delete().eq("id",id);setStatus(error?error.message:`${label} gelöscht.`);await load()}
  async function reminder(){setBusy(true);try{await push("Pack-Reminder ⏰","Denkt daran, eure Packliste zu prüfen. Alles mit Haken ist schon im Gepäck.");setStatus("Erinnerungs-Push wurde versendet.")}catch(error){setStatus(error instanceof Error?error.message:"Fehler")}setBusy(false)}

  return <AuthGate admin><Shell>
    <div className="page-heading"><span className="eyebrow">VORBEREITUNG</span><h1>Packliste verwalten</h1><p>Rubriken und Gegenstände frei anlegen, geheim vorbereiten und später für alle freischalten.</p></div>
    {status&&<div className="status">{status}</div>}
    <div className="packing-admin-grid">
      <form className="admin-card packing-settings-card" onSubmit={saveSettings}><div className="admin-card-heading"><div>{settings.is_visible?<Eye/>:<EyeOff/>}<h2>Sichtbarkeit & Push</h2></div></div><input name="title" defaultValue={settings.title} placeholder="Titel der Packliste" required/><textarea name="intro" defaultValue={settings.intro||""} placeholder="Kurzer Hinweis für die Teilnehmer"/><label className="check-row"><input name="is_visible" type="checkbox" defaultChecked={settings.is_visible}/> Packliste für alle sichtbar</label><label className="check-row"><input name="send_push" type="checkbox"/> Beim erstmaligen Freischalten Push senden</label><button className="primary-button" disabled={busy}>{settings.is_visible?<><Eye/>Speichern</>:<><EyeOff/>Geheim speichern</>}</button><button type="button" className="secondary-button" onClick={reminder} disabled={busy}><BellRing/>Pack-Erinnerung senden</button></form>
      <form className="admin-card" onSubmit={addCategory}><ListPlus/><h2>Neue Rubrik</h2><input name="name" placeholder="z. B. Pflicht, Kleidung, Optional" required/><textarea name="description" placeholder="Beschreibung (optional)"/><input name="sort_order" type="number" placeholder="Reihenfolge, z. B. 1"/><button className="primary-button"><ListPlus/>Rubrik anlegen</button></form>
      <form className="admin-card" onSubmit={addItem}><PackagePlus/><h2>Gegenstand hinzufügen</h2><select name="category_id" required defaultValue=""><option value="" disabled>Rubrik auswählen</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select><input name="title" placeholder="z. B. Zahnbürste" required/><textarea name="description" placeholder="Zusatzhinweis (optional)"/><label className="check-row"><input name="is_required" type="checkbox"/> Als Pflicht markieren</label><input name="sort_order" type="number" placeholder="Reihenfolge, z. B. 1"/><button className="primary-button"><PackagePlus/>Gegenstand speichern</button></form>
      <section className="admin-card admin-wide"><h2>Aktuelle Packliste</h2>{categories.map(category=><div className="packing-admin-category" key={category.id}><header><div><strong>{category.name}</strong>{category.description&&<small>{category.description}</small>}</div><button className="danger-icon" onClick={()=>remove("packing_categories",category.id,"Rubrik")}><Trash2/></button></header>{items.filter(item=>item.category_id===category.id).map(item=><div className="admin-content-row" key={item.id}><div><strong>{item.title}{item.is_required&&<em className="required-pill">Pflicht</em>}</strong><small>{item.description||"Ohne Zusatzhinweis"}</small></div><button className="danger-icon" onClick={()=>remove("packing_items",item.id,"Gegenstand")}><Trash2/></button></div>)}{!items.some(item=>item.category_id===category.id)&&<p>Noch keine Gegenstände in dieser Rubrik.</p>}</div>)}{!categories.length&&<div className="empty-card">Lege zuerst eine Rubrik an.</div>}</section>
    </div>
  </Shell></AuthGate>;
}
