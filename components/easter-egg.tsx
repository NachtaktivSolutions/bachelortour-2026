"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type EasterEggProps={open:boolean;onClose:()=>void};
type LeafData={id:number;left:number;delay:number;duration:number;size:number;drift:number;rotate:number;hue:number;blur:number};

function CannabisLeaf({className=""}:{className?:string}){
  return <svg className={className} viewBox="0 0 120 150" aria-hidden="true">
    <g fill="currentColor">
      <path d="M60 8C49 34 48 56 60 84C72 56 71 34 60 8Z"/>
      <path d="M54 79C39 49 23 32 8 25C15 53 28 73 51 91Z"/>
      <path d="M67 79C82 49 97 32 112 25C106 53 93 73 70 91Z"/>
      <path d="M49 88C28 68 9 61 0 61C15 82 30 94 50 101Z"/>
      <path d="M71 88C92 68 111 61 120 61C105 82 90 94 70 101Z"/>
      <path d="M48 99C25 93 10 96 3 103C21 112 36 113 52 108Z"/>
      <path d="M72 99C95 93 110 96 117 103C99 112 84 113 68 108Z"/>
      <path d="M56 104L60 142L64 104Z"/>
    </g>
  </svg>;
}

export function EasterEgg({open,onClose}:EasterEggProps){
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const [remaining,setRemaining]=useState(20);
  const leaves=useMemo<LeafData[]>(()=>Array.from({length:38},(_,i)=>({
    id:i,left:(i*29)%101,delay:(i%11)*.13,duration:5.2+(i%8)*.48,size:34+(i%7)*12,drift:-85+(i%7)*28,rotate:(i%2?1:-1)*(220+(i%9)*47),hue:i%3,blur:i%9===0?2:0
  })),[]);
  const sparks=useMemo(()=>Array.from({length:44},(_,i)=>({id:i,left:(i*41)%100,top:(i*67)%100,delay:(i%13)*.12,size:2+(i%4)})),[]);

  useEffect(()=>{
    if(!open)return;
    setRemaining(20);
    const audio=new Audio("/easter-egg.mp3");
    audioRef.current=audio;
    audio.volume=.95;
    audio.play().catch(()=>{});
    const timer=window.setTimeout(onClose,20000);
    const counter=window.setInterval(()=>setRemaining(value=>Math.max(0,value-1)),1000);
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};
    document.body.classList.add("easter-egg-open");
    document.addEventListener("keydown",key);
    return()=>{window.clearTimeout(timer);window.clearInterval(counter);document.removeEventListener("keydown",key);document.body.classList.remove("easter-egg-open");audio.pause();audio.currentTime=0;audioRef.current=null};
  },[open,onClose]);

  if(!open||typeof document==="undefined")return null;
  return createPortal(<div className="easter-overlay" role="dialog" aria-modal="true" aria-label="Firestarter Easter Egg">
    <div className="easter-rasta-frame"/>
    <div className="easter-neon easter-neon-green"/><div className="easter-neon easter-neon-yellow"/><div className="easter-neon easter-neon-red"/>
    <div className="easter-smoke smoke-green"/><div className="easter-smoke smoke-gold"/><div className="easter-smoke smoke-red"/>
    <div className="easter-sparks">{sparks.map(spark=><i key={spark.id} style={{left:`${spark.left}%`,top:`${spark.top}%`,animationDelay:`${spark.delay}s`,width:spark.size,height:spark.size}}/>)}</div>
    <button className="easter-close" onClick={onClose} aria-label="Schließen"><X/></button>
    <div className="easter-hero-leaf"><CannabisLeaf/></div>
    <div className="easter-title">
      <span>🔥 RASTA FIRE MODE 🔥</span>
      <strong><b>FIRESTARTER</b><b>2026</b></strong>
      <small>AKTIVIERT!</small>
      <div className="easter-lion" aria-hidden="true">🦁</div>
    </div>
    <div className="easter-leaves">{leaves.map(leaf=><span key={leaf.id} className={`easter-leaf hue-${leaf.hue}`} style={{left:`${leaf.left}%`,animationDelay:`${leaf.delay}s`,animationDuration:`${leaf.duration}s`,width:`${leaf.size}px`,height:`${leaf.size*1.25}px`,filter:`blur(${leaf.blur}px) drop-shadow(0 0 12px currentColor)`,"--drift":`${leaf.drift}px`,"--spin":`${leaf.rotate}deg`} as React.CSSProperties}><CannabisLeaf/></span>)}</div>
    <div className="easter-footer"><div className="easter-progress"><span/></div><strong>0:{String(remaining).padStart(2,"0")}</strong><small>Lass es brennen!</small></div>
  </div>,document.body);
}
