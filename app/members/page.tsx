"use client";
import { useCallback,useEffect,useState } from "react";
import { createPortal } from "react-dom";
import { Award,Home,Info,MapPinned,Navigation,Phone,Shirt,Trash2,X } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import styles from "./member-stamps.module.css";

type PrivateDetails={user_id:string;clothing_size:string|null;home_address:string|null;street:string|null;postal_code:string|null;city:string|null};
type MemberStamp={user_id:string;label:string;updated_at:string};

const stampPresets=["🌱 Neu-Bachelor","👑 König","🔥 Legende","🍻 Bierminister","🏆 Tour-Legende"];

export default function MembersPage(){
 const {profile,session}=useApp();
 const [members,setMembers]=useState<Profile[]>([]);
 const [details,setDetails]=useState<Record<string,PrivateDetails>>({});
 const [stamps,setStamps]=useState<Record<string,MemberStamp>>({});
 const [selected,setSelected]=useState<Profile|null>(null);
 const [stampDraft,setStampDraft]=useState("");
 const [stampBusy,setStampBusy]=useState(false);
 const [mounted,setMounted]=useState(false);
 const [q,setQ]=useState("");
 const [status,setStatus]=useState("");
 const supabase=createClient();

 useEffect(()=>setMounted(true),[]);
 useEffect(()=>{
   if(!selected)return;
   setStampDraft(stamps[selected.id]?.label||"");
   const previousOverflow=document.body.style.overflow;
   const previousOverscroll=document.body.style.overscrollBehavior;
   document.body.style.overflow="hidden";
   document.body.style.overscrollBehavior="none";
   const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setSelected(null)};
   window.addEventListener("keydown",close);
   return()=>{
     document.body.style.overflow=previousOverflow;
     document.body.style.overscrollBehavior=previousOverscroll;
     window.removeEventListener("keydown",close);
   };
 },[selected,stamps]);

 const load=useCallback(async()=>{
   const [{data:memberData},{data:stampData}]=await Promise.all([
     supabase.from("profiles").select("*").order("name"),
     supabase.from("member_stamps").select("user_id,label,updated_at")
   ]);
   setMembers(memberData??[]);
   setStamps(Object.fromEntries(((stampData??[]) as MemberStamp[]).map(item=>[item.user_id,item])));
   if(profile?.is_admin){
     const {data:d}=await supabase.from("member_private_details").select("user_id,clothing_size,home_address,street,postal_code,city");
     setDetails(Object.fromEntries((d??[]).map(i=>[i.user_id,i])));
   }
 },[supabase,profile?.is_admin]);

 useEffect(()=>{
   load();
   const c=supabase.channel("members-status-stamps-live")
     .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles"},load)
     .on("postgres_changes",{event:"*",schema:"public",table:"member_stamps"},load)
     .subscribe();
   return()=>{supabase.removeChannel(c)};
 },[load,supabase]);

 async function remove(m:Profile){
   if(!profile?.is_admin||m.id===profile.id||!confirm(`${m.name} wirklich vollständig löschen?`))return;
   const r=await fetch("/api/admin/users",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token}`},body:JSON.stringify({userId:m.id})});
   const j=await r.json();setStatus(r.ok?`${m.name} wurde gelöscht.`:j.error);if(r.ok)await load();
 }

 async function saveStamp(){
   if(!profile?.is_admin||!selected||stampBusy)return;
   const label=stampDraft.trim();
   if(!label){await clearStamp();return}
   setStampBusy(true);
   const {error}=await supabase.from("member_stamps").upsert({user_id:selected.id,label,updated_by:profile.id,updated_at:new Date().toISOString()},{onConflict:"user_id"});
   setStatus(error?error.message:`Stempel „${label}“ für ${selected.name} gespeichert.`);
   if(!error)await load();
   setStampBusy(false);
 }

 async function clearStamp(){
   if(!profile?.is_admin||!selected||stampBusy)return;
   setStampBusy(true);
   const {error}=await supabase.from("member_stamps").delete().eq("user_id",selected.id);
   setStatus(error?error.message:`Stempel von ${selected.name} entfernt.`);
   if(!error){setStampDraft("");await load()}
   setStampBusy(false);
 }

 const d=selected?details[selected.id]:null;
 const address=d?[d.street,d.postal_code&&d.city?`${d.postal_code} ${d.city}`:d.postal_code||d.city].filter(Boolean).join("\n")||d.home_address||"Nicht hinterlegt":"";
 const modal=profile?.is_admin&&selected?(
   <div className="member-detail-backdrop" role="dialog" aria-modal="true" aria-label={`Admin-Informationen zu ${selected.name}`} onClick={()=>setSelected(null)}>
     <section className="member-detail-dialog premium" onClick={e=>e.stopPropagation()}>
       <button className="member-detail-close" onClick={()=>setSelected(null)} aria-label="Schließen"><X/></button>
       <div className="member-detail-hero">
         <div className="avatar xl">{selected.avatar_url?<img src={selected.avatar_url} alt=""/>:<span>{selected.name[0]}</span>}</div>
         <span className="eyebrow">ADMIN-INFORMATIONEN</span>
         <h2>{selected.name}</h2>
         <div className={styles.heroBadges}>{selected.is_admin&&<em className="admin-pill">Admin</em>}{stamps[selected.id]&&<span className={styles.memberStamp}>{stamps[selected.id].label}</span>}</div>
       </div>
       <div className={styles.stampEditor}>
         <div className={styles.stampEditorTitle}><Award/><div><span className="eyebrow">STEMPEL</span><h3>Mitglieder-Stempel vergeben</h3></div></div>
         <p>Nur Admins können diesen Stempel ändern. Sichtbar ist er für alle Mitglieder direkt beim Namen.</p>
         <div className={styles.presetGrid}>{stampPresets.map(preset=><button type="button" key={preset} className={stampDraft===preset?styles.presetActive:""} onClick={()=>setStampDraft(preset)}>{preset}</button>)}</div>
         <input value={stampDraft} onChange={e=>setStampDraft(e.target.value)} maxLength={40} placeholder="z. B. 👑 König"/>
         <div className={styles.stampActions}><button type="button" className="primary-button" disabled={stampBusy||!stampDraft.trim()} onClick={saveStamp}>{stampBusy?"Speichert …":"Stempel speichern"}</button>{stamps[selected.id]&&<button type="button" className={styles.clearStamp} disabled={stampBusy} onClick={clearStamp}><Trash2/>Stempel entfernen</button>}</div>
       </div>
       <div className="member-private-list">
         <div><Phone/><span><small>Telefon</small><strong>{selected.phone||"Nicht hinterlegt"}</strong></span></div>
         <div><Shirt/><span><small>Kleidergröße</small><strong>{d?.clothing_size||"Nicht hinterlegt"}</strong></span></div>
         <div><Home/><span><small>Wohnanschrift</small><strong>{address}</strong></span></div>
       </div>
       <div className="member-detail-actions">
         {selected.phone&&<a href={`tel:${selected.phone}`}><Phone/>Anrufen</a>}
         {address&&address!=="Nicht hinterlegt"&&<a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.replace("\n",", "))}`}><Navigation/>Navigieren</a>}
       </div>
     </section>
   </div>
 ):null;

 return <AuthGate><Shell>
   <div className="page-heading"><h1>Mitglieder</h1><p>{members.length} Bachelor auf Tour.</p></div>
   {status&&<div className="status">{status}</div>}
   <input className="search" placeholder="Mitglied suchen …" value={q} onChange={e=>setQ(e.target.value)}/>
   <div className="member-list">{members.filter(m=>m.name.toLowerCase().includes(q.toLowerCase())).map(m=><article className="member-card" key={m.id}>
     <div className="avatar large">{m.avatar_url?<img src={m.avatar_url} alt=""/>:<span>{m.name[0]}</span>}</div>
     <div className="member-info"><h3 className={styles.memberName}>{m.name}{m.is_admin&&<em>Admin</em>}{stamps[m.id]&&<span className={styles.memberStamp}>{stamps[m.id].label}</span>}</h3><p>{m.share_location?"Standort aktiv":"Standort verborgen"}</p>{m.participant_status&&<span className={`participant-status status-${statusSlug(m.participant_status)}`}>{m.participant_status}</span>}</div>
     {profile?.is_admin&&<button className="icon-button member-info-button" onClick={()=>setSelected(m)} title="Mitglied verwalten"><Info/></button>}
     {m.phone&&<a className="icon-button" href={`tel:${m.phone}`}><Phone/></a>}
     {m.latitude&&m.longitude&&<a className="icon-button" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${m.latitude},${m.longitude}`}><MapPinned/></a>}
     {profile?.is_admin&&m.id!==profile.id&&<button className="icon-button danger-icon" onClick={()=>remove(m)}><Trash2/></button>}
   </article>)}</div>
   {mounted&&modal?createPortal(modal,document.body):null}
 </Shell></AuthGate>;
}

function statusSlug(v:string){return v.toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g,"-")}
