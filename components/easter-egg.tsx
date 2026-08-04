"use client";

import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type EasterEggProps={open:boolean;onClose:()=>void};

export function EasterEgg({open,onClose}:EasterEggProps){
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const leaves=useMemo(()=>Array.from({length:32},(_,i)=>({
    id:i,left:(i*37)%100,delay:(i%9)*.16,duration:4.8+(i%7)*.55,size:30+(i%6)*10,drift:-60+(i%5)*30,rotate:(i%2?1:-1)*(180+(i%8)*50)
  })),[]);

  useEffect(()=>{
    if(!open)return;
    const audio=new Audio("/easter-egg.mp3");
    audioRef.current=audio;
    audio.volume=.95;
    audio.play().catch(()=>{});
    const timer=window.setTimeout(onClose,20000);
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};
    document.body.classList.add("easter-egg-open");
    document.addEventListener("keydown",key);
    return()=>{window.clearTimeout(timer);document.removeEventListener("keydown",key);document.body.classList.remove("easter-egg-open");audio.pause();audio.currentTime=0;audioRef.current=null};
  },[open,onClose]);

  if(!open||typeof document==="undefined")return null;
  return createPortal(<div className="easter-overlay" role="dialog" aria-modal="true" aria-label="Firestarter Easter Egg">
    <div className="easter-neon easter-neon-a"/><div className="easter-neon easter-neon-b"/><div className="easter-smoke smoke-a"/><div className="easter-smoke smoke-b"/>
    <button className="easter-close" onClick={onClose} aria-label="Schließen"><X/></button>
    <div className="easter-title"><span>🔥 FIRESTARTER-MODUS 🔥</span><strong>BACHELORTOUR 2026</strong><small>GEHEIMES LEVEL FREIGESCHALTET</small></div>
    <div className="easter-leaves">{leaves.map(leaf=><span key={leaf.id} className="easter-leaf" style={{left:`${leaf.left}%`,animationDelay:`${leaf.delay}s`,animationDuration:`${leaf.duration}s`,fontSize:`${leaf.size}px`,"--drift":`${leaf.drift}px`,"--spin":`${leaf.rotate}deg`} as React.CSSProperties}>🌿</span>)}</div>
    <div className="easter-progress"><span/></div>
  </div>,document.body);
}
