"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronRight, RefreshCw } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { LocationSharing } from "@/components/location-sharing";
import { useApp } from "@/components/app-provider";
import { createClient } from "@/lib/supabase/client";
import type { MapPin, Profile, ProgramItem } from "@/lib/types";

const MapView = dynamic(() => import("@/components/map-view").then(m => m.MapView), { ssr: false });

export default function MapPage() {
  const {profile,session,refreshProfile}=useApp();
  const [pins,setPins]=useState<MapPin[]>([]);
  const [programItems,setProgramItems]=useState<ProgramItem[]>([]);
  const [members,setMembers]=useState<Profile[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [helpBusy,setHelpBusy]=useState(false);
  const [helpStatus,setHelpStatus]=useState("");
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
    setPins(pinResult.data ?? []);setProgramItems(programResult.data ?? []);setMembers(memberResult.data ?? []);setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel=supabase.channel("live-map-v27")
      .on("postgres_changes",{event:"*",schema:"public",table:"profiles"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"map_pins"},load)
      .on("postgres_changes",{event:"*",schema:"public",table:"program_items"},load).subscribe();
    const timer=window.setInterval(load,10_000);
    const onVisible=()=>{if(document.visibilityState==="visible")load()};
    document.addEventListener("visibilitychange",onVisible);window.addEventListener("focus",load);
    return()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible);window.removeEventListener("focus",load);supabase.removeChannel(channel)};
  },[load,supabase]);

  async function sendHelp(){
    if(!profile||!session||helpBusy)return;
    if(!confirm("Wirklich einen Hilferuf an alle senden? Dein aktueller Standort wird geteilt."))return;
    setHelpBusy(true);setHelpStatus("Standort wird ermittelt …");
    try{
      const position=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
      const now=new Date().toISOString();
      const {error:updateError}=await supabase.from("profiles").update({latitude:position.coords.latitude,longitude:position.coords.longitude,location_updated_at:now,share_location:true,participant_status:"brauche Hilfe",status_updated_at:now}).eq("id",profile.id);
      if(updateError)throw updateError;
      const response=await fetch("/api/help-alert",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({latitude:position.coords.latitude,longitude:position.coords.longitude})});
      const json=await response.json();if(!response.ok)throw new Error(json.error||"Hilferuf konnte nicht gesendet werden.");
      setHelpStatus("Hilferuf wurde an alle gesendet.");await refreshProfile();await load();
    }catch(err){setHelpStatus(err instanceof Error?err.message:"Standort konnte nicht ermittelt werden.")}finally{setHelpBusy(false)}
  }

  return <AuthGate><Shell>
    <div className="page-heading map-page-heading"><span className="eyebrow">WO SIND DIE JUNGS?</span><h1>Live-Karte</h1><p>Aktive Standorte werden alle 10 Sekunden aktualisiert. Ältere Positionen werden als nicht aktuell markiert.</p></div>
    <div className="map-toolbar"><LocationSharing/><button className="secondary-button map-refresh" onClick={load}><RefreshCw/>Aktualisieren</button></div>
    {error&&<div className="error">{error}</div>}
    {helpStatus&&<div className={`map-help-status ${helpStatus.includes("gesendet")?"success":""}`}>{helpStatus}</div>}
    <div className="map-stage">{loading?<div className="empty-card">Karte wird geladen …</div>:<MapView pins={pins} programItems={programItems} members={members}/>}</div>
    <button className="map-emergency-banner" onClick={sendHelp} disabled={helpBusy}><span className="map-emergency-icon"><AlertTriangle/></span><span><strong>{helpBusy?"Hilferuf wird gesendet …":"HILFE AN ALLE SENDEN"}</strong><small>Dein Standort wird geteilt und alle werden benachrichtigt.</small></span><ChevronRight/></button>
  </Shell></AuthGate>;
}
