"use client";

import Link from "next/link";
import { useCallback,useEffect,useMemo,useState } from "react";
import { Eye, Flame, Power, RotateCcw, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "./app-provider";

export function AdminTourBurnCard(){
  const {session}=useApp();
  const supabase=useMemo(()=>createClient(),[]);
  const [enabled,setEnabled]=useState(false);
  const [burned,setBurned]=useState(false);
  const [burnedAt,setBurnedAt]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");

  const load=useCallback(async()=>{
    const {data}=await supabase.from("app_settings").select("tour_burn_enabled,tour_burned,tour_burned_at").eq("id",1).maybeSingle();
    setEnabled(Boolean(data?.tour_burn_enabled));
    setBurned(Boolean(data?.tour_burned));
    setBurnedAt(data?.tour_burned_at??null);
  },[supabase]);

  useEffect(()=>{void load();const channel=supabase.channel("admin-tour-burn-card").on("postgres_changes",{event:"UPDATE",schema:"public",table:"app_settings",filter:"id=eq.1"},()=>void load()).subscribe();return()=>{void supabase.removeChannel(channel)}},[load,supabase]);

  async function action(action:string,extra:Record<string,unknown>={}){
    if(!session?.access_token)return;
    setBusy(true);setStatus("");
    try{
      const r=await fetch("/api/tour-burn",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({action,...extra})});
      const j=await r.json();if(!r.ok)throw new Error(j.error||"Aktion fehlgeschlagen.");
      await load();setStatus(action==="reset"?"Tour wurde global wiederhergestellt.":extra.enabled?"Tour-Verbrennung für alle Teilnehmer freigeschaltet.":"Tour-Verbrennung wieder deaktiviert.");
    }catch(e){setStatus(e instanceof Error?e.message:"Aktion fehlgeschlagen.")}finally{setBusy(false)}
  }

  async function reset(){if(!confirm("Tour wirklich global wiederherstellen? Danach haben alle Teilnehmer wieder normalen Zugriff auf die App."))return;await action("reset")}

  return <section className="admin-card admin-wide">
    <div className="admin-card-heading"><div><ShieldAlert/><h2>🔥 Tour verbrennen</h2></div></div>
    <p>Finale Firestarter-Funktion. Standardmäßig bleibt sie deaktiviert. Erst kurz vor Tourende freischalten.</p>
    <div className="admin-content-row"><div><strong>Status</strong><small>{burned?`VERBRANNT${burnedAt?` · ${new Date(burnedAt).toLocaleString("de-DE",{timeZone:"Europe/Berlin"})}`:""}`:enabled?"Freigeschaltet – der Button ist für Teilnehmer sichtbar":"Deaktiviert – Teilnehmer sehen keinen Button"}</small></div></div>
    <div className="admin-row-actions" style={{justifyContent:"flex-start",flexWrap:"wrap",marginTop:12}}>
      {!burned&&<button className={enabled?"danger-button":"primary-button"} disabled={busy} onClick={()=>void action("toggle",{enabled:!enabled})}><Power/>{enabled?"Für Teilnehmer deaktivieren":"Für Teilnehmer freischalten"}</button>}
      {burned&&<button className="primary-button" disabled={busy} onClick={()=>void reset()}><RotateCcw/>Verbrennung global rückgängig machen</button>}
      <Link className="secondary-button" href="/admin/tour-burn-preview"><Eye/>Animation sicher ansehen</Link>
    </div>
    {burned&&<p><strong>Admins behalten Zugriff.</strong> Normale Teilnehmer sehen ausschließlich den Firestarter-Abspann. Es werden keine Daten gelöscht.</p>}
    {status&&<div className="status" style={{marginTop:12}}>{status}</div>}
  </section>;
}
