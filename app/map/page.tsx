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
  const supabase=createClient();

  const load = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    setError("");
    const [pinResult, programResult, memberResult] = await Promise.all([
      supabase.from("map_pins").select("*").or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`).order("starts_at"),
      supabase.from("program_items").select("*").or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`).order("starts_at"),
      supabase.from("profiles").select("*").eq("share_location", true)
    ]);

    const firstError = pinResult.error || programResult.error || memberResult.error;
    if (firstError) setError(firstError.message);
    setPins(pinResult.data ?? []);
    setProgramItems(programResult.data ?? []);
    setMembers(memberResult.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel=supabase.channel("live-map-v22")
      .on("postgres_changes",{event:"*",schema:"public",table:"profiles"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"map_pins"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"program_items"},load)
      .subscribe();

    const timer=window.setInterval(load,10_000);
    const onVisible=()=>{if(document.visibilityState==="visible")load()};
    document.addEventListener("visibilitychange",onVisible);
    window.addEventListener("focus",load);
    return()=>{
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange",onVisible);
      window.removeEventListener("focus",load);
      supabase.removeChannel(channel);
    };
  },[load,supabase]);

  return <AuthGate><Shell>
    <div className="page-heading"><span className="eyebrow">WO SIND DIE JUNGS?</span><h1>Live-Karte</h1><p>Aktive Standorte werden alle 10 Sekunden aktualisiert. Ältere Positionen werden als nicht aktuell markiert.</p></div>
    <div className="map-toolbar"><LocationSharing/><button className="secondary-button map-refresh" onClick={load}><RefreshCw/>Aktualisieren</button></div>
    {error&&<div className="error">{error}</div>}
    {loading?<div className="empty-card">Karte wird geladen …</div>:<MapView pins={pins} programItems={programItems} members={members}/>}
    <div className="map-legend"><span>🔥 Treffpunkt</span><span>📍 Du</span><span>👤 Mitglied</span><span>⚪ älter als 30 Min.</span></div>
  </Shell></AuthGate>;
}
