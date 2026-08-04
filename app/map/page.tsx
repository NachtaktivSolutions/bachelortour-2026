"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { createClient } from "@/lib/supabase/client";
import type { MapPin, Profile } from "@/lib/types";

const MapView = dynamic(() => import("@/components/map-view").then(m => m.MapView), { ssr: false });

export default function MapPage() {
  const [pins,setPins]=useState<MapPin[]>([]);
  const [members,setMembers]=useState<Profile[]>([]);
  const supabase=createClient();
  useEffect(()=>{
    Promise.all([
      supabase.from("map_pins").select("*"),
      supabase.from("profiles").select("*").eq("share_location", true)
    ]).then(([p,m])=>{setPins(p.data??[]);setMembers(m.data??[])});
    const channel=supabase.channel("locations").on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles"},()=> {
      supabase.from("profiles").select("*").eq("share_location",true).then(({data})=>setMembers(data??[]));
    }).subscribe();
    return()=>{supabase.removeChannel(channel)}
  },[]);
  return <AuthGate><Shell><div className="page-heading"><h1>Karte</h1><p>Treffpunkte und freigegebene Live-Standorte.</p></div><MapView pins={pins} members={members}/></Shell></AuthGate>;
}
