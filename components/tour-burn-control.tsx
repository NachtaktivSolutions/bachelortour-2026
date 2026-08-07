"use client";

import Link from "next/link";
import { useCallback,useEffect,useMemo,useState } from "react";
import { Flame, ShieldCheck, Eye, RotateCcw } from "lucide-react";
import { useApp } from "./app-provider";
import { createClient } from "@/lib/supabase/client";
import { TourBurn } from "./tour-burn";
import styles from "./tour-burn-control.module.css";

export function TourBurnControl(){
  const {profile,session}=useApp();
  const supabase=useMemo(()=>createClient(),[]);
  const[enabled,setEnabled]=useState(false);const[burned,setBurned]=useState(false);const[busy,setBusy]=useState(false);const[animating,setAnimating]=useState(false);const[status,setStatus]=useState("");
  const load=useCallback(async()=>{const{data}=await supabase.from("app_settings").select("tour_burn_enabled,tour_burned").eq("id",1).maybeSingle();setEnabled(Boolean(data?.tour_burn_enabled));setBurned(Boolean(data?.tour_burned))},[supabase]);
  useEffect(()=>{void load();const channel=supabase.channel("tour-burn-control").on("postgres_changes",{event:"UPDATE",schema:"public",table:"app_settings",filter:"id=eq.1"},()=>void load()).subscribe();return()=>{void supabase.removeChannel(channel)}},[load,supabase]);
  async function action(action:string,extra:Record<string,unknown>={}){if(!session?.access_token)return;setBusy(true);setStatus("");try{const r=await fetch("/api/tour-burn",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action,...extra})});const j=await r.json();if(!r.ok)throw new Error(j.error||"Aktion fehlgeschlagen.");await load();return j}catch(e){setStatus(e instanceof Error?e.message:"Aktion fehlgeschlagen.");throw e}finally{setBusy(false)}}
  async function burn(){if(!confirm("Wirklich die gesamte Tour verbrennen? Danach haben normale Teilnehmer keinen Zugriff mehr auf die App."))return;window.dispatchEvent(new Event("tour-burn-animation-start"));try{await action("burn");setAnimating(true)}catch{window.dispatchEvent(new Event("tour-burn-animation-end"))}}
  if(burned&&profile?.is_admin)return <section className={styles.adminState}><div><ShieldCheck/><div><strong>Tour ist verbrannt</strong><span>Teilnehmer sehen nur noch den Firestarter-Abspann.</span></div></div><div className={styles.adminActions}><Link href="/admin/tour-burn-preview"><Eye/>Vorschau</Link><button disabled={busy} onClick={()=>void action("reset")}><RotateCcw/>Tour wiederherstellen</button></div>{status&&<p>{status}</p>}</section>;
  if(!enabled&&!profile?.is_admin)return null;
  return <>
    {profile?.is_admin&&!enabled&&<section className={styles.adminState}><div><ShieldCheck/><div><strong>„Diese Tour verbrennen“ ist deaktiviert</strong><span>Nur Admins können die finale Funktion freischalten.</span></div></div><div className={styles.adminActions}><Link href="/admin/tour-burn-preview"><Eye/>Animation ansehen</Link><button disabled={busy} onClick={()=>void action("toggle",{enabled:true})}><Flame/>Freischalten</button></div>{status&&<p>{status}</p>}</section>}
    {enabled&&!burned&&<section className={styles.burnSection}><button className={styles.burnButton} disabled={busy} onClick={burn}><span className={styles.icon}><Flame/></span><span><small>FIRESTARTER FINAL</small><strong>Diese Tour verbrennen</strong><em>Einmal drücken. Alles brennt. Danach ist Schluss.</em></span></button>{profile?.is_admin&&<div className={styles.adminInline}><Link href="/admin/tour-burn-preview"><Eye/>Vorschau</Link><button disabled={busy} onClick={()=>void action("toggle",{enabled:false})}>Funktion wieder deaktivieren</button></div>}{status&&<p className={styles.status}>{status}</p>}</section>}
    {animating&&<TourBurn mode="animation" onFinished={()=>{setAnimating(false);window.dispatchEvent(new Event("tour-burn-animation-end"))}}/>}
  </>;
}
