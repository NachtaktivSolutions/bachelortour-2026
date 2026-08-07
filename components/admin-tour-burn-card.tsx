"use client";

import Link from "next/link";
import { useCallback,useEffect,useMemo,useState } from "react";
import { Eye, Power, RotateCcw, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "./app-provider";

export function AdminTourBurnCard(){
  const {session}=useApp();
  const supabase=useMemo(()=>createClient(),[]);
  const [enabled,setEnabled]=useState(false);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");

  const load=useCallback(async()=>{
    const {data}=await supabase.from("app_settings").select("tour_burn_enabled").eq("id",1).maybeSingle();
    setEnabled(Boolean(data?.tour_burn_enabled));
  },[supabase]);

  useEffect(()=>{void load();const channel=supabase.channel("admin-tour-burn-card").on("postgres_changes",{event:"UPDATE",schema:"public",table:"app_settings",filter:"id=eq.1"},()=>void load()).subscribe();return()=>{void supabase.removeChannel(channel)}},[load,supabase]);

  async function action(action:string,extra:Record<string,unknown>={}){
    if(!session?.access_token)return;
    setBusy(true);setStatus("");
    try{
      const r=await fetch("/api/tour-burn",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action,...extra})});
      const j=await r.json();if(!r.ok)throw new Error(j.error||"Aktion fehlgeschlagen.");
      await load();
      if(action==="reset")setStatus(`${j.cleared??0} persönliche Verbrennung(en) wurden zurückgesetzt. Alle Teilnehmer haben wieder Zugriff.`);
      else setStatus(extra.enabled?"Tour-Verbrennung für Teilnehmer freigeschaltet.":"Tour-Verbrennung wieder deaktiviert.");
    }catch(e){setStatus(e instanceof Error?e.message:"Aktion fehlgeschlagen.")}finally{setBusy(false)}
  }

  async function reset(){if(!confirm("Wirklich ALLE persönlichen Verbrennungen zurücksetzen? Danach haben alle Teilnehmer, die ihren Zugang bereits verbrannt hatten, wieder normalen Zugriff."))return;await action("reset")}

  return <section className="admin-card admin-wide">
    <div className="admin-card-heading"><div><ShieldAlert/><h2>🔥 Tour verbrennen</h2></div></div>
    <p>Finale Firestarter-Funktion. Jeder Teilnehmer verbrennt ausschließlich seinen eigenen Zugang. Admins bleiben immer ausgespart.</p>
    <div className="admin-content-row"><div><strong>Freischaltung</strong><small>{enabled?"AKTIV – normale Teilnehmer sehen den Button auf der Startseite":"DEAKTIVIERT – standardmäßig aus, niemand sieht den Button"}</small></div></div>
    <div className="admin-row-actions" style={{justifyContent:"flex-start",flexWrap:"wrap",marginTop:12}}>
      <button className={enabled?"danger-button":"primary-button"} disabled={busy} onClick={()=>void action("toggle",{enabled:!enabled})}><Power/>{enabled?"Für Teilnehmer deaktivieren":"Für Teilnehmer freischalten"}</button>
      <button className="secondary-button" disabled={busy} onClick={()=>void reset()}><RotateCcw/>Alle Verbrennungen zurücksetzen</button>
      <Link className="secondary-button" href="/admin/tour-burn-preview"><Eye/>Animation sicher ansehen</Link>
    </div>
    <p><strong>Wichtig:</strong> Es werden keinerlei Tourdaten gelöscht. Der Sperrstatus hängt am Benutzerkonto und bleibt deshalb auch nach Neuinstallation oder erneutem Login bestehen.</p>
    {status&&<div className="status" style={{marginTop:12}}>{status}</div>}
  </section>;
}
