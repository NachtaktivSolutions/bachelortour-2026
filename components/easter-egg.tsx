"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type EasterEggProps={open:boolean;onClose:()=>void};

export function EasterEgg({open,onClose}:EasterEggProps){
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const backgroundVideoRef=useRef<HTMLVideoElement|null>(null);
  const [remaining,setRemaining]=useState(20);

  useEffect(()=>{
    if(!open)return;
    setRemaining(20);

    const audio=new Audio("/easter-egg.mp3");
    audio.preload="auto";
    audio.volume=.95;
    audio.currentTime=0;
    audioRef.current=audio;

    const videos=[backgroundVideoRef.current,videoRef.current].filter(Boolean) as HTMLVideoElement[];
    videos.forEach(video=>{
      video.currentTime=0;
      video.muted=true;
      video.volume=0;
      video.play().catch(()=>{});
    });
    audio.play().catch(()=>{});

    const timer=window.setTimeout(onClose,20000);
    const counter=window.setInterval(()=>setRemaining(value=>Math.max(0,value-1)),1000);
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};
    document.body.classList.add("easter-egg-open");
    document.addEventListener("keydown",key);

    return()=>{
      window.clearTimeout(timer);
      window.clearInterval(counter);
      document.removeEventListener("keydown",key);
      document.body.classList.remove("easter-egg-open");
      audio.pause();
      audio.currentTime=0;
      audioRef.current=null;
      videos.forEach(video=>{video.pause();video.currentTime=0;});
    };
  },[open,onClose]);

  if(!open||typeof document==="undefined")return null;

  return createPortal(
    <div className="easter-overlay easter-video-mode" role="dialog" aria-modal="true" aria-label="Firestarter 2026 Easter Egg">
      <video ref={backgroundVideoRef} className="easter-video easter-video-background" src="/easter-egg.mp4" muted playsInline preload="auto" aria-hidden="true"/>
      <video ref={videoRef} className="easter-video easter-video-foreground" src="/easter-egg.mp4" muted playsInline preload="auto" aria-hidden="true"/>
      <div className="easter-video-vignette"/>
      <div className="easter-smoke smoke-a"/><div className="easter-smoke smoke-b"/>
      <div className="easter-embers" aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{left:`${(i*37)%100}%`,animationDelay:`${(i%8)*.22}s`,animationDuration:`${3.6+(i%5)*.7}s`}}/>)}</div>
      <button className="easter-close" onClick={onClose} aria-label="Schließen"><X/></button>
      <div className="easter-footer"><div className="easter-progress"><span/></div><strong>0:{String(remaining).padStart(2,"0")}</strong></div>
    </div>,
    document.body
  );
}
