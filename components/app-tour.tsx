"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Flame, X } from "lucide-react";

const STORAGE_KEY="firestarter-app-tour-v1";
type Step={title:string;text:string;target?:string;emoji:string};
const steps:Step[]=[
 {title:"Willkommen bei Firestarter",text:"In weniger als einer Minute zeigen wir dir alles Wichtige. Du kannst die Einführung jederzeit überspringen.",emoji:"🔥"},
 {title:"Deine Startseite",text:"Hier findest du Countdown, Neuigkeiten, Wetter, Tourbewertung, Sounds und den nächsten Programmpunkt.",target:".page-content",emoji:"🏠"},
 {title:"Live-Karte",text:"Hier siehst du freigegebene Standorte, Treffpunkte und wichtige Orte in eurer Nähe.",target:'.bottom-nav a[href="/map"]',emoji:"🗺️"},
 {title:"Gruppenchat",text:"Im Chat erreicht ihr alle Teilnehmer schnell und könnt Bilder miteinander teilen.",target:'.bottom-nav a[href="/chat"]',emoji:"💬"},
 {title:"Fotogalerie",text:"Hier sammelt ihr eure besten und wahrscheinlich auch schlimmsten Erinnerungen.",target:'.bottom-nav a[href="/gallery"]',emoji:"📸"},
 {title:"Die Bachelor",text:"In der Mitgliederübersicht findest du alle Teilnehmer und ihre aktuellen Tourstatus.",target:'.bottom-nav a[href="/members"]',emoji:"👥"},
 {title:"Dein Profil",text:"Über dein Profilbild änderst du Status und Daten, prüfst Push und kannst im Notfall Hilfe senden.",target:".topbar .avatar",emoji:"😄"},
 {title:"Alles bereit",text:"Benachrichtigungen und Standort sollten aktiviert bleiben, damit du unterwegs nichts verpasst.",target:".top-actions",emoji:"🔔"}
];

export function AppTour(){
 const [mounted,setMounted]=useState(false);const [open,setOpen]=useState(false);const [step,setStep]=useState(0);const [finale,setFinale]=useState(false);const [rect,setRect]=useState<DOMRect|null>(null);
 const current=steps[step];
 useEffect(()=>{setMounted(true);const forced=new URLSearchParams(location.search).get("tour")==="1";if(forced||localStorage.getItem(STORAGE_KEY)!=="done")setTimeout(()=>setOpen(true),450)},[]);
 useEffect(()=>{if(!open)return;document.body.classList.add("app-tour-open");return()=>document.body.classList.remove("app-tour-open")},[open]);
 useEffect(()=>{if(!open||finale||!current.target){setRect(null);return}const update=()=>{const el=document.querySelector(current.target!);setRect(el?.getBoundingClientRect()??null);el?.scrollIntoView({behavior:"smooth",block:"center",inline:"center"})};const timer=setTimeout(update,180);window.addEventListener("resize",update);return()=>{clearTimeout(timer);window.removeEventListener("resize",update)}},[open,step,finale,current.target]);
 const cardClass=useMemo(()=>rect&&rect.top>innerHeight*.55?"tour-card top":"tour-card bottom",[rect]);
 function close(){localStorage.setItem(STORAGE_KEY,"done");setOpen(false);setFinale(false);history.replaceState({},"",location.pathname)}
 function next(){if(step<steps.length-1){setStep(v=>v+1);return}setFinale(true);setTimeout(close,5200)}
 if(!mounted||!open)return null;
 return createPortal(<div className={`app-tour ${finale?"finale":""}`} role="dialog" aria-modal="true" aria-label="App-Einführung">
  {!finale&&<><div className="tour-dimmer"/>{rect&&<div className="tour-spotlight" style={{left:Math.max(8,rect.left-8),top:Math.max(8,rect.top-8),width:Math.min(innerWidth-16,rect.width+16),height:rect.height+16}}/>}<button className="tour-skip" onClick={close}><X size={18}/> Überspringen</button><section className={cardClass}><div className="tour-step-icon">{current.emoji}</div><span className="eyebrow">SCHRITT {step+1} VON {steps.length}</span><h2>{current.title}</h2><p>{current.text}</p><div className="tour-progress">{steps.map((_,i)=><i key={i} className={i<=step?"active":""}/>)}</div><div className="tour-actions"><button disabled={step===0} onClick={()=>setStep(v=>Math.max(0,v-1))}><ChevronLeft/>Zurück</button><button className="primary-button" onClick={next}>{step===steps.length-1?"Tour starten":"Weiter"}<ChevronRight/></button></div></section></>}
  {finale&&<div className="tour-finale"><div className="tour-smoke smoke-a"/><div className="tour-smoke smoke-b"/><div className="tour-leaves">{Array.from({length:18},(_,i)=><span key={i} style={{left:`${(i*37)%100}%`,animationDelay:`${(i%6)*.18}s`}}>🌿</span>)}</div><div className="tour-bus">🚌</div><div className="tour-finale-copy"><Flame/><h2>Firestarter 2026</h2><p>Die Tour kann beginnen.</p><button className="primary-button" onClick={close}>Los geht’s</button></div><div className="tour-gates gate-left"/><div className="tour-gates gate-right"/></div>}
 </div>,document.body)
}
