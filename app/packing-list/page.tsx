"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Check, GripVertical, Luggage, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";

type Settings={is_visible:boolean;title:string;intro:string|null};
type AdminItem={id:string;title:string;description:string|null;sort_order:number};
type PersonalItem={id:string;title:string;description:string|null;sort_order:number;checked:boolean};

export default function PackingListPage(){
  const {profile}=useApp();
  const supabase=useMemo(()=>createClient(),[]);
  const [settings,setSettings]=useState<Settings|null>(null);
  const [adminItems,setAdminItems]=useState<AdminItem[]>([]);
  const [personalItems,setPersonalItems]=useState<PersonalItem[]>([]);
  const [checked,setChecked]=useState<Set<string>>(new Set());
  const [loading,setLoading]=useState(true);
  const [status,setStatus]=useState("");
  const [dragging,setDragging]=useState<string|null>(null);

  const load=useCallback(async()=>{
    if(!profile)return;
    const [s,i,ch,p]=await Promise.all([
      supabase.from("packing_settings").select("is_visible,title,intro").eq("id",1).maybeSingle(),
      supabase.from("packing_items").select("id,title,description,sort_order").order("sort_order").order("created_at"),
      supabase.from("packing_checks").select("item_id").eq("user_id",profile.id).eq("checked",true),
      supabase.from("personal_packing_items").select("id,title,description,sort_order,checked").eq("user_id",profile.id).order("sort_order").order("created_at")
    ]);
    setSettings(s.data);setAdminItems(i.data??[]);setChecked(new Set((ch.data??[]).map(row=>row.item_id)));setPersonalItems(p.data??[]);setLoading(false);
  },[profile,supabase]);

  useEffect(()=>{
    load();if(!profile)return;
    const channel=supabase.channel(`packing-live-${profile.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"packing_settings"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"packing_items"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"personal_packing_items",filter:`user_id=eq.${profile.id}`},load)
      .subscribe();
    return()=>{supabase.removeChannel(channel)};
  },[load,profile,supabase]);

  async function toggleAdmin(itemId:string){
    if(!profile)return;
    const active=checked.has(itemId);
    setChecked(current=>{const next=new Set(current);active?next.delete(itemId):next.add(itemId);return next});
    const result=active?await supabase.from("packing_checks").delete().eq("user_id",profile.id).eq("item_id",itemId):await supabase.from("packing_checks").upsert({user_id:profile.id,item_id:itemId,checked:true,checked_at:new Date().toISOString()});
    if(result.error){setStatus(result.error.message);await load()}
  }

  async function togglePersonal(item:PersonalItem){
    const next=!item.checked;setPersonalItems(current=>current.map(entry=>entry.id===item.id?{...entry,checked:next}:entry));
    const {error}=await supabase.from("personal_packing_items").update({checked:next}).eq("id",item.id);
    if(error){setStatus(error.message);await load()}
  }

  async function addPersonal(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!profile)return;
    const form=event.currentTarget;const data=new FormData(form);const title=String(data.get("title")||"").trim();if(!title)return;
    const nextOrder=personalItems.length?Math.max(...personalItems.map(item=>item.sort_order))+1:0;
    const {error}=await supabase.from("personal_packing_items").insert({user_id:profile.id,title,description:String(data.get("description")||"").trim()||null,sort_order:nextOrder});
    setStatus(error?error.message:"Eigener Gegenstand hinzugefügt.");if(!error){form.reset();await load()}
  }

  async function editPersonal(item:PersonalItem){
    const title=window.prompt("Gegenstand bearbeiten",item.title)?.trim();if(!title)return;
    const description=window.prompt("Hinweis bearbeiten (leer lassen zum Entfernen)",item.description||"");if(description===null)return;
    const {error}=await supabase.from("personal_packing_items").update({title,description:description.trim()||null}).eq("id",item.id);
    setStatus(error?error.message:"Eigener Gegenstand gespeichert.");if(!error)setPersonalItems(current=>current.map(entry=>entry.id===item.id?{...entry,title,description:description.trim()||null}:entry));
  }

  async function removePersonal(id:string){
    if(!confirm("Eigenen Gegenstand wirklich löschen?"))return;
    const {error}=await supabase.from("personal_packing_items").delete().eq("id",id);
    setStatus(error?error.message:"Eigener Gegenstand gelöscht.");if(!error)setPersonalItems(current=>current.filter(item=>item.id!==id));
  }

  async function dropPersonal(targetId:string){
    if(!dragging||dragging===targetId)return;
    const from=personalItems.findIndex(item=>item.id===dragging);const to=personalItems.findIndex(item=>item.id===targetId);if(from<0||to<0)return;
    const next=[...personalItems];const [moved]=next.splice(from,1);next.splice(to,0,moved);
    const ordered=next.map((item,index)=>({...item,sort_order:index}));setDragging(null);setPersonalItems(ordered);
    const updates=await Promise.all(ordered.map(item=>supabase.from("personal_packing_items").update({sort_order:item.sort_order}).eq("id",item.id)));
    const error=updates.find(result=>result.error)?.error;if(error){setStatus(error.message);await load()}
  }

  const total=adminItems.length+personalItems.length;
  const done=checked.size+personalItems.filter(item=>item.checked).length;
  const progress=total?Math.round(done/total*100):0;

  return <AuthGate><Shell>
    <div className="page-heading"><span className="eyebrow">NICHTS VERGESSEN</span><h1>{settings?.title||"Packliste"}</h1><p>{settings?.intro||"Pflichtsachen abhaken und deine eigene Liste ergänzen."}</p></div>
    {status&&<div className="status">{status}</div>}
    {loading?<div className="empty-card">Packliste wird geladen …</div>:!settings?.is_visible&&!profile?.is_admin?<div className="empty-card"><Luggage/>Die Packliste ist noch geheim. Du bekommst Bescheid, sobald sie freigeschaltet wird.</div>:<>
      <section className="packing-progress"><div><strong>{done} von {total}</strong><span>eingepackt</span></div><div className="packing-progress-track"><span style={{width:`${progress}%`}}/></div><b>{progress}%</b></section>
      {profile?.is_admin&&!settings?.is_visible&&<div className="status"><ShieldCheck/>Admin-Vorschau: Für Teilnehmer ist diese Liste aktuell unsichtbar.</div>}

      <section className="packing-simple-section unified-packing-section">
        <header className="packing-simple-heading"><div><span className="eyebrow">DEINE GESAMTE LISTE</span><h2>Alles auf einen Blick</h2><p>Pflichtgegenstände stehen immer oben. Deine Ergänzungen folgen direkt darunter.</p></div><strong>{done}/{total}</strong></header>

        <div className="packing-simple-list unified-packing-list">
          {adminItems.map(item=>{const isDone=checked.has(item.id);return <button type="button" key={item.id} className={`packing-item ${isDone?"done":""}`} onClick={()=>toggleAdmin(item.id)}><span className="packing-check">{isDone&&<Check/>}</span><span><strong>{item.title}<em>Pflicht</em></strong>{item.description&&<small>{item.description}</small>}</span></button>})}

          {personalItems.length>0&&<div className="personal-list-divider"><strong>Meine Ergänzungen</strong><p>Diese Einträge kannst du verschieben, bearbeiten und löschen.</p></div>}

          {personalItems.map(item=><article key={item.id} draggable onDragStart={()=>setDragging(item.id)} onDragEnd={()=>setDragging(null)} onDragOver={event=>event.preventDefault()} onDrop={()=>dropPersonal(item.id)} className={`personal-packing-item ${item.checked?"done":""} ${dragging===item.id?"dragging":""}`}><button type="button" className="packing-drag-handle" aria-label="Verschieben"><GripVertical/></button><button type="button" className="personal-packing-toggle" onClick={()=>togglePersonal(item)}><span className="packing-check">{item.checked&&<Check/>}</span><span><strong>{item.title}</strong>{item.description&&<small>{item.description}</small>}</span></button><button type="button" className="icon-button" onClick={()=>editPersonal(item)} aria-label="Bearbeiten"><Pencil/></button><button type="button" className="icon-button danger-icon" onClick={()=>removePersonal(item.id)} aria-label="Löschen"><Trash2/></button></article>)}
        </div>

        {!adminItems.length&&!personalItems.length&&<div className="empty-card">Noch keine Gegenstände eingetragen.</div>}
      </section>

      <section className="packing-simple-section add-personal-packing-section">
        <header className="packing-simple-heading add-personal-heading"><div><span className="eyebrow">DEINE EIGENE LISTE</span><h2>Gegenstand hinzufügen</h2><p>Ergänze alles, was du zusätzlich mitnehmen möchtest.</p></div><Plus/></header>
        <form className="personal-packing-form" onSubmit={addPersonal}><input name="title" placeholder="Eigenen Gegenstand hinzufügen" required/><input name="description" placeholder="Hinweis (optional)"/><button className="primary-button"><Plus/>Hinzufügen</button></form>
      </section>
    </>}
  </Shell></AuthGate>;
}
