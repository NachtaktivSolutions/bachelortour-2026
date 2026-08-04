"use client";
import { useCallback,useEffect,useState } from "react";
import { Phone, MapPinned, Trash2 } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export default function MembersPage(){
  const {profile,session}=useApp();
  const [members,setMembers]=useState<Profile[]>([]);const [q,setQ]=useState("");const [status,setStatus]=useState("");const supabase=createClient();
  const load=useCallback(()=>{supabase.from("profiles").select("*").order("name").then(({data})=>setMembers(data??[]))},[supabase]);
  useEffect(()=>{load();const channel=supabase.channel("members-status-live").on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles"},load).subscribe();return()=>{supabase.removeChannel(channel)}},[load,supabase]);
  async function remove(member:Profile){if(!profile?.is_admin||member.id===profile.id||!confirm(`${member.name} wirklich vollständig löschen?`))return;const res=await fetch("/api/admin/users",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session?.access_token}`},body:JSON.stringify({userId:member.id})});const json=await res.json();setStatus(res.ok?`${member.name} wurde gelöscht.`:json.error);if(res.ok)await load()}
  return <AuthGate><Shell><div className="page-heading"><h1>Mitglieder</h1><p>{members.length} Bachelor auf Tour.</p></div>{status&&<div className="status">{status}</div>}
    <input className="search" placeholder="Mitglied suchen …" value={q} onChange={e=>setQ(e.target.value)}/>
    <div className="member-list">{members.filter(m=>m.name.toLowerCase().includes(q.toLowerCase())).map(m=><article className="member-card" key={m.id}>
      <div className="avatar large">{m.avatar_url?<img src={m.avatar_url} alt=""/>:<span>{m.name[0]}</span>}</div>
      <div className="member-info"><h3>{m.name}{m.is_admin&&<em>Admin</em>}</h3><p>{m.share_location?"Standort aktiv":"Standort verborgen"}</p>{m.participant_status&&<span className={`participant-status status-${statusSlug(m.participant_status)}`}>{m.participant_status}</span>}</div>
      {m.phone&&<a className="icon-button" href={`tel:${m.phone}`}><Phone/></a>}
      {m.latitude&&m.longitude&&<a className="icon-button" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${m.latitude},${m.longitude}`}><MapPinned/></a>}
      {profile?.is_admin&&m.id!==profile.id&&<button className="icon-button danger-icon" onClick={()=>remove(m)} title="Benutzer löschen"><Trash2/></button>}
    </article>)}</div>
  </Shell></AuthGate>;
}

function statusSlug(value:string){return value.toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g,"-")}
