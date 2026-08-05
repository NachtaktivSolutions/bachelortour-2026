"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Flame, X } from "lucide-react";
import { useApp } from "./app-provider";

const STORAGE_KEY="firestarter-app-tour-v5";

type Placement="top"|"bottom"|"center";
type Step={title:string;text:string;path:string;target?:string;emoji:string;placement:Placement};

const steps:Step[]=[
 {title:"Willkommen bei Firestarter",text:"In wenigen Schritten siehst du, wo du alles Wichtige findest.",path:"/",emoji:"🔥",placement:"center"},
 {title:"Deine Startseite",text:"Hier stehen Countdown, Meldungen, Wetter, Bewertung, Sounds und Programm.",path:"/",target:'.bottom-nav a[href="/"]',emoji:"🏠",placement:"top"},
 {title:"Live-Karte",text:"Standorte, Treffpunkte und wichtige Orte findest du auf der Karte.",path:"/map",target:'.bottom-nav a[href="/map"]',emoji:"🗺️",placement:"top"},
 {title:"Gruppenchat",text:"Im Chat erreicht ihr alle Teilnehmer und könnt Bilder teilen.",path:"/chat",target:'.bottom-nav a[href="/chat"]',emoji:"💬",placement:"top"},
 {title:"Fotogalerie",text:"Hier sammelt ihr alle Bilder und Erinnerungen der Tour.",path:"/gallery",target:'.bottom-nav a[href="/gallery"]',emoji:"📸",placement:"top"},
 {title:"Die Bachelor",text:"Hier findest du alle Teilnehmer und ihre aktuellen Tourstatus.",path:"/members",target:'.bottom-nav a[href="/members"]',emoji:"👥",placement:"top"},
 {title:"Dein Profil",text:"Über dein Profil änderst du Daten und Status oder sendest Hilfe.",path:"/profile",target:".topbar .avatar",emoji:"😄",placement:"bottom"},
 {title:"Push & Geräteprüfung",text:"Unter Push-Nachrichten kannst du Benachrichtigungen und dein Gerät prüfen.",path:"/profile",target:".profile-setting-card h3",emoji:"🔔",placement:"top"}
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
 const targetTimer=useRef<number|null>(null);
 const current=steps[step]??steps[0];

 useEffect(()=>{setMounted(true)},[]);

 useEffect(()=>{
  if(!mounted||loading||!session||!profile||open)return;
  if(pathname==="/login"||pathname==="/register"||pathname.startsWith("/auth"))return;
  const forced=new URLSearchParams(window.location.search).get("tour")==="1";
  const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const setupKey=`firestarter-device-setup-v2:${session.user.id}`;
  const mayStart=(!mobile||isStandalone())&&localStorage.getItem(setupKey)==="done";
  if(!forced&&(!mayStart||localStorage.getItem(STORAGE_KEY)==="done"))return;
  openTimer.current=window.setTimeout(()=>setOpen(true),850);
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
  return()=>document.body.classList.remove("app-tour-open");
 },[open]);

 useEffect(()=>{
  if(!open||finale)return;
  setReady(false);setRect(null);
  if(pathname!==current.path){router.replace(current.path);return}
  const settle=window.setTimeout(()=>setReady(true),520);
  return()=>window.clearTimeout(settle);
 },[open,finale,current.path,pathname,router]);

 const updateTarget=useCallback(()=>{
  if(targetTimer.current)window.clearTimeout(targetTimer.current);
  if(!ready||!current.target){setRect(null);return}
  const element=current.target.split(",").map(s=>document.querySelector(s.trim())).find(Boolean) as HTMLElement|null;
  if(!element){setRect(null);return}
  element.scrollIntoView({behavior:"auto",block:"center",inline:"center"});
  targetTimer.current=window.setTimeout(()=>setRect(element.getBoundingClientRect()),90);
 },[current.target,ready]);

 useEffect(()=>{
  if(!open||finale)return;
  updateTarget();
  window.addEventListener("resize",updateTarget);
  window.addEventListener("orientationchange",updateTarget);
  return()=>{
   if(targetTimer.current)window.clearTimeout(targetTimer.current);
   window.removeEventListener("resize",updateTarget);
   window.removeEventListener("orientationchange",updateTarget);
  };
 },[open,finale,updateTarget]);

 function close(){
  if(finaleTimer.current)window.clearTimeout(finaleTimer.current);
  if(openTimer.current)window.clearTimeout(openTimer.current);
  if(targetTimer.current)window.clearTimeout(targetTimer.current);
  localStorage.setItem(STORAGE_KEY,"done");
  setOpen(false);setFinale(false);setStep(0);setRect(null);
  history.replaceState({},"",location.pathname);
  if(location.pathname!=="/")router.replace("/");
 }
 function changeStep(nextStep:number){setRect(null);setReady(false);setStep(Math.max(0,Math.min(steps.length-1,nextStep)))}
 function next(){if(step<steps.length-1){changeStep(step+1);return}setFinale(true);setRect(null);finaleTimer.current=window.setTimeout(close,7200)}

 if(!mounted||!open||!session||!profile)return null;
 const spotlight=rect?{
  left:Math.max(8,rect.left-8),
  top:Math.max(8,rect.top-8),
  width:Math.min(window.innerWidth-16,rect.width+16),
  height:Math.min(92,rect.height+16)
 }:undefined;

 return createPortal(<div className={`app-tour ${finale?"finale":""}`} role="dialog" aria-modal="true" aria-label="App-Einführung">
  {!finale&&<>
   {!rect&&<div className="tour-dimmer"/>}
   {rect&&<div className="tour-spotlight" style={spotlight}/>} 
   <button className="tour-skip" onClick={close}><X size={16}/> Überspringen</button>
   <section className={`tour-card ${current.placement}${ready?" visible":" waiting"}`}>
    <div className="tour-card-header"><div className="tour-step-icon">{current.emoji}</div><div><span className="eyebrow">{step+1} / {steps.length}</span><h2>{current.title}</h2></div></div>
    <p>{current.text}</p>
    <div className="tour-actions"><button disabled={step===0} onClick={()=>changeStep(step-1)}><ChevronLeft/>Zurück</button><div className="tour-progress">{steps.map((_,index)=><i key={index} className={index<=step?"active":""}/>)}</div><button className="primary-button" onClick={next}>{step===steps.length-1?"Start":"Weiter"}<ChevronRight/></button></div>
   </section>
  </>}
  {finale&&<div className="tour-finale"><div className="tour-smoke smoke-a"/><div className="tour-smoke smoke-b"/><div className="tour-leaves">{Array.from({length:24},(_,i)=><span key={i} style={{left:`${(i*41)%100}%`,animationDelay:`${(i%8)*.16}s`}}>🌿</span>)}</div><div className="tour-bus">🚌</div><div className="tour-finale-copy"><Flame/><h2>Firestarter 2026</h2><p>Alles bereit. Die Tour kann beginnen.</p><button className="primary-button" onClick={close}>Los geht’s</button></div><div className="tour-gates gate-left"/><div className="tour-gates gate-right"/></div>}
 </div>,document.body);
}
