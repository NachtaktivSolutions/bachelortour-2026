"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Flame, X } from "lucide-react";
import { useApp } from "./app-provider";

const STORAGE_KEY="firestarter-app-tour-v7";

type Step={title:string;text:string;path:string;emoji:string;nav?:"home"|"map"|"chat"|"gallery"|"members"|"profile"};

const steps:Step[]=[
 {title:"Willkommen bei Firestarter",text:"Wir zeigen dir jetzt kurz und verständlich die wichtigsten Bereiche der App.",path:"/",emoji:"🔥"},
 {title:"Deine Startseite",text:"Hier findest du Countdown, Meldungen, Wetter, Tourbewertung, Sounds und das aktuelle Programm.",path:"/",emoji:"🏠",nav:"home"},
 {title:"Live-Karte",text:"Auf der Karte siehst du freigegebene Standorte, Treffpunkte und wichtige Orte in eurer Nähe.",path:"/map",emoji:"🗺️",nav:"map"},
 {title:"Gruppenchat",text:"Im Chat erreicht ihr alle Teilnehmer und könnt Nachrichten oder Bilder miteinander teilen.",path:"/chat",emoji:"💬",nav:"chat"},
 {title:"Fotogalerie",text:"Hier landen die besten Bilder und Erinnerungen eurer Tour.",path:"/gallery",emoji:"📸",nav:"gallery"},
 {title:"Die Bachelor",text:"Hier findest du alle Teilnehmer und ihre aktuellen Tourstatus.",path:"/members",emoji:"👥",nav:"members"},
 {title:"Dein Profil",text:"Im Profil änderst du deine Daten, deinen Status und kannst im Notfall Hilfe senden.",path:"/profile",emoji:"😄",nav:"profile"},
 {title:"Push & Geräteprüfung",text:"Weiter unten im Profil aktivierst du Push-Nachrichten und kannst dein Gerät vollständig prüfen.",path:"/profile",emoji:"🔔",nav:"profile"}
];

function isStandalone(){
 if(typeof window==="undefined")return false;
 return window.matchMedia("(display-mode: standalone)").matches||(window.navigator as Navigator&{standalone?:boolean}).standalone===true;
}

export function AppTour(){
 const {session,profile,loading}=useApp();
 const router=useRouter();
 const pathname=usePathname();
 const [mounted,setMounted]=useState(false);
 const [open,setOpen]=useState(false);
 const [step,setStep]=useState(0);
 const [finale,setFinale]=useState(false);
 const [transitioning,setTransitioning]=useState(false);
 const openTimer=useRef<number|null>(null);
 const finaleTimer=useRef<number|null>(null);
 const current=steps[step]??steps[0];

 useEffect(()=>setMounted(true),[]);

 useEffect(()=>{
  if(!mounted||loading||!session||!profile||open)return;
  if(pathname==="/login"||pathname==="/register"||pathname.startsWith("/auth"))return;
  const forced=new URLSearchParams(window.location.search).get("tour")==="1";
  const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const setupKey=`firestarter-device-setup-v2:${session.user.id}`;
  const setupComplete=(!mobile||isStandalone())&&localStorage.getItem(setupKey)==="done";
  if(!forced&&(!setupComplete||localStorage.getItem(STORAGE_KEY)==="done"))return;
  openTimer.current=window.setTimeout(()=>setOpen(true),700);
  return()=>{if(openTimer.current)window.clearTimeout(openTimer.current)};
 },[mounted,loading,session,profile,pathname,open]);

 useEffect(()=>{
  if(!mounted||loading||!session||!profile||open)return;
  const retry=()=>{
   const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
   const setupKey=`firestarter-device-setup-v2:${session.user.id}`;
   if((!mobile||isStandalone())&&localStorage.getItem(setupKey)==="done"&&localStorage.getItem(STORAGE_KEY)!=="done")setOpen(true);
  };
  window.addEventListener("firestarter-device-setup-complete",retry);
  return()=>window.removeEventListener("firestarter-device-setup-complete",retry);
 },[mounted,loading,session,profile,open]);

 useEffect(()=>{
  if(!open)return;
  document.body.classList.add("app-tour-open");
  document.body.dataset.tourNav=current.nav??"none";
  return()=>{
   document.body.classList.remove("app-tour-open");
   delete document.body.dataset.tourNav;
  };
 },[open,current.nav]);

 useEffect(()=>{
  if(!open||finale)return;
  if(pathname!==current.path){
   setTransitioning(true);
   router.replace(current.path);
   return;
  }
  const timer=window.setTimeout(()=>setTransitioning(false),180);
  return()=>window.clearTimeout(timer);
 },[open,finale,current.path,pathname,router]);

 function close(){
  if(openTimer.current)window.clearTimeout(openTimer.current);
  if(finaleTimer.current)window.clearTimeout(finaleTimer.current);
  localStorage.setItem(STORAGE_KEY,"done");
  setOpen(false);setFinale(false);setStep(0);setTransitioning(false);
  history.replaceState({},"",location.pathname);
  if(location.pathname!=="/")router.replace("/");
 }

 function changeStep(nextStep:number){
  const safe=Math.max(0,Math.min(steps.length-1,nextStep));
  setTransitioning(true);
  setStep(safe);
 }

 function next(){
  if(step<steps.length-1){changeStep(step+1);return}
  setFinale(true);
  finaleTimer.current=window.setTimeout(close,6500);
 }

 if(!mounted||!open||!session||!profile)return null;

 return createPortal(<div className={`app-tour ${finale?"finale":""}`} role="dialog" aria-modal="true" aria-label="App-Einführung">
  {!finale&&<>
   <div className="tour-dimmer"/>
   <button className="tour-skip" onClick={close}><X size={16}/> Überspringen</button>
   <section className={`tour-guide-card ${step===0?"welcome":""}${transitioning?" is-switching":""}`}>
    <div className="tour-guide-head">
     <span className="tour-step-icon">{current.emoji}</span>
     <div><span className="eyebrow">SCHRITT {step+1} VON {steps.length}</span><h2>{current.title}</h2></div>
    </div>
    <p>{current.text}</p>
    <div className="tour-progress">{steps.map((_,index)=><i key={index} className={index<=step?"active":""}/>)}</div>
    <div className="tour-guide-actions">
     <button disabled={step===0||transitioning} onClick={()=>changeStep(step-1)}><ChevronLeft/>Zurück</button>
     <button className="primary-button" disabled={transitioning} onClick={next}>{step===steps.length-1?"Tour starten":"Weiter"}<ChevronRight/></button>
    </div>
   </section>
  </>}
  {finale&&<div className="tour-finale"><div className="tour-smoke smoke-a"/><div className="tour-smoke smoke-b"/><div className="tour-leaves">{Array.from({length:24},(_,i)=><span key={i} style={{left:`${(i*41)%100}%`,animationDelay:`${(i%8)*.16}s`}}>🌿</span>)}</div><div className="tour-bus">🚌</div><div className="tour-finale-copy"><Flame/><h2>Firestarter 2026</h2><p>Alles bereit. Die Tour kann beginnen.</p><button className="primary-button" onClick={close}>Los geht’s</button></div><div className="tour-gates gate-left"/><div className="tour-gates gate-right"/></div>}
 </div>,document.body);
}
