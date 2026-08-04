"use client";
import { useEffect,useState } from "react";
import { CalendarDays, Navigation } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { createClient } from "@/lib/supabase/client";
import type { ProgramItem } from "@/lib/types";

export default function ProgramPage(){
  const [items,setItems]=useState<ProgramItem[]>([]); const supabase=createClient();
  useEffect(()=>{supabase.from("program_items").select("*").order("starts_at").then(({data})=>setItems(data??[]))},[]);
  const groups=items.reduce<Record<string,ProgramItem[]>>((acc,item)=>{
    const key=new Date(item.starts_at).toLocaleDateString("de-DE",{weekday:"long",day:"2-digit",month:"long"});
    (acc[key]??=[]).push(item);return acc;
  },{});
  return <AuthGate><Shell><div className="page-heading"><span className="eyebrow">DER PLAN</span><h1>Programm</h1><p>Alle Zeiten und Treffpunkte auf einen Blick.</p></div>
    {Object.entries(groups).map(([day,dayItems])=><section className="program-day" key={day}><h2><CalendarDays/>{day}</h2>{dayItems.map(item=><article className="program-item" key={item.id}>
      <div className="program-time">{new Date(item.starts_at).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}</div>
      <div><h3>{item.title}</h3><p>{item.description}</p><small>{item.address}</small></div>
      {item.address&&<a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address)}`} target="_blank"><Navigation/></a>}
    </article>)}</section>)}
  </Shell></AuthGate>
}
