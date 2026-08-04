"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { LocationSharing } from "@/components/location-sharing";
import { createClient } from "@/lib/supabase/client";
import type { MapPin, Profile, ProgramItem } from "@/lib/types";

const MapView = dynamic(() => import("@/components/map-view").then(m => m.MapView), { ssr: false });

export default function MapPage() {
  const [pins,setPins]=useState<MapPin[]>([]);
  const [programItems,setProgramItems]=useState<ProgramItem[]>([]);
  const [members,setMembers]=useState<Profile[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [fitRequest,setFitRequest]=useState(0);
  const supabase=createClient();

  const load = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const now=new Date().toISOString();
    const [pinResult, programResult, memberResult] = await Promise.all([
      supabase.from("map_pins").select("*").or("ends_at.is.null,ends_at.gte."+now).order("starts_at"),
      supabase.from("program_items").select("*").eq("is_visible",true).or("ends_at.is.null,ends_at.gte."+now).order("starts_at"),
      supabase.from("profiles").select("*").eq("share_location", true)
    ]);
    const firstError = pinResult.error || programResult.error || memberResult.error;
    setError(firstError?.message ?? "");
    setPins(pinResult.data ?? []);
    setProgramItems(programResult.data ?? []);
    setMembers(memberResult.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel=supabase.channel("live-map-v33")
      .on("postgres_changes",{event:"*",schema:"public",table:"profiles"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"map_pins"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"program_items"},load).subscribe();
    const timer=window.setInterval(load,10000);
    const onVisible=()=>{if(document.visibilityState==="visible")load()};
    document.addEventListener("visibilitychange",onVisible);
    window.addEventListener("focus",load);
    return()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible);window.removeEventListener("focus",load);supabase.removeChannel(channel)};
  },[load,supabase]);

  async function refreshAndFit(){await load();setFitRequest(v=>v+1)}

  return <AuthGate><Shell>
    <div className="page-heading map-page-heading"><span className="eyebrow">WO SIND DIE JUNGS?</span><h1>Live-Karte</h1><p>Die Positionen aktualisieren sich alle 10 Sekunden. Zoom und Kartenausschnitt bleiben erhalten.</p></div>
    <div className="map-toolbar"><LocationSharing/><button className="secondary-button map-refresh" onClick={refreshAndFit}><RefreshCw/>Alle anzeigen</button></div>
    {error&&<div className="error">{error}</div>}
    <div className="map-stage">{loading?<div className="empty-card">Karte wird geladen …</div>:<MapView pins={pins} programItems={programItems} members={members} fitRequest={fitRequest}/>}</div>
  </Shell></AuthGate>;
}
