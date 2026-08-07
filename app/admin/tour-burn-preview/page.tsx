"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flame, RotateCcw, ShieldCheck, Smartphone, Monitor } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { Shell } from "@/components/shell";
import { TourBurn } from "@/components/tour-burn";
import styles from "./preview.module.css";

type Device="phoneSmall"|"phoneLarge"|"android"|"desktop";

const devices:{id:Device;label:string;icon:typeof Smartphone}[]=[
  {id:"phoneSmall",label:"iPhone SE",icon:Smartphone},
  {id:"phoneLarge",label:"iPhone Pro Max",icon:Smartphone},
  {id:"android",label:"Android",icon:Smartphone},
  {id:"desktop",label:"Desktop",icon:Monitor}
];

export default function TourBurnPreviewPage(){
  const[running,setRunning]=useState(false);
  const[finished,setFinished]=useState(false);
  const[device,setDevice]=useState<Device>("phoneLarge");

  const start=()=>{setFinished(false);setRunning(true)};
  const reset=()=>{setRunning(false);setFinished(false)};

  return <AuthGate admin><Shell>
    <div className="page-heading"><span className="eyebrow">SICHERE VORSCHAU</span><h1>Tour-Verbrennung testen</h1><p>Hier simulierst du exakt den Ablauf für einen Teilnehmer. Es wird nichts gespeichert, niemand gesperrt und die Live-Freischaltung bleibt unangetastet.</p></div>

    <div className="admin-card">
      <div className={styles.controls}>
        <div className={styles.safeBadge}><ShieldCheck size={17}/>100 % Vorschau – keine Auswirkung auf echte Teilnehmer</div>
        <h2>Gerät auswählen</h2>
        <div className={styles.deviceTabs}>{devices.map(({id,label,icon:Icon})=><button type="button" key={id} className={device===id?styles.active:""} onClick={()=>setDevice(id)}><Icon size={16}/> {label}</button>)}</div>
        <div className={styles.actions}>
          <button className="primary-button" onClick={start}><Flame/>Als Teilnehmer verbrennen</button>
          {(running||finished)&&<button className="secondary-button" onClick={reset}><RotateCcw/>Vorschau zurücksetzen</button>}
          <Link className="secondary-button" href="/admin"><ArrowLeft/>Zur Admin-Zentrale</Link>
        </div>
        <p className={styles.note}>Der echte Teilnehmer sieht nach dem Klick zuerst die Vollbildanimation und danach dauerhaft den Abschlussbildschirm. Diese Vorschau verhält sich optisch genauso, speichert aber keinen Burn-Status.</p>
      </div>

      <div className={styles.previewStage}>
        <div>
          <div className={`${styles.device} ${styles[device]}`}>
            <div className={styles.deviceInner}>
              {!running&&!finished&&<div className={styles.fakeHome}><div className={styles.fakeTop}>FIRESTARTER 26 · Teilnehmeransicht</div><div className={styles.fakeHero}><strong>Bachelortour 2026</strong></div><button type="button" className={styles.fakeButton} onClick={start}>🔥 Diese Tour verbrennen</button></div>}
              {running&&<TourBurn mode="animation" onFinished={()=>{setRunning(false);setFinished(true)}}/>}
              {finished&&<TourBurn mode="final" preview onExitPreview={reset}/>} 
            </div>
          </div>
          <div className={styles.deviceLabel}>{devices.find(d=>d.id===device)?.label} · sichere Simulation</div>
        </div>
      </div>
    </div>
  </Shell></AuthGate>;
}
