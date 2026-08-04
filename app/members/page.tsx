"use client";
import { useEffect,useState } from "react";
import { Phone, MapPinned } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export default function MembersPage(){
  const [members,setMembers]=useState<Profile[]>([]); const [q,setQ]=useState(""); const supabase=createClient();
  useEffect(()=>{supabase.from("profiles").select("*").order("name").then(({data})=>setMembers(data??[]))},[]);
  return <AuthGate><Shell><div className="page-heading"><h1>Mitglieder</h1><p>{members.length} Jungs auf Tour.</p></div>
    <input className="search" placeholder="Mitglied suchen …" value={q} onChange={e=>setQ(e.target.value)}/>
    <div className="member-list">{members.filter(m=>m.name.toLowerCase().includes(q.toLowerCase())).map(m=><article className="member-card" key={m.id}>
      <div className="avatar large">{m.avatar_url?<img src={m.avatar_url} alt=""/>:<span>{m.name[0]}</span>}</div>
      <div className="member-info"><h3>{m.name}{m.is_admin&&<em>Admin</em>}</h3><p>{m.share_location?"Standort aktiv":"Standort verborgen"}</p></div>
      {m.phone&&<a className="icon-button" href={`tel:${m.phone}`}><Phone/></a>}
      {m.latitude&&m.longitude&&<a className="icon-button" target="_blank" href={`https://www.google.com/maps/dir/?api=1&destination=${m.latitude},${m.longitude}`}><MapPinned/></a>}
    </article>)}</div>
  </Shell></AuthGate>;
}
