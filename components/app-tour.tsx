"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Flame, X } from "lucide-react";

const STORAGE_KEY="firestarter-app-tour-v2";

type Step={
  title:string;
  text:string;
  path:string;
  target?:string;
  emoji:string;
};

const steps:Step[]=[
 {title:"Willkommen bei Firestarter",text:"Wir zeigen dir jetzt Schritt für Schritt die wichtigsten Bereiche. Das dauert weniger als eine Minute.",path:"/",emoji:"🔥"},
 {title:"Deine Startseite",text:"Hier stehen Countdown, aktuelle Meldungen, Wetter, Tourbewertung, Sounds und der nächste Programmpunkt.",path:"/",target:".premium-hero, .hero",emoji:"🏠"},
 {title:"Live-Karte",text:"Hier siehst du freigegebene Standorte, Treffpunkte und wichtige Orte in eurer Nähe.",path:"/map",target:'.bottom-nav a[href="/map"]',emoji:"🗺️"},
 {title:"Gruppenchat",text:"Im Chat erreicht ihr alle Teilnehmer schnell und könnt Bilder miteinander teilen.",path:"/chat",target:'.bottom-nav a[href="/chat"]',emoji:"💬"},
 {title:"Fotogalerie",text:"Hier sammelt ihr eure besten und wahrscheinlich auch schlimmsten Erinnerungen der Tour.",path:"/gallery",target:'.bottom-nav a[href="/gallery"]',emoji:"📸"},
 {title:"Die Bachelor",text:"In der Mitgliederübersicht findest du alle Teilnehmer und ihre aktuellen Tourstatus.",path:"/members",target:'.bottom-nav a[href="/members"]',emoji:"👥"},
 {title:"Dein Profil",text:"Hier änderst du deine Daten und deinen Tourstatus und kannst im Notfall Hilfe senden.",path:"/profile",target:".profile-status-card",emoji:"😄"},
 {title:"Push & Geräteprüfung",text:"Unter deinem Profil kannst du Push aktivieren und prüfen, ob Standort und Benachrichtigungen funktionieren.",path:"/profile",target:".profile-setting-card",emoji:"🔔"}
];

export function AppTour(){
 const router=useRouter();
 const pathname=usePathname();
 const [mounted,setMounted]=useState(false);
 const [open,setOpen]=useState(false);
 const [step,setStep]=useState(0);
 const [finale,setFinale]=useState(false);
 const [rect,setRect]=useState<DOMRect|null>(null);
 const [ready,setReady]=useState(false);
 const finaleTimer=useRef<number|null>(null);
 const current=steps[step];

 useEffect(()=>{
  setMounted(true);
  const forced=new URLSearchParams(location.search).get("tour")==="1";
  if(forced||localStorage.getItem(STORAGE_KEY)!=="done"){
   const timer=window.setTimeout(()=>setOpen(true),500);
   return()=>window.clearTimeout(timer);
  }
 },[]);

 useEffect(()=>{
  if(!open)return;
  document.body.classList.add("app-tour-open");
  return()=>document.body.classList.remove("app-tour-open");
 },[open]);

 useEffect(()=>{
  if(!open||finale)return;
  setReady(false);
  setRect(null);
  if(pathname!==current.path){router.replace(current.path);return}
  const settle=window.setTimeout(()=>setReady(true),260);
  return()=>window.clearTimeout(settle);
 },[open,finale,current.path,pathname,router]);

 const updateTarget=useCallback(()=>{
  if(!ready||!current.target){setRect(null);return}
  const selectors=current.target.split(",").map(value=>value.trim());
  const element=selectors.map(selector=>document.querySelector(selector)).find(Boolean) as HTMLElement|null;
  if(!element){setRect(null);return}
  element.scrollIntoView({behavior:"smooth",block:"center",inline:"center"});
  window.setTimeout(()=>setRect(element.getBoundingClientRect()),220);
 },[current.target,ready]);

 useEffect(()=>{
  if(!open||finale)return;
  updateTarget();
  window.addEventListener("resize",updateTarget);
  window.addEventListener("orientationchange",updateTarget);
  return()=>{
   window.removeEventListener("resize",updateTarget);
   window.removeEventListener("orientationchange",updateTarget);
  }
 },[open,finale,updateTarget]);

 const placement=useMemo(()=>{
  if(!rect)return"center";
  const targetMiddle=rect.top+rect.height/2;
  return targetMiddle>window.innerHeight*.56?"top":"bottom";
 },[rect]);

 function close(){
  if(finaleTimer.current)window.clearTimeout(finaleTimer.current);
  localStorage.setItem(STORAGE_KEY,"done");
  setOpen(false);setFinale(false);setStep(0);setRect(null);
  history.replaceState({},"",location.pathname);
  if(location.pathname!=="/")router.replace("/");
 }

 function changeStep(nextStep:number){
  setRect(null);setReady(false);setStep(Math.max(0,Math.min(steps.length-1,nextStep)));
 }

 function next(){
  if(step<steps.length-1){changeStep(step+1);return}
  setFinale(true);setRect(null);
  finaleTimer.current=window.setTimeout(close,7200);
 }

 if(!mounted||!open)return null;
 const spotlight=rect?{
  left:Math.max(10,rect.left-10),
  top:Math.max(10,rect.top-10),
  width:Math.min(window.innerWidth-20,rect.width+20),
  height:Math.min(window.innerHeight-20,rect.height+20)
 }:undefined;

 return createPortal(<div className={`app-tour ${finale?"finale":""}`} role="dialog" aria-modal="true" aria-label="App-Einführung">
  {!finale&&<>
   {!rect&&<div className="tour-dimmer"/>}
   {rect&&<div className="tour-spotlight" style={spotlight}/>} 
   <button className="tour-skip" onClick={close}><X size={18}/> Überspringen</button>
   <section className={`tour-card ${placement}${ready?" visible":" waiting"}`}>
    <div className="tour-pointer"/>
    <div className="tour-step-icon">{current.emoji}</div>
    <span className="eyebrow">SCHRITT {step+1} VON {steps.length}</span>
    <h2>{current.title}</h2>
    <p>{current.text}</p>
    <div className="tour-progress">{steps.map((_,index)=><i key={index} className={index<=step?"active":""}/>)}</div>
    <div className="tour-actions">
     <button disabled={step===0} onClick={()=>changeStep(step-1)}><ChevronLeft/>Zurück</button>
     <button className="primary-button" onClick={next}>{step===steps.length-1?"Tour starten":"Weiter"}<ChevronRight/></button>
    </div>
   </section>
  </>}
  {finale&&<div className="tour-finale">
   <div className="tour-smoke smoke-a"/><div className="tour-smoke smoke-b"/>
   <div className="tour-leaves">{Array.from({length:24},(_,i)=><span key={i} style={{left:`${(i*41)%100}%`,animationDelay:`${(i%8)*.16}s`}}>🌿</span>)}</div>
   <div className="tour-bus">🚌</div>
   <div className="tour-finale-copy"><Flame/><h2>Firestarter 2026</h2><p>Alles bereit. Die Tour kann beginnen.</p><button className="primary-button" onClick={close}>Los geht’s</button></div>
   <div className="tour-gates gate-left"/><div className="tour-gates gate-right"/>
  </div>}
 </div>,document.body);
}
