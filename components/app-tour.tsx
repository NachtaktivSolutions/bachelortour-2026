"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  Flame,
  Home,
  Images,
  Map,
  MessageCircle,
  UserRound,
  Users,
  X
} from "lucide-react";
import { useApp } from "./app-provider";

const STORAGE_KEY="firestarter-app-tour-v8";

type SlideKind="welcome"|"home"|"map"|"chat"|"gallery"|"members"|"profile";
type Slide={kind:SlideKind;eyebrow:string;title:string;text:string;icon:React.ComponentType<{size?:number}>};

const slides:Slide[]=[
  {kind:"welcome",eyebrow:"WILLKOMMEN",title:"Firestarter 2026",text:"In weniger als einer Minute kennst du alle wichtigen Funktionen der App.",icon:Flame},
  {kind:"home",eyebrow:"ALLES AUF EINEN BLICK",title:"Deine Startseite",text:"Countdown, Neuigkeiten, Wetter, Sounds, Tourbewertung und Programm findest du direkt auf Home.",icon:Home},
  {kind:"map",eyebrow:"WO SIND DIE JUNGS?",title:"Live-Karte",text:"Sieh freigegebene Standorte, Treffpunkte und wichtige Orte in eurer Nähe.",icon:Map},
  {kind:"chat",eyebrow:"ALLE ZUSAMMEN",title:"Gruppenchat",text:"Schreibe der ganzen Gruppe und teile kurzfristige Änderungen oder Bilder.",icon:MessageCircle},
  {kind:"gallery",eyebrow:"EURE ERINNERUNGEN",title:"Fotogalerie",text:"Alle Tourbilder landen gesammelt in einer gemeinsamen Galerie.",icon:Images},
  {kind:"members",eyebrow:"DIE BACHELOR",title:"Teilnehmer & Status",text:"Hier findest du alle Teilnehmer und siehst sofort ihren aktuellen Tourstatus.",icon:Users},
  {kind:"profile",eyebrow:"DEIN BEREICH",title:"Profil, Push & Hilfe",text:"Ändere deinen Status, prüfe Push und Standort oder sende im Notfall Hilfe.",icon:UserRound}
];

function isStandalone(){
  if(typeof window==="undefined")return false;
  return window.matchMedia("(display-mode: standalone)").matches||(window.navigator as Navigator&{standalone?:boolean}).standalone===true;
}

export function AppTour(){
  const {session,profile,loading}=useApp();
  const [mounted,setMounted]=useState(false);
  const [open,setOpen]=useState(false);
  const [index,setIndex]=useState(0);
  const [direction,setDirection]=useState<"next"|"back">("next");
  const [animating,setAnimating]=useState(false);
  const [finale,setFinale]=useState(false);
  const openTimer=useRef<number|null>(null);
  const finaleTimer=useRef<number|null>(null);
  const current=slides[index]??slides[0];

  useEffect(()=>setMounted(true),[]);

  useEffect(()=>{
    if(!mounted||loading||!session||!profile||open)return;
    if(location.pathname==="/login"||location.pathname==="/register"||location.pathname.startsWith("/auth"))return;
    const forced=new URLSearchParams(location.search).get("tour")==="1";
    const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const setupKey=`firestarter-device-setup-v2:${session.user.id}`;
    const setupComplete=(!mobile||isStandalone())&&localStorage.getItem(setupKey)==="done";
    if(!forced&&(!setupComplete||localStorage.getItem(STORAGE_KEY)==="done"))return;
    openTimer.current=window.setTimeout(()=>setOpen(true),forced?100:650);
    return()=>{if(openTimer.current)window.clearTimeout(openTimer.current)};
  },[mounted,loading,session,profile,open]);

  useEffect(()=>{
    if(!mounted||loading||!session||!profile||open)return;
    const retry=()=>{
      const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const setupKey=`firestarter-device-setup-v2:${session.user.id}`;
      if((!mobile||isStandalone())&&localStorage.getItem(setupKey)==="done"&&localStorage.getItem(STORAGE_KEY)!=="done")setOpen(true);
    };
    const restart=()=>{
      if(openTimer.current)window.clearTimeout(openTimer.current);
      if(finaleTimer.current)window.clearTimeout(finaleTimer.current);
      localStorage.removeItem(STORAGE_KEY);
      setIndex(0);setFinale(false);setAnimating(false);setOpen(true);
    };
    window.addEventListener("firestarter-device-setup-complete",retry);
    window.addEventListener("firestarter-app-tour-start",restart);
    return()=>{
      window.removeEventListener("firestarter-device-setup-complete",retry);
      window.removeEventListener("firestarter-app-tour-start",restart);
    };
  },[mounted,loading,session,profile,open]);

  useEffect(()=>{
    if(!open)return;
    document.body.classList.add("app-tour-open");
    return()=>document.body.classList.remove("app-tour-open");
  },[open]);

  function close(){
    if(openTimer.current)window.clearTimeout(openTimer.current);
    if(finaleTimer.current)window.clearTimeout(finaleTimer.current);
    localStorage.setItem(STORAGE_KEY,"done");
    setOpen(false);setFinale(false);setIndex(0);setAnimating(false);
    history.replaceState({},"",location.pathname);
  }

  function move(nextIndex:number,nextDirection:"next"|"back"){
    if(animating)return;
    setAnimating(true);setDirection(nextDirection);
    window.setTimeout(()=>{
      setIndex(nextIndex);
      setAnimating(false);
    },180);
  }

  function next(){
    if(index<slides.length-1){move(index+1,"next");return}
    setFinale(true);
    finaleTimer.current=window.setTimeout(close,6500);
  }

  function back(){if(index>0)move(index-1,"back")}

  if(!mounted||!open||!session||!profile)return null;
  const Icon=current.icon;

  return createPortal(
    <div className={`app-tour fullscreen-tour${finale?" finale":""}`} role="dialog" aria-modal="true" aria-label="App-Einführung">
      {!finale&&<>
        <div className="fullscreen-tour-bg"/>
        <button className="tour-skip" onClick={close}><X size={17}/> Überspringen</button>
        <main className={`tour-slide ${animating?`leaving-${direction}`:""}`}>
          <section className="tour-slide-visual" aria-hidden="true">
            <TourVisual kind={current.kind}/>
          </section>
          <section className="tour-slide-copy">
            <div className="tour-slide-icon"><Icon size={26}/></div>
            <span className="eyebrow">{current.eyebrow}</span>
            <h1>{current.title}</h1>
            <p>{current.text}</p>
          </section>
        </main>
        <footer className="tour-slide-footer">
          <button className="tour-back" onClick={back} disabled={index===0||animating}><ChevronLeft/>Zurück</button>
          <div className="tour-dots" aria-label={`Schritt ${index+1} von ${slides.length}`}>{slides.map((_,i)=><i key={i} className={i===index?"active":i<index?"done":""}/>)}</div>
          <button className="tour-next" onClick={next} disabled={animating}>{index===slides.length-1?"App öffnen":"Weiter"}<ChevronRight/></button>
        </footer>
      </>}
      {finale&&<div className="tour-finale"><div className="tour-smoke smoke-a"/><div className="tour-smoke smoke-b"/><div className="tour-leaves">{Array.from({length:24},(_,i)=><span key={i} style={{left:`${(i*41)%100}%`,animationDelay:`${(i%8)*.16}s`}}>🌿</span>)}</div><div className="tour-bus">🚌</div><div className="tour-finale-copy"><Flame/><h2>Firestarter 2026</h2><p>Alles bereit. Die Tour kann beginnen.</p><button className="primary-button" onClick={close}>Los geht’s</button></div><div className="tour-gates gate-left"/><div className="tour-gates gate-right"/></div>}
    </div>,document.body
  );
}

