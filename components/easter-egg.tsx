"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type EasterEggProps={open:boolean;onClose:()=>void;audio?:HTMLAudioElement|null};

export function EasterEgg({open,onClose,audio}:EasterEggProps){
  const fallbackAudioRef=useRef<HTMLAudioElement|null>(null);
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const onCloseRef=useRef(onClose);
  const [remaining,setRemaining]=useState(20);

  useEffect(()=>{onCloseRef.current=onClose},[onClose]);

  useEffect(()=>{
    if(!open)return;
    setRemaining(20);

    const soundtrack=audio??new Audio("/easter-egg.mp3");
    if(!audio){
      soundtrack.preload="auto";
      soundtrack.volume=.95;
      soundtrack.currentTime=0;
      fallbackAudioRef.current=soundtrack;
      soundtrack.play().catch(()=>{});
    }

    const video=videoRef.current;
    if(video){
      try{video.currentTime=soundtrack.currentTime||0}catch{}
      video.muted=true;
      video.volume=0;
      video.play().catch(()=>{});
    }

    const syncToSoundtrack=()=>{
      if(!video||soundtrack.paused)return;
      const drift=Math.abs(video.currentTime-soundtrack.currentTime);
      if(drift>.25){try{video.currentTime=soundtrack.currentTime}catch{}}
      if(video.paused)video.play().catch(()=>{});
    };
    const syncTimer=window.setInterval(syncToSoundtrack,750);
    const timer=window.setTimeout(()=>onCloseRef.current(),20000);
    const counter=window.setInterval(()=>setRemaining(value=>Math.max(0,value-1)),1000);
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape")onCloseRef.current()};
    document.body.classList.add("easter-egg-open");
    document.addEventListener("keydown",key);

    return()=>{
      window.clearInterval(syncTimer);
      window.clearTimeout(timer);
      window.clearInterval(counter);
      document.removeEventListener("keydown",key);
      document.body.classList.remove("easter-egg-open");
      soundtrack.pause();
      try{soundtrack.currentTime=0}catch{}
      fallbackAudioRef.current=null;
      if(video){video.pause();try{video.currentTime=0}catch{}}
    };
  },[open,audio]);

  if(!open||typeof document==="undefined")return null;

  return createPortal(
    <div className="easter-overlay easter-video-mode" role="dialog" aria-modal="true" aria-label="Firestarter 2026 Easter Egg">
      <video ref={videoRef} className="easter-video easter-video-foreground" src="/easter-egg.mp4" muted playsInline preload="auto" aria-hidden="true"/>
      <div className="easter-video-vignette"/>
      <div className="easter-smoke smoke-a"/><div className="easter-smoke smoke-b"/>
      <div className="easter-embers" aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{left:`${(i*37)%100}%`,animationDelay:`${(i%8)*.22}s`,animationDuration:`${3.6+(i%5)*.7}s`}}/>)}</div>
      <button className="easter-close" onClick={()=>onCloseRef.current()} aria-label="Schließen"><X/></button>
      <div className="easter-footer"><div className="easter-progress"><span/></div><strong>0:{String(remaining).padStart(2,"0")}</strong></div>
    </div>,
    document.body
  );
}
