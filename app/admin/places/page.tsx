"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Building2, Eye, EyeOff, Info, Navigation, Pencil, Plus, Trash2, X } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/components/app-provider";

type Hotel = { id:string; name:string; address:string; description:string|null; latitude:number|null; longitude:number|null; is_visible:boolean; sort_order:number };
type Knowledge = { id:string; category:string; title:string; description:string|null; address:string|null; phone:string|null; url:string|null; latitude:number|null; longitude:number|null; is_visible:boolean; sort_order:number };

export default function PlacesAdminPage(){
  const { session } = useApp();
  const supabase = createClient();
  const [hotels,setHotels]=useState<Hotel[]>([]);
  const [knowledge,setKnowledge]=useState<Knowledge[]>([]);
  const [editingHotel,setEditingHotel]=useState<Hotel|null>(null);
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);

  const load=useCallback(async()=>{
    const [h,k]=await Promise.all([
      supabase.from("hotels").select("*").order("sort_order").order("created_at"),
      supabase.from("knowledge_items").select("*").order("sort_order").order("created_at")
    ]);
    setHotels(h.data??[]);setKnowledge(k.data??[]);
  },[supabase]);
  useEffect(()=>{load()},[load]);

  async function geocode(address:string){
    const response=await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
    const json=await response.json();
    if(!response.ok)throw new Error(json.error||"Adresse nicht gefunden.");
    return json as {latitude:number;longitude:number;display_name:string};
  }

  async function addHotel(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const form=e.currentTarget;const f=new FormData(form);setBusy(true);setStatus("");
    try{
      const address=String(f.get("address")).trim();const coords=await geocode(address);
      const {error}=await supabase.from("hotels").insert({name:String(f.get("name")).trim(),address,description:String(f.get("description")).trim()||null,latitude:coords.latitude,longitude:coords.longitude,is_visible:f.get("is_visible")==="on",created_by:session!.user.id});
      if(error)throw error;form.reset();setStatus("Hotel gespeichert.");await load();
    }catch(error){setStatus(error instanceof Error?error.message:"Fehler beim Speichern.")}
    finally{setBusy(false)}
  }

  async function saveHotel(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!editingHotel)return;const f=new FormData(e.currentTarget);setBusy(true);setStatus("");
    try{
      const address=String(f.get("address")).trim();
      let latitude=editingHotel.latitude,longitude=editingHotel.longitude;
      if(address!==editingHotel.address||latitude==null||longitude==null){const coords=await geocode(address);latitude=coords.latitude;longitude=coords.longitude}
      const {error}=await supabase.from("hotels").update({name:String(f.get("name")).trim(),address,description:String(f.get("description")).trim()||null,latitude,longitude,is_visible:f.get("is_visible")==="on",updated_at:new Date().toISOString()}).eq("id",editingHotel.id);
      if(error)throw error;setEditingHotel(null);setStatus("Hotel aktualisiert.");await load();
    }catch(error){setStatus(error instanceof Error?error.message:"Hotel konnte nicht aktualisiert werden.")}
    finally{setBusy(false)}
  }

  async function addKnowledge(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const form=e.currentTarget;const f=new FormData(form);setBusy(true);setStatus("");
    try{
      const address=String(f.get("address")).trim();let coords:{latitude:number;longitude:number}|null=null;if(address)coords=await geocode(address);
      const {error}=await supabase.from("knowledge_items").insert({category:String(f.get("category")).trim()||"Allgemein",title:String(f.get("title")).trim(),description:String(f.get("description")).trim()||null,address:address||null,phone:String(f.get("phone")).trim()||null,url:String(f.get("url")).trim()||null,latitude:coords?.latitude??null,longitude:coords?.longitude??null,is_visible:f.get("is_visible")==="on",created_by:session!.user.id});
      if(error)throw error;form.reset();setStatus("Wissenswertes gespeichert.");await load();
    }catch(error){setStatus(error instanceof Error?error.message:"Fehler beim Speichern.")}
    finally{setBusy(false)}
  }

  async function toggle(table:"hotels"|"knowledge_items",id:string,current:boolean){const {error}=await supabase.from(table).update({is_visible:!current,updated_at:new Date().toISOString()}).eq("id",id);setStatus(error?error.message:(!current?"Inhalt ist jetzt sichtbar.":"Inhalt wurde verborgen."));await load()}
  async function remove(table:"hotels"|"knowledge_items",id:string,label:string){if(!confirm(`${label} wirklich löschen?`))return;const {error}=await supabase.from(table).delete().eq("id",id);setStatus(error?error.message:`${label} gelöscht.`);await load()}

  return <AuthGate admin><Shell>
    <div className="page-heading"><span className="eyebrow">GEHEIME ORTE</span><h1>Hotels & Wissenswertes</h1><p>Hier verwaltest du ausschließlich Hotels und hilfreiche Informationen. Programmpunkte werden nur unter „Programm verwalten“ angelegt und bearbeitet.</p></div>
    {status&&<div className="status">{status}</div>}
    <div className="admin-grid secret-admin-grid">
      <form className="admin-card" onSubmit={addHotel}><Building2/><h2>Hotel anlegen</h2><input name="name" placeholder="Hotelname" required/><input name="address" placeholder="Vollständige Adresse" required/><textarea name="description" placeholder="Hinweise, Check-in, Zimmer …"/><label className="check-row"><input name="is_visible" type="checkbox"/> Sofort sichtbar schalten</label><button className="primary-button" disabled={busy}><Plus/>Hotel speichern</button></form>
      <form className="admin-card" onSubmit={addKnowledge}><Info/><h2>Wissenswertes anlegen</h2><input name="category" placeholder="Kategorie, z. B. Nachtclub, Taxi, Essen"/><input name="title" placeholder="Name / Titel" required/><textarea name="description" placeholder="Beschreibung und Hinweise"/><input name="address" placeholder="Adresse (optional)"/><input name="phone" placeholder="Telefonnummer (optional)"/><input name="url" placeholder="Webseite oder Link (optional)"/><label className="check-row"><input name="is_visible" type="checkbox"/> Sofort sichtbar schalten</label><button className="primary-button" disabled={busy}><Plus/>Information speichern</button></form>

      <section className="admin-card admin-wide places-manage-card">
        <div className="places-section-head"><div><Building2/><div><span className="eyebrow">UNTERKÜNFTE</span><h2>Hotels verwalten</h2></div></div><span className="places-count">{hotels.length}</span></div>
        <div className="places-list">{hotels.map(item=><article className="place-manage-item" key={item.id}><div className="place-copy"><div className="place-title-row"><strong>{item.name}</strong><span className={`visibility-pill ${item.is_visible?"is-on":"is-off"}`}>{item.is_visible?"Sichtbar":"Versteckt"}</span></div><small>{item.address}</small>{item.description&&<p>{item.description}</p>}</div><div className="place-actions"><button className="place-action" title="Bearbeiten" aria-label={`${item.name} bearbeiten`} onClick={()=>setEditingHotel(item)}><Pencil/><span>Bearbeiten</span></button><button className="place-action" title={item.is_visible?"Verbergen":"Sichtbar schalten"} aria-label={item.is_visible?`${item.name} verbergen`:`${item.name} sichtbar schalten`} onClick={()=>toggle("hotels",item.id,item.is_visible)}>{item.is_visible?<EyeOff/>:<Eye/>}<span>{item.is_visible?"Verbergen":"Sichtbar"}</span></button><a className="place-action" title="Navigation" aria-label={`Zu ${item.name} navigieren`} target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address)}`}><Navigation/><span>Navigation</span></a><button className="place-action place-action-danger" title="Löschen" aria-label={`${item.name} löschen`} onClick={()=>remove("hotels",item.id,"Hotel")}><Trash2/><span>Löschen</span></button></div></article>)}{!hotels.length&&<div className="places-empty"><Building2/><strong>Noch keine Hotels angelegt</strong><p>Lege oben das erste Hotel an.</p></div>}</div>
      </section>

      <section className="admin-card admin-wide places-manage-card">
        <div className="places-section-head"><div><Info/><div><span className="eyebrow">INFORMATIONEN</span><h2>Wissenswertes verwalten</h2></div></div><span className="places-count">{knowledge.length}</span></div>
        <div className="places-list">{knowledge.map(item=><article className="place-manage-item" key={item.id}><div className="place-copy"><div className="place-title-row"><strong>{item.title}</strong><span className={`visibility-pill ${item.is_visible?"is-on":"is-off"}`}>{item.is_visible?"Sichtbar":"Versteckt"}</span></div><small>{item.category}</small><p>{item.description||item.address||item.phone||item.url||"Ohne Zusatzangabe"}</p></div><div className="place-actions place-actions-two"><button className="place-action" onClick={()=>toggle("knowledge_items",item.id,item.is_visible)}>{item.is_visible?<EyeOff/>:<Eye/>}<span>{item.is_visible?"Verbergen":"Sichtbar"}</span></button><button className="place-action place-action-danger" onClick={()=>remove("knowledge_items",item.id,"Eintrag")}><Trash2/><span>Löschen</span></button></div></article>)}{!knowledge.length&&<div className="places-empty"><Info/><strong>Noch keine Informationen angelegt</strong><p>Ergänze oben beispielsweise Taxi, Essen oder Nachtleben.</p></div>}</div>
      </section>
    </div>

    {editingHotel&&<div className="admin-modal" onClick={()=>!busy&&setEditingHotel(null)}><form className="admin-modal-card" onClick={e=>e.stopPropagation()} onSubmit={saveHotel}><button type="button" className="modal-close" disabled={busy} onClick={()=>setEditingHotel(null)}><X/></button><span className="eyebrow">HOTEL BEARBEITEN</span><h2>{editingHotel.name}</h2><p className="hotel-edit-meta">Bei einer geänderten Adresse wird die Kartenposition automatisch neu ermittelt.</p><input name="name" defaultValue={editingHotel.name} placeholder="Hotelname" required/><input name="address" defaultValue={editingHotel.address} placeholder="Vollständige Adresse" required/><textarea className="hotel-edit-description" name="description" defaultValue={editingHotel.description||""} placeholder="Hinweise, Check-in, Zimmer …"/><label className="check-row"><input name="is_visible" type="checkbox" defaultChecked={editingHotel.is_visible}/> Für Teilnehmer sichtbar</label><button className="primary-button" disabled={busy}><Pencil/>{busy?"Wird gespeichert …":"Änderungen speichern"}</button></form></div>}
  </Shell></AuthGate>;
}
