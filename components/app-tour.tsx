"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Flame, X } from "lucide-react";
import { useApp } from "./app-provider";

const STORAGE_KEY="firestarter-app-tour-v4";

type Step={title:string;text:string;path:string;target?:string;emoji:string};

const steps:Step[]=[
 {title:"Willkommen bei Firestarter",text:"Wir zeigen dir kurz die wichtigsten Bereiche. Du kannst jederzeit überspringen.",path:"/",emoji:"🔥"},
 {title:"Deine Startseite",text:"Countdown, Meldungen, Wetter, Tourbewertung, Sounds und Programm auf einen Blick.",path:"/",target:".premium-hero, .hero",emoji:"🏠"},
 {title:"Live-Karte",text:"Freigegebene Standorte, Treffpunkte und wichtige Orte in eurer Nähe.",path:"/map",target:'.bottom-nav a[href="/map"]',emoji:"🗺️"},
 {title:"Gruppenchat",text:"Hier erreicht ihr alle Teilnehmer und könnt Bilder miteinander teilen.",path:"/chat",target:'.bottom-nav a[href="/chat"]',emoji:"💬"},
 {title:"Fotogalerie",text:"Hier landen die besten und wahrscheinlich auch schlimmsten Erinnerungen.",path:"/gallery",target:'.bottom-nav a[href="/gallery"]',emoji:"📸"},
 {title:"Die Bachelor",text:"Alle Teilnehmer und ihre aktuellen Tourstatus findest du hier.",path:"/members",target:'.bottom-nav a[href="/members"]',emoji:"👥"},
 {title:"Dein Profil",text:"Daten ändern, Tourstatus setzen und im Notfall Hilfe senden.",path:"/profile",target:".profile-section-head",emoji:"😄"},
 {title:"Push & Geräteprüfung",text:"Push aktivieren und Standort sowie Benachrichtigungen prüfen.",path:"/profile",target:".profile-setting-card",emoji:"🔔"}
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
 const [rect,setRect]=useState<DOMRect|null>(null);
 const [ready,setReady]=useState(false);
 const finaleTimer=useRef<number|null>(null);
 const openTimer=useRef<number|null>(null);
 const current=steps[step]??steps[0];

 useEffect(()=>{setMounted(true)},[]);

 useEffect(()=>{
  if(!mounted||loading||!session||!profile||open)return;
  if(pathname==="/login"||pathname==="/register"||pathname.startsWith("/auth"))return;

  const forced=new URLSearchParams(window.location.search).get("tour")==="1";
  const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const installed=!mobile||isStandalone();
  const setupKey=`firestarter-device-setup-v2:${session.user.id}`;
  const setupComplete=localStorage.getItem(setupKey)==="done";
  const tourComplete=localStorage.getItem(STORAGE_KEY)==="done";

  if(!forced&&(!installed||!setupComplete||tourComplete))return;
  openTimer.current=window.setTimeout(()=>setOpen(true),650);
  return()=>{if(openTimer.current)window.clearTimeout(openTimer.current)};
 },[mounted,loading,session,profile,pathname,open]);

 useEffect(()=>{
  if(!mounted||loading||!session||!profile||open)return;
  const retry=()=>{
   const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
   const setupKey=`firestarter-device-setup-v2:${session.user.id}`;
   if((!mobile||isStandalone())&&localStorage.getItem(setupKey)==="done"&&localStorage.getItem(STORAGE_KEY)!=="done"){
    setOpen(true);
   }
  };
  window.addEventListener("firestarter-device-setup-complete",retry);
  return()=>window.removeEventListener("firestarter-device-setup-complete",retry);
 },[mounted,loading,session,profile,open]);

 useEffect(()=>{
  if(!open)return;
  document.body.classList.add("app-tour-open");
  return()=>document.body.classList.remove("app-tour-open");
 },[open]);

 useEffect(()=>{
  if(!open||finale)return;
  setReady(false);setRect(null);
  if(pathname!==current.path){router.replace(current.path);return}
  const settle=window.setTimeout(()=>setReady(true),300);
  return()=>window.clearTimeout(settle);
 },[open,finale,current.path,pathname,router]);

 const updateTarget=useCallback(()=>{
  if(!ready||!current.target){setRect(null);return}
  const element=current.target.split(",").map(s=>document.querySelector(s.trim())).find(Boolean) as HTMLElement|null;
  if(!element){setRect(null);return}
  element.scrollIntoView({behavior:"smooth",block:"center",inline:"center"});
  window.setTimeout(()=>setRect(element.getBoundingClientRect()),240);
 },[current.target,ready]);

 useEffect(()=>{
  if(!open||finale)return;
  updateTarget();
  window.addEventListener("resize",updateTarget);
  window.addEventListener("orientationchange",updateTarget);
  return()=>{window.removeEventListener("resize",updateTarget);window.removeEventListener("orientationchange",updateTarget)};
 },[open,finale,updateTarget]);

 const placement=useMemo(()=>{
  if(!rect||typeof window==="undefined")return"center";
  const freeAbove=Math.max(0,rect.top-110);
  const freeBelow=Math.max(0,window.innerHeight-(rect.bottom+105));
  return freeBelow>=freeAbove?"bottom":"top";
 },[rect]);

 function close(){
  if(finaleTimer.current)window.clearTimeout(finaleTimer.current);
  if(openTimer.current)window.clearTimeout(openTimer.current);
  localStorage.setItem(STORAGE_KEY,"done");
  setOpen(false);setFinale(false);setStep(0);setRect(null);
  history.replaceState({},"",location.pathname);
  if(location.pathname!=="/")router.replace("/");
 }
 function changeStep(nextStep:number){setRect(null);setReady(false);setStep(Math.max(0,Math.min(steps.length-1,nextStep)))}
 function next(){if(step<steps.length-1){changeStep(step+1);return}setFinale(true);setRect(null);finaleTimer.current=window.setTimeout(close,7200)}

 if(!mounted||!open||!session||!profile)return null;
 const maxSpotHeight=Math.min(rect?.height??0,Math.max(100,window.innerHeight*.42));
 const spotlight=rect?{left:Math.max(10,rect.left-8),top:Math.max(10,rect.top-8),width:Math.min(window.innerWidth-20,rect.width+16),height:maxSpotHeight+16}:undefined;

 return createPortal(<div className={`app-tour ${finale?"finale":""}`} role="dialog" aria-modal="true" aria-label="App-Einführung">
  {!finale&&<>
   {!rect&&<div className="tour-dimmer"/>}
   {rect&&<div className="tour-spotlight" style={spotlight}/>} 
   <button className="tour-skip" onClick={close}><X size={17}/> Überspringen</button>
   <section className={`tour-card ${placement}${ready?" visible":" waiting"}`}>
    <div className="tour-card-header"><div className="tour-step-icon">{current.emoji}</div><div><span className="eyebrow">SCHRITT {step+1} VON {steps.length}</span><h2>{current.title}</h2></div></div>
    <p>{current.text}</p>
    <div className="tour-progress">{steps.map((_,index)=><i key={index} className={index<=step?"active":""}/>)}</div>
    <div className="tour-actions"><button disabled={step===0} onClick={()=>changeStep(step-1)}><ChevronLeft/>Zurück</button><button className="primary-button" onClick={next}>{step===steps.length-1?"Tour starten":"Weiter"}<ChevronRight/></button></div>
   </section>
  </>}
  {finale&&<div className="tour-finale"><div className="tour-smoke smoke-a"/><div className="tour-smoke smoke-b"/><div className="tour-leaves">{Array.from({length:24},(_,i)=><span key={i} style={{left:`${(i*41)%100}%`,animationDelay:`${(i%8)*.16}s`}}>🌿</span>)}</div><div className="tour-bus">🚌</div><div className="tour-finale-copy"><Flame/><h2>Firestarter 2026</h2><p>Alles bereit. Die Tour kann beginnen.</p><button className="primary-button" onClick={close}>Los geht’s</button></div><div className="tour-gates gate-left"/><div className="tour-gates gate-right"/></div>}
 </div>,document.body);
}
