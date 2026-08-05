"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "./app-provider";

type RatingRow={id:string;user_id:string;rating:number;hour_bucket:string;created_at:string};

export function TourRatingCard(){
  const {profile}=useApp();
  const supabase=createClient();
  const [ratings,setRatings]=useState<RatingRow[]>([]);
  const [open,setOpen]=useState(false);
  const [selected,setSelected]=useState(0);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [mounted,setMounted]=useState(false);

  const load=useCallback(async()=>{
    const {data}=await supabase.from("tour_ratings").select("*").order("created_at",{ascending:false});
    setRatings((data as RatingRow[])??[]);
  },[supabase]);

  useEffect(()=>{setMounted(true);load();const channel=supabase.channel("tour-ratings-live").on("postgres_changes",{event:"*",schema:"public",table:"tour_ratings"},load).subscribe();return()=>{supabase.removeChannel(channel)}},[load,supabase]);

  const average=useMemo(()=>ratings.length?ratings.reduce((sum,item)=>sum+item.rating,0)/ratings.length:0,[ratings]);
  const fill=average<=0?0:Math.min(100,(average/5)*100);
  const hourKey=new Date();hourKey.setMinutes(0,0,0);
  const alreadyRated=ratings.some(item=>item.user_id===profile?.id&&new Date(item.hour_bucket).getTime()===hourKey.getTime());

  async function submit(){
    if(!profile||alreadyRated||saving)return;
    setSaving(true);setMessage("");
    const {error}=await supabase.from("tour_ratings").insert({user_id:profile.id,rating:selected,hour_bucket:hourKey.toISOString()});
    if(error)setMessage(error.code==="23505"?"Du hast in dieser Stunde bereits bewertet.":error.message);else{setMessage("Bewertung gespeichert.");await load()}
    setSaving(false);
  }

  async function reset(){
    if(!profile?.is_admin||!confirm("Alle Tourbewertungen wirklich auf 0 zurücksetzen?"))return;
    setSaving(true);setMessage("");
    const {error}=await supabase.rpc("reset_tour_ratings");
    if(error){setMessage(error.message)}else{setRatings([]);setSelected(0);setMessage("Bewertung wurde auf 0 zurückgesetzt.");await load()}
    setSaving(false);
  }

  const modal=open&&mounted?createPortal(<div className="tour-rating-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}><section className="tour-rating-modal" role="dialog" aria-modal="true" aria-label="Tour bewerten"><button className="tour-rating-close" onClick={()=>setOpen(false)} aria-label="Schließen"><X/></button><span className="eyebrow">STIMMUNGSBAROMETER</span><h2>Wie läuft die Tour?</h2><p>Du kannst einmal pro Stunde eine Bewertung von −5 bis +5 abgeben.</p><div className="tour-rating-big-leaf"><RatingLeaf fill={fill}/><strong>{average.toFixed(1)}</strong><small>Durchschnitt · {ratings.length} Bewertungen</small></div><div className="rating-scale">{Array.from({length:11},(_,i)=>i-5).map(value=><button key={value} className={selected===value?"active":""} onClick={()=>setSelected(value)}><b>{value>0?`+${value}`:value}</b></button>)}</div><div className="rating-scale-labels"><span>Katastrophe</span><span>Legendär</span></div><button className="primary-button rating-submit" disabled={alreadyRated||saving} onClick={submit}>{alreadyRated?"Diese Stunde bereits bewertet":saving?"Speichert …":"Bewertung abgeben"}</button>{profile?.is_admin&&<button className="secondary-button rating-reset" disabled={saving} onClick={reset}><RotateCcw/> Bewertung auf 0 setzen</button>}{message&&<div className="status">{message}</div>}</section></div>,document.body):null;

  return <><button className="tour-rating-card" onClick={()=>setOpen(true)}><div className="rating-card-copy"><span className="eyebrow">TOURBEWERTUNG</span><strong>{ratings.length?average.toFixed(1):"0.0"}</strong><small>{alreadyRated?"Nächste Bewertung zur vollen Stunde":"Jetzt bewerten"}</small></div><div className="rating-card-leaf"><RatingLeaf fill={fill}/></div></button>{modal}</>;
}

function RatingLeaf({fill}:{fill:number}){
  const uid=useId().replace(/:/g,"");
  const gradientId=`leafFill-${uid}`;
  const clipId=`leafClip-${uid}`;
  const path="M60 132C57 103 57 86 58 68C49 89 36 105 20 112C25 92 34 76 48 61C32 72 18 77 4 75C15 58 30 48 49 43C34 43 23 38 14 29C31 25 45 28 56 37C53 21 55 9 60 2C66 13 68 25 65 39C76 29 90 26 106 30C97 40 86 45 72 45C91 51 105 62 116 79C100 80 85 75 72 65C85 80 94 97 99 116C82 108 70 94 62 75C63 94 64 112 65 132Z";
  return <svg className={`rating-leaf${fill===0?" is-empty":""}`} viewBox="0 0 120 140" aria-hidden="true"><defs><linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#0b7f3d"/><stop offset=".55" stopColor="#20e36d"/><stop offset="1" stopColor="#a6ff74"/></linearGradient><clipPath id={clipId}><path d={path}/></clipPath></defs><path className="leaf-outline" d={path}/>{fill>0&&<rect x="0" y={140-(140*fill/100)} width="120" height={140*fill/100} fill={`url(#${gradientId})`} clipPath={`url(#${clipId})`}/>}<path className="leaf-vein" d="M60 126L60 20M60 58L30 93M61 61L91 98M58 47L29 57M63 49L91 59"/></svg>;
}
