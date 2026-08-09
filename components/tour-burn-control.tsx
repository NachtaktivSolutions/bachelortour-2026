"use client";

import { useCallback,useEffect,useMemo,useState } from "react";
import { Flame } from "lucide-react";
import { useApp } from "./app-provider";
import { createClient } from "@/lib/supabase/client";
import { TourBurn } from "./tour-burn";
import styles from "./tour-burn-control.module.css";

export function TourBurnControl(){
  const {profile,session}=useApp();
  const supabase=useMemo(()=>createClient(),[]);
  const[enabled,setEnabled]=useState(false);const[busy,setBusy]=useState(false);const[animating,setAnimating]=useState(false);const[status,setStatus]=useState("");
  const load=useCallback(async()=>{if(!session?.access_token)return;try{const r=await fetch("/api/tour-burn",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});const j=await r.json();if(r.ok)setEnabled(Boolean(j.enabled)&&!Boolean(j.burned))}catch{}},[session?.access_token]);
  useEffect(()=>{void load();const channel=supabase.channel("tour-burn-control").on("postgres_changes",{event:"UPDATE",schema:"public",table:"app_settings",filter:"id=eq.1"},()=>void load()).subscribe();return()=>{void supabase.removeChannel(channel)}},[load,supabase]);
  async function burn(){
    if(!session?.access_token||profile?.is_admin)return;
    if(!confirm("Willst du deine Tour wirklich verbrennen?"))return;
    setBusy(true);setStatus("");window.dispatchEvent(new Event("tour-burn-animation-start"));
    try{
      const r=await fetch("/api/tour-burn",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action:"burn"})});
      const j=await r.json();if(!r.ok)throw new Error(j.error||"Verbrennung fehlgeschlagen.");
      setAnimating(true);
    }catch(e){window.dispatchEvent(new Event("tour-burn-animation-end"));setStatus(e instanceof Error?e.message:"Verbrennung fehlgeschlagen.")}
    finally{setBusy(false)}
  }
  if(profile?.is_admin||!enabled)return null;
  return <>
    <section className={styles.burnSection}>
      <button className={styles.burnButton} disabled={busy} onClick={burn}><span className={styles.icon}><Flame/></span><span><small>FIRESTARTER FINAL</small><strong>Diese Tour verbrennen</strong><em>Einmal drücken. Deine Tour endet hier.</em></span></button>
      {status&&<p className={styles.status}>{status}</p>}
    </section>
    {animating&&<TourBurn mode="animation" onFinished={()=>{setAnimating(false);window.dispatchEvent(new Event("tour-burn-animation-end"));window.dispatchEvent(new Event("tour-burn-status-change"))}}/>}
  </>;
}
