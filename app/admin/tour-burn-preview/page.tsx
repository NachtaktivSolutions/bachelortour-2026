"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flame } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { TourBurn } from "@/components/tour-burn";

export default function TourBurnPreviewPage(){
  const[running,setRunning]=useState(false);const[finished,setFinished]=useState(false);
  return <AuthGate admin><Shell>
    <div className="page-heading"><span className="eyebrow">SICHERE VORSCHAU</span><h1>Tour-Verbrennung testen</h1><p>Hier kannst du Animation und Abschlussbild testen. Es wird dabei nichts gespeichert und niemand wird ausgesperrt.</p></div>
    <div className="admin-card"><Flame/><h2>Firestarter Final</h2><p>Starte die Vorschau genau so, wie sie später beim echten Button abläuft.</p><button className="primary-button" onClick={()=>{setFinished(false);setRunning(true)}}><Flame/>Animation starten</button><Link className="secondary-button" href="/"><ArrowLeft/>Zurück zur Startseite</Link></div>
    {running&&<TourBurn mode="animation" onFinished={()=>{setRunning(false);setFinished(true)}}/>}
    {finished&&<TourBurn mode="final" preview onExitPreview={()=>setFinished(false)}/>} 
  </Shell></AuthGate>;
}
