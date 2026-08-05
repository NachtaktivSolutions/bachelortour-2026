"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BellRing, Eye, EyeOff, GripVertical, ListPlus, PackagePlus, Trash2 } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";

type Settings={is_visible:boolean;title:string;intro:string|null};
type Category={id:string;name:string;description:string|null;sort_order:number};
type Item={id:string;category_id:string;title:string;description:string|null;is_required:boolean;sort_order:number};
type DragState={type:"category"|"item";id:string}|null;

export default function PackingAdminPage(){
  const {session}=useApp();
  const supabase=createClient();
  const [settings,setSettings]=useState<Settings>({is_visible:false,title:"Packliste",intro:""});
  const [categories,setCategories]=useState<Category[]>([]);
  const [items,setItems]=useState<Item[]>([]);
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const [dragging,setDragging]=useState<DragState>(null);

  const load=useCallback(async()=>{const [s,c,i]=await Promise.all([supabase.from("packing_settings").select("is_visible,title,intro").eq("id",1).maybeSingle(),supabase.from("packing_categories").select("*").order("sort_order").order("created_at"),supabase.from("packing_items").select("*").order("sort_order").order("created_at")]);if(s.data)setSettings(s.data);setCategories(c.data??[]);setItems(i.data??[])},[supabase]);
  useEffect(()=>{load()},[load]);

  async function push(title:string,body:string){const response=await fetch("/api/push/send",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token}`},body:JSON.stringify({title,body,url:"/packing-list"})});if(!response.ok){const json=await response.json();throw new Error(json.error||"Push konnte nicht gesendet werden.")}}

  async function saveSettings(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setStatus("");const form=new FormData(e.currentTarget);const next={title:String(form.get("title")).trim()||"Packliste",intro:String(form.get("intro")).trim()||null,is_visible:form.get("is_visible")==="on",updated_at:new Date().toISOString(),updated_by:session!.user.id};const becameVisible=!settings.is_visible&&next.is_visible;const {error}=await supabase.from("packing_settings").update(next).eq("id",1);if(error)setStatus(error.message);else{setSettings({...next,intro:next.intro});if(becameVisible&&form.get("send_push")==="on"){try{await push("Packliste ist online 🎒","Die Packliste ist freigeschaltet. Schau rein und hake ab, was du schon eingepackt hast.");setStatus("Packliste veröffentlicht und Push versendet.")}catch(error){setStatus(error instanceof Error?error.message:"Push-Fehler")}}else setStatus("Packliste gespeichert.")}setBusy(false)}

  async function addCategory(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const nextOrder=categories.length?Math.max(...categories.map(category=>category.sort_order))+1:0;const {error}=await supabase.from("packing_categories").insert({name:String(f.get("name")).trim(),description:String(f.get("description")).trim()||null,sort_order:nextOrder,created_by:session!.user.id});setStatus(error?error.message:"Rubrik angelegt. Du kannst sie unten frei verschieben.");if(!error){form.reset();await load()}}
  async function addItem(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const f=new FormData(form);const categoryId=String(f.get("category_id"));const categoryItems=items.filter(item=>item.category_id===categoryId);const nextOrder=categoryItems.length?Math.max(...categoryItems.map(item=>item.sort_order))+1:0;const {error}=await supabase.from("packing_items").insert({category_id:categoryId,title:String(f.get("title")).trim(),description:String(f.get("description")).trim()||null,is_required:f.get("is_required")==="on",sort_order:nextOrder,created_by:session!.user.id});setStatus(error?error.message:"Gegenstand hinzugefügt. Du kannst ihn unten frei verschieben.");if(!error){form.reset();await load()}}
  async function remove(table:"packing_categories"|"packing_items",id:string,label:string){if(!confirm(`${label} wirklich löschen?`))return;const {error}=await supabase.from(table).delete().eq("id",id);setStatus(error?error.message:`${label} gelöscht.`);await load()}
  async function reminder(){setBusy(true);try{await push("Pack-Reminder ⏰","Denkt daran, eure Packliste zu prüfen. Alles mit Haken ist schon im Gepäck.");setStatus("Erinnerungs-Push wurde versendet.")}catch(error){setStatus(error instanceof Error?error.message:"Fehler")}setBusy(false)}

  async function saveCategoryOrder(next:Category[]){setCategories(next);const updates=await Promise.all(next.map((category,index)=>supabase.from("packing_categories").update({sort_order:index}).eq("id",category.id)));const error=updates.find(result=>result.error)?.error;setStatus(error?error.message:"Rubrik-Reihenfolge gespeichert.");if(error)await load()}

  async function dropCategory(targetId:string){if(!dragging||dragging.type!=="category"||dragging.id===targetId)return;const from=categories.findIndex(category=>category.id===dragging.id);const to=categories.findIndex(category=>category.id===targetId);if(from<0||to<0)return;const next=[...categories];const [moved]=next.splice(from,1);next.splice(to,0,moved);setDragging(null);await saveCategoryOrder(next)}

  async function persistItems(next:Item[]){setItems(next);const grouped=new Map<string,Item[]>();next.forEach(item=>grouped.set(item.category_id,[...(grouped.get(item.category_id)||[]),item]));const updates=[] as ReturnType<typeof supabase.from>[];
    const promises:Array<PromiseLike<{error:any}>>=[];
    grouped.forEach((group,categoryId)=>group.forEach((item,index)=>promises.push(supabase.from("packing_items").update({category_id:categoryId,sort_order:index}).eq("id",item.id))));
    const results=await Promise.all(promises);const error=results.find(result=>result.error)?.error;setStatus(error?error.message:"Packlisten-Reihenfolge gespeichert.");if(error)await load();void updates;
  }

  async function dropItem(targetId:string){if(!dragging||dragging.type!=="item"||dragging.id===targetId)return;const moved=items.find(item=>item.id===dragging.id);const target=items.find(item=>item.id===targetId);if(!moved||!target)return;const without=items.filter(item=>item.id!==moved.id);const targetIndex=without.findIndex(item=>item.id===target.id);without.splice(targetIndex,0,{...moved,category_id:target.category_id});setDragging(null);await persistItems(without)}

  async function dropItemInCategory(categoryId:string){if(!dragging||dragging.type!=="item")return;const moved=items.find(item=>item.id===dragging.id);if(!moved)return;const without=items.filter(item=>item.id!==moved.id);let insertAt=without.length;for(let index=without.length-1;index>=0;index--){if(without[index].category_id===categoryId){insertAt=index+1;break}}without.splice(insertAt,0,{...moved,category_id:categoryId});setDragging(null);await persistItems(without)}

  return <AuthGate admin><Shell>
    <div className="page-heading"><span className="eyebrow">VORBEREITUNG</span><h1>Packliste verwalten</h1><p>Rubriken und Gegenstände anlegen und unten per Drag & Drop frei sortieren.</p></div>
    {status&&<div className="status">{status}</div>}
    <div className="packing-admin-grid">
      <form className="admin-card packing-settings-card" onSubmit={saveSettings}><div className="admin-card-heading"><div>{settings.is_visible?<Eye/>:<EyeOff/>}<h2>Sichtbarkeit & Push</h2></div></div><input name="title" defaultValue={settings.title} placeholder="Titel der Packliste" required/><textarea name="intro" defaultValue={settings.intro||""} placeholder="Kurzer Hinweis für die Teilnehmer"/><label className="check-row"><input name="is_visible" type="checkbox" defaultChecked={settings.is_visible}/> Packliste für alle sichtbar</label><label className="check-row"><input name="send_push" type="checkbox"/> Beim erstmaligen Freischalten Push senden</label><button className="primary-button" disabled={busy}>{settings.is_visible?<><Eye/>Speichern</>:<><EyeOff/>Geheim speichern</>}</button><button type="button" className="secondary-button" onClick={reminder} disabled={busy}><BellRing/>Pack-Erinnerung senden</button></form>
      <form className="admin-card" onSubmit={addCategory}><ListPlus/><h2>Neue Rubrik</h2><input name="name" placeholder="z. B. Pflicht, Kleidung, Optional" required/><textarea name="description" placeholder="Beschreibung (optional)"/><button className="primary-button"><ListPlus/>Rubrik anlegen</button></form>
      <form className="admin-card" onSubmit={addItem}><PackagePlus/><h2>Gegenstand hinzufügen</h2><select name="category_id" required defaultValue=""><option value="" disabled>Rubrik auswählen</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select><input name="title" placeholder="z. B. Zahnbürste" required/><textarea name="description" placeholder="Zusatzhinweis (optional)"/><label className="check-row"><input name="is_required" type="checkbox"/> Als Pflicht markieren</label><button className="primary-button"><PackagePlus/>Gegenstand speichern</button></form>
      <section className="admin-card admin-wide packing-sort-section"><h2>Aktuelle Packliste</h2><div className="packing-sort-hint"><GripVertical/><span>Rubriken und Gegenstände am Griff gedrückt halten und verschieben. Gegenstände können auch in andere Rubriken gezogen werden.</span></div>{categories.map(category=><article className={`packing-sort-category ${dragging?.type==="category"&&dragging.id===category.id?"dragging":""}`} key={category.id} draggable onDragStart={()=>setDragging({type:"category",id:category.id})} onDragEnd={()=>setDragging(null)} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.stopPropagation();dragging?.type==="category"?dropCategory(category.id):dropItemInCategory(category.id)}}><header><button type="button" className="packing-drag-handle" aria-label={`${category.name} verschieben`}><GripVertical/></button><div><strong>{category.name}</strong>{category.description&&<small>{category.description}</small>}</div><button type="button" className="icon-button danger-icon" onClick={()=>remove("packing_categories",category.id,"Rubrik")} title="Rubrik löschen"><Trash2/></button></header><div className="packing-sort-items">{items.filter(item=>item.category_id===category.id).map(item=><div className={`packing-sort-item ${dragging?.type==="item"&&dragging.id===item.id?"dragging":""}`} key={item.id} draggable onDragStart={event=>{event.stopPropagation();setDragging({type:"item",id:item.id})}} onDragEnd={()=>setDragging(null)} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.stopPropagation();dropItem(item.id)}}><button type="button" className="packing-drag-handle" aria-label={`${item.title} verschieben`}><GripVertical/></button><div><strong>{item.title}{item.is_required&&<em className="required-pill">Pflicht</em>}</strong><small>{item.description||"Ohne Zusatzhinweis"}</small></div><button type="button" className="icon-button danger-icon" onClick={()=>remove("packing_items",item.id,"Gegenstand")} title="Gegenstand löschen"><Trash2/></button></div>)}{!items.some(item=>item.category_id===category.id)&&<div className="packing-empty-drop">Gegenstand hierher ziehen</div>}</div></article>)}{!categories.length&&<div className="empty-card">Lege zuerst eine Rubrik an.</div>}</section>
    </div>
  </Shell></AuthGate>;
}
