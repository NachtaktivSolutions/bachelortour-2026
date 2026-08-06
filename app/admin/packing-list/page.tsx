"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, Eye, EyeOff, GripVertical, PackagePlus, Trash2 } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";

type Settings={is_visible:boolean;title:string;intro:string|null};
type Item={id:string;title:string;description:string|null;sort_order:number};

export default function PackingAdminPage(){
  const {session}=useApp();
  const supabase=useMemo(()=>createClient(),[]);
  const [settings,setSettings]=useState<Settings>({is_visible:false,title:"Packliste",intro:""});
  const [items,setItems]=useState<Item[]>([]);
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const [dragging,setDragging]=useState<string|null>(null);

  const load=useCallback(async()=>{
    const [s,i]=await Promise.all([
      supabase.from("packing_settings").select("is_visible,title,intro").eq("id",1).maybeSingle(),
      supabase.from("packing_items").select("id,title,description,sort_order").order("sort_order").order("created_at")
    ]);
    if(s.data)setSettings(s.data);
    setItems(i.data??[]);
  },[supabase]);

  useEffect(()=>{load()},[load]);

  async function push(title:string,body:string){
    const response=await fetch("/api/push/send",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token}`},body:JSON.stringify({title,body,url:"/packing-list"})});
    if(!response.ok){const json=await response.json();throw new Error(json.error||"Push konnte nicht gesendet werden.")}
  }

  async function saveSettings(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setStatus("");
    const form=new FormData(event.currentTarget);
    const next={title:String(form.get("title")).trim()||"Packliste",intro:String(form.get("intro")).trim()||null,is_visible:form.get("is_visible")==="on",updated_at:new Date().toISOString(),updated_by:session!.user.id};
    const becameVisible=!settings.is_visible&&next.is_visible;
    const {error}=await supabase.from("packing_settings").update(next).eq("id",1);
    if(error)setStatus(error.message);
    else{
      setSettings({...next,intro:next.intro});
      if(becameVisible&&form.get("send_push")==="on"){
        try{await push("Packliste ist online 🎒","Die Pflicht-Packliste ist freigeschaltet. Ergänze bei Bedarf deine eigenen Sachen.");setStatus("Packliste veröffentlicht und Push versendet.")}
        catch(error){setStatus(error instanceof Error?error.message:"Push-Fehler")}
      }else setStatus("Packliste gespeichert.");
    }
    setBusy(false);
  }

  async function addItem(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=event.currentTarget;
    const data=new FormData(form);
    const nextOrder=items.length?Math.max(...items.map(item=>item.sort_order))+1:0;
    const {error}=await supabase.from("packing_items").insert({category_id:null,title:String(data.get("title")).trim(),description:String(data.get("description")).trim()||null,is_required:true,sort_order:nextOrder,created_by:session!.user.id});
    setStatus(error?error.message:"Pflichtgegenstand hinzugefügt. Du kannst ihn unten frei verschieben.");
    if(!error){form.reset();await load()}
  }

  async function removeItem(id:string){
    if(!confirm("Pflichtgegenstand wirklich löschen? Er verschwindet bei allen Teilnehmern."))return;
    const {error}=await supabase.from("packing_items").delete().eq("id",id);
    setStatus(error?error.message:"Pflichtgegenstand gelöscht.");
    if(!error)await load();
  }

  async function reminder(){
    setBusy(true);
    try{await push("Pack-Reminder ⏰","Denkt daran, eure Pflicht-Packliste und persönlichen Ergänzungen zu prüfen.");setStatus("Erinnerungs-Push wurde versendet.")}
    catch(error){setStatus(error instanceof Error?error.message:"Fehler")}
    setBusy(false);
  }

  async function dropItem(targetId:string){
    if(!dragging||dragging===targetId)return;
    const from=items.findIndex(item=>item.id===dragging);
    const to=items.findIndex(item=>item.id===targetId);
    if(from<0||to<0)return;
    const next=[...items];
    const [moved]=next.splice(from,1);
    next.splice(to,0,moved);
    const ordered=next.map((item,index)=>({...item,sort_order:index}));
    setDragging(null);setItems(ordered);
    const updates=await Promise.all(ordered.map(item=>supabase.from("packing_items").update({sort_order:item.sort_order,is_required:true,category_id:null}).eq("id",item.id)));
    const error=updates.find(result=>result.error)?.error;
    setStatus(error?error.message:"Reihenfolge gespeichert.");
    if(error)await load();
  }

  return <AuthGate admin><Shell>
    <div className="page-heading"><span className="eyebrow">VORBEREITUNG</span><h1>Pflicht-Packliste verwalten</h1><p>Alle hier eingetragenen Gegenstände gelten automatisch für jeden Teilnehmer als Pflicht. Kategorien gibt es nicht mehr.</p></div>
    {status&&<div className="status">{status}</div>}
    <div className="packing-admin-grid">
      <form className="admin-card packing-settings-card" onSubmit={saveSettings}><div className="admin-card-heading"><div>{settings.is_visible?<Eye/>:<EyeOff/>}<h2>Sichtbarkeit & Push</h2></div></div><input name="title" defaultValue={settings.title} placeholder="Titel der Packliste" required/><textarea name="intro" defaultValue={settings.intro||""} placeholder="Kurzer Hinweis für die Teilnehmer"/><label className="check-row"><input name="is_visible" type="checkbox" defaultChecked={settings.is_visible}/> Packliste für alle sichtbar</label><label className="check-row"><input name="send_push" type="checkbox"/> Beim erstmaligen Freischalten Push senden</label><button className="primary-button" disabled={busy}>{settings.is_visible?<><Eye/>Speichern</>:<><EyeOff/>Geheim speichern</>}</button><button type="button" className="secondary-button" onClick={reminder} disabled={busy}><BellRing/>Pack-Erinnerung senden</button></form>

      <form className="admin-card" onSubmit={addItem}><PackagePlus/><h2>Pflichtgegenstand hinzufügen</h2><p>Dieser Eintrag erscheint automatisch bei allen Teilnehmern und kann dort nur abgehakt werden.</p><input name="title" placeholder="z. B. Zahnbürste" required/><textarea name="description" placeholder="Zusatzhinweis (optional)"/><button className="primary-button"><PackagePlus/>Pflichtgegenstand speichern</button></form>

      <section className="admin-card admin-wide packing-sort-section"><h2>Aktuelle Pflicht-Packliste</h2><div className="packing-sort-hint"><GripVertical/><span>Gegenstände am Griff gedrückt halten und per Drag & Drop frei sortieren.</span></div><div className="packing-sort-items standalone">{items.map(item=><div className={`packing-sort-item ${dragging===item.id?"dragging":""}`} key={item.id} draggable onDragStart={()=>setDragging(item.id)} onDragEnd={()=>setDragging(null)} onDragOver={event=>event.preventDefault()} onDrop={()=>dropItem(item.id)}><button type="button" className="packing-drag-handle" aria-label={`${item.title} verschieben`}><GripVertical/></button><div><strong>{item.title}<em className="required-pill">Pflicht</em></strong><small>{item.description||"Ohne Zusatzhinweis"}</small></div><button type="button" className="icon-button danger-icon" onClick={()=>removeItem(item.id)} title="Pflichtgegenstand löschen"><Trash2/></button></div>)}</div>{!items.length&&<div className="empty-card">Noch keine Pflichtgegenstände eingetragen.</div>}</section>
    </div>
  </Shell></AuthGate>;
}
