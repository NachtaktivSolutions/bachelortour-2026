"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Headphones, Pause, Play, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type TourSound={id:string;title:string;category:string;description:string|null;storage_path:string;duration_seconds:number|null;sort_order:number};

export function SoundboardModal({open,onClose}:{open:boolean;onClose:()=>void}){
  const [sounds,setSounds]=useState<TourSound[]>([]);
  const [loading,setLoading]=useState(false);
  const [activeId,setActiveId]=useState<string|null>(null);
  const [isPlaying,setIsPlaying]=useState(false);
  const [progress,setProgress]=useState(0);
  const [duration,setDuration]=useState(0);
  const [error,setError]=useState("");
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const onCloseRef=useRef(onClose);
  const supabase=useMemo(()=>createClient(),[]);

  useEffect(()=>{onCloseRef.current=onClose},[onClose]);

  const stop=useCallback(()=>{
    const audio=audioRef.current;
    if(audio){audio.pause();audio.removeAttribute("src");audio.load();audioRef.current=null}
    setActiveId(null);setIsPlaying(false);setProgress(0);setDuration(0);
  },[]);

  const loadSounds=useCallback(async()=>{
    const {data,error:loadError}=await supabase.from("tour_sounds").select("id,title,category,description,storage_path,duration_seconds,sort_order").eq("is_visible",true).order("category").order("sort_order").order("created_at");
    if(loadError)setError(loadError.message);else setSounds((data as TourSound[])??[]);
  },[supabase]);

  useEffect(()=>{
    if(!open)return;
    let active=true;
    setLoading(true);setError("");
    loadSounds().finally(()=>{if(active)setLoading(false)});
    document.body.classList.add("soundboard-open");
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape")onCloseRef.current()};
    document.addEventListener("keydown",key);
    const channel=supabase.channel("public-soundboard-live").on("postgres_changes",{event:"*",schema:"public",table:"tour_sounds"},()=>{loadSounds()}).subscribe();
    return()=>{
      active=false;
      document.removeEventListener("keydown",key);
      document.body.classList.remove("soundboard-open");
      supabase.removeChannel(channel);
      stop();
    };
  },[open,loadSounds,stop,supabase]);

  async function play(sound:TourSound){
    const current=audioRef.current;
    if(activeId===sound.id&&current){
      if(current.paused){
        try{await current.play();setIsPlaying(true);setError("")}catch{setError("Sound konnte nicht gestartet werden.")}
      }else{current.pause();setIsPlaying(false)}
      return;
    }

    stop();setError("");
    const {data,error:signedError}=await supabase.storage.from("tour-sounds").createSignedUrl(sound.storage_path,3600);
    if(signedError||!data?.signedUrl){setError("Sound konnte nicht geladen werden.");return}

    const audio=new Audio();
    audio.preload="auto";
    audio.src=data.signedUrl;
    audioRef.current=audio;
    setActiveId(sound.id);
    setDuration(sound.duration_seconds||0);
    audio.ontimeupdate=()=>{if(audioRef.current!==audio)return;setProgress(audio.currentTime);setDuration(audio.duration||sound.duration_seconds||0)};
    audio.onloadedmetadata=()=>{if(audioRef.current===audio)setDuration(audio.duration||sound.duration_seconds||0)};
    audio.onplay=()=>{if(audioRef.current===audio)setIsPlaying(true)};
    audio.onpause=()=>{if(audioRef.current===audio)setIsPlaying(false)};
    audio.onended=stop;
    audio.onerror=()=>{if(audioRef.current===audio){setError("Sound konnte nicht abgespielt werden.");stop()}};
    try{await audio.play()}catch{setError("Sound konnte nicht gestartet werden.");stop()}
  }

  if(!open||typeof document==="undefined")return null;
  const categories=Array.from(new Set(sounds.map(sound=>sound.category)));
  return createPortal(<div className="soundboard-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget)onCloseRef.current()}}><section className="soundboard-modal" role="dialog" aria-modal="true" aria-label="Tour-Sounds"><header className="soundboard-header"><div><span className="eyebrow">DIE BESTEN MOMENTE</span><h2><Headphones/> Tour-Sounds</h2><p>Sounds aus dieser und früheren Touren.</p></div><button type="button" className="soundboard-close" onClick={()=>onCloseRef.current()} aria-label="Schließen"><X/></button></header>{error&&<div className="error">{error}</div>}<div className="soundboard-scroll">{loading?<div className="empty-card">Sounds werden geladen …</div>:!sounds.length?<div className="empty-card">Noch keine Sounds freigeschaltet.</div>:categories.map(category=><section className="sound-category" key={category}><h3>{category}</h3><div className="sound-list">{sounds.filter(sound=>sound.category===category).map(sound=>{const active=activeId===sound.id;const playing=active&&isPlaying;const total=active?duration:(sound.duration_seconds||0);return <article className={`sound-row ${active?"active":""}`} key={sound.id}><button type="button" className="sound-play" onClick={()=>play(sound)} aria-label={`${sound.title} ${playing?"pausieren":"abspielen"}`}>{playing?<Pause/>:<Play/>}</button><div className="sound-copy"><strong>{sound.title}</strong>{sound.description&&<small>{sound.description}</small>}<div className="sound-progress"><span style={{width:active&&total?`${Math.min(100,progress/total*100)}%`:"0%"}}/></div></div><time>{formatTime(active?progress:total)}</time></article>})}</div></section>)}</div></section></div>,document.body)
}

function formatTime(seconds:number){if(!Number.isFinite(seconds)||seconds<=0)return "–:––";const minutes=Math.floor(seconds/60);return `${minutes}:${String(Math.floor(seconds%60)).padStart(2,"0")}`}
