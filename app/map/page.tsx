"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { LocationSharing } from "@/components/location-sharing";
import { createClient } from "@/lib/supabase/client";
import type { MapPin, Profile, ProgramItem } from "@/lib/types";

const MapView = dynamic(() => import("@/components/map-view").then(m => m.MapView), { ssr: false, loading:()=> <div className="empty-card">Karte wird vorbereitet …</div> });

export default function MapPage() {
  const [pins,setPins]=useState<MapPin[]>([]);
  const [programItems,setProgramItems]=useState<ProgramItem[]>([]);
  const [members,setMembers]=useState<Profile[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [fitRequest,setFitRequest]=useState(0);
  const supabase=useMemo(()=>createClient(),[]);
  const loadingRef=useRef(false);
  const lastLoadRef=useRef(0);

  const load = useCallback(async (force=false) => {
    if (document.visibilityState !== "visible" || loadingRef.current) return;
    if(!force&&Date.now()-lastLoadRef.current<5000)return;
    loadingRef.current=true;
    try{
      const now=new Date().toISOString();
      const [pinResult, programResult, memberResult] = await Promise.all([
        supabase.from("map_pins").select("id,title,description,address,latitude,longitude,starts_at,ends_at,created_at").or("ends_at.is.null,ends_at.gte."+now).order("starts_at"),
        supabase.from("program_items").select("id,title,description,address,starts_at,ends_at,latitude,longitude,marker_type,is_visible,created_at").eq("is_visible",true).or("ends_at.is.null,ends_at.gte."+now).order("starts_at"),
        supabase.from("profiles").select("id,name,phone,avatar_url,latitude,longitude,location_updated_at,participant_status,status_updated_at,share_location").eq("share_location", true)
      ]);
      const firstError = pinResult.error || programResult.error || memberResult.error;
      setError(firstError?.message ?? "");
      setPins((pinResult.data as unknown as MapPin[]) ?? []);
      setProgramItems((programResult.data as unknown as ProgramItem[]) ?? []);
      setMembers((memberResult.data as unknown as Profile[]) ?? []);
      lastLoadRef.current=Date.now();
      setLoading(false);
    }finally{loadingRef.current=false}
  }, [supabase]);

  useEffect(() => {
    load(true);
    const channel=supabase.channel("live-map-v44")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"profiles"},()=>load(true))
      .on("postgres_changes",{event:"*",schema:"public",table:"map_pins"},()=>load(true))
      .on("postgres_changes",{event:"*",schema:"public",table:"program_items"},()=>load(true)).subscribe();
    const timer=window.setInterval(()=>load(),15000);
    const onVisible=()=>{if(document.visibilityState==="visible"&&Date.now()-lastLoadRef.current>10000)load(true)};
    document.addEventListener("visibilitychange",onVisible);
    window.addEventListener("focus",onVisible);
    return()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible);window.removeEventListener("focus",onVisible);supabase.removeChannel(channel)};
  },[load,supabase]);

  async function refreshAndFit(){await load(true);setFitRequest(v=>v+1)}

  return <AuthGate><Shell>
    <div className="page-heading map-page-heading"><span className="eyebrow">WO SIND DIE JUNGS?</span><h1>Live-Karte</h1><p>Die Positionen aktualisieren sich automatisch. Zoom und Kartenausschnitt bleiben erhalten.</p></div>
    <div className="map-toolbar"><LocationSharing/><button className="secondary-button map-refresh" onClick={refreshAndFit}><RefreshCw/>Alle anzeigen</button></div>
    {error&&<div className="error">{error}</div>}
    <div className="map-stage">{loading?<div className="empty-card">Karte wird geladen …</div>:<MapView pins={pins} programItems={programItems} members={members} fitRequest={fitRequest}/>}</div>
  </Shell></AuthGate>;
}