function TourVisual({kind}:{kind:SlideKind}){
  if(kind==="welcome")return <div className="tour-brand-visual"><div className="tour-brand-ring"><img src="/api/branding/icon" alt=""/></div><strong>FIRESTARTER 26</strong><span>Bachelortour 2026</span></div>;
  if(kind==="home")return <div className="tour-phone-preview home-preview"><div className="preview-hero"><span>DER COUNTDOWN LÄUFT</span><strong>Bachelortour 2026</strong><div><b>1</b> Tag&nbsp;&nbsp; <b>14</b> Std.</div></div><div className="preview-grid"><i>👥</i><i>📸</i><i>💬</i><i>🔊</i></div><div className="preview-row"><span>🌦️ 22 °C</span><span>🌿 0.0</span></div></div>;
  if(kind==="map")return <div className="tour-phone-preview map-preview"><div className="fake-map"><span className="road r1"/><span className="road r2"/><i className="pin p1">🔥</i><i className="pin p2">😎</i><i className="pin p3">🥴</i></div><div className="map-search">In deiner Nähe suchen …</div></div>;
  if(kind==="chat")return <div className="tour-phone-preview chat-preview"><div className="bubble left">Wo treffen wir uns? 🍻</div><div className="bubble right">Am Bus um 18 Uhr 🔥</div><div className="bubble left image-bubble">📸</div><div className="chat-input">Nachricht schreiben … <b>➤</b></div></div>;
  if(kind==="gallery")return <div className="tour-phone-preview gallery-preview"><div>🔥</div><div>🚌</div><div>🍻</div><div>🎉</div><div>🌿</div><div>📸</div></div>;
  if(kind==="members")return <div className="tour-phone-preview members-preview"><div><span>😎</span><b>Dennis</b><small>🥴 Total breit</small></div><div><span>😁</span><b>Kevin</b><small>🍻 Beim Saufen</small></div><div><span>😴</span><b>Antonio</b><small>😴 Beim Schlafen</small></div></div>;
  return <div className="tour-phone-preview profile-preview"><div className="profile-avatar">😎</div><strong>Dein Profil</strong><div className="status-options"><i>😁</i><i>🍻</i><i>🥴</i><i>🕺</i><i>😴</i><i>🆘</i></div><div className="profile-setting"><BellRing size={20}/><span><b>Push-Nachrichten</b><small>Aktiv</small></span><i/></div></div>;
}
